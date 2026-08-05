import { NextResponse } from "next/server";
import type { PickedSkill, Skill } from "@/lib/types";
import { searchSkillsMany } from "@/lib/skills-search";
import { enrich } from "@/lib/aitmpl";
import { FOUNDRY_ERROR, clientIp, foundryClient, rateLimit } from "@/lib/foundry";

// Second half of the onboarding draft: search skills.sh with the model's own
// queries, then let it choose from what actually came back. Split from the
// persona call so the browser can show the persona while this runs.

export const runtime = "nodejs";

// The model picks by index out of a list the server actually fetched, so it
// can only ever return skills that exist. Asked to recall repos from memory it
// invents plausible `owner/repo` pairs that `npx skills add` cannot resolve.
const PICK_PROMPT =
  "Choose the skills that genuinely fit the agent described. " +
  "Reply with the indices of your picks, most relevant first, at most 6. " +
  "Prefer precision over coverage: return an empty list rather than padding " +
  "with skills that only loosely relate.";

const PICK_SCHEMA = {
  type: "object" as const,
  properties: { picks: { type: "array", items: { type: "integer" } } },
  required: ["picks"],
  additionalProperties: false,
};

// Enough for the model to choose well without turning the prompt into a
// catalogue dump billed by the token.
const MAX_CANDIDATES = 30;
const MAX_PICKS = 6;
const MAX_BRIEF = 1200;

export async function POST(req: Request) {
  const foundry = foundryClient();
  if (!foundry) return NextResponse.json({ error: FOUNDRY_ERROR }, { status: 500 });

  // Its own bucket: picking skills is the second half of one draft, so it must
  // not spend the draft endpoint's allowance.
  const limit = rateLimit("skills", clientIp(req));
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many requests — wait ${limit.retryAfter}s and try again.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const terms = (Array.isArray(raw.searchTerms) ? raw.searchTerms : [])
    .map((t) => String(t).trim())
    .filter((t) => t.length >= 2)
    .slice(0, 4);
  // Nothing to search for is a valid outcome, not an error — the caller shows
  // an empty picks list and sends the user to the composer.
  if (terms.length === 0) return NextResponse.json({ skills: [] });

  const brief = String(raw.brief ?? "").slice(0, MAX_BRIEF);
  const agent = `${String(raw.name ?? "").slice(0, 80)} — ${String(raw.role ?? "").slice(0, 120)}`;

  let candidates: Skill[];
  try {
    // Enriched because skills.sh returns no description at all, and a name plus
    // an owner/repo is thin evidence to choose on. The aitmpl overlay only
    // covers about one candidate in nine, but a described candidate is the one
    // the model can actually judge.
    candidates = (await enrich(await searchSkillsMany(terms))).slice(0, MAX_CANDIDATES);
  } catch {
    return NextResponse.json({ skills: [] });
  }
  if (candidates.length === 0) return NextResponse.json({ skills: [] });

  const list = candidates
    .map((s, i) => `${i}. ${s.name} — ${s.repo}${s.description ? ` — ${s.description}` : ""}`)
    .join("\n");

  try {
    const response = await foundry.client.responses.create({
      model: foundry.model,
      instructions: PICK_PROMPT,
      input: `${brief}\n\nAgent: ${agent}\n\nCandidate skills:\n${list}`,
      reasoning: { effort: "none" },
      max_output_tokens: 200,
      text: {
        format: { type: "json_schema", name: "skill_picks", strict: true, schema: PICK_SCHEMA },
      },
    });

    const parsed = JSON.parse(response.output_text ?? "{}") as { picks?: unknown };
    const picks = Array.isArray(parsed.picks) ? parsed.picks : [];

    const seen = new Set<number>();
    const skills: PickedSkill[] = picks
      .filter((i): i is number => Number.isInteger(i) && i >= 0 && i < candidates.length)
      // A model can repeat an index; the composer keys skills by id, so a
      // duplicate would render twice and double-count in the export.
      .filter((i) => !seen.has(i) && seen.add(i))
      .slice(0, MAX_PICKS)
      .map((i) => ({ id: candidates[i].id, name: candidates[i].name, repo: candidates[i].repo! }));

    return NextResponse.json({ skills });
  } catch {
    // The persona already landed; losing the picks to a model hiccup should
    // not surface as a failure the user has to retry.
    return NextResponse.json({ skills: [] });
  }
}
