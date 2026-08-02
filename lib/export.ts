import { agentRepos, type Agent } from "./types";

// The official `skills` CLI install command for an agent's picked skills.
// Works in any existing project — it detects the agent and writes the skills
// into the right config dir (.claude/skills, .agents/skills, …).
export function installCommand(agent: Agent): string {
  const repos = agentRepos(agent);
  if (repos.length === 0) return "# pick some skills first";
  return `npx skills add ${repos.join(" ")}`;
}

// Bootstrap a brand-new project, then add the skills.
export function newProjectCommand(agent: Agent, scaffold = "npx create-next-app@latest my-agent-app --yes"): string {
  const repos = agentRepos(agent);
  const add = repos.length ? ` && npx skills add ${repos.join(" ")}` : "";
  return `${scaffold} && cd my-agent-app${add}`;
}

// The agent spec consumed by @agents-dev/mcp (agents-dev.agent.json).
export function agentSpecJson(agent: Agent): string {
  return JSON.stringify(
    {
      name: agent.name,
      role: agent.role,
      model: agent.model,
      temperature: agent.temperature,
      system: agent.systemPrompt,
      skills: agent.skills.map((s) => ({ name: s.name, repo: s.repo })),
    },
    null,
    2,
  );
}

// Command that serves this agent over MCP to any MCP client.
export function mcpServeCommand(): string {
  return "npx -y @agents-dev/mcp --agent ./agents-dev.agent.json";
}

// A reproducible manifest of the picks (drop in repo, share, re-install).
export function skillsManifest(agent: Agent): string {
  return JSON.stringify(
    {
      agent: agent.name,
      target: agent.target,
      model: agent.model,
      skills: agent.skills.map((s) => ({ name: s.name, repo: s.repo })),
      repos: agentRepos(agent),
    },
    null,
    2,
  );
}

// Turn an agent spec into the config file its target tool expects.
export function exportAgent(agent: Agent): { filename: string; lang: string; content: string } {
  const skillList =
    agent.skills.map((s) => `- **${s.name}** — \`${s.repo}\``).join("\n") || "- (none)";
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

## Skills

${skillList}

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

## Skills
${skillList}

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

Skills in scope:
${skillList}

Install: ${install}
`,
      };

    case "gemini-cli":
      return {
        filename: "GEMINI.md",
        lang: "markdown",
        content: `# ${agent.name}\n\n${agent.systemPrompt}\n\n## Skills\n${skillList}\n\n## Install\n\`\`\`bash\n${install}\n\`\`\`\n`,
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
                args: ["-y", "@agents-dev/mcp", "--agent", "./agents-dev.agent.json"],
              },
            },
          },
          null,
          2,
        ),
      };
  }
}
