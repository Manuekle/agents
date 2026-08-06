-- creagent — plan sync from Polar subscription webhooks.
-- Run after 0004_agent_graph.sql.

-- ---------------------------------------------------------------- app_config
-- A one-row-per-key table for secrets the database itself must check, as
-- opposed to secrets an application env var holds. There is exactly one row
-- in it today: the value the webhook route proves it holds before this
-- migration's function will touch anyone's plan.
--
-- No RLS policies at all — not "owner reads", none. The only way to reach
-- this table through PostgREST is via a security-definer function, and a
-- table with zero policies denies every request that arrives through the
-- anon or authenticated role, which is exactly the point: this is not data
-- an account owns, it is a secret the *server* holds.
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

alter table public.app_config enable row level security;

-- Set the actual secret by hand, once, from the SQL editor — never in a
-- migration file, which is committed to git:
--
--   insert into public.app_config (key, value) values
--     ('plan_sync_secret', '<a long random string>')
--   on conflict (key) do update set value = excluded.value;
--
-- The same string is set as PLAN_SYNC_SECRET on the Next.js deploy
-- (app/api/billing/webhook/route.ts), which is the only caller that should
-- ever know it.

-- ------------------------------------------------------------ apply_polar_plan
-- Moves an account onto a plan by user id, proving the caller holds the
-- shared secret rather than proving it holds a user's session — a Polar
-- webhook has no session to hold. This is the same trade the MCP token
-- functions make (see 0003_mcp_tokens.sql): the anon key is grantable here
-- because the secret argument is the actual gate, not the key.
--
-- profiles has deliberately no user update path to `plan` (0001_agents.sql):
-- this function is the other write path, alongside the trigger that creates
-- the row in the first place.
create or replace function public.apply_polar_plan(
  p_user_id uuid,
  p_plan text,
  p_secret text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expected text;
begin
  select value into expected from public.app_config where key = 'plan_sync_secret';

  if expected is null then
    raise exception 'plan_sync_secret is not set — see 0005_polar_billing.sql';
  end if;

  if p_secret is distinct from expected then
    raise exception 'invalid plan sync secret';
  end if;

  if p_plan not in ('free', 'pro', 'max') then
    raise exception 'invalid plan %', p_plan;
  end if;

  update public.profiles set plan = p_plan where id = p_user_id;
end;
$$;

revoke all on function public.apply_polar_plan(uuid, text, text) from public;
grant execute on function public.apply_polar_plan(uuid, text, text) to anon, authenticated;
