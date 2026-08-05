-- agents.dev — accounts and saved agents.
-- Run once against your Supabase project (SQL Editor, or `supabase db push`).

-- ---------------------------------------------------------------- profiles --
-- One row per auth user. Exists to hold the plan: auth.users is managed by
-- Supabase and application columns do not belong on it.
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  plan       text not null default 'free' check (plan in ('free', 'pro', 'max')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Readable and updatable only by its owner. Note there is no insert policy and
-- no update path to `plan` for users — see the trigger and the note below.
drop policy if exists "profiles: owner reads" on public.profiles;
create policy "profiles: owner reads"
  on public.profiles for select
  using (auth.uid() = id);

-- A profile is created by trigger, never by the client, so that signing up
-- cannot be used to self-assign a plan.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed in before this migration ran.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ------------------------------------------------------------------ agents --
-- `id` stays the client-generated string so an agent keeps its identity when it
-- moves from localStorage into an account, and so /build?id= keeps working.
-- The key is composite because that id is only unique per user: two accounts
-- generating one in the same millisecond would otherwise collide.
create table if not exists public.agents (
  user_id       uuid not null references auth.users on delete cascade,
  id            text not null,
  name          text not null,
  role          text not null default '',
  system_prompt text not null default '',
  target        text not null,
  model         text not null,
  temperature   real not null default 0.7,
  skills        jsonb not null default '[]'::jsonb,
  mascot        text not null default 'working',
  accent        text not null default '#f95c4b',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists agents_user_created_idx
  on public.agents (user_id, created_at desc);

alter table public.agents enable row level security;

-- Four explicit policies rather than one `for all`: it keeps the read path
-- readable next to the write path, and makes it obvious that `with check` (not
-- just `using`) guards inserts and updates — without it a user could write a
-- row owned by someone else.
drop policy if exists "agents: owner reads" on public.agents;
create policy "agents: owner reads"
  on public.agents for select using (auth.uid() = user_id);

drop policy if exists "agents: owner inserts" on public.agents;
create policy "agents: owner inserts"
  on public.agents for insert with check (auth.uid() = user_id);

drop policy if exists "agents: owner updates" on public.agents;
create policy "agents: owner updates"
  on public.agents for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "agents: owner deletes" on public.agents;
create policy "agents: owner deletes"
  on public.agents for delete using (auth.uid() = user_id);

-- Keep updated_at honest without trusting the client to send it.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agents_touch_updated_at on public.agents;
create trigger agents_touch_updated_at
  before update on public.agents
  for each row execute function public.touch_updated_at();

-- Note on plans: `plan` is deliberately not writable by the client. Nothing
-- here grants an update policy on profiles, so the only way it changes is via
-- the service role — i.e. a billing webhook. Enforcing the per-plan agent cap
-- belongs next to that, in a later migration.
