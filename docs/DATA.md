---
title: DATA — schema, persistence and plan limits
summary: Supabase tables, RLS policies, security-definer functions, the client store, and where each limit is enforced.
version: 1.0.0
updated: 2026-08-05
area: data / backend
audience: ai-agent, backend
source_of_truth: supabase/migrations/, lib/store.ts, lib/plans.ts, lib/polar/
read_when: Touching the schema, persistence, auth, tokens, plans or quotas.
skip_when: Visual or export-only work.
tokens_est: ~1.5k
---

# DATA

Everything is Postgres on Supabase, with **row level security on every table**. The anon key is browser-safe by design; RLS is the protection. **Never** put the service_role key in this project.

## 1. Tables

### `profiles` — `0001`
`id uuid pk → auth.users`, `plan text ('free'|'pro'|'max', default 'free')`, `created_at`.

- Exists only to hold `plan` — application columns do not belong on `auth.users`.
- RLS: owner **reads** only. **No insert policy, no user update path to `plan`** — a profile is created by the `on_auth_user_created` trigger (`handle_new_user`, security definer), so signing up cannot self-assign a plan.

### `agents` — `0001` + `0004`
`primary key (user_id, id)` — `id` stays the **client-generated string** so an agent keeps its identity moving from localStorage into an account and `/build?id=` keeps working; it is only unique per user, hence the composite key.

Columns: `name`, `role`, `system_prompt`, `target`, `model`, `temperature real`, `skills jsonb` (default `[]`), `mascot`, `accent`, `graph jsonb` (nullable), `created_at`, `updated_at`.
Index: `(user_id, created_at desc)`. Trigger: `touch_updated_at`.

- RLS: four explicit owner policies (select / insert / update / delete).
- `graph` is a **document** — read whole, written whole, never queried by its innards. Only constraint: `agents_graph_is_object`.
- `graph is null` = a pre-canvas agent; the client derives one from `skills` on first open. No backfill, no broken old clients.
- `skills` stays the flat union even when `graph` exists — installers must never walk a tree.
- `graph.annotations` (optional) is the canvas' labels — a piece of text and the box it wraps in, in grid units. It rides in the same document because it is written and read on exactly the same beat as the nodes, and it exports to nothing: no installer, manifest or MCP payload ever reads it. Absent, not `[]`, on a graph nobody has labelled, so an untouched agent serialises as it always did. `normalizeAnnotations` drops anything malformed rather than repairing it — nothing downstream depends on a label existing, and entries from the old drawing set (anything carrying `points`, or a `kind` other than `text`) fall out on that same rule.
- `node.tint` (optional) is the colour tag, stored as a token name (`ink`, `coral`, `ok`, `muted` — `TINT_COLORS` in `lib/graph.ts`), never a hex: a branch tagged red in light mode has to still be tagged red after the theme wipe. Organisational only; it changes nothing about what the agent installs, but unlike a label it *does* appear in the PNG/SVG export.

### `ai_usage` — `0002`
`primary key (user_id, month)`, `drafts integer`. `month` is always the first of the month.

- A counter, not a log: it is read on every draft and this keeps that O(1).
- RLS: owner **reads** only (so the UI can say "7 of 10"). No insert/update policy — the only writer is `consume_ai_draft()`, so nobody can reset their own counter.

### `api_tokens` — `0003`
`id uuid`, `user_id`, `name`, `token_hash unique`, `prefix` (first 10 chars), `created_at`, `last_used`.

- **Only the SHA-256 is stored.** A leaked dump yields hashes, not credentials; `prefix` is how tokens are told apart afterwards.
- RLS: owner select + delete (list and revoke). **No insert policy** — tokens are minted by `create_api_token()` so the plaintext is hashed and never round-trips through the client.

### `app_config` — `0005`

`key text pk`, `value text`. One row today: `plan_sync_secret`.

- RLS: **enabled, zero policies.** Not owner-scoped data — a secret the server holds, not an account holds. The only way to reach it through PostgREST is a security-definer function; every direct request from `anon` or `authenticated` is denied.
- The row is set by hand from the SQL editor, never in a migration file (which is committed to git) — see the comment in `0005_polar_billing.sql`.

## 2. Functions (all `security definer`)

| Function | Contract |
|---|---|
| `handle_new_user()` | trigger on `auth.users` insert → creates the profile |
| `touch_updated_at()` | trigger on `agents` update |
| `plan_agent_limit(p)` | free 3 · pro 25 · max `null` |
| `plan_draft_limit(p)` | free 10 · pro 200 · max `null` |
| `enforce_agent_limit()` | before-insert trigger on `agents`; excludes the row being written so updates never count as new |
| `consume_ai_draft()` | check **and** increment in one statement — two concurrent drafts cannot both take the last slot. Refuses by decrementing back, so a rejected draft never burns a slot. Returns `boolean` |
| `create_api_token(name)` | mints `adv_<base64 of 32 random bytes, +/= translated to xyz>`, stores the hash, returns the plaintext **once** |
| `resolve_api_token(raw)` | hash → user |
| `agent_for_token(raw, agent_id)` | serves one agent to the MCP endpoint. **Fixed column list** — a new agent column must be added here or served agents silently lose it (that is why `0004` drops and recreates it: `create or replace` cannot change a `returns table`) |
| `apply_polar_plan(user_id, plan, secret)` | moves an account onto a plan, called by the billing webhook. Proves the caller holds `secret` (checked against `app_config`) rather than a session — a webhook has no session to hold. Same trade as the MCP token functions: grantable to `anon` because the secret argument is the actual gate, not the key |

## 3. Where limits are enforced

Limits live in **two** places on purpose:

- `lib/plans.ts` — for the UI (`PLANS`, `formatUsage`, `atLimit`, `remaining`).
- SQL (`plan_*_limit`, `enforce_agent_limit`, `consume_ai_draft`) — because PostgREST is reachable directly with the anon key, so an app-only check is a suggestion.

Plans: **free** 3 agents / 10 drafts / no MCP · **pro** 25 / 200 / MCP · **max** unlimited / unlimited / MCP. `plan` is set either by hand or by the Polar webhook (`apply_polar_plan()`, `0005`) — see API.md's `/api/billing/webhook`. Until `POLAR_ACCESS_TOKEN` and the two `NEXT_PUBLIC_POLAR_*_PRODUCT_ID` vars are set, `/pricing` shows an honest "Coming soon" instead of a checkout link (`POLAR_CONFIGURED`, `lib/polar/env.ts`).

## 4. Client persistence — `lib/store.ts`

- Agents live in Supabase. Reads stay **synchronous**: the DB hydrates an in-memory cache; writes update the cache first and persist after.
- Exposed through `useSyncExternalStore` (`useAgents`, `useAgentsLoading`, `useStoreError`). Snapshots are compared by identity — every empty path must return the same `EMPTY` array or React loops.
- `loading` starts `true` whenever `SUPABASE_CONFIGURED`, because until `getUser()` answers we do not know if this browser has a session. Starting `false` briefly showed signed-in users the signed-out truth ("no agents yet"), which reads as having lost the work.
- **localStorage (`agents-dev:agents`) is a migration path, not a mode.** Nothing new is written there; the upsert in `applyUser` carries pre-account agents into the account on first sign-in. Removing it strands them.
- With Supabase unset, nothing is gated and localStorage is the whole store — which is what a self-hosted, account-less instance wants.

## 5. Migration rules

- Files are ordered and additive: `0001_agents` → `0002_plans` → `0003_mcp_tokens` → `0004_agent_graph` → `0005_polar_billing`.
- Add a new numbered file; never edit a shipped one.
- Adding an agent column? Update `agent_for_token`'s column list in the same migration.
- Every new table: `enable row level security` + explicit owner policies. A write path a user must not control belongs in a `security definer` function with **no** matching RLS insert policy.

## Related
[ARCHITECTURE.md](ARCHITECTURE.md) · [API.md](API.md)
