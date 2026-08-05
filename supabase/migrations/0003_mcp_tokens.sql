-- agents.dev — API tokens so the MCP server can fetch an agent from an account.
-- Run after 0002_plans.sql.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------ api_tokens --
-- Only the SHA-256 of the token is stored. A leaked database dump then gives
-- an attacker hashes, not working credentials, and there is no way for us to
-- show a token again after it is created — which is why `prefix` exists.
create table if not exists public.api_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null default 'MCP token',
  token_hash text not null unique,
  prefix     text not null,          -- first 10 chars, for telling tokens apart
  created_at timestamptz not null default now(),
  last_used  timestamptz
);

create index if not exists api_tokens_user_idx on public.api_tokens (user_id, created_at desc);

alter table public.api_tokens enable row level security;

-- Owners can list and revoke. There is no insert policy: tokens are minted by
-- the function below, which is what guarantees the plaintext is hashed and
-- never round-trips through the client.
drop policy if exists "api_tokens: owner reads" on public.api_tokens;
create policy "api_tokens: owner reads"
  on public.api_tokens for select using (auth.uid() = user_id);

drop policy if exists "api_tokens: owner deletes" on public.api_tokens;
create policy "api_tokens: owner deletes"
  on public.api_tokens for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------- minting --
create or replace function public.create_api_token(token_name text default 'MCP token')
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid   uuid := auth.uid();
  raw   text;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  -- 256 bits from pgcrypto, base64 with the URL-hostile characters removed so
  -- the token survives being pasted into a shell argument or a JSON config.
  raw := 'adv_' || translate(encode(gen_random_bytes(32), 'base64'), '+/=', 'xyz');

  insert into public.api_tokens (user_id, name, token_hash, prefix)
  values (uid, coalesce(nullif(token_name, ''), 'MCP token'),
          encode(digest(raw, 'sha256'), 'hex'), left(raw, 10));

  -- The only time the plaintext exists outside the caller's machine.
  return raw;
end;
$$;

revoke all on function public.create_api_token(text) from public;
grant execute on function public.create_api_token(text) to authenticated;

-- -------------------------------------------------------------- resolving --
-- Looks a token up by hash and reports who it belongs to and on what plan.
--
-- Deliberately callable with the anon key rather than requiring a service_role
-- key in the deployment: the caller must already hold the 256-bit token, so
-- this grants nothing that the token itself does not, while a service_role key
-- would hand the server permission to do everything to every table. Least
-- privilege, and one fewer secret to leak.
create or replace function public.resolve_api_token(raw_token text)
returns table (user_id uuid, plan text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h text := encode(digest(raw_token, 'sha256'), 'hex');
begin
  update public.api_tokens set last_used = now() where token_hash = h;

  return query
    select t.user_id, p.plan
      from public.api_tokens t
      join public.profiles p on p.id = t.user_id
     where t.token_hash = h;
end;
$$;

revoke all on function public.resolve_api_token(text) from public;
grant execute on function public.resolve_api_token(text) to anon, authenticated;

-- ------------------------------------------------------- agent for a token --
-- Returns one agent belonging to the token's owner. Kept as a function so the
-- lookup and the ownership check cannot drift apart in application code.
create or replace function public.agent_for_token(raw_token text, agent_id text)
returns table (
  id text, name text, role text, system_prompt text,
  target text, model text, temperature real, skills jsonb
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h   text := encode(digest(raw_token, 'sha256'), 'hex');
  uid uuid;
begin
  select t.user_id into uid from public.api_tokens t where t.token_hash = h;
  if uid is null then
    return;  -- unknown token: no rows, and no hint about why
  end if;

  update public.api_tokens set last_used = now() where token_hash = h;

  return query
    select a.id, a.name, a.role, a.system_prompt,
           a.target, a.model, a.temperature, a.skills
      from public.agents a
     where a.user_id = uid
       and (agent_id is null or a.id = agent_id)
     order by a.created_at desc
     limit 1;
end;
$$;

revoke all on function public.agent_for_token(text, text) from public;
grant execute on function public.agent_for_token(text, text) to anon, authenticated;
