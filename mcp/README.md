# @agents-dev/mcp

Serve an [agents.dev](https://agents.dev) agent — its system prompt and skills —
over MCP, so any MCP-capable client (Claude Desktop, Claude Code, Cursor, Codex,
Windsurf, Cline, Gemini…) can load it.

## Use

1. In the agents.dev composer, download **agents-dev.agent.json**.
2. Drop it in your project root.
3. Add to your MCP client config (`.mcp.json`, `~/.claude/…`, etc.):

```json
{
  "mcpServers": {
    "agents-dev": {
      "command": "npx",
      "args": ["-y", "@agents-dev/mcp", "--agent", "./agents-dev.agent.json"]
    }
  }
}
```

4. Call the **activate_agent** prompt to load the persona.

Spec resolution order: `--agent <file>` → `$AGENTS_DEV_AGENT` → `./agents-dev.agent.json`.

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
  "model": "claude-opus-4-8",
  "temperature": 0.4,
  "system": "You review diffs for correctness and clarity.",
  "skills": [{ "name": "Security Review", "repo": "anthropics/skills" }]
}
```

## Dev

```bash
npm install
node test.mjs   # smoke test against example.agent.json
```
