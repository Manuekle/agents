import { NextResponse } from "next/server";
import { SEED_SKILLS } from "@/lib/skills-seed";
import type { Skill } from "@/lib/types";

export const runtime = "nodejs";

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
    description: `Skill from ${it.source}`,
    category: it.source.split("/")[0] ?? "skills.sh",
    source: "skills.sh",
    repo: it.source,
    tags: [],
    installs: it.installs,
  };
}

// Proxy skills.sh search. Empty query -> seed catalog (the API needs q>=2).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ ok: true, source: "seed", skills: SEED_SKILLS });
  }

  try {
    const res = await fetch(`${SKILLS_SH}?q=${encodeURIComponent(q)}`, {
      headers: { "user-agent": "agents-dev/1.0", accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`skills.sh ${res.status}`);

    const data = (await res.json()) as { skills?: SkillShItem[] };
    const items = Array.isArray(data.skills) ? data.skills : [];
    const skills = items.slice(0, 80).map(mapItem);

    return NextResponse.json({ ok: true, source: "skills.sh", count: skills.length, skills });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "search failed",
      skills: SEED_SKILLS,
    });
  }
}
