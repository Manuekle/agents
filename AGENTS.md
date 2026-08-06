<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# creagent — agent entry point

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Supabase · motion · d3 · MCP.
Product: scrape skills → compose an agent → export to Claude Code / Codex / Cursor / Gemini CLI / MCP.

This file is loaded on **every** turn, so it stays short. Everything else is loaded on demand.

## Load one doc, not all of them

| Task | Read |
|---|---|
| Colour, type, spacing, borders, motion, a new component | [`docs/DESIGN.md`](docs/DESIGN.md) |
| A new route or module, navigation, gating, the file map | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Schema, RLS, migrations, persistence, plans, quotas | [`docs/DATA.md`](docs/DATA.md) |
| Endpoints, auth, rate limits, the MCP contract | [`docs/API.md`](docs/API.md) |
| The standalone MCP server package | [`mcp/README.md`](mcp/README.md) |

Map and doc-writing rules: [`docs/README.md`](docs/README.md).

## Always

- **No `border-radius`.** The design is hard-edged everywhere.
- **No `transition-all`.** Name the properties.
- Colours come from the CSS tokens (`--paper`, `--ink`, `--coral`, `--line`, …), never a literal hex in a component.
- Build UI from the primitives in `components/ui.tsx` before writing a new one.
- Motion durations live as CSS custom properties in `app/globals.css`; JS reads them through `lib/motion.ts`.
- Every animation needs a `prefers-reduced-motion` escape.
- Route access is declared in `lib/access.ts` — one table read by `proxy.ts`, the handlers and the nav.
- Anything money- or account-touching: gate → rate limit → consume quota → call.
- New table ⇒ `enable row level security` + explicit owner policies. Migrations are additive and numbered; never edit a shipped one.
- Never add the Supabase `service_role` key to this project. RLS is the protection.
- `app/api/ai/relay/route.ts` is an SSRF surface. Changing its allow-list, protocol set or address rules is a security change — say so.

## Comments

This codebase comments **why**, not what, and the existing comments are load-bearing context. Match that density and register; do not strip them.
