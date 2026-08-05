import type { Skill } from "./types";
import { searchSkillsMany } from "./skills-search";
import { enrich } from "./aitmpl";

// The registry lookup that sits between the two model calls of an onboarding
// draft. Server-side either way: skills.sh and the aitmpl catalogue are ours to
// fetch, and a browser running its own model still asks us for the candidates.

// Enough for the model to choose well without turning the prompt into a
// catalogue dump billed by the token.
export const MAX_CANDIDATES = 30;

/** Terms the model asked to search for, cleaned up and capped. */
export function normalizeTerms(value: unknown): string[] {
  return (Array.isArray(value) ? value : [])
    .map((t) => String(t).trim())
    .filter((t) => t.length >= 2)
    .slice(0, 4);
}

/**
 * Search the registry and describe what came back. Returns an empty list
 * instead of throwing: nothing matching is a legitimate outcome of a draft,
 * and a registry hiccup should not sink the persona that already landed.
 */
export async function fetchCandidates(terms: string[]): Promise<Skill[]> {
  if (terms.length === 0) return [];
  try {
    // Enriched because skills.sh returns no description at all, and a name plus
    // an owner/repo is thin evidence to choose on. The aitmpl overlay only
    // covers about one candidate in nine, but a described candidate is the one
    // the model can actually judge.
    return (await enrich(await searchSkillsMany(terms))).slice(0, MAX_CANDIDATES);
  } catch {
    return [];
  }
}
