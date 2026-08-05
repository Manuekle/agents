# @manudev.jsx/agents

Serve an [agents.dev](https://agents-dev.vercel.app) agent over MCP, so any
MCP-capable client (Claude Desktop, Claude Code, Cursor, Codex, Windsurf, Cline,
Gemini…) can load it.

An agent is not one persona any more. The composer's canvas builds an
**orchestrator** that delegates to **subagents**, each carrying only the
components it needs, and this server exposes that whole structure: the roster
the orchestrator can hand work to, each specialist's own prompt, and which
components belong to whom.

## Use

Two ways to point it at an agent.

### From your account (needs Pro or Max)

Create a token on [the MCP page](https://agents-dev.vercel.app/mcp), then:

```json
{
  "mcpServers": {
    "agents-dev": {
      "command": "npx",
      "args": ["-y", "@manudev.jsx/agents", "--token", "adv_…"]
    }
  }
}
```

The agent is fetched from your account, so it follows you between machines
rather than living in one file. Add `--agent-id <id>` to pick a specific one;
without it you get your most recent agent.

### From a file (works on every plan, no account)

1. In the agents.dev composer, download **agents-dev.agent.json**.
2. Drop it in your project root.
3. Add to your MCP client config (`.mcp.json`, `~/.claude/…`, etc.):

```json
{
  "mcpServers": {
    "agents-dev": {
      "command": "npx",
      "args": ["-y", "@manudev.jsx/agents", "--agent", "./agents-dev.agent.json"]
    }
  }
}
```

Then call the **activate_agent** prompt to load the persona.

Resolution order: `--token` / `$AGENTS_DEV_TOKEN` wins if present; otherwise
`--agent <file>` → `$AGENTS_DEV_AGENT` → `./agents-dev.agent.json`.
`$AGENTS_DEV_API` overrides the API host for self-hosted deploys.

## Exposes

| kind | name | purpose |
|------|------|---------|
| prompt | `activate_agent` | the orchestrator persona, its own components, and the roster of specialists it can delegate to |
| prompt | `activate_subagent` | one specialist's persona, by `name`. Only registered when the agent has specialists |
| resource | `agent://spec` | full agent spec JSON |
| resource | `agent://skills` | every component in the agent (name + owner/repo), flat |
| resource | `agent://subagents` | the delegation tree: each specialist, its parent and its components |
| tool | `agent_info` | name / role / model / temperature / spec version / counts |
| tool | `list_skills` | components. Pass `agent` to scope to the orchestrator or one specialist; omit for all |
| tool | `list_subagents` | the specialists and what each one carries |
| tool | `system_prompt` | a raw system prompt. Pass `agent` for a specialist's; omit for the orchestrator's |

Lookups by `agent` are case-insensitive and take the name a human would type.
An unknown name is an error that lists the ones that exist rather than a silent
empty result.

## Agent spec

Version 2. A v1 file — one persona and a flat `skills` array — still loads: it
simply has no specialists, and `skills` means the same thing in both.

```json
{
  "version": 2,
  "name": "Pixel Reviewer",
  "role": "a meticulous code reviewer",
  "model": "claude-opus-5",
  "temperature": 0.4,
  "system": "You review diffs. Delegate the specialised passes.",

  "skills": [
    { "name": "Security Review", "kind": "skills", "repo": "anthropics/skills" }
  ],

  "orchestrator": {
    "name": "Pixel Reviewer",
    "role": "a meticulous code reviewer",
    "model": "claude-opus-5",
    "temperature": 0.4,
    "system": "You review diffs. Delegate the specialised passes.",
    "skills": []
  },

  "subagents": [
    {
      "name": "Security Pass",
      "role": "hunts for injection, authz gaps and leaked secrets",
      "model": "claude-opus-5",
      "temperature": 0.2,
      "system": "You look for security defects only.",
      "parent": "Pixel Reviewer",
      "depth": 1,
      "skills": [
        { "name": "Security Review", "kind": "skills", "repo": "anthropics/skills" }
      ]
    }
  ]
}
```

`skills` at the top level is the flat union of every component in the graph,
whichever specialist holds it — that is what the install CLIs read, and it is
why it stays even though `orchestrator.skills` and each subagent's `skills`
already say who owns what. A specialist that sets no `model` or `temperature`
inherits the root's.

## Dev

```bash
npm install @manudev.jsx/agents
node test.mjs   # smoke test: v2 tree + v1 backwards compatibility
```
