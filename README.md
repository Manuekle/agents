# agents

Build AI agents. Ship your skills.

**Live: [agents-dev.vercel.app](https://agents-dev.vercel.app)**

A pixel-native composer for AI agents: search the open [skills.sh](https://skills.sh)
registry, pick skills, write a system prompt, choose a model — then export the
config your tool actually reads (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`,
`GEMINI.md`, `mcp.json`) or serve the whole agent over MCP.

## Creating an agent

`/new` offers two entry points:

- **Onboarding** (`/onboarding`) — answer a few guided questions (purpose,
  domain/stack, tone, target tool); a model drafts the name, role and system
  prompt, then picks the agent's skills. You land in the composer with all of
  it pre-filled to review and save. Run it on our model or on
  [your own](#bring-your-own-model).

  Skill picking is two model calls around a real lookup, not one call from
  memory: the first drafts the persona and emits a few registry search terms,
  the server runs those against skills.sh, and the second call chooses by
  index out of what actually came back. A model asked to name repos unprompted
  invents plausible `owner/repo` pairs that `npx skills add` cannot resolve —
  this way it can only ever return skills that exist. An empty list is a valid
  answer and is shown as one.
- **Personalizado** (`/build`) — the manual composer, straight up. Every
  field (name, role, system prompt, model, temperature, mascot, skills) is
  yours to write.

Both paths converge on the same composer and the same `Agent` record — the
onboarding wizard is just a way to seed it, not a separate product.

## Bring your own model

The **Model** panel on `/onboarding` switches the draft between our hosted
deployment and an API key of your own — Claude, ChatGPT, Kimi, DeepSeek,
Gemini, Groq, OpenRouter, anything OpenAI-compatible, or a local model served
by Ollama or LM Studio. Providers live in `lib/ai/providers.ts`; adding one is
a row in that table.

Your key is stored in this browser (`localStorage`, or `sessionStorage` if you
untick *Remember this key*) and the request goes straight from the page to the
provider. It is never posted to our server, drafts never touch the monthly plan
quota, and a model on `localhost` works precisely because the call is made from
your machine rather than ours.

Two details that follow from that:

- **CORS.** Some vendors send no CORS headers, so a page cannot call them
  directly. With *Relay if the provider blocks browsers* ticked, that one
  request is forwarded through `app/api/ai/relay/route.ts` — the key passes
  through and is not stored. The relay only speaks https to public addresses:
  loopback, RFC1918, link-local and hostnames that resolve to any of them are
  refused, so it cannot be turned into a probe of our network. Local endpoints
  are never relayed, and the option is hidden for them.
- **Local models need to allow this origin.** Ollama: `OLLAMA_ORIGINS=<origin>
  ollama serve`. LM Studio: enable CORS on its local server. The panel prints
  the exact line with your origin filled in.

Providers disagree on how a JSON shape is requested — Anthropic's messages API,
OpenAI's responses API, and chat completions each spell it differently, and
several local runtimes reject the parameter outright. `lib/ai/structured.ts`
covers all three, and falls back to asking for the schema in words (then
digging the object out of whatever comes back) when a provider rejects the
strict form.

## Accounts, plans and what is public

Building an agent needs an account. Not as a growth tactic — the three things
`/build` and `/onboarding` do are *save an agent* (against a per-plan cap),
*spend an AI draft* (against a monthly quota) and *issue an MCP token* (which
reads an account). None of the three has a meaning without an identity to
attribute it to, and a signed-out draft used to be exactly the hole that made
the monthly quota optional: sign out, draft again.

What a visitor with no account gets instead is `/demo` — the whole flow, brief
to export, on pre-loaded data. It is a simulation, not a trial: the graph, the
`CLAUDE.md` and the install line are produced by the same `lib/graph.ts` and
`lib/export.ts` the composer runs, so it cannot drift from the real thing, but
nothing is drafted, fetched or stored, which is why it can be public when
`/build` is not.

| | no account | Free | Pro | Max |
|---|---|---|---|---|
| `/demo`, `/skills`, `/pricing` | ✓ | ✓ | ✓ | ✓ |
| compose & export (`/build`) | — | ✓ | ✓ | ✓ |
| saved agents | — | 3 | 25 | ∞ |
| AI drafts a month (`/onboarding`) | — | 10 | 200 | ∞ |
| bring your own API key | — | unmetered | unmetered | unmetered |
| serve over MCP (`/mcp`) | — | — | ✓ | ✓ |

### Where each rule lives

One table, three enforcement points, and they are not interchangeable:

- **`lib/access.ts`** — which paths need an account, and why. The single list
  the other two read, so the redirect, the check and the nav cannot disagree.
- **`proxy.ts`** — Next 16's renamed Middleware. Refreshes the Supabase session
  on every request, then sends a signed-out browser to `/demo` and an API
  caller a `401`. This is the *optimistic* check in the sense the Next docs
  mean: it decides what gets rendered.
- **`lib/api-auth.ts`** — `requireAccount()`, called at the top of every gated
  route handler. A matcher change can silently drop a path out of the proxy's
  coverage, and nothing about a proxy stops a direct `POST` from curl, so the
  check that actually binds sits next to the work.

The plan *limits* are enforced somewhere else again, and deliberately: the
agent cap is a database trigger and the draft quota is checked and incremented
in one statement (`supabase/migrations/0002_plans.sql`). PostgREST is reachable
directly with the anon key, so a limit that lives only in the app is a
suggestion. `plan` itself has no client-writable path — a profile is created by
trigger and only the service role can change the column, which is where a
billing webhook will eventually sit.

A deploy with no Supabase credentials gates nothing. There is no way to sign in
on one, so gating would lock the owner out of their own instance; the composer
stays open and agents live in `localStorage`, as they did before accounts.

## The canvas

An agent used to be one prompt with a flat list of picks. That stopped
describing what people actually build, so `/build` opens on a canvas: an
**orchestrator** at the root, **subagents** it delegates to, and **components**
(skills, commands, MCP servers, hooks, settings, subagent packages) wired under
whichever agent should carry them. Structure is the graph's job — which
specialist owns which tool is the thing that took the design work, and a flat
list threw it away.

Drag the ▾ port out of an agent to wire it to something. A component belongs to
exactly one owner, nothing can own the orchestrator, and a wire that would form
a cycle is refused — an export walks the tree, and a loop walks forever.

| gesture | what |
|---------|------|
| drag empty space | marquee-select |
| space / middle-drag, or the **hand** tool | pan |
| ⌘scroll | zoom, anchored on the cursor |
| drag a node | move it; drag one that is already selected to move the whole selection |
| alt while dragging | ignore the alignment guides |
| shift-click | add or remove one node from the selection |
| double-click empty space | new subagent, right there |
| right-click | context menu — duplicate, delete, disconnect a wire, tidy, fit |
| ⌘Z / ⇧⌘Z | undo / redo. A whole drag is one step |
| ⌘D, ⌘C/⌘V | duplicate the selection with its components |
| ⌘A / ⌫ / arrows | select all / delete / nudge (shift for a bigger step) |
| ⌘0 · **fit** · **tidy** | frame everything · re-lay the tree top-down |
| **expand** | fullscreen — the graph takes the whole window. Esc leaves it (after clearing whatever is selected) |
| **lock** | freeze the graph: nothing moves, wires, is added or deleted. Selecting, panning, zooming and editing a node's fields keep working |

Everything downstream of the canvas keeps reading the flat list: `Agent.skills`
stays the union of every component in the graph, so the install commands, the
manifest and the share payload never have to walk a tree. The structure is
additive — `graph` on the record, `orchestrator` + `subagents` in the exported
spec — and an agent saved before the canvas existed gets one built from its
picks on first open, so nothing needed a backfill.

The exports carry it through: `CLAUDE.md` and friends grow a **Subagents**
section naming each specialist, its parent and its components;
`agents-dev.skills.json` records an `owners` map; and `@manudev.jsx/agents`
serves the roster over MCP (see [`mcp/README.md`](mcp/README.md)).

## Layout

| path | what |
|------|------|
| `app/` | Next.js App Router pages — `/` (home), `/demo` (the signed-out simulator), `/new` (create — choose onboarding or manual), `/onboarding` (AI-assisted wizard), `/build` (composer), `/skills` (registry browser), `/mcp` (MCP bridge docs) |
| `proxy.ts` | Next 16's renamed Middleware — refreshes the auth cookie, then redirects signed-out visitors off the gated routes |
| `lib/access.ts` | the route table: which paths need an account and why. Read by the proxy, the route handlers and the nav |
| `lib/api-auth.ts` | `requireAccount()` — the check inside each gated route, which is the one that actually binds |
| `lib/demo-agent.ts` | the pre-loaded agent `/demo` builds in front of you. Literal ids, since it renders on the server and hydrates on the client |
| `app/api/skills/` | server proxy for the skills.sh search API, with an offline seed fallback |
| `app/api/onboarding/` | server-side route that calls Azure AI Foundry to draft a persona — the API key never reaches the browser, and the route is rate-limited and token-capped |
| `app/api/ai/relay/` | forwards one bring-your-own-key request to a provider that refuses browser calls. Stores nothing; https and public addresses only |
| `app/api/skills/candidates/` | the registry half of a draft, on its own, so a browser running its own model can still get candidates |
| `lib/ai/` | the model layer — `providers.ts` (the catalogue), `structured.ts` (three wire formats behind one call), `settings.ts` (where your key lives), `draft.ts` (the browser-side draft) |
| `app/sitemap.ts`, `app/robots.ts` | generated `sitemap.xml` and `robots.txt` (crawlers are kept off `/api/`) |
| `app/opengraph-image.tsx`, `app/twitter-image.tsx` | 1200×630 social cards rendered at the edge from the brand tokens in `lib/brand.ts` |
| `app/icon.png`, `app/apple-icon.png`, `app/manifest.ts` | app icon surfaces — browser tab, iOS home screen, Android manifest. All cut from `assets/logo-raw.png` |
| `components/` | UI primitives (`ui.tsx`), mascot, dither canvas, skill browser |
| `components/canvas/` | `AgentCanvas` — the orchestrator/subagent graph editor: pan, zoom, marquee, wiring, snapping, minimap, context menu |
| `lib/graph.ts` | the canvas model — nodes, edges, the edit ops that keep it acyclic, layout, and the graph↔agent conversions the exports read |
| `lib/use-graph-history.ts` | undo/redo. Snapshots beside the state rather than owning it, because the `Agent` record owns the graph |
| `lib/` | agent types + export formats, localStorage store, mascot state machine |
| `mcp/` | the published npm package, `@manudev.jsx/agents` — serves an exported agent over MCP |
| `assets/mascots-raw/` | 1024² pixel-art sources (not served; `public/mascots/` holds the 256² builds) |
| `assets/logo-raw.png` | full-bleed logo source, kept out of `public/` so the 2 MB original is never served. `assets/logo-mark.png` is the 256² copy the OG card inlines as a data URI |
| `scripts/` | one-off mascot pipeline (background removal, body-normalized sizing) used to author the raws |

## Develop

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

```bash
npm run build
```

### Environment

| var | purpose |
|-----|---------|
| `NEXT_PUBLIC_SITE_URL` | absolute base for OG/Twitter card images. Falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then `http://localhost:3000`. Set to `https://agents-dev.vercel.app` in Vercel production. |
| `AZURE_FOUNDRY_ENDPOINT` | Azure OpenAI-compatible endpoint for `/onboarding`, e.g. `https://<resource>.openai.azure.com/openai/v1` — the OpenAI SDK talks to it directly, no `api-version` query param. |
| `AZURE_FOUNDRY_API_KEY` | key for that endpoint. Server-side only (`app/api/onboarding/route.ts`); never sent to the browser. |
| `AZURE_FOUNDRY_DEPLOYMENT` | deployment/model name, e.g. `gpt-5.4-mini`. |

None of the three Foundry vars are required to run the site. They power the
hosted half of `/onboarding`; with them unset, that page still drafts against
[a key of your own](#bring-your-own-model). The Supabase vars are what switch
accounts on — without them nothing is gated and agents live in `localStorage`
(see [Accounts, plans and what is public](#accounts-plans-and-what-is-public)).
See [`.env.example`](.env.example).

### Cost guardrails on `/api/onboarding`

That route spends real money per call, so it is not left open:

- **An account** — the first gate, and the one that makes the rest add up. The
  monthly quota is per user, so a route that answered signed-out requests had
  no quota at all: signing out was the way around it. `requireAccount()` runs
  before anything is spent.
- **Rate limit** — 5 drafts per minute per IP, fixed window, held in process
  memory. Measured on production: 12 rapid requests return `400 ×5` then
  `429 ×7`, so it does stop a client hammering the endpoint. The gap is that
  a *draft* call occupies its instance for several seconds, and Vercel routes
  the next request to a different instance with its own counter — so a patient
  attacker pacing real drafts gets 5 per instance rather than 5 overall. It
  caps the cheap flood, not the total spend. A durable store (KV/Redis) is the
  upgrade for a hard ceiling.
- **Monthly quota** — `consume_ai_draft()` checks the plan's cap and increments
  the counter in one statement, so two drafts racing for the last slot cannot
  both be granted it, and a refused draft puts the increment back.
- **Input caps** — every field is truncated before it reaches the model
  (`purpose` 600 chars, `domain` 200, `tone` 40, `teamName` 120), and `target`
  must be one of the known tool ids. An unbounded prompt is an unbounded bill.
- **Output caps** — `max_output_tokens` 600 on the draft and 200 on the skill
  pick, with `reasoning.effort: "none"` on both: drafting a persona and
  choosing from a numbered list are formatting, not deduction.
- **Bounded candidate list** — the pick call sees at most 30 skills, so the
  prompt stays a shortlist rather than a catalogue dump billed by the token.
- **Structured Outputs** — the model is constrained to the response schema, so
  the reply parses on the first call instead of costing a retry.
- `robots.txt` disallows `/api/` so crawlers never trip any of this.

## The MCP package

`mcp/` is published separately as [`@manudev.jsx/agents`](mcp/README.md). It reads
an `agents-dev.agent.json` exported from the composer and exposes the persona,
system prompt and picked skills to any MCP client.

```bash
cd mcp
npm test        # smoke test against example.agent.json
npm publish     # requires `npm login`; publishConfig.access is already public
```

## License

MIT — see [`LICENSE`](LICENSE).
