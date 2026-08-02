#!/usr/bin/env node
// @agents-dev/mcp — serve an agents.dev agent spec over MCP (stdio).
//
// Reads an agent spec JSON (exported from agents.dev) and exposes it to any
// MCP-capable client (Claude Desktop, Cursor, …) as:
//   - prompt   `activate_agent`   -> injects the agent persona + skill context
//   - resource `agent://spec`     -> the full agent JSON
//   - resource `agent://skills`   -> the picked skills (name + owner/repo)
//   - tool     `agent_info`       -> name / role / model / temperature
//   - tool     `list_skills`      -> the agent's skills
//   - tool     `system_prompt`    -> the raw system prompt
//
// Spec resolution order: --agent <file>  |  $AGENTS_DEV_AGENT  |  ./agents-dev.agent.json

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

function resolveSpecPath() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--agent");
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  if (process.env.AGENTS_DEV_AGENT) return process.env.AGENTS_DEV_AGENT;
  return "agents-dev.agent.json";
}

function loadSpec() {
  const path = resolve(process.cwd(), resolveSpecPath());
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    process.stderr.write(
      `[agents-dev/mcp] agent spec not found at ${path}\n` +
        `  pass --agent <file>, set AGENTS_DEV_AGENT, or add ./agents-dev.agent.json\n`,
    );
    process.exit(1);
  }
  try {
    const spec = JSON.parse(raw);
    return {
      name: spec.name ?? "Untitled Agent",
      role: spec.role ?? "assistant",
      model: spec.model ?? "unspecified",
      temperature: typeof spec.temperature === "number" ? spec.temperature : 0.7,
      system: spec.system ?? spec.systemPrompt ?? "",
      skills: Array.isArray(spec.skills) ? spec.skills : [],
    };
  } catch (e) {
    process.stderr.write(`[agents-dev/mcp] invalid JSON: ${e.message}\n`);
    process.exit(1);
  }
}

function personaText(a) {
  const skills = a.skills.length
    ? a.skills.map((s) => `- ${s.name}${s.repo ? ` (${s.repo})` : ""}`).join("\n")
    : "- (none)";
  return [
    `You are "${a.name}", ${a.role}.`,
    "",
    a.system,
    "",
    "## Skills in scope",
    skills,
    "",
    `Preferred model: ${a.model} · temperature: ${a.temperature}`,
  ].join("\n");
}

const agent = loadSpec();
const server = new McpServer({ name: "agents-dev", version: "0.1.0" });

// ---- prompt: activate the agent persona ----
server.registerPrompt(
  "activate_agent",
  {
    title: `Activate: ${agent.name}`,
    description: "Load this agent's persona, system prompt and skill context.",
  },
  async () => ({
    messages: [
      {
        role: "user",
        content: { type: "text", text: personaText(agent) },
      },
    ],
  }),
);

// ---- resources ----
server.registerResource(
  "agent-spec",
  "agent://spec",
  { title: "Agent spec", description: "Full agents.dev spec JSON", mimeType: "application/json" },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(agent, null, 2) }],
  }),
);

server.registerResource(
  "agent-skills",
  "agent://skills",
  { title: "Agent skills", description: "Picked skills (name + owner/repo)", mimeType: "application/json" },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(agent.skills, null, 2) }],
  }),
);

// ---- tools ----
server.registerTool(
  "agent_info",
  {
    title: "Agent info",
    description: "Name, role, model and temperature of the active agent.",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { name: agent.name, role: agent.role, model: agent.model, temperature: agent.temperature, skillCount: agent.skills.length },
          null,
          2,
        ),
      },
    ],
  }),
);

server.registerTool(
  "list_skills",
  { title: "List skills", description: "The agent's skills as name + owner/repo.", inputSchema: {} },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(agent.skills, null, 2) }],
  }),
);

server.registerTool(
  "system_prompt",
  { title: "System prompt", description: "The agent's raw system prompt.", inputSchema: {} },
  async () => ({
    content: [{ type: "text", text: agent.system || "(empty)" }],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[agents-dev/mcp] serving "${agent.name}" (${agent.skills.length} skills)\n`);
