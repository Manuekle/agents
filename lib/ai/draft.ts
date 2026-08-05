"use client";

import type { PickedSkill, Skill } from "@/lib/types";
import { buildBrief, type BriefInput } from "./brief";
import {
  DRAFT_PROMPT,
  DRAFT_SCHEMA,
  PICK_PROMPT,
  PICK_SCHEMA,
  pickInput,
  resolvePicks,
  type DraftedAgent,
} from "./onboarding";
import { runStructured, type AiConfig } from "./structured";

// The onboarding draft, run from the browser against the user's own provider.
// Same two calls and the same prompts as the hosted route — the difference is
// that the key stays on this machine and the bill lands on their account, which
// is also why nothing here touches the monthly plan quota.

export interface Drafted extends DraftedAgent {
  brief: string;
}

export async function draftPersona(config: AiConfig, input: BriefInput): Promise<Drafted> {
  const brief = buildBrief(input);
  const drafted = await runStructured<DraftedAgent>(config, {
    instructions: DRAFT_PROMPT,
    input: brief,
    schemaName: "agent_persona",
    schema: DRAFT_SCHEMA,
    // Generous next to the ~150-token persona: a reasoning model spends part
    // of this budget thinking, and a tight cap truncates the JSON instead.
    maxTokens: 4096,
  });

  if (!drafted?.name || !drafted.role || !drafted.systemPrompt) {
    throw new Error("The model's reply was missing name, role or system prompt.");
  }

  return {
    name: drafted.name,
    role: drafted.role,
    systemPrompt: drafted.systemPrompt,
    searchTerms: Array.isArray(drafted.searchTerms) ? drafted.searchTerms.slice(0, 4) : [],
    brief,
  };
}

/** Registry lookup — ours to run either way, since skills.sh sends no CORS. */
async function candidates(searchTerms: string[]): Promise<Skill[]> {
  const res = await fetch("/api/skills/candidates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ searchTerms }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { candidates?: Skill[] };
  return Array.isArray(data.candidates) ? data.candidates : [];
}

export async function pickSkills(config: AiConfig, drafted: Drafted): Promise<PickedSkill[]> {
  if (drafted.searchTerms.length === 0) return [];

  const found = await candidates(drafted.searchTerms);
  if (found.length === 0) return [];

  const parsed = await runStructured<{ picks?: unknown }>(config, {
    instructions: PICK_PROMPT,
    input: pickInput(drafted.brief, `${drafted.name} — ${drafted.role}`, found),
    schemaName: "skill_picks",
    schema: PICK_SCHEMA,
    maxTokens: 2048,
  });

  return resolvePicks(parsed?.picks, found);
}
