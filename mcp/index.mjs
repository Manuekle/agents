#!/usr/bin/env node
// @manudev.jsx/agents — serve an agents.dev agent spec over MCP (stdio).
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
// Two ways to get the spec:
//   - signed in: --token <api-token> [--agent-id <id>]  |  $AGENTS_DEV_TOKEN
//                pulls the agent from your agents.dev account, so it follows
//                you between machines instead of living in one file
//   - local:     --agent <file>  |  $AGENTS_DEV_AGENT  |  ./agents-dev.agent.json
//
// The token wins when both are present.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const API_BASE = process.env.AGENTS_DEV_API ?? "https://agents-dev.vercel.app";

function flag(name) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
}

function normalise(spec) {
  return {
    name: spec.name ?? "Untitled Agent",
    role: spec.role ?? "assistant",
    model: spec.model ?? "unspecified",
    temperature: typeof spec.temperature === "number" ? spec.temperature : 0.7,
    system: spec.system ?? spec.systemPrompt ?? "",
    skills: Array.isArray(spec.skills) ? spec.skills : [],
  };
}

function die(message) {
  // stderr, never stdout: stdout is the MCP transport, and a stray line there
  // corrupts the protocol stream rather than showing the user an error.
  process.stderr.write(`[manudev.jsx/agents] ${message}\n`);
  process.exit(1);
}

async function fetchSpec(token) {
  const url = new URL("/api/mcp/agent", API_BASE);
  const agentId = flag("agent-id") ?? process.env.AGENTS_DEV_AGENT_ID;
  if (agentId) url.searchParams.set("agent", agentId);

  let res;
  try {
    res = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    die(`could not reach ${API_BASE}: ${e.message}`);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // The API already explains 401/402/404 in plain words; pass it through
    // rather than inventing a vaguer message on top of it.
    die(`${res.status} — ${body.error ?? res.statusText}`);
  }

  return normalise(await res.json());
}

function loadLocalSpec() {
  const path = resolve(
    process.cwd(),
    flag("agent") ?? process.env.AGENTS_DEV_AGENT ?? "agents-dev.agent.json",
  );
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    die(
      `agent spec not found at ${path}\n` +
        `  pass --agent <file>, set AGENTS_DEV_AGENT, add ./agents-dev.agent.json,\n` +
        `  or sign in with --token <api-token> to pull it from your account`,
    );
  }
  try {
    return normalise(JSON.parse(raw));
  } catch (e) {
    die(`invalid JSON: ${e.message}`);
  }
}

async function loadSpec() {
  const token = flag("token") ?? process.env.AGENTS_DEV_TOKEN;
  return token ? fetchSpec(token) : loadLocalSpec();
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

const agent = await loadSpec();
const server = new McpServer({ name: "agents", version: "0.1.0" });

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
process.stderr.write(`[manudev.jsx/agents] serving "${agent.name}" (${agent.skills.length} skills)\n`);
