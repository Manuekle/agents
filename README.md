<div align="center">

<img src="assets/logo-mark.png" width="110" alt="agents logo" />

# agents

**Build AI agents. Ship your skills.**

[![Live](https://img.shields.io/badge/live-agents--dev.vercel.app-ef5c47?style=flat-square&logo=vercel&logoColor=white)](https://agents-dev.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-17150f?style=flat-square)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-17150f?style=flat-square)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-17150f?style=flat-square)](https://react.dev)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-17150f?style=flat-square)](https://tailwindcss.com)
[![MCP](https://img.shields.io/badge/serve-via%20MCP-ef5c47?style=flat-square)](mcp/README.md)

</div>

<img src="docs/screenshots/hero.png" alt="agents — home" width="100%" />

---

## What it does

| 🪄 **Generate** | 🧭 **Compose** | 📦 **Export** | 🔌 **Serve** |
|---|---|---|---|
| Answer 4 questions and the AI drafts the persona, searches real skills on [skills.sh](https://skills.sh) and picks them. | Visual canvas: an orchestrator, subagents and components (skills, commands, MCP, hooks) wired by hand. | `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `GEMINI.md` or `mcp.json` — whatever your tool reads. | The whole agent served over MCP with `@manudev.jsx/agents`. |

## The flow, on screen

### 01 · Onboarding — the AI writes the draft

Answer a few questions: a model drafts name, role and system prompt, searches the live skills.sh registry and returns candidates that actually exist. You approve, edit and save.

<img src="docs/screenshots/onboarding.png" alt="Onboarding — AI-assisted draft" width="100%" />

### 02 · Composer — the canvas

Drag the ▾ port out of an agent to wire it to another. What each specialist carries is seen, moved and duplicated as a graph, not a list.

<img src="docs/screenshots/build.png" alt="Composer — orchestrator and subagent graph" width="100%" />

### 03 · Canvas, fullscreen

Expand the graph to fullscreen mode: pan with space, zoom with ⌘scroll, tidy to re-lay the tree.

<img src="docs/screenshots/canvas.png" alt="Fullscreen canvas" width="100%" />

### 04 · Demo — the whole flow, no account

Brief → draft → skills → delegation → export, on real data. Not a trial: the same `lib/graph.ts` and `lib/export.ts` the composer runs.

<img src="docs/screenshots/demo.png" alt="Demo — the full flow" width="100%" />

### 05 · Skills — two open registries

[skills.sh](https://skills.sh) is searched live; aitmpl browses skills, subagents, slash commands, MCP servers, hooks and settings by category. Copy an install, no account needed.

<img src="docs/screenshots/skills.png" alt="Skills registry" width="100%" />

### 06 · MCP bridge

The exported agent as an npm package that exposes the persona, system prompt and picked skills to any MCP client.

<img src="docs/screenshots/mcp.png" alt="MCP bridge" width="100%" />

### 07 · Plans

Free to compose, Pro for saved agents and drafts, Max to serve over MCP. Bring your own API key: Claude, ChatGPT, Kimi, DeepSeek, Gemini, Groq or local Ollama.

<img src="docs/screenshots/pricing.png" alt="Plans" width="100%" />

## Quick start

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. Without Supabase configured nothing is gated: agents live in `localStorage` and you can try the whole flow on `/demo`.

## Stack

**Next.js 16** · **React 19** · **TypeScript** · **Tailwind v4** · **Supabase** · **motion** · **d3** · **MCP** — all pixel, all custom.

Details for devs: [`mcp/README.md`](mcp/README.md) · [`.env.example`](.env.example) · [skills.sh](https://skills.sh) · [npx skills](https://www.npmjs.com/package/skills)

## License

MIT — see [`LICENSE`](LICENSE).
