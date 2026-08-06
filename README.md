<div align="center">

<img src="assets/logo-mark.png" width="104" alt="creagent logo" />

# creagent

### Build AI agents. Ship your skills.

Scrape skills, compose agents, export to Claude Code, Codex & any MCP model.

[![Live](https://img.shields.io/badge/live-creagent.fun-ef5c47?style=flat-square&logo=vercel&logoColor=white)](https://creagent.fun)
[![Demo](https://img.shields.io/badge/demo-no%20account-ef5c47?style=flat-square)](https://creagent.fun/demo)
[![MCP](https://img.shields.io/badge/serve-via%20MCP-17150f?style=flat-square)](mcp/README.md)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-17150f?style=flat-square)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-17150f?style=flat-square)](https://react.dev)
[![License: FSL-1.1-MIT](https://img.shields.io/badge/license-FSL--1.1--MIT-17150f?style=flat-square)](LICENSE)

</div>

<img src="docs/screenshots/hero.png" alt="creagent — home" width="100%" />

<div align="center">

`scrape` → `compose` → `export` → `serve`

</div>

---

## One agent, five tools

<img src="docs/screenshots/export-targets.png" alt="Export targets: Claude Code, Codex, Cursor, Gemini CLI, generic MCP" width="100%" />

## One file, every tool

<img src="docs/screenshots/agent-json.png" alt="agent.json — the portable agent manifest" width="100%" />

---

# The flow, on screen

<div align="center">

**Brief** · **Draft** · **Skills** · **Delegate** · **Export** — the five steps below run live at [`/demo`](https://creagent.fun/demo), no account.

</div>

### 01 · A model writes the persona

Answer four questions. Name, role and system prompt come back drafted — then yours to edit, field by field.

<img src="docs/screenshots/draft.png" alt="Draft — a model writes the persona from the brief" width="100%" />

### 02 · Skills from two open registries

[skills.sh](https://skills.sh) is searched live. Pick `owner/repo`, and the install command writes itself.

<img src="docs/screenshots/skills-picker.png" alt="Add skills — live search against the skills.sh registry" width="100%" />

### 03 · The canvas, not a list

An orchestrator that plans, specialists that do. Each one carries only the components it needs.

<img src="docs/screenshots/composer.png" alt="Composer — orchestrator, subagents and skills as a graph" width="100%" />

### 04 · Fullscreen

Pan with space, zoom with ⌘scroll, tidy to re-lay the tree.

<img src="docs/screenshots/canvas.png" alt="Fullscreen canvas" width="100%" />

### 05 · Ship it to the tool you use

`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `GEMINI.md` or raw MCP — plus one install command for every component.

<img src="docs/screenshots/export.png" alt="Export — five targets and a generated install command" width="100%" />

---

## Registry

Two open registries in one search. **skills.sh** live; **aitmpl** by category — skills, subagents, slash commands, MCP servers, hooks and settings. Copy an install, no account needed.

<img src="docs/screenshots/skills.png" alt="Skill registry — live search, install counts, copy-install" width="100%" />

## Serve over MCP

One command and any MCP-capable model — Claude, GPT, Gemini — calls your agent's skills straight from the prompt.

<img src="docs/screenshots/mcp.png" alt="Serve over MCP — generated mcp.json" width="100%" />

```bash
npx -y @manudev.jsx/creagent --agent ./creagent.agent.json
```

## Plans

<img src="docs/screenshots/pricing.png" alt="Plans — Free, Pro, Max" width="100%" />

Free is free forever: 3 saved agents, 10 AI drafts a month, the whole registry, every export target. Paid plans bring your own key — Claude, ChatGPT, Kimi, DeepSeek, Gemini, Groq, OpenRouter, Ollama or LM Studio — and drafting on it is unmetered.

## Dark, too

<img src="docs/screenshots/hero-dark.png" alt="creagent — dark theme" width="100%" />

---

## Quick start

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. Without Supabase configured nothing is gated: agents live in `localStorage` and the whole flow runs on [`/demo`](https://creagent.fun/demo).

## Stack

**Next.js 16** · **React 19** · **TypeScript** · **Tailwind v4** · **Supabase** · **motion** · **d3** · **MCP** — all pixel, all custom.

For devs: [`docs/`](docs/README.md) · [`mcp/README.md`](mcp/README.md) · [`.env.example`](.env.example) · [skills.sh](https://skills.sh) · [npx skills](https://www.npmjs.com/package/skills)

## License

**[FSL-1.1-MIT](LICENSE)** — read it, run it, fork it, modify it, use it inside your
company. The one thing it withholds is standing up a commercial service that
substitutes for creagent. Every version becomes plain MIT two years after it
ships, so nothing here is locked away for good.

The MCP server in [`mcp/`](mcp/README.md) is **[MIT](mcp/LICENSE)**, separately and on
purpose: it is a client, and a client nobody is free to embed is a client
nobody uses.

The name, the logo and the mascot are trademarks and are not covered by either
licence — see [`TRADEMARK.md`](TRADEMARK.md). Fork the code, rename the thing.
