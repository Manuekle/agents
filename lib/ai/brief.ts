import type { AgentTarget } from "@/lib/types";

// The onboarding form, flattened into the string the model reads. Shared by the
// hosted route and the browser path so both send the same brief; kept in its
// own module because the browser must not pull in the Foundry client to get it.

// Every field is capped before it reaches the model: the prompt is billed by
// the token, so an unbounded `purpose` is an unbounded bill.
export const LIMITS = { purpose: 600, domain: 200, tone: 40, teamName: 120 } as const;

export function clamp(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export interface BriefInput {
  purpose: string;
  domain?: string;
  tone?: string;
  target: AgentTarget | string;
  teamName?: string;
}

export function buildBrief(input: BriefInput): string {
  return [
    `Purpose: ${clamp(input.purpose, LIMITS.purpose)}`,
    `Domain/stack: ${clamp(input.domain, LIMITS.domain) || "general"}`,
    `Tone: ${clamp(input.tone, LIMITS.tone) || "direct"}`,
    `Target tool: ${input.target}`,
    clamp(input.teamName, LIMITS.teamName) && `Team/project: ${clamp(input.teamName, LIMITS.teamName)}`,
  ]
    .filter(Boolean)
    .join("\n");
}
