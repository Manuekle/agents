# agents

Build AI agents. Ship your skills.

**Live: [agents-dev.vercel.app](https://agents-dev.vercel.app)**

A pixel-native composer for AI agents: search the open [skills.sh](https://skills.sh)
registry, pick skills, write a system prompt, choose a model — then export the
config your tool actually reads (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`,
`GEMINI.md`, `mcp.json`) or serve the whole agent over MCP.

## Layout

| path | what |
|------|------|
| `app/` | Next.js App Router pages — `/` (home), `/build` (composer), `/skills` (registry browser), `/mcp` (MCP bridge docs) |
| `app/api/skills/` | server proxy for the skills.sh search API, with an offline seed fallback |
| `components/` | UI primitives (`ui.tsx`), mascot, dither canvas, skill browser |
| `lib/` | agent types + export formats, localStorage store, mascot state machine |
| `mcp/` | the published npm package, `@manudev.jsx/agents` — serves an exported agent over MCP |
| `assets/mascots-raw/` | 1024² pixel-art sources (not served; `public/mascots/` holds the 256² builds) |
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

Nothing else is required — the skills search proxies a public API and agents are
stored in the browser's localStorage.

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
