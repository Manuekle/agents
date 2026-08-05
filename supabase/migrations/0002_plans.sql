-- agents.dev — plan limits.
-- Run after 0001_agents.sql.

-- --------------------------------------------------------------- ai_usage --
-- One row per user per calendar month. Counting rows in a log table would be
-- honest too, but this is read on every draft and a counter keeps that O(1).
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  month   date not null,          -- always the first of the month
  drafts  integer not null default 0,
  primary key (user_id, month)
);

alter table public.ai_usage enable row level security;

-- Readable by its owner so the UI can show "7 of 10 used". Deliberately no
-- insert/update policy: the only writer is the security-definer function
-- below, so a user cannot reset their own counter to zero.
drop policy if exists "ai_usage: owner reads" on public.ai_usage;
create policy "ai_usage: owner reads"
  on public.ai_usage for select using (auth.uid() = user_id);

-- ------------------------------------------------------------ plan limits --
-- Kept in SQL as well as in lib/plans.ts because the database is the only
-- place a limit cannot be skipped: PostgREST is reachable directly with the
-- anon key, so a check that lives only in the app is a suggestion.
create or replace function public.plan_agent_limit(p text)
returns integer language sql immutable as $$
  select case p when 'free' then 3 when 'pro' then 25 else null end;
$$;

create or replace function public.plan_draft_limit(p text)
returns integer language sql immutable as $$
  select case p when 'free' then 10 when 'pro' then 200 else null end;
$$;

-- ------------------------------------------------------- agent cap trigger --
create or replace function public.enforce_agent_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap   integer;
  used  integer;
begin
  select plan_agent_limit(plan) into cap from public.profiles where id = new.user_id;
  if cap is null then
    return new;  -- max, or no profile row yet
  end if;

  -- Updates to an existing agent must not count as a new one, so the row
  -- being written is excluded from the tally.
  select count(*) into used
    from public.agents
   where user_id = new.user_id and id <> new.id;

  if used >= cap then
    raise exception 'agent limit reached for this plan (%).', cap
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists agents_enforce_limit on public.agents;
create trigger agents_enforce_limit
  before insert on public.agents
  for each row execute function public.enforce_agent_limit();

-- ------------------------------------------------------ draft quota usage --
-- Returns true when the draft is allowed and has been counted, false when the
-- user is out of quota. Doing the check and the increment in one statement is
-- what stops two concurrent drafts both seeing the last remaining slot.
create or replace function public.consume_ai_draft()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  cap   integer;
  used  integer;
begin
  if uid is null then
    return false;
  end if;

  select plan_draft_limit(plan) into cap from public.profiles where id = uid;

  insert into public.ai_usage (user_id, month, drafts)
       values (uid, date_trunc('month', now())::date, 1)
  on conflict (user_id, month)
    do update set drafts = public.ai_usage.drafts + 1
  returning drafts into used;

  if cap is not null and used > cap then
    -- Put the increment back: the draft is being refused, so it must not
    -- burn a slot the user never got the benefit of.
    update public.ai_usage
       set drafts = drafts - 1
     where user_id = uid and month = date_trunc('month', now())::date;
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.consume_ai_draft() from public;
grant execute on function public.consume_ai_draft() to authenticated;
