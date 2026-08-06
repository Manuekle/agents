-- creagent — the composer's canvas.
--
-- An agent is no longer one prompt with a flat list of picks: it is an
-- orchestrator that can delegate to subagents, each carrying its own
-- components. That structure lives here as one jsonb document.
--
-- `skills` stays exactly as it was. Every installer, the manifest and the
-- share payload only ever ask "what do I install", and none of them should
-- have to walk a tree to answer. The graph is additive; a row with a null
-- graph is a pre-canvas agent and the client builds one from `skills` on
-- first open, so no backfill is needed and no old client breaks.

alter table public.agents
  add column if not exists graph jsonb;

comment on column public.agents.graph is
  'Orchestrator/subagent canvas: { nodes: [...], edges: [...] }. Null means '
  'the agent predates the canvas; the client derives one from skills.';

-- A graph is a document, not a relation: it is always read whole, always
-- written whole, and never queried by its innards. The one constraint worth
-- enforcing in the database is that it is an object when it is present —
-- a bare array or a string would crash the client's normalizer before it
-- could fall back.
alter table public.agents
  drop constraint if exists agents_graph_is_object;

alter table public.agents
  add constraint agents_graph_is_object
  check (graph is null or jsonb_typeof(graph) = 'object');

-- The MCP endpoint serves an agent to a CLI over a bearer token. It reads
-- through agent_for_token, which is a security-definer function with a fixed
-- column list — so it has to learn about the new column explicitly, or a
-- served agent silently loses its subagents.
--
-- Dropped rather than replaced: `create or replace function` cannot change a
-- function's return type, and adding a column to a `returns table` is exactly
-- that. The body below is 0003's, with `graph` added and nothing else moved.
drop function if exists public.agent_for_token(text, text);

create function public.agent_for_token(raw_token text, agent_id text)
returns table (
  id text, name text, role text, system_prompt text,
  target text, model text, temperature real, skills jsonb, graph jsonb
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
           a.target, a.model, a.temperature, a.skills, a.graph
      from public.agents a
     where a.user_id = uid
       and (agent_id is null or a.id = agent_id)
     order by a.created_at desc
     limit 1;
end;
$$;

revoke all on function public.agent_for_token(text, text) from public;
grant execute on function public.agent_for_token(text, text) to anon, authenticated;
