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
  domain/stack, tone, target tool); an Azure AI Foundry model drafts the
  name, role and system prompt for you. You land in the composer with those
  fields pre-filled to review, pick skills, and save.
- **Personalizado** (`/build`) — the manual composer, straight up. Every
  field (name, role, system prompt, model, temperature, mascot, skills) is
  yours to write.

Both paths converge on the same composer and the same `Agent` record — the
onboarding wizard is just a way to seed it, not a separate product.

## Layout

| path | what |
|------|------|
| `app/` | Next.js App Router pages — `/` (home), `/new` (create — choose onboarding or manual), `/onboarding` (AI-assisted wizard), `/build` (composer), `/skills` (registry browser), `/mcp` (MCP bridge docs) |
| `app/api/skills/` | server proxy for the skills.sh search API, with an offline seed fallback |
| `app/api/onboarding/` | server-side route that calls Azure AI Foundry to draft a persona — the API key never reaches the browser, and the route is rate-limited and token-capped |
| `app/sitemap.ts`, `app/robots.ts` | generated `sitemap.xml` and `robots.txt` (crawlers are kept off `/api/`) |
| `app/opengraph-image.tsx`, `app/twitter-image.tsx` | 1200×630 social cards rendered at the edge from the brand tokens in `lib/brand.ts` |
| `app/icon.png`, `app/apple-icon.png`, `app/manifest.ts` | app icon surfaces — browser tab, iOS home screen, Android manifest. All cut from `assets/logo-raw.png` |
| `components/` | UI primitives (`ui.tsx`), mascot, dither canvas, skill browser |
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

None of the three Foundry vars are required to run the site — only `/onboarding`
needs them. Everything else works with zero config: the skills search proxies a
public API and agents are stored in the browser's localStorage. See
[`.env.example`](.env.example).

### Cost guardrails on `/api/onboarding`

That route spends real money per call, so it is not left open:

- **Rate limit** — 5 drafts per minute per IP, fixed window, held in process
  memory. Measured on production: 12 rapid requests return `400 ×5` then
  `429 ×7`, so it does stop a client hammering the endpoint. The gap is that
  a *draft* call occupies its instance for several seconds, and Vercel routes
  the next request to a different instance with its own counter — so a patient
  attacker pacing real drafts gets 5 per instance rather than 5 overall. It
  caps the cheap flood, not the total spend. A durable store (KV/Redis) is the
  upgrade for a hard ceiling.
- **Input caps** — every field is truncated before it reaches the model
  (`purpose` 600 chars, `domain` 200, `tone` 40, `teamName` 120), and `target`
  must be one of the known tool ids. An unbounded prompt is an unbounded bill.
- **Output caps** — `max_output_tokens: 500`, and `reasoning.effort: "none"`
  because drafting a persona is formatting, not deduction.
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
