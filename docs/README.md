---
title: docs — the context map
summary: Which .md to load for which task, and what each one costs. Read this first, then load exactly one.
version: 1.0.0
updated: 2026-08-05
area: meta
audience: ai-agent, human
read_when: Always — it is the router.
tokens_est: ~0.4k
---

# Context map

The docs are split by **task**, not by chapter, so a model loads one file instead of the whole project. Load the row that matches the work; do not load the others.

| Doc | Load it when | Cost |
|---|---|---|
| [DESIGN.md](DESIGN.md) | colour, type, spacing, borders, motion, a new component | ~2.2k |
| [ARCHITECTURE.md](ARCHITECTURE.md) | a new route or module, navigation, gating, the file map | ~1.6k |
| [DATA.md](DATA.md) | schema, RLS, migrations, persistence, plans and quotas | ~1.5k |
| [API.md](API.md) | endpoints, auth, rate limits, the MCP contract | ~1.3k |
| [`../mcp/README.md`](../mcp/README.md) | the standalone MCP server package | — |
| [`../README.md`](../README.md) | what the product is, for humans | — |

`AGENTS.md` at the repo root is the entry point and stays deliberately short — it is loaded on **every** turn, so anything durable but situational belongs in one of the files above instead.

## House rules for these files

1. **One file, one job.** If a section would only ever be read by a different task, it belongs in that task's file.
2. **YAML frontmatter on every file** — `title`, `summary`, `version`, `updated`, `area`, `read_when`, `skip_when`, `tokens_est`. `read_when` / `skip_when` are what let a model skip a file without reading it.
3. **Heading hierarchy is the chunk boundary.** `#` once, `##` per section, `###` sparingly. Retrieval splits on headings, so a wall of text is one unhelpful chunk.
4. **Tables over prose** for anything enumerable — tokens, routes, statuses, limits.
5. **Point at the source of truth, never copy it.** These docs name files and constants; they do not restate code that would then drift.
6. **No screenshots, no decorative HTML, no dead links.** They cost tokens and carry nothing.
7. **Facts, dated.** Bump `updated` and `version` when the content changes.
