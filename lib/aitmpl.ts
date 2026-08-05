import type { Skill } from "./types";

// Second catalog source, alongside skills.sh: the open claude-code-templates
// index (MIT, github.com/davila7/claude-code-templates) published as static
// JSON at aitmpl.com. It exists here for the one thing skills.sh does not
// give us — every entry carries a real description, a real category and a
// download count. The skills.sh search API returns only
// `{id, skillId, name, installs, source}`; there is no detail endpoint to ask
// for more (checked: /api/skills/:id, /api/skill?id=, ?full=1 all 404).
//
// The two sources install through different CLIs and neither is a superset of
// the other, so they stay labelled rather than silently merged:
//   skills.sh -> npx skills add owner/repo
//   aitmpl    -> npx claude-code-templates@latest --skill category/name --yes
//
// Overlap by slug is only ~11%, so this is a catalog, not an enrichment layer.
// `enrich` still applies that 11% to skills.sh results because it is free.

const BASE = "https://aitmpl.com/components";

// aitmpl publishes one feed per component kind, all sharing a schema and a CLI
// flag. The flags compose — `--skill a/b --hook c/d --mcp e/f` is one command —
// so an agent that mixes kinds still installs in a single line.
export const AITMPL_KINDS = {
  skills: "--skill",
  agents: "--agent",
  commands: "--command",
  mcps: "--mcp",
  hooks: "--hook",
  settings: "--setting",
} as const;

export type AitmplKind = keyof typeof AITMPL_KINDS;

// Order is the order the tabs render in: what an agent is made of, roughly
// most to least reached for.
export const KIND_META: { id: AitmplKind; label: string; title: string; blurb: string }[] = [
  { id: "skills", label: "skills", title: "Skills", blurb: "capabilities the agent can invoke" },
  {
    id: "agents",
    label: "subagents",
    title: "Subagents",
    blurb: "specialists the agent can delegate to",
  },
  { id: "commands", label: "commands", title: "Commands", blurb: "slash commands" },
  { id: "mcps", label: "mcp", title: "MCP servers", blurb: "MCP servers the agent connects to" },
  { id: "hooks", label: "hooks", title: "Hooks", blurb: "lifecycle automation" },
  { id: "settings", label: "settings", title: "Settings", blurb: "runtime configuration" },
];

export function isKind(v: string | null): v is AitmplKind {
  return v !== null && v in AITMPL_KINDS;
}

/**
 * `--skill web-data/search` -> `web-data/search`. The flag belongs in the
 * command; anywhere we are only naming the component it is noise.
 */
export function componentId(arg: string | undefined): string | undefined {
  return arg?.split(" ").slice(1).join(" ") || undefined;
}

/** The kind a pick belongs to, read back off its CLI flag. */
export function kindOfArg(arg: string | undefined): AitmplKind | null {
  const flag = arg?.split(" ")[0];
  const hit = (Object.keys(AITMPL_KINDS) as AitmplKind[]).find((k) => AITMPL_KINDS[k] === flag);
  return hit ?? null;
}

interface RawEntry {
  name: string;
  path: string;
  category: string;
  description?: string;
  keywords?: string[];
  downloads?: number;
}

// Long enough to judge a skill by, short enough that 30 of them in the
// onboarding picker's prompt stay affordable. Some upstream descriptions run
// past 700 characters and embed whole <example> blocks.
const MAX_DESC = 240;

function clean(desc: string | undefined): string {
  if (!desc) return "";
  // A chunk of the feed has descriptions that were serialised with their
  // surrounding quotes intact, and the agent entries carry literal "\n<example>"
  // transcripts that are noise in a card and in a prompt.
  const flat = desc
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .split(/\\n|\n/)[0]
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > MAX_DESC ? `${flat.slice(0, MAX_DESC - 1)}…` : flat;
}

function prettify(name: string): string {
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** `web-data/search.md` -> `web-data/search`, the CLI's component id. */
function slugOf(path: string): string {
  return path.replace(/\.(md|json|ya?ml)$/i, "");
}

/** Match key shared with skills.sh `skillId`, which is already kebab-case. */
export function slugKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toSkill(e: RawEntry, kind: AitmplKind): Skill {
  const slug = slugOf(e.path);
  return {
    id: `aitmpl:${kind}:${slug}`,
    name: prettify(e.name),
    slug,
    description: clean(e.description),
    category: e.category || "uncategorized",
    source: "aitmpl",
    // Deliberately no `repo`: 865 of the 871 entries have an empty one
    // upstream, so `npx skills add` cannot resolve them. They install through
    // `installArg` instead.
    installArg: `${AITMPL_KINDS[kind]} ${slug}`,
    tags: e.keywords ?? [],
    installs: e.downloads,
  };
}

// One parsed copy per server instance. The feed is ~128 KB of JSON for skills
// alone and changes maybe daily; re-parsing it per request is pure waste.
// `next.revalidate` handles freshness across instances, this handles the parse.
const memo = new Map<AitmplKind, Promise<Skill[]>>();

async function load(kind: AitmplKind): Promise<Skill[]> {
  const res = await fetch(`${BASE}/${kind}.json`, {
    headers: { accept: "application/json" },
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`aitmpl ${kind} ${res.status}`);
  const raw = (await res.json()) as RawEntry[];
  if (!Array.isArray(raw)) throw new Error(`aitmpl ${kind}: not an array`);
  return raw.filter((e) => e?.path && e?.name).map((e) => toSkill(e, kind));
}

/**
 * Every catalog at once, for the command palette — which promises to search
 * hooks and MCP servers, not just skills. Six feeds is one request rather than
 * six because they are all memoized here already, and a partial answer beats
 * failing the whole search over one feed.
 */
export async function catalogAll(): Promise<Skill[]> {
  const settled = await Promise.allSettled(
    (Object.keys(AITMPL_KINDS) as AitmplKind[]).map((k) => catalog(k)),
  );
  const out = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (out.length === 0) throw new Error("aitmpl: no catalog reachable");
  return out;
}

/** The full catalog for one kind. Throws so callers can fall back. */
export function catalog(kind: AitmplKind = "skills"): Promise<Skill[]> {
  let hit = memo.get(kind);
  if (!hit) {
    hit = load(kind).catch((err) => {
      // A failed fetch must not be cached as the answer forever.
      memo.delete(kind);
      throw err;
    });
    memo.set(kind, hit);
  }
  return hit;
}

/** Categories present in a catalog, with counts, most populated first. */
export function categoriesOf(skills: Skill[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of skills) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export type SortKey = "relevance" | "installs" | "alpha";

export function sortSkills(skills: Skill[], sort: SortKey): Skill[] {
  if (sort === "relevance") return skills;
  const out = [...skills];
  if (sort === "alpha") out.sort((a, b) => a.name.localeCompare(b.name));
  else out.sort((a, b) => (b.installs ?? 0) - (a.installs ?? 0));
  return out;
}

/** Substring match over the fields a person would actually search by. */
export function filterSkills(skills: Skill[], q: string, category?: string): Skill[] {
  const needle = q.trim().toLowerCase();
  return skills.filter((s) => {
    if (category && s.category !== category) return false;
    if (!needle) return true;
    return (
      s.name.toLowerCase().includes(needle) ||
      s.slug.toLowerCase().includes(needle) ||
      s.description.toLowerCase().includes(needle) ||
      s.tags.some((t) => t.toLowerCase().includes(needle))
    );
  });
}

/**
 * Overlay aitmpl's description/category/tags onto skills.sh results whose slug
 * matches. Only about one in nine hits, but a real description on one card in
 * nine beats "Skill from owner/repo" on all of them, and it costs one cached
 * fetch. A failure here is not worth failing the search over.
 */
export async function enrich(skills: Skill[]): Promise<Skill[]> {
  let index: Map<string, Skill>;
  try {
    index = new Map((await catalog("skills")).map((s) => [slugKey(s.slug.split("/").pop() ?? s.slug), s]));
  } catch {
    return skills;
  }

  return skills.map((s) => {
    const hit = index.get(slugKey(s.slug));
    if (!hit?.description) return s;
    return {
      ...s,
      description: hit.description,
      // The skills.sh mapping uses the repo owner as a stand-in category
      // ("vercel-labs"); a real one ("web-development") is strictly better.
      category: hit.category,
      tags: s.tags.length ? s.tags : hit.tags,
    };
  });
}
