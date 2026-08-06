#!/usr/bin/env node
// @manudev.jsx/creagent — serve a creagent agent spec over MCP (stdio).
//
// Reads an agent spec JSON (exported from creagent) and exposes it to any
// MCP-capable client (Claude Desktop, Cursor, …) as:
//   - prompt   `activate_agent`     -> the orchestrator persona + its delegation roster
//   - prompt   `activate_subagent`  -> one specialist's persona, by name
//   - resource `agent://spec`       -> the full agent JSON
//   - resource `agent://skills`     -> every component in the agent (flat)
//   - resource `agent://subagents`  -> the delegation tree
//   - tool     `agent_info`         -> name / role / model / temperature / counts
//   - tool     `list_skills`        -> components, optionally scoped to one agent
//   - tool     `list_subagents`     -> the specialists and what each one carries
//   - tool     `system_prompt`      -> a raw system prompt, root or specialist
//
// Spec versions: v1 was one persona and a flat `skills` array. v2 adds
// `orchestrator` and `subagents`. Both load — a v1 file simply has no
// specialists, and `skills` means the same thing in both.
//
// Two ways to get the spec:
//   - signed in: --token <api-token> [--agent-id <id>]  |  $CREAGENT_TOKEN
//                pulls the agent from your creagent account, so it follows
//                you between machines instead of living in one file
//   - local:     --agent <file>  |  $CREAGENT_AGENT  |  ./creagent.agent.json
//
// The token wins when both are present.
//
// The project was called agents.dev before creagent.fun, and the published
// package predates the rename: every $CREAGENT_* var still falls back to its
// $AGENTS_DEV_* spelling, and the local spec falls back to the old
// agents-dev.agent.json, so an existing client config keeps working untouched.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE =
  process.env.CREAGENT_API ?? process.env.AGENTS_DEV_API ?? "https://creagent.fun";

function flag(name) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
}

function componentList(raw) {
  return Array.isArray(raw) ? raw.filter((c) => c && typeof c.name === "string") : [];
}

/** Where a component came from, in one string: `owner/repo` or the CLI id. */
function refOf(c) {
  return c.repo ?? c.component ?? null;
}

function normaliseSubagent(raw, root) {
  return {
    name: typeof raw.name === "string" && raw.name ? raw.name : "Unnamed specialist",
    role: raw.role ?? "specialist",
    // A specialist that never overrode the model inherits the root's, so a
    // client asking "what runs this" always gets an answer.
    model: raw.model ?? root.model,
    temperature: typeof raw.temperature === "number" ? raw.temperature : root.temperature,
    system: raw.system ?? raw.systemPrompt ?? "",
    parent: raw.parent ?? null,
    depth: typeof raw.depth === "number" ? raw.depth : 1,
    skills: componentList(raw.skills),
  };
}

function normalise(spec) {
  const root = {
    name: spec.name ?? "Untitled Agent",
    role: spec.role ?? "assistant",
    model: spec.model ?? "unspecified",
    temperature: typeof spec.temperature === "number" ? spec.temperature : 0.7,
    system: spec.system ?? spec.systemPrompt ?? "",
    // The flat union of every component in the agent, whichever specialist
    // holds it. Unchanged from v1 — this is what installers read.
    skills: componentList(spec.skills),
  };

  // v2 splits the root's *own* components out of that union. A v1 spec has no
  // `orchestrator`, and there falling back to the union is right: with no
  // specialists to own anything, everything is the root's.
  const own = spec.orchestrator ? componentList(spec.orchestrator.skills) : root.skills;

  return {
    ...root,
    version: spec.version === 2 ? 2 : 1,
    own,
    subagents: (Array.isArray(spec.subagents) ? spec.subagents : [])
      .filter((s) => s && typeof s === "object")
      .map((s) => normaliseSubagent(s, root)),
  };
}

/** Case-insensitive lookup, so a client can pass the name a human would type. */
function findSubagent(agent, name) {
  const needle = String(name ?? "").trim().toLowerCase();
  return agent.subagents.find((s) => s.name.toLowerCase() === needle) ?? null;
}

function die(message) {
  // stderr, never stdout: stdout is the MCP transport, and a stray line there
  // corrupts the protocol stream rather than showing the user an error.
  process.stderr.write(`[manudev.jsx/creagent] ${message}\n`);
  process.exit(1);
}

async function fetchSpec(token) {
  const url = new URL("/api/mcp/agent", API_BASE);
  const agentId =
    flag("agent-id") ?? process.env.CREAGENT_AGENT_ID ?? process.env.AGENTS_DEV_AGENT_ID;
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
  // An explicit --agent / $CREAGENT_AGENT is taken literally — only the
  // implicit lookup gets the old filename as a second guess, so a spec exported
  // before the rename still loads without the user editing anything.
  const named = flag("agent") ?? process.env.CREAGENT_AGENT ?? process.env.AGENTS_DEV_AGENT;
  const candidates = (named ? [named] : ["creagent.agent.json", "agents-dev.agent.json"]).map((p) =>
    resolve(process.cwd(), p),
  );
  let raw;
  for (const candidate of candidates) {
    try {
      raw = readFileSync(candidate, "utf8");
      break;
    } catch {
      // next candidate; the loop reports only if none of them read
    }
  }
  if (raw === undefined) {
    die(
      `agent spec not found at ${candidates.join(" or ")}\n` +
        `  pass --agent <file>, set CREAGENT_AGENT, add ./creagent.agent.json,\n` +
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
  const token = flag("token") ?? process.env.CREAGENT_TOKEN ?? process.env.AGENTS_DEV_TOKEN;
  return token ? fetchSpec(token) : loadLocalSpec();
}

function componentLines(list) {
  if (!list.length) return "- (none)";
  return list.map((s) => `- ${s.name}${refOf(s) ? ` (${refOf(s)})` : ""}`).join("\n");
}

/**
 * The delegation roster. Naming the specialists *and* what each one carries is
 * the whole point: a model told only that "Reviewer" exists will guess at what
 * to send it, and guess wrong.
 */
function rosterText(a) {
  if (!a.subagents.length) return null;
  const rows = a.subagents.map((s) => {
    const tools = s.skills.length
      ? s.skills.map((c) => c.name).join(", ")
      : "no components of its own";
    return `- **${s.name}** — ${s.role}. Carries: ${tools}.`;
  });
  return [
    "## Subagents you can delegate to",
    "",
    ...rows,
    "",
    "Hand a task to the specialist that owns the components for it rather than",
    "doing that work yourself. Ask for a specialist's full prompt with the",
    "`activate_subagent` prompt or the `system_prompt` tool.",
  ].join("\n");
}

function personaText(a) {
  const roster = rosterText(a);
  return [
    `You are "${a.name}", ${a.role}.`,
    "",
    a.system,
    "",
    "## Components in scope",
    componentLines(a.own),
    ...(roster ? ["", roster] : []),
    "",
    `Preferred model: ${a.model} · temperature: ${a.temperature}`,
  ].join("\n");
}

function subagentText(a, s) {
  return [
    `You are "${s.name}", ${s.role}.`,
    `You are a specialist working under "${s.parent ?? a.name}".`,
    "",
    s.system || "(no system prompt was set for this specialist)",
    "",
    "## Components in scope",
    componentLines(s.skills),
    "",
    `Preferred model: ${s.model} · temperature: ${s.temperature}`,
  ].join("\n");
}

const agent = await loadSpec();
const server = new McpServer({ name: "creagent", version: "0.1.0" });

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

// Registered only when there is something to activate: an empty picker entry
// in every client's prompt list is worse than no entry at all.
if (agent.subagents.length) {
  server.registerPrompt(
    "activate_subagent",
    {
      title: "Activate a subagent",
      description: `Load one specialist's persona. One of: ${agent.subagents.map((s) => s.name).join(", ")}`,
      argsSchema: { name: z.string().describe("The specialist's name.") },
    },
    async ({ name }) => {
      const sub = findSubagent(agent, name);
      if (!sub) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `No subagent named "${name}". Available: ${agent.subagents.map((s) => s.name).join(", ")}`,
              },
            },
          ],
        };
      }
      return {
        messages: [{ role: "user", content: { type: "text", text: subagentText(agent, sub) } }],
      };
    },
  );
}

// ---- resources ----
server.registerResource(
  "agent-spec",
  "agent://spec",
  { title: "Agent spec", description: "Full creagent spec JSON", mimeType: "application/json" },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(agent, null, 2) }],
  }),
);

server.registerResource(
  "agent-skills",
  "agent://skills",
  {
    title: "Agent skills",
    description: "Every component in the agent (name + owner/repo), flat",
    mimeType: "application/json",
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(agent.skills, null, 2) }],
  }),
);

server.registerResource(
  "agent-subagents",
  "agent://subagents",
  {
    title: "Subagents",
    description: "The delegation tree: each specialist, its parent and its components",
    mimeType: "application/json",
  },
  async (uri) => ({
    contents: [
      { uri: uri.href, mimeType: "application/json", text: JSON.stringify(agent.subagents, null, 2) },
    ],
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
          {
            name: agent.name,
            role: agent.role,
            model: agent.model,
            temperature: agent.temperature,
            specVersion: agent.version,
            skillCount: agent.skills.length,
            ownSkillCount: agent.own.length,
            subagentCount: agent.subagents.length,
          },
          null,
          2,
        ),
      },
    ],
  }),
);

server.registerTool(
  "list_skills",
  {
    title: "List skills",
    description:
      "Components as name + owner/repo. Pass `agent` to scope it to the orchestrator or one specialist; omit it for every component in the agent.",
    inputSchema: {
      agent: z
        .string()
        .optional()
        .describe("Agent name to scope to. Omit for all components."),
    },
  },
  async ({ agent: scope }) => {
    if (!scope) return { content: [{ type: "text", text: JSON.stringify(agent.skills, null, 2) }] };
    if (scope.toLowerCase() === agent.name.toLowerCase()) {
      return { content: [{ type: "text", text: JSON.stringify(agent.own, null, 2) }] };
    }
    const sub = findSubagent(agent, scope);
    if (!sub) {
      const known = [agent.name, ...agent.subagents.map((s) => s.name)].join(", ");
      return {
        isError: true,
        content: [{ type: "text", text: `No agent named "${scope}". Known: ${known}` }],
      };
    }
    return { content: [{ type: "text", text: JSON.stringify(sub.skills, null, 2) }] };
  },
);

server.registerTool(
  "list_subagents",
  {
    title: "List subagents",
    description: "The specialists this agent can delegate to, and what each one carries.",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text",
        text: agent.subagents.length
          ? JSON.stringify(
              agent.subagents.map((s) => ({
                name: s.name,
                role: s.role,
                parent: s.parent,
                depth: s.depth,
                skills: s.skills.map((c) => ({ name: c.name, ref: refOf(c) })),
              })),
              null,
              2,
            )
          : "[]",
      },
    ],
  }),
);

server.registerTool(
  "system_prompt",
  {
    title: "System prompt",
    description:
      "A raw system prompt. Pass `agent` to get one specialist's; omit it for the orchestrator's.",
    inputSchema: {
      agent: z.string().optional().describe("Specialist name. Omit for the orchestrator."),
    },
  },
  async ({ agent: scope }) => {
    if (!scope || scope.toLowerCase() === agent.name.toLowerCase()) {
      return { content: [{ type: "text", text: agent.system || "(empty)" }] };
    }
    const sub = findSubagent(agent, scope);
    if (!sub) {
      const known = [agent.name, ...agent.subagents.map((s) => s.name)].join(", ");
      return {
        isError: true,
        content: [{ type: "text", text: `No agent named "${scope}". Known: ${known}` }],
      };
    }
    return { content: [{ type: "text", text: sub.system || "(empty)" }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(
  `[manudev.jsx/creagent] serving "${agent.name}" — ${agent.skills.length} components, ` +
    `${agent.subagents.length} subagents (spec v${agent.version})\n`,
);
