import { NextResponse } from "next/server";
import { SEED_SKILLS } from "@/lib/skills-seed";
import { searchSkills } from "@/lib/skills-search";

export const runtime = "nodejs";

// Proxy skills.sh search. Empty query -> seed catalog (the API needs q>=2).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ ok: true, source: "seed", skills: SEED_SKILLS });
  }

  try {
    const skills = await searchSkills(q);
    return NextResponse.json({ ok: true, source: "skills.sh", count: skills.length, skills });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "search failed",
      skills: SEED_SKILLS,
    });
  }
}
