---
title: ARCHITECTURE — how creagent is put together
summary: Routes, layers, module map and the four data flows (draft, compose, export, serve).
version: 1.0.0
updated: 2026-08-05
area: engineering
audience: ai-agent, backend, frontend
source_of_truth: app/, lib/, proxy.ts
read_when: Adding a route or module, changing navigation/gating, or you need the file map before editing.
skip_when: Purely visual work (read DESIGN.md) or schema work (read DATA.md).
tokens_est: ~1.6k
---

# ARCHITECTURE

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase · motion · d3 · MCP.

> The installed Next.js has breaking changes vs. training data. Read `node_modules/next/dist/docs/` before writing framework code.

## 1. Product flow

`scrape` → `compose` → `export` → `serve`

1. **Brief** — four questions (`/onboarding`).
2. **Draft** — a model writes name, role, system prompt.
3. **Skills** — live search across skills.sh + aitmpl.
4. **Delegate** — orchestrator + subagents on the canvas (`/build`).
5. **Export** — `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `GEMINI.md` or raw MCP.

## 2. Routes

**Pages** (`app/`)

| Path | What | Access |
|---|---|---|
| `/` | marketing | public |
| `/demo` | signed-out simulator, saves nothing | public |
| `/skills` | registry browsing | public |
| `/pricing`, `/privacy`, `/terms`, `/login` | — | public |
| `/onboarding` | brief → AI draft | account |
| `/new` | composer entry | account |
| `/build` | composer + canvas | account |
| `/mcp` | issue API tokens | account |

**API** (`app/api/`, all `runtime = "nodejs"`)

| Endpoint | Method | Access |
|---|---|---|
| `/api/skills` | GET | public |
| `/api/skills/candidates` | POST | account |
| `/api/onboarding` | POST | account |
| `/api/onboarding/skills` | POST | account |
| `/api/ai/relay` | POST | account |
| `/api/mcp/agent` | GET | bearer token |

**Auth**: `/auth/callback`, `/auth/signout`.
**Metadata**: `manifest.ts`, `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `twitter-image.tsx`.

## 3. Access control

`lib/access.ts` holds **one table** read by the three places that must never disagree: `proxy.ts` (redirect), route handlers (the check that binds), and the nav (what it offers). Default is `public` — anything gated is listed explicitly, with a `why` string spent in the 401 body and in `gateReason()`. Longest path match wins. Signed-out visitors on a gated path go to `DEMO_PATH` (`/demo`).

Feature gating (`planAllows`) is separate from access gating: today the only feature is `"mcp"`.

**"Signed in" has three answers, not two.** `lib/supabase/answer.ts` (`readUser`) is the only place allowed to decide, and every consumer — `proxy.ts`, `api-auth.ts`, `use-auth.ts`, `use-plan.ts`, `store.ts`, `AuthButton` — goes through it. Never call `supabase.auth.getUser()` directly: it reports an unreachable auth service as `{ user: null, error }` rather than throwing, so reading only `data.user` turns a network blip into a sign-out and the whole app starts telling signed-in users to sign in.

| `signedIn` | Means | What the app does |
|---|---|---|
| `true` | verified session | serve |
| `false` | no session, or one the server rejected | gate: redirect to `/demo`, 401 on `/api/*` |
| `null` | could not tell (offline, 5xx, timeout) | **pages serve**, UI holds its state; `/api/*` still refuses, but with `503` + `retry-after` and a message that says so |

`null` fails open for rendering and closed for spending. RLS owns the data underneath either way, so a page served on an unknown answer shows nothing that is not already the visitor's.

## 4. Module map — `lib/`

| Module | Owns |
|---|---|
| `types.ts` | `Agent`, `Skill`, `PickedSkill`, `AgentTarget`, `MODELS`, `TARGETS`, `modelsFor` |
| `graph.ts` | `AgentGraph`, nodes/edges, grid constants, tree helpers |
| `store.ts` | agent persistence + `useSyncExternalStore` cache (see DATA.md) |
| `export.ts` | `agentSpec`, `skillsManifest`, `installCommand`, `exportAgent` per target |
| `access.ts` | route access table + feature gating |
| `plans.ts` | plan definitions and limit formatting |
| `ai/` | `providers`, `settings`, `structured`, `brief`, `draft`, `onboarding` |
| `supabase/` | `client` (browser), `server`, `env` (`SUPABASE_CONFIGURED`), `answer` (`readUser` — the only reader of "am I signed in") |
| `skills-search.ts`, `skills-candidates.ts`, `skills-seed.ts`, `aitmpl.ts` | registry search and seeding |
| `motion.ts` | reads CSS motion tokens back into JS |
| `theme-wipe.ts` | the block-wipe theme transition |
| `mascot.ts`, `avatar.ts`, `brand.ts`, `site.ts`, `palette.ts`, `stars.ts`, `share.ts`, `copy.ts`, `clsx.ts` | small single-purpose helpers |
| `use-auth.ts`, `use-plan.ts`, `use-graph-history.ts` | client hooks |

## 5. Components

- `components/ui.tsx` — the primitive kit (see DESIGN.md §7). Build from it first.
- `components/canvas/AgentCanvas.tsx` — pan/zoom/marquee graph editor.
- `components/dither-kit/` — the in-house chart library (cartesian + polar, dithered paint, axes, legend, tooltip). No chart dependency beyond `d3-scale`/`d3-shape`.
- Feature components: `SkillBrowser`, `CommandPalette`, `McpTokens`, `AiProviderSettings`, `PlanUsage`, `Mascot`, `Nav`, `Footer`, …

## 6. The four flows

**Draft** — `/onboarding` → `POST /api/onboarding` → Azure Foundry (`AZURE_FOUNDRY_*`) **or** the visitor's own key via `POST /api/ai/relay`. Bring-your-own-key is a plan feature (`planAllows(plan, "byok")`, Pro and up), unmetered and never stored server-side; the hosted path consumes a monthly draft (`consume_ai_draft()`).

**Compose** — `/build` mutates an `Agent` + its `AgentGraph`; `lib/store.ts` writes the in-memory cache first, persists after; `agent.skills` is the flat union of graph components so no installer has to walk the tree.

**Export** — `lib/export.ts` renders a per-target file plus one install command (`npx skills add …` for repos, `--skill …` flags for aitmpl entries).

**Serve** — `npx -y @manudev.jsx/creagent --agent ./x.agent.json`, or the hosted `GET /api/mcp/agent` authenticated by bearer token (`mcp/`, and DATA.md §3).

## 7. Environment

Both integrations are optional and each one turns behaviour **on**:

- `AZURE_FOUNDRY_ENDPOINT|API_KEY|DEPLOYMENT` — hosted drafting. Server-only.
- `NEXT_PUBLIC_SUPABASE_URL|ANON_KEY` — accounts, plans, saved agents. With these unset nothing is gated and agents stay in `localStorage`. **Never** add the service_role key; RLS is the protection.

See `.env.example`.

## Related
[DESIGN.md](DESIGN.md) · [DATA.md](DATA.md) · [API.md](API.md)
