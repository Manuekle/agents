import { agentInstallArgs, agentRepos, type Agent, type PickedSkill } from "./types";
import { KIND_META, componentId, kindOfArg, type AitmplKind } from "./aitmpl";
import {
  componentsOf,
  graphFromAgent,
  nodeRef,
  orchestratorOf,
  walkAgents,
  type AgentGraph,
  type GraphNode,
} from "./graph";

// The two registries install through different CLIs, so an agent that mixes
// them needs both lines. Each CLI takes all of its targets at once.
function installLines(agent: Agent): string[] {
  const lines: string[] = [];
  const repos = agentRepos(agent);
  if (repos.length) lines.push(`npx skills add ${repos.join(" ")}`);
  const args = agentInstallArgs(agent);
  if (args.length) lines.push(`npx claude-code-templates@latest ${args.join(" ")} --yes`);
  return lines;
}

// Install command(s) for an agent's picked skills. Works in any existing
// project — both CLIs detect the agent and write into the right config dir
// (.claude/skills, .agents/skills, …).
export function installCommand(agent: Agent): string {
  const lines = installLines(agent);
  return lines.length ? lines.join("\n") : "# pick some skills first";
}

// Bootstrap a brand-new project, then add the skills.
export function newProjectCommand(agent: Agent, scaffold = "npx create-next-app@latest my-agent-app --yes"): string {
  const add = installLines(agent)
    .map((l) => ` && ${l}`)
    .join("");
  return `${scaffold} && cd my-agent-app${add}`;
}

/** The graph an agent carries, building one from its flat picks if it has none. */
export function graphOf(agent: Agent): AgentGraph {
  return agent.graph ?? graphFromAgent(agent);
}

/** A component node in the spec's own vocabulary. */
function nodeComponentRef(n: GraphNode): {
  name: string;
  kind: AitmplKind;
  repo?: string;
  component?: string;
} {
  return n.repo
    ? { name: n.name, kind: "skills", repo: n.repo }
    : { name: n.name, kind: (kindOfArg(n.installArg) ?? "skills") as AitmplKind, component: componentId(n.installArg) };
}

/** Every subagent, flattened, each carrying its own components and parent. */
export function subagentSpecs(graph: AgentGraph): {
  name: string;
  role: string;
  model?: string;
  temperature?: number;
  system: string;
  parent: string | null;
  depth: number;
  skills: ReturnType<typeof nodeComponentRef>[];
}[] {
  const parentOf = new Map<string, string>();
  for (const e of graph.edges) parentOf.set(e.to, e.from);

  return walkAgents(graph)
    .filter((w) => w.node.kind === "subagent")
    .map(({ node, depth }) => {
      const parentId = parentOf.get(node.id);
      const parent = parentId ? (graph.nodes.find((n) => n.id === parentId)?.name ?? null) : null;
      return {
        name: node.name,
        role: node.role ?? "",
        model: node.model,
        temperature: node.temperature,
        system: node.systemPrompt ?? "",
        parent,
        depth,
        skills: componentsOf(graph, node.id).map(nodeComponentRef),
      };
    });
}

// The agent spec consumed by @manudev.jsx/creagent (creagent.agent.json).
//
// `skills` stays the flat union so an older server build still finds every
// component where it expects it; `orchestrator` and `subagents` are additive,
// and a server that does not know about them simply serves the root persona.
export function agentSpec(agent: Agent) {
  const graph = graphOf(agent);
  const root = orchestratorOf(graph);

  return {
    version: 2 as const,
    name: agent.name,
    role: agent.role,
    model: agent.model,
    temperature: agent.temperature,
    system: agent.systemPrompt,
    skills: agent.skills.map(skillRef),
    orchestrator: root
      ? {
          name: root.name,
          role: root.role ?? agent.role,
          model: root.model ?? agent.model,
          temperature: typeof root.temperature === "number" ? root.temperature : agent.temperature,
          system: root.systemPrompt ?? agent.systemPrompt,
          skills: componentsOf(graph, root.id).map(nodeComponentRef),
        }
      : null,
    subagents: subagentSpecs(graph),
  };
}

export function agentSpecJson(agent: Agent): string {
  return JSON.stringify(agentSpec(agent), null, 2);
}

// Command that serves this agent over MCP to any MCP client.
export function mcpServeCommand(): string {
  return "npx -y @manudev.jsx/creagent --agent ./creagent.agent.json";
}

// A reproducible manifest of the picks (drop in repo, share, re-install).
// `owners` records which agent each component belongs to: the install commands
// are flat by necessity — both CLIs write into one skills dir — but the
// manifest is what a reviewer reads to see who was given what.
export function skillsManifest(agent: Agent): string {
  const graph = graphOf(agent);
  const nameOf = new Map(graph.nodes.map((n) => [n.id, n.name]));
  const owners: Record<string, string> = {};
  for (const e of graph.edges) {
    const child = graph.nodes.find((n) => n.id === e.to);
    if (child && !isAgentNode(child)) owners[nodeRef(child)] = nameOf.get(e.from) ?? "?";
  }

  return JSON.stringify(
    {
      agent: agent.name,
      target: agent.target,
      model: agent.model,
      skills: agent.skills.map(skillRef),
      repos: agentRepos(agent),
      templates: agentInstallArgs(agent),
      subagents: subagentSpecs(graph).map((s) => ({ name: s.name, parent: s.parent })),
      owners,
    },
    null,
    2,
  );
}

function isAgentNode(n: GraphNode): boolean {
  return n.kind === "orchestrator" || n.kind === "subagent";
}

// An agent is not only skills any more — it can carry subagents, slash
// commands, MCP servers, hooks and settings, each with its own CLI flag.
function kindOf(s: PickedSkill): AitmplKind {
  // A skills.sh pick has a repo and no flag to read, and is always a skill.
  return s.repo ? "skills" : (kindOfArg(s.installArg) ?? "skills");
}

// How a picked component identifies itself in an export: its owner/repo, or
// the CLI component id it installs by when it has no repo.
function skillRef(s: PickedSkill): {
  name: string;
  kind: AitmplKind;
  repo?: string;
  component?: string;
} {
  return s.repo
    ? { name: s.name, kind: "skills", repo: s.repo }
    : { name: s.name, kind: kindOf(s), component: componentId(s.installArg) };
}

// The picks as markdown, one `### ` section per kind that is actually present.
// A flat list stopped carrying enough once hooks and MCP servers could sit in
// it next to skills.
function componentSections(agent: Agent): string {
  const sections = KIND_META.map((meta) => {
    const items = agent.skills.filter((s) => kindOf(s) === meta.id);
    if (items.length === 0) return null;
    const lines = items
      .map((s) => `- **${s.name}** — \`${s.repo ?? componentId(s.installArg) ?? "?"}\``)
      .join("\n");
    return `### ${meta.title}\n\n${lines}`;
  }).filter((s): s is string => s !== null);

  return sections.length ? sections.join("\n\n") : "- (none)";
}

/**
 * The orchestrator's own components, as markdown. Distinct from
 * `componentSections`, which lists everything in the agent regardless of which
 * specialist owns it — the root section must not claim a subagent's tools.
 */
function rootComponentSections(agent: Agent): string {
  const graph = graphOf(agent);
  const root = orchestratorOf(graph);
  if (!root) return componentSections(agent);
  const owned = componentsOf(graph, root.id);
  if (owned.length === 0) return "- (none — every component belongs to a subagent)";

  const sections = KIND_META.map((meta) => {
    const items = owned.filter((n) => (n.repo ? "skills" : (kindOfArg(n.installArg) ?? "skills")) === meta.id);
    if (items.length === 0) return null;
    return `### ${meta.title}\n\n${items.map((n) => `- **${n.name}** — \`${nodeRef(n)}\``).join("\n")}`;
  }).filter((s): s is string => s !== null);

  return sections.length ? sections.join("\n\n") : "- (none)";
}

/**
 * The delegation tree as markdown. Every target tool gets the same block: even
 * the ones with no native subagent format benefit from the model being told,
 * in prose, who it can hand work to and what each specialist carries.
 */
function subagentSections(agent: Agent): string {
  const subs = subagentSpecs(graphOf(agent));
  if (subs.length === 0) return "";

  const blocks = subs.map((s) => {
    const tools = s.skills.length
      ? s.skills.map((c) => `- **${c.name}** — \`${c.repo ?? c.component ?? "?"}\` (${c.kind})`).join("\n")
      : "- (none)";
    const model = s.model ? `\n> model: ${s.model}${typeof s.temperature === "number" ? ` · temp: ${s.temperature}` : ""}` : "";
    return `### ${s.name}

> ${s.role || "specialist"}
> delegated from: ${s.parent ?? "(unconnected)"}${model}

${s.system || "_No system prompt set._"}

**Components**

${tools}`;
  });

  return `## Subagents

Delegate to these specialists rather than doing their work inline. Each one
owns only the components listed under it.

${blocks.join("\n\n")}`;
}

/** `\n\n` + the block, or nothing — so an agent with no subagents has no gap. */
function withSubagents(agent: Agent): string {
  const block = subagentSections(agent);
  return block ? `\n${block}\n` : "";
}

// Turn an agent spec into the config file its target tool expects.
export function exportAgent(agent: Agent): { filename: string; lang: string; content: string } {
  const components = rootComponentSections(agent);
  const subagents = withSubagents(agent);
  const install = installCommand(agent);

  switch (agent.target) {
    case "claude-code":
      return {
        filename: "CLAUDE.md",
        lang: "markdown",
        content: `# ${agent.name}

> ${agent.role}
> model: ${agent.model} · temp: ${agent.temperature}

## System

${agent.systemPrompt}

## Components

${components}
${subagents}
## Install

\`\`\`bash
${install}
\`\`\`
`,
      };

    case "codex":
      return {
        filename: "AGENTS.md",
        lang: "markdown",
        content: `# ${agent.name}

Role: ${agent.role}
Model: ${agent.model}

## Instructions

${agent.systemPrompt}

## Components

${components}
${subagents}
## Install
\`\`\`bash
${install}
\`\`\`
`,
      };

    case "cursor":
      return {
        filename: ".cursorrules",
        lang: "text",
        content: `# ${agent.name} — ${agent.role}

${agent.systemPrompt}

Components in scope:

${components}
${subagents}
Install: ${install}
`,
      };

    case "gemini-cli":
      return {
        filename: "GEMINI.md",
        lang: "markdown",
        content: `# ${agent.name}\n\n${agent.systemPrompt}\n\n## Components\n\n${components}\n${subagents}\n## Install\n\`\`\`bash\n${install}\n\`\`\`\n`,
      };

    case "generic-mcp":
    default:
      // mcp.json that any MCP client (Claude Desktop, Cursor, …) can load.
      // Save agentSpecJson(agent) next to it as creagent.agent.json.
      return {
        filename: "mcp.json",
        lang: "json",
        content: JSON.stringify(
          {
            mcpServers: {
              creagent: {
                command: "npx",
                args: ["-y", "@manudev.jsx/creagent", "--agent", "./creagent.agent.json"],
              },
            },
          },
          null,
          2,
        ),
      };
  }
}
