import type { PickedSkill, Skill } from "@/lib/types";

// The two model calls behind the onboarding draft, defined once. The hosted
// Foundry routes and the bring-your-own-key path in the browser both read from
// here, so a draft is the same draft whichever model produces it — the only
// difference is whose key pays for it.

export const DRAFT_PROMPT =
  "Draft a coding-agent persona from the user's brief. " +
  "name: 2-4 words, punchy. role: one lowercase clause, no leading article. " +
  "systemPrompt: 2-4 sentences, second person, concrete about scope and constraints, no filler. " +
  "searchTerms: 2-4 short queries (1-2 words each) for an agent-skill registry — " +
  "the technologies and practices this agent needs, e.g. \"react\", \"testing\", \"security\". " +
  "Do not name specific skills or repositories; these are search queries, not results.";

// Structured Outputs — the model is constrained to this shape, so the response
// is valid JSON on the first call. Without it a malformed reply costs a second
// round trip to recover from.
export const DRAFT_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" },
    role: { type: "string" },
    systemPrompt: { type: "string" },
    searchTerms: { type: "array", items: { type: "string" } },
  },
  required: ["name", "role", "systemPrompt", "searchTerms"],
  additionalProperties: false,
};

export interface DraftedAgent {
  name: string;
  role: string;
  systemPrompt: string;
  searchTerms: string[];
}

// The model picks by index out of a list the server actually fetched, so it
// can only ever return skills that exist. Asked to recall repos from memory it
// invents plausible `owner/repo` pairs that `npx skills add` cannot resolve.
export const PICK_PROMPT =
  "Choose the skills that genuinely fit the agent described. " +
  "Reply with the indices of your picks, most relevant first, at most 6. " +
  "Prefer precision over coverage: return an empty list rather than padding " +
  "with skills that only loosely relate.";

export const PICK_SCHEMA = {
  type: "object" as const,
  properties: { picks: { type: "array", items: { type: "integer" } } },
  required: ["picks"],
  additionalProperties: false,
};

export const MAX_PICKS = 6;
export const MAX_BRIEF = 1200;

/** The candidate list as the model sees it — index, name, repo, description. */
export function candidateList(candidates: Skill[]): string {
  return candidates
    .map((s, i) => `${i}. ${s.name} — ${s.repo}${s.description ? ` — ${s.description}` : ""}`)
    .join("\n");
}

export function pickInput(brief: string, agent: string, candidates: Skill[]): string {
  return `${brief.slice(0, MAX_BRIEF)}\n\nAgent: ${agent}\n\nCandidate skills:\n${candidateList(candidates)}`;
}

/**
 * Turn the model's indices into picks. Anything out of range is dropped rather
 * than trusted, and duplicates are collapsed — the composer keys skills by id,
 * so a repeated index would render twice and double-count in the export.
 */
export function resolvePicks(picks: unknown, candidates: Skill[]): PickedSkill[] {
  const list = Array.isArray(picks) ? picks : [];
  const seen = new Set<number>();
  return list
    .filter((i): i is number => Number.isInteger(i) && i >= 0 && i < candidates.length)
    .filter((i) => !seen.has(i) && seen.add(i))
    .slice(0, MAX_PICKS)
    .map((i) => ({ id: candidates[i].id, name: candidates[i].name, repo: candidates[i].repo! }));
}
