import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/foundry";
import { SEED_SKILLS } from "@/lib/skills-seed";
import { searchSkills } from "@/lib/skills-search";
import {
  catalog,
  catalogAll,
  categoriesOf,
  enrich,
  filterSkills,
  isKind,
  sortSkills,
  type SortKey,
} from "@/lib/aitmpl";

export const runtime = "nodejs";

const SORTS: SortKey[] = ["relevance", "installs", "alpha"];
const PAGE = 60;

// A skills.sh query is a live outbound fetch on every miss (lib/skills-search
// has no cache of its own — only the aitmpl catalog does), so this route is one
// unauthenticated request away from being a scraping proxy for skills.sh
// wearing our IP. That is the exact reason /api/skills/candidates is gated;
// this one has to stay public because /skills and ⌘K are, so it gets a ceiling
// instead of a login. Generous on purpose: the command palette fires two of
// these per search and the browser paginates.
const MAX_PER_MINUTE = 60;

// No registry query is a paragraph. Longer than this is either a mistake or an
// attempt to make the upstream do expensive work on our behalf.
const MAX_QUERY = 120;

function sortParam(v: string | null): SortKey {
  return SORTS.includes(v as SortKey) ? (v as SortKey) : "relevance";
}

function offsetParam(v: string | null): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

// Two catalogs, kept apart rather than merged: they install through different
// CLIs and only ~11% of entries overlap. `source=aitmpl` browses the
// claude-code-templates index (real descriptions + categories, no owner/repo);
// the default searches skills.sh (installable via `npx skills add`) and
// overlays aitmpl copy wherever a slug happens to match.
export async function GET(req: Request) {
  const limit = rateLimit("skills", clientIp(req), MAX_PER_MINUTE);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "rate limited", skills: [] },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

  const params = new URL(req.url).searchParams;
  // Truncated rather than rejected: a query this long is never deliberate, and
  // the first 120 characters still search for whatever the visitor meant.
  const q = (params.get("q")?.trim() ?? "").slice(0, MAX_QUERY);
  const sort = sortParam(params.get("sort"));

  if (params.get("source") === "aitmpl") {
    const category = params.get("category")?.trim() || undefined;
    const kindParam = params.get("kind");
    // `kind=all` searches every feed at once — what the command palette needs,
    // since nobody typing "postgres" knows whether the answer is a skill, a
    // subagent or an MCP server.
    const everything = kindParam === "all";
    const kind = isKind(kindParam) ? kindParam : "skills";
    const offset = offsetParam(params.get("offset"));
    try {
      const all = everything ? await catalogAll() : await catalog(kind);
      // Categories come off the whole catalog, not the filtered slice, so the
      // chips do not vanish as you narrow the search.
      const matched = sortSkills(filterSkills(all, q, category), sort);
      const page = matched.slice(offset, offset + PAGE);
      return NextResponse.json({
        ok: true,
        source: "aitmpl",
        kind: everything ? "all" : kind,
        count: matched.length,
        total: all.length,
        offset,
        // The browser appends pages, so it needs to know when to stop asking.
        hasMore: offset + page.length < matched.length,
        categories: categoriesOf(all),
        skills: page,
      });
    } catch (err) {
      return NextResponse.json({
        ok: false,
        source: "aitmpl",
        kind,
        error: err instanceof Error ? err.message : "catalog unavailable",
        categories: [],
        skills: [],
      });
    }
  }

  // Empty query -> seed catalog (the skills.sh API needs q >= 2).
  if (q.length < 2) {
    return NextResponse.json({
      ok: true,
      source: "seed",
      skills: sortSkills(SEED_SKILLS, sort),
    });
  }

  try {
    const skills = sortSkills(await enrich(await searchSkills(q)), sort);
    return NextResponse.json({ ok: true, source: "skills.sh", count: skills.length, skills });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "search failed",
      skills: sortSkills(SEED_SKILLS, sort),
    });
  }
}
