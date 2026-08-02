import type { MascotState } from "./mascot";

export type AgentTarget = "claude-code" | "codex" | "cursor" | "gemini-cli" | "generic-mcp";

export interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  source: string; // registry/host it came from
  repo?: string; // owner/repo — the `npx skills add` target
  tags: string[];
  installs?: number;
}

// A skill the user picked into an agent. `repo` (owner/repo) is what the
// official `skills` CLI installs.
export interface PickedSkill {
  id: string;
  name: string;
  repo: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  target: AgentTarget;
  model: string;
  temperature: number;
  skills: PickedSkill[];
  mascot: MascotState;
  accent: string; // hex
  createdAt: number;
}

// Unique owner/repo install targets for an agent's picked skills.
export function agentRepos(agent: Agent): string[] {
  return Array.from(new Set(agent.skills.map((s) => s.repo).filter(Boolean)));
}

export const TARGETS: { id: AgentTarget; label: string; hint: string }[] = [
  { id: "claude-code", label: "Claude Code", hint: "CLAUDE.md + skills + subagents" },
  { id: "codex", label: "Codex", hint: "AGENTS.md + tools" },
  { id: "cursor", label: "Cursor", hint: ".cursorrules" },
  { id: "gemini-cli", label: "Gemini CLI", hint: "GEMINI.md" },
  { id: "generic-mcp", label: "Generic MCP", hint: "any MCP-capable model" },
];

// `tools` scopes a model to the CLIs that can actually run it. Cursor and
// Generic MCP are model-agnostic, so they get the whole list (see modelsFor).
export interface Model {
  id: string;
  label: string;
  vendor: string;
  tools: AgentTarget[];
}

export const MODELS: Model[] = [
  // Anthropic — Claude Code
  { id: "claude-opus-5", label: "Opus 5", vendor: "Anthropic", tools: ["claude-code"] },
  { id: "claude-fable-5", label: "Fable 5", vendor: "Anthropic", tools: ["claude-code"] },
  { id: "claude-sonnet-5", label: "Sonnet 5", vendor: "Anthropic", tools: ["claude-code"] },
  {
    id: "claude-haiku-4-5-20251001",
    label: "Haiku 4.5",
    vendor: "Anthropic",
    tools: ["claude-code"],
  },

  // OpenAI — Codex
  { id: "gpt-5.5", label: "GPT-5.5", vendor: "OpenAI", tools: ["codex"] },
  { id: "gpt-5-codex", label: "GPT-5 Codex", vendor: "OpenAI", tools: ["codex"] },
  { id: "gpt-5-codex-mini", label: "GPT-5 Codex Mini", vendor: "OpenAI", tools: ["codex"] },
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", vendor: "OpenAI", tools: ["codex"] },

  // Google — Gemini CLI
  { id: "gemini-3-pro", label: "Gemini 3 Pro", vendor: "Google", tools: ["gemini-cli"] },
  { id: "gemini-3-flash", label: "Gemini 3 Flash", vendor: "Google", tools: ["gemini-cli"] },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro Preview",
    vendor: "Google",
    tools: ["gemini-cli"],
  },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", vendor: "Google", tools: ["gemini-cli"] },
];

// Models the given tool can drive. Tools with no dedicated list run anything.
export function modelsFor(target: AgentTarget): Model[] {
  const scoped = MODELS.filter((m) => m.tools.includes(target));
  return scoped.length > 0 ? scoped : MODELS;
}
