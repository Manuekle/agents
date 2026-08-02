import type { Agent, Skill } from "./types";

// Turn an agent spec into the config file its target tool expects.
export function exportAgent(agent: Agent, skills: Skill[]): { filename: string; lang: string; content: string } {
  const picked = skills.filter((s) => agent.skillIds.includes(s.id));
  const skillList = picked.map((s) => `- **${s.name}** — ${s.description}`).join("\n") || "- (none)";
  const skillSlugs = picked.map((s) => s.slug);

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

## Invocation

Use \`/<skill-name>\` to invoke a skill. Available: ${skillSlugs.map((s) => `\`/${s}\``).join(", ") || "—"}.
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

## Enabled skills
${skillList}
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
`,
      };

    case "gemini-cli":
      return {
        filename: "GEMINI.md",
        lang: "markdown",
        content: `# ${agent.name}\n\n${agent.systemPrompt}\n\n## Skills\n${skillList}\n`,
      };

    case "generic-mcp":
    default:
      return {
        filename: `${agent.name.toLowerCase().replace(/\s+/g, "-")}.mcp.json`,
        lang: "json",
        content: JSON.stringify(
          {
            name: agent.name,
            role: agent.role,
            model: agent.model,
            temperature: agent.temperature,
            system: agent.systemPrompt,
            skills: skillSlugs,
            mcpServers: {
              "agent-forge": {
                command: "npx",
                args: ["-y", "agent-forge-mcp", "--agent", agent.id],
              },
            },
          },
          null,
          2,
        ),
      };
  }
}
