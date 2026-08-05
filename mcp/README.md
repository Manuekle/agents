# @manudev.jsx/agents

Serve an [agents.dev](https://agents-dev.vercel.app) agent — its system prompt and skills —
over MCP, so any MCP-capable client (Claude Desktop, Claude Code, Cursor, Codex,
Windsurf, Cline, Gemini…) can load it.

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
| prompt | `activate_agent` | inject the persona + skill context |
| resource | `agent://spec` | full agent spec JSON |
| resource | `agent://skills` | picked skills (name + owner/repo) |
| tool | `agent_info` | name / role / model / temperature |
| tool | `list_skills` | the agent's skills |
| tool | `system_prompt` | the raw system prompt |

## Agent spec

```json
{
  "name": "Pixel Reviewer",
  "role": "a meticulous code reviewer",
  "model": "claude-opus-5",
  "temperature": 0.4,
  "system": "You review diffs for correctness and clarity.",
  "skills": [{ "name": "Security Review", "repo": "anthropics/skills" }]
}
```

## Dev

```bash
npm install @manudev.jsx/agents
node test.mjs   # smoke test against example.agent.json
```
