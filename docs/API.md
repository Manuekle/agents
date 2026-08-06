---
title: API — internal endpoints and the MCP contract
summary: Every route handler: auth, rate limit, request shape, status codes, and the rules a new endpoint must follow.
version: 1.0.0
updated: 2026-08-05
area: backend / integrations
audience: ai-agent, backend
source_of_truth: app/api/, lib/api-auth.ts, lib/foundry.ts, mcp/
read_when: Adding or changing an endpoint, the MCP contract, auth or rate limiting.
skip_when: UI-only or schema-only work.
tokens_est: ~1.3k
---

# API

All handlers are `runtime = "nodejs"`. Access gating comes from `lib/access.ts` (see ARCHITECTURE.md §3); handlers call `requireAccount(reason)` from `lib/api-auth.ts` — the `reason` completes "it …" and lands in the 401 body. Rate limiting is `rateLimit(bucket, clientIp(req), max)` from `lib/foundry.ts`, one bucket per endpoint.

## `GET /api/skills` — public

Registry search. Two catalogs kept **apart**, not merged: they install through different CLIs and only ~11% of entries overlap.

Query: `q`, `sort` (`relevance` | `installs` | `alpha`), `source=aitmpl`, `category`, `kind` (`all` searches every feed — what the command palette needs), `offset`. Page size 60.
Default source is skills.sh (installable via `npx skills add`), with aitmpl copy overlaid where a slug matches.

## `POST /api/skills/candidates` — account

The registry half of a draft, on its own. No model is called. Exists because skills.sh sends no CORS headers, so a bring-your-own-key draft running in the browser still needs this hop. Gated anyway — open, it is an unmetered scraping proxy wearing our IP.

Body `{ searchTerms }` → `{ candidates }`. Rate limit 20. `422`/`400` on bad JSON.

## `POST /api/onboarding` — account

**Hosted** persona draft (our Foundry deployment, our bill). Order matters: account gate → Foundry client → rate limit → `consume_ai_draft()` → model call.

- Account required *before* anything is spent — a signed-out draft has no month to attribute, so the quota was walkable by signing out.
- `402` when the monthly quota is out.
- `500` with `FOUNDRY_ERROR` when the deployment is unconfigured.
- The Foundry key never reaches the browser.
- A visitor with their own key never hits this route: their browser runs the same prompt (`lib/ai/draft.ts`).

## `POST /api/onboarding/skills` — account

Second half of the same draft: search with the model's own queries, then let it choose from what came back. Split from the persona call so the UI paints the persona at ~4s instead of holding a blank panel for ~9s.
**Its own rate-limit bucket, and it does not spend a second draft** — one draft is one persona plus one pick.

## `POST /api/ai/relay` — account

One-hop forwarder for bring-your-own-key calls the browser cannot make (vendors with no CORS headers). It **holds nothing**: the key arrives in a header, passes through, and is gone with the response — never logged, cached or stored.

Deliberately narrow, because an open forwarder is an SSRF hole:

- `https` only; `localhost`, `.local`, `.internal`, `.localhost` refused.
- Hostnames are **resolved before the request**, and any private address (RFC1918, loopback, link-local, CGNAT, ULA, IPv4-mapped v6) is rejected.
- Header allow-list only (`content-type`, `authorization`, `x-api-key`, `api-key`, `anthropic-*`, `openai-*`, `http-referer`, `x-title`).
- `MAX_BODY` 256 KB, `TIMEOUT_MS` 60s, rate limit 20.

**Any change here is a security change.** Do not widen the allow-list, the protocol set or the address rules without saying so explicitly.

## `GET /api/mcp/agent` — bearer token

What `@manudev.jsx/agents --token …` calls so a served agent need not live in a file. Bearer token, not a session cookie — the caller is a CLI process.

Query: `?agent=<id>` (omit for the account's first agent).

| Status | Meaning |
|---|---|
| `501` | accounts not enabled on this deploy |
| `429` | rate limited (30, `retry-after` header) |
| `401` | missing or invalid bearer token |
| `402` | the plan does not include MCP serving |
| `404` | no such agent / account has no agents |
| `502` | token or agent lookup failed |

Reads through the security-definer `resolve_api_token` + `agent_for_token` with a plain anon client (no cookies). Responds with `agentSpec(...)` — **the same shape as the downloaded `*.agent.json`**, so the MCP server has one format whether it read a file or fetched this. The graph is rebuilt with `normalizeGraph` so a pre-canvas or hand-edited row still serves something coherent. `cache-control: private, no-store`.

## Auth routes

`/auth/callback` (Supabase code exchange) · `/auth/signout`.

## Rules for a new endpoint

1. Decide access in `lib/access.ts` first — `proxy.ts`, the handler and the nav all read that one table.
2. Call `requireAccount(reason)` in the handler. The middleware redirect is not the check that binds.
3. Give it its **own** rate-limit bucket.
4. Validate the body; `400`/`422` on bad JSON, never a 500.
5. Anything that spends money: gate → limit → consume quota → call. Refund the quota if the call is refused.
6. Never return a provider key, a token plaintext, or a raw upstream error body.

## Related
[ARCHITECTURE.md](ARCHITECTURE.md) · [DATA.md](DATA.md) · [`mcp/README.md`](../mcp/README.md)
