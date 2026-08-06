import type { Skill } from "./types";

// Shared skills.sh search. Lives here rather than in the route because the
// onboarding draft needs the same lookup to pick real skills — a model asked
// to name repos from memory invents `owner/repo` pairs that `npx skills add`
// then fails to resolve.

const SKILLS_SH = "https://www.skills.sh/api/search";

interface SkillShItem {
  id: string;
  skillId: string;
  name: string;
  installs?: number;
  source: string; // owner/repo
}

function prettify(name: string) {
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function mapItem(it: SkillShItem): Skill {
  return {
    id: it.id,
    name: prettify(it.name || it.skillId),
    slug: it.skillId,
    // skills.sh publishes no description on any endpoint, so this stays empty
    // and the card renders nothing rather than a line that only repeats the
    // repo shown directly above it. `enrich` fills in what it can.
    description: "",
    category: it.source.split("/")[0] ?? "skills.sh",
    source: "skills.sh",
    repo: it.source,
    tags: [],
    installs: it.installs,
  };
}

/** One skills.sh query. Throws on a bad response so callers can decide. */
export async function searchSkills(q: string, limit = 80): Promise<Skill[]> {
  const res = await fetch(`${SKILLS_SH}?q=${encodeURIComponent(q)}`, {
    headers: { "user-agent": "creagent/1.0", accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`skills.sh ${res.status}`);

  const data = (await res.json()) as { skills?: SkillShItem[] };
  const items = Array.isArray(data.skills) ? data.skills : [];
  return items.slice(0, limit).map(mapItem);
}

/**
 * Run several queries and merge the hits, best-installed first. A failed term
 * is skipped rather than sinking the batch — a partial candidate list is far
 * more useful here than none.
 */
export async function searchSkillsMany(terms: string[], perTerm = 12): Promise<Skill[]> {
  const results = await Promise.allSettled(
    terms.map((t) => searchSkills(t, perTerm)),
  );

  const byRepo = new Map<string, Skill>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const skill of r.value) {
      // `npx skills add` only resolves owner/repo, so anything else is not
      // installable and has no business in a generated agent.
      if (!skill.repo?.includes("/")) continue;
      const existing = byRepo.get(skill.repo);
      if (!existing || (skill.installs ?? 0) > (existing.installs ?? 0)) {
        byRepo.set(skill.repo, skill);
      }
    }
  }

  return [...byRepo.values()].sort((a, b) => (b.installs ?? 0) - (a.installs ?? 0));
}
