import type { MascotState } from "./mascot";

export type AgentTarget = "claude-code" | "codex" | "cursor" | "gemini-cli" | "generic-mcp";

export interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  source: string; // where it was scraped from
  tags: string[];
  installs?: number;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  target: AgentTarget;
  model: string;
  temperature: number;
  skillIds: string[];
  mascot: MascotState;
  accent: string; // hex
  createdAt: number;
}

export const TARGETS: { id: AgentTarget; label: string; hint: string }[] = [
  { id: "claude-code", label: "Claude Code", hint: "CLAUDE.md + skills + subagents" },
  { id: "codex", label: "Codex", hint: "AGENTS.md + tools" },
  { id: "cursor", label: "Cursor", hint: ".cursorrules" },
  { id: "gemini-cli", label: "Gemini CLI", hint: "GEMINI.md" },
  { id: "generic-mcp", label: "Generic MCP", hint: "any MCP-capable model" },
];

export const MODELS: { id: string; label: string; vendor: string }[] = [
  { id: "claude-opus-4-8", label: "Opus 4.8", vendor: "Anthropic" },
  { id: "claude-sonnet-5", label: "Sonnet 5", vendor: "Anthropic" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5", vendor: "Anthropic" },
  { id: "gpt-5-codex", label: "GPT-5 Codex", vendor: "OpenAI" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", vendor: "Google" },
  { id: "llama-4-scout", label: "Llama 4 Scout", vendor: "Meta" },
];
