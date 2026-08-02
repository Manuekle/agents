import { NextResponse } from "next/server";
import { SEED_SKILLS } from "@/lib/skills-seed";
import type { Skill } from "@/lib/types";

export const runtime = "nodejs";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Parse markdown "- **Name** — description" or "- name: description" lines
// out of a scraped README / listing.
function parseMarkdownSkills(md: string, source: string): Skill[] {
  const out: Skill[] = [];
  const seen = new Set<string>();
  const add = (rawName: string, rawDesc: string) => {
    const name = rawName.trim().replace(/\s+/g, " ");
    const description = rawDesc
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // md links -> text
      .replace(/[*`_]/g, "")
      .replace(/\s+/g, " ")
      .replace(/[.\s|]+$/, "")
      .trim();
    const slug = slugify(name);
    if (!slug || name.length < 2 || seen.has(slug) || out.length >= 60) return;
    seen.add(slug);
    out.push({
      id: `scraped-${slug}`,
      name,
      slug,
      description: description || name,
      category: "Scraped",
      source,
      tags: ["scraped"],
    });
  };

  // Format A — awesome-list link:  - [Name](url) — description
  const linkRe = /^\s*[-*]\s+\[([^\]]{2,60})\]\([^)]+\)\s*[—:\-–]?\s*(.{0,200})$/gm;
  // Format B — bold/plain:         - **Name** — description   |   - name: description
  const plainRe = /^\s*[-*]\s+(?:\*\*|`)?([A-Za-z0-9][\w .\-/]{1,50}?)(?:\*\*|`)?\s*[—:\-–]\s+(.{8,200})$/gm;

  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(md))) add(m[1], m[2]);
  while ((m = plainRe.exec(md))) add(m[1], m[2]);
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = url.searchParams.get("source");

  if (!source) {
    return NextResponse.json({ scraped: false, skills: SEED_SKILLS });
  }

  try {
    const target = new URL(source);
    if (!/^https?:$/.test(target.protocol)) throw new Error("bad protocol");

    const res = await fetch(target.toString(), {
      headers: { "user-agent": "agent-forge-scraper/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);

    const ct = res.headers.get("content-type") ?? "";
    let skills: Skill[] = [];

    if (ct.includes("application/json")) {
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.skills ?? data.items ?? []);
      skills = (arr as Record<string, unknown>[]).slice(0, 60).map((r, i) => {
        const name = String(r.name ?? r.title ?? `skill-${i}`);
        return {
          id: `scraped-${slugify(name)}-${i}`,
          name,
          slug: slugify(name),
          description: String(r.description ?? r.summary ?? "").slice(0, 200),
          category: String(r.category ?? "Scraped"),
          source: target.host,
          tags: Array.isArray(r.tags) ? (r.tags as string[]).slice(0, 5) : ["scraped"],
        };
      });
    } else {
      const text = await res.text();
      skills = parseMarkdownSkills(text, target.host);
    }

    if (skills.length === 0) {
      return NextResponse.json({
        scraped: false,
        error: "no skill entries found at source",
        skills: SEED_SKILLS,
      });
    }

    return NextResponse.json({ scraped: true, source: target.host, count: skills.length, skills });
  } catch (err) {
    return NextResponse.json({
      scraped: false,
      error: err instanceof Error ? err.message : "scrape failed",
      skills: SEED_SKILLS,
    });
  }
}
