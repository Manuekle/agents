import { agentInstallArgs, agentRepos, type Agent, type PickedSkill } from "./types";
import { KIND_META, componentId, kindOfArg, type AitmplKind } from "./aitmpl";

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

// The agent spec consumed by @manudev.jsx/agents (agents-dev.agent.json).
export function agentSpecJson(agent: Agent): string {
  return JSON.stringify(
    {
      name: agent.name,
      role: agent.role,
      model: agent.model,
      temperature: agent.temperature,
      system: agent.systemPrompt,
      skills: agent.skills.map(skillRef),
    },
    null,
    2,
  );
}

// Command that serves this agent over MCP to any MCP client.
export function mcpServeCommand(): string {
  return "npx -y @manudev.jsx/agents --agent ./agents-dev.agent.json";
}

// A reproducible manifest of the picks (drop in repo, share, re-install).
export function skillsManifest(agent: Agent): string {
  return JSON.stringify(
    {
      agent: agent.name,
      target: agent.target,
      model: agent.model,
      skills: agent.skills.map(skillRef),
      repos: agentRepos(agent),
      templates: agentInstallArgs(agent),
    },
    null,
    2,
  );
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

// Turn an agent spec into the config file its target tool expects.
export function exportAgent(agent: Agent): { filename: string; lang: string; content: string } {
  const components = componentSections(agent);
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

Install: ${install}
`,
      };

    case "gemini-cli":
      return {
        filename: "GEMINI.md",
        lang: "markdown",
        content: `# ${agent.name}\n\n${agent.systemPrompt}\n\n## Components\n\n${components}\n\n## Install\n\`\`\`bash\n${install}\n\`\`\`\n`,
      };

    case "generic-mcp":
    default:
      // mcp.json that any MCP client (Claude Desktop, Cursor, …) can load.
      // Save agentSpecJson(agent) next to it as agents-dev.agent.json.
      return {
        filename: "mcp.json",
        lang: "json",
        content: JSON.stringify(
          {
            mcpServers: {
              "agents-dev": {
                command: "npx",
                args: ["-y", "@manudev.jsx/agents", "--agent", "./agents-dev.agent.json"],
              },
            },
          },
          null,
          2,
        ),
      };
  }
}
