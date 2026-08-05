import { NextResponse } from "next/server";
import type { PickedSkill } from "@/lib/types";
import { FOUNDRY_ERROR, clientIp, foundryClient, rateLimit } from "@/lib/foundry";
import { fetchCandidates, normalizeTerms } from "@/lib/skills-candidates";
import { PICK_PROMPT, PICK_SCHEMA, pickInput, resolvePicks } from "@/lib/ai/onboarding";
import { requireAccount } from "@/lib/api-auth";

// Second half of the onboarding draft: search skills.sh with the model's own
// queries, then let it choose from what actually came back. Split from the
// persona call so the browser can show the persona while this runs.
//
// Hosted path only — a bring-your-own-key draft runs the same prompt in the
// browser and calls /api/skills/candidates for the lookup half.

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Same bill as the persona call, so the same requirement. The draft *count*
  // is still spent once, over in ../route.ts — one draft is one persona plus
  // one pick, and charging for both halves would halve everyone's quota.
  const gate = await requireAccount("pick skills for an agent");
  if (!gate.ok) return gate.response;

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
  const terms = normalizeTerms(raw.searchTerms);
  // Nothing to search for is a valid outcome, not an error — the caller shows
  // an empty picks list and sends the user to the composer.
  if (terms.length === 0) return NextResponse.json({ skills: [] });

  const candidates = await fetchCandidates(terms);
  if (candidates.length === 0) return NextResponse.json({ skills: [] });

  const brief = String(raw.brief ?? "");
  const agent = `${String(raw.name ?? "").slice(0, 80)} — ${String(raw.role ?? "").slice(0, 120)}`;

  try {
    const response = await foundry.client.responses.create({
      model: foundry.model,
      instructions: PICK_PROMPT,
      input: pickInput(brief, agent, candidates),
      reasoning: { effort: "none" },
      max_output_tokens: 200,
      text: {
        format: { type: "json_schema", name: "skill_picks", strict: true, schema: PICK_SCHEMA },
      },
    });

    const parsed = JSON.parse(response.output_text ?? "{}") as { picks?: unknown };
    const skills: PickedSkill[] = resolvePicks(parsed.picks, candidates);

    return NextResponse.json({ skills });
  } catch {
    // The persona already landed; losing the picks to a model hiccup should
    // not surface as a failure the user has to retry.
    return NextResponse.json({ skills: [] });
  }
}
