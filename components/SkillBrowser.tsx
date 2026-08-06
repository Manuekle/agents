"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@/components/ui";
import { SearchInput } from "@/components/SearchInput";
import { BarChart } from "@/components/dither-kit/bar-chart";
import { Bar } from "@/components/dither-kit/bar";
import { XAxis } from "@/components/dither-kit/x-axis";
import { YAxis } from "@/components/dither-kit/y-axis";
import { Tooltip } from "@/components/dither-kit/tooltip";
import { DitherAvatar } from "@/components/dither-kit/avatar";
import { avatarHue } from "@/lib/avatar";
import { clsx } from "@/lib/clsx";
import { copyText } from "@/lib/copy";
import { KIND_META, type AitmplKind } from "@/lib/aitmpl";
import type { PickedSkill, Skill } from "@/lib/types";

const SUGGESTIONS = ["react", "next", "testing", "database", "security", "tailwind", "docs", "ai"];

// The two catalogs are browsed, not blended: they install through different
// CLIs and only ~11% of their entries overlap. skills.sh is the installable,
// composable one; aitmpl is the one with real descriptions and categories.
const SOURCES = [
  { id: "skills.sh", label: "skills.sh", hint: "installable via npx skills add" },
  { id: "aitmpl", label: "aitmpl", hint: "skills, subagents, commands, MCP, hooks, settings" },
] as const;

type SourceId = (typeof SOURCES)[number]["id"];

const SORTS = [
  { id: "relevance", label: "Relevance" },
  { id: "installs", label: "Most installed" },
  { id: "alpha", label: "A–Z" },
] as const;

type SortId = (typeof SORTS)[number]["id"];

interface Category {
  name: string;
  count: number;
}

function fmtInstalls(n?: number) {
  if (!n) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

// The command that actually installs a given result, or null when neither
// channel can resolve it (a bare registry name, a docs host).
function installFor(s: Skill): string | null {
  const repo = s.repo ?? s.source;
  if (repo.includes("/")) return `npx skills add ${repo}`;
  if (s.installArg) return `npx claude-code-templates@latest ${s.installArg} --yes`;
  return null;
}

// Exactly one install channel is carried into the agent, so an export never
// installs the same skill through both CLIs.
function pick(s: Skill): PickedSkill {
  const repo = s.repo ?? s.source;
  return repo.includes("/")
    ? { id: s.id, name: s.name, repo }
    : { id: s.id, name: s.name, installArg: s.installArg };
}

// Who a skill comes from, as one stable string to seed the card avatar with.
// The owner half of owner/repo for skills.sh; for aitmpl there is no owner, so
// the catalog itself is the identity — every aitmpl result shares one glyph,
// which is the truth.
function ownerOf(s: Skill): string {
  return s.repo?.split("/")[0] ?? s.source;
}

// What the card shows under the name: the owner/repo for skills.sh, the CLI
// component id for aitmpl.
function targetLabel(s: Skill): string {
  if (s.repo) return s.repo;
  if (s.installArg) return s.installArg.split(" ").slice(1).join(" ");
  return s.source;
}

// Orange is the closest thing the dither palette has to the coral the rest of
// the site is built on.
const INSTALLS_CONFIG = { installs: { label: "Installs", color: "orange" as const } };

// Registry names share long vendor prefixes — "Vercel React Best Practices",
// "Vercel React Native Skills", "Vercel React View Transitions" all collapse to
// the same string if you just take the first N characters. The tail is what
// actually tells them apart.
function axisLabel(name: string, max: number) {
  const words = name.split(/\s+/);
  const tail = words.length > 2 ? words.slice(-2).join(" ") : name;
  return tail.length > max ? `${tail.slice(0, max - 1)}…` : tail;
}

// Six skill names side by side collapse into unreadable mush on a phone, so
// the axis drops to every other bar there. Nothing is lost — the tooltip
// still names whichever bar is under the pointer.
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return narrow;
}

// Relative popularity of the current results. skills.sh returns `installs` and
// aitmpl returns download counts; the offline seed catalog deliberately does
// not, so with fewer than two counted skills there is nothing honest to plot
// and this renders nothing rather than a row of zeroes.
function InstallsChart({ skills }: { skills: Skill[] }) {
  const narrow = useNarrow();
  const top = useMemo(
    () =>
      skills
        .filter((s): s is Skill & { installs: number } => typeof s.installs === "number" && s.installs > 0)
        .sort((a, b) => b.installs - a.installs)
        .slice(0, 6)
        .map((s) => ({ skill: s.name, installs: s.installs })),
    [skills],
  );

  if (top.length < 2) return null;

  return (
    <div className="mb-3 p-3 border-2 border-line bg-paper">
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-pixel text-[10px] uppercase">Top by installs</span>
        <span className="font-mono text-[10px] text-muted">{top.length} of {skills.length}</span>
      </div>
      <BarChart data={top} config={INSTALLS_CONFIG} bloom="low" className="h-44">
        <XAxis
          dataKey="skill"
          maxTicks={narrow ? 3 : 6}
          tickFormatter={(v) => axisLabel(String(v), narrow ? 11 : 14)}
        />
        <YAxis tickFormatter={(n) => fmtInstalls(n) ?? "0"} />
        <Tooltip labelKey="skill" valueFormatter={(n) => `${fmtInstalls(n) ?? n} installs`} />
        <Bar dataKey="installs" variant="gradient" />
      </BarChart>
    </div>
  );
}

export function SkillBrowser({
  selected,
  onToggle,
  initialQuery = "react",
  showChart = false,
}: {
  // present -> selectable mode (composer); absent -> browse/copy mode
  selected?: PickedSkill[];
  onToggle?: (s: PickedSkill) => void;
  initialQuery?: string;
  // Opt-in so the composer's sidebar stays a picker, not a dashboard.
  showChart?: boolean;
}) {
  const [q, setQ] = useState(initialQuery);
  const [source, setSource] = useState<SourceId>("skills.sh");
  const [kind, setKind] = useState<AitmplKind>("skills");
  const [sort, setSort] = useState<SortId>("relevance");
  const [category, setCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [results, setResults] = useState<Skill[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIds = new Set((selected ?? []).map((s) => s.id));

  // `offset > 0` is a "load more": results append and the skeleton stays out
  // of the way, since the list the user is reading has not been replaced.
  const run = async (
    query: string,
    src: SourceId,
    srt: SortId,
    cat: string | null,
    knd: AitmplKind,
    offset = 0,
  ) => {
    setLoading(true);
    if (offset === 0) {
      setNote(null);
      setRevealed(false);
    }
    const params = new URLSearchParams({ q: query, sort: srt });
    if (src === "aitmpl") {
      params.set("source", "aitmpl");
      params.set("kind", knd);
      if (cat) params.set("category", cat);
      if (offset) params.set("offset", String(offset));
    }
    try {
      const res = await fetch(`/api/skills?${params}`);
      const data = await res.json();
      const batch: Skill[] = data.skills ?? [];
      setResults((prev) => (offset > 0 ? [...prev, ...batch] : batch));
      setHasMore(Boolean(data.hasMore));
      if (Array.isArray(data.categories)) setCategories(data.categories);
      // The raw `data.error` stays out of these strings — it is an exception
      // message the reader cannot act on. What they need is which catalog they
      // are looking at now.
      setNote(
        data.source === "skills.sh"
          ? `${data.count} results from skills.sh`
          : data.source === "aitmpl"
            ? data.error
              ? "aitmpl is unavailable — try skills.sh"
              : `${data.count} of ${data.total} ${knd}${cat ? ` in ${cat}` : ""}`
            : data.source === "seed"
              ? "seed catalog — type to search skills.sh"
              : data.error
                ? "skills.sh is unavailable — showing the offline catalog"
                : null,
      );
    } catch {
      setNote("Search failed. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRevealed(true);
    }
  };

  // debounced search on any control change. Always starts a fresh page —
  // an appended list from the previous filter would be nonsense.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(q, source, sort, category, kind), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, source, sort, category, kind]);

  // Moving between catalogs (or between kinds within aitmpl) resets the
  // filters, query included. A term typed to find a skill almost never matches
  // a hook or a setting, and a silent "0 of 62" reads as a broken tab rather
  // than as a filter that is still applied.
  const resetFilters = () => {
    setQ("");
    setCategory(null);
    setCategories([]);
  };

  const switchSource = (next: SourceId) => {
    if (next === source) return;
    resetFilters();
    setSource(next);
  };

  const switchKind = (next: AitmplKind) => {
    if (next === kind) return;
    resetFilters();
    setKind(next);
  };

  const copyInstall = async (cmd: string, id: string) => {
    if (await copyText(cmd)) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } else {
      setNote(`copy failed — run ${cmd} manually`);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* The in-flight state rides inside the field (a dot by the × button),
            not as a word next to it: this row is flex-wrap, and a label that
            appeared on every keystroke pushed the sort control onto a second
            line and back. The count line below is what announces the result. */}
        <SearchInput
          value={q}
          onChange={setQ}
          // The placeholder cannot do this job: it disappears the moment
          // someone types, and this is the page's primary control.
          label={source === "aitmpl" ? `Filter ${kind}` : "Search skills.sh"}
          placeholder={source === "aitmpl" ? `filter ${kind}…` : "search skills.sh…"}
          loading={loading}
          className="flex-1 min-w-[200px]"
        />
        <Select<SortId>
          options={SORTS.map((s) => ({ id: s.id, label: s.label }))}
          value={sort}
          onChange={setSort}
          aria-label="Sort results"
          // The custom dropdown draws its own trigger; width must be explicit
          // so the row wraps instead of stretching full-width like a <select>.
          className="w-40 shrink-0"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            onClick={() => switchSource(s.id)}
            title={s.hint}
            className={clsx(
              "font-pixel text-[9px] uppercase px-2 py-1 border-2 border-line transition-colors",
              source === s.id ? "bg-fill text-on-fill" : "bg-paper hover:bg-stone",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {source === "aitmpl" && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {KIND_META.map((k) => (
            <button
              key={k.id}
              onClick={() => switchKind(k.id)}
              title={k.blurb}
              className={clsx(
                // `min-h-6`: 10px type on `py-0.5` measures 23px, one pixel
                // under the 24px target minimum, and these sit in a wrapped row
                // on a 6px gap so nothing about the spacing makes up for it.
                "inline-flex items-center min-h-6 font-mono text-[10px] px-2 py-0.5 border-2 border-line transition-colors cursor-pointer",
                kind === k.id ? "bg-ink text-paper" : "bg-paper hover:bg-stone",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        {source === "aitmpl" ? (
          <>
            <button
              onClick={() => setCategory(null)}
              className={clsx(
                // `min-h-6`: 10px type on `py-0.5` measures 23px, one pixel
                // under the 24px target minimum, and these sit in a wrapped row
                // on a 6px gap so nothing about the spacing makes up for it.
                "inline-flex items-center min-h-6 font-mono text-[10px] px-2 py-0.5 border-2 border-line transition-colors cursor-pointer",
                category === null ? "bg-fill text-on-fill" : "bg-paper hover:bg-stone",
              )}
            >
              all
            </button>
            {categories.map((c) => (
              <button
                key={c.name}
                onClick={() => setCategory(c.name === category ? null : c.name)}
                className={clsx(
                  // `min-h-6`: 10px type on `py-0.5` measures 23px, one pixel
                // under the 24px target minimum, and these sit in a wrapped row
                // on a 6px gap so nothing about the spacing makes up for it.
                "inline-flex items-center min-h-6 font-mono text-[10px] px-2 py-0.5 border-2 border-line transition-colors cursor-pointer",
                  category === c.name ? "bg-fill text-on-fill" : "bg-paper hover:bg-stone",
                )}
              >
                {c.name} <span className="opacity-60">{c.count}</span>
              </button>
            ))}
          </>
        ) : (
          SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setQ(s)}
              className="inline-flex items-center min-h-6 font-mono text-[10px] px-2 py-0.5 border-2 border-line bg-paper hover:bg-stone transition-colors cursor-pointer"
            >
              #{s}
            </button>
          ))
        )}
      </div>

      {/* Always mounted, even with nothing to say. Results arrive
          asynchronously, so this line is the only thing that tells a
          screen-reader user the list under it changed and how many hits it
          holds — and a region inserted at the same moment its text appears
          announces unreliably. `min-h` keeps the layout from jumping. */}
      <p role="status" aria-live="polite" className="font-mono text-[10px] text-muted mb-2 min-h-4">
        {note ?? ""}
      </p>

      <div
        key={`${source}:${kind}:${q}:${category}`}
        className={clsx("t-skel", revealed && "is-revealed")}
      >
        <div className="t-skel-skeleton is-pulsing grid sm:grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-2.5 border-2 border-line bg-paper">
              <div className="h-3 bg-stone-deep w-2/3" />
              <div className="h-2.5 bg-stone-deep w-1/2 mt-1.5" />
              <div className="h-5 bg-stone-deep mt-2" />
            </div>
          ))}
        </div>
        <div className="t-skel-content">
          {/* Inside t-skel-content so it reveals with the results rather than
              sitting there showing the previous query's numbers. */}
          {showChart && <InstallsChart skills={results} />}
          <div className="grid sm:grid-cols-2 gap-2 max-h-[420px] overflow-auto pr-1">
            {results.map((s) => {
              const cmd = installFor(s);
              const on = selectedIds.has(s.id);
              const installs = fmtInstalls(s.installs);
              return (
                <div
                  key={s.id}
                  className={clsx(
                    "text-left p-2.5 border-2 border-line transition-colors",
                    on ? "bg-fill text-on-fill" : "bg-paper",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Seeded with the owner, not the skill: everything from
                        vercel-labs draws the same glyph, so where a result
                        came from is visible without reading the line under
                        it. `animate={false}` because a query can swap 50
                        cards at once and each entrance is 1024 fillRects a
                        frame — the materialize belongs on a handful of
                        nodes, not on a search list. */}
                    <DitherAvatar
                      name={ownerOf(s)}
                      hue={avatarHue(ownerOf(s))}
                      animate={false}
                      className="size-5 shrink-0"
                    />
                    <span className="font-mono text-xs font-bold truncate flex-1">{s.name}</span>
                    {installs && (
                      <span className={clsx("font-mono text-[9px] shrink-0", on ? "text-on-fill-muted" : "text-muted")}>
                        ↓{installs}
                      </span>
                    )}
                  </div>
                  <div className={clsx("font-mono text-[10px] truncate mt-0.5", on ? "text-on-fill-muted" : "text-coral-text")}>
                    {targetLabel(s)}
                  </div>
                  {s.description && (
                    <p
                      className={clsx(
                        "font-mono text-[10px] leading-snug mt-1 line-clamp-2",
                        on ? "text-on-fill-muted" : "text-muted",
                      )}
                    >
                      {s.description}
                    </p>
                  )}
                  <div className="mt-2">
                    {onToggle ? (
                      <button
                        onClick={() => onToggle(pick(s))}
                        disabled={!cmd}
                        title={cmd ?? `${s.source} has no install target`}
                        className={clsx(
                          "w-full font-pixel text-[9px] uppercase py-1 border-2 border-line transition-colors",
                          "disabled:opacity-40 disabled:pointer-events-none",
                          on ? "bg-paper text-ink" : "bg-fill text-on-fill hover:bg-coral-text",
                        )}
                      >
                        {on ? "remove [x]" : cmd ? "add [ ]" : "no target"}
                      </button>
                    ) : (
                      <button
                        onClick={() => cmd && copyInstall(cmd, s.id)}
                        disabled={!cmd}
                        title={cmd ? `copies "${cmd}"` : `${s.source} has no install target`}
                        className={clsx(
                          "w-full font-pixel text-[9px] uppercase py-1 border-2 border-line transition-colors",
                          "disabled:opacity-40 disabled:pointer-events-none",
                          copiedId === s.id
                            ? "bg-ok text-paper normal-case tracking-normal"
                            : "bg-fill text-on-fill hover:bg-coral-text",
                        )}
                      >
                        {copiedId === s.id ? "✓ copied" : cmd ? "copy install" : "no target"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Names the query and offers the way out, so a typo is
                distinguishable from an empty category or a dead registry. */}
            {!loading && results.length === 0 && (
              <div className="col-span-full py-8 px-3 text-center">
                <p className="font-mono text-xs">
                  {q ? <>No matches for “{q}”</> : "Nothing here yet"}
                  {category && <> in {category}</>}.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 justify-center">
                  {q && (
                    <button
                      onClick={() => setQ("")}
                      className="font-pixel text-[9px] uppercase px-3 py-1 border-2 border-line bg-paper hover:bg-stone transition-colors"
                    >
                      clear search
                    </button>
                  )}
                  {category && (
                    <button
                      onClick={() => setCategory(null)}
                      className="font-pixel text-[9px] uppercase px-3 py-1 border-2 border-line bg-paper hover:bg-stone transition-colors"
                    >
                      all categories
                    </button>
                  )}
                </div>
              </div>
            )}
            {hasMore && (
              <button
                onClick={() => run(q, source, sort, category, kind, results.length)}
                disabled={loading}
                className={clsx(
                  "col-span-full font-pixel text-[9px] uppercase py-2 border-2 border-line",
                  "bg-paper hover:bg-stone transition-colors disabled:opacity-40",
                )}
              >
                {loading ? "loading…" : "load more"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
