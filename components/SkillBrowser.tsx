"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, PixelButton, TextInput } from "@/components/ui";
import { BarChart } from "@/components/dither-kit/bar-chart";
import { Bar } from "@/components/dither-kit/bar";
import { XAxis } from "@/components/dither-kit/x-axis";
import { YAxis } from "@/components/dither-kit/y-axis";
import { Tooltip } from "@/components/dither-kit/tooltip";
import { clsx } from "@/lib/clsx";
import { copyText } from "@/lib/copy";
import type { PickedSkill, Skill } from "@/lib/types";

const SUGGESTIONS = ["react", "next", "testing", "database", "security", "tailwind", "docs", "ai"];

function fmtInstalls(n?: number) {
  if (!n) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
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

// Relative popularity of the current results. skills.sh returns `installs`;
// the offline seed catalog deliberately does not, so with fewer than two
// counted skills there is nothing honest to plot and this renders nothing
// rather than a row of zeroes.
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
  const [results, setResults] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIds = new Set((selected ?? []).map((s) => s.id));

  const run = async (query: string) => {
    setLoading(true);
    setNote(null);
    setRevealed(false);
    try {
      const res = await fetch(`/api/skills?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.skills ?? []);
      setNote(
        data.source === "skills.sh"
          ? `${data.count} results from skills.sh`
          : data.source === "seed"
            ? "seed catalog — type to search skills.sh"
            : data.error
              ? `skills.sh error — showing seed (${data.error})`
              : null,
      );
    } catch {
      setNote("search failed");
    } finally {
      setLoading(false);
      setRevealed(true);
    }
  };

  // debounced search on query change
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(q), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const copyInstall = async (repo: string, id: string) => {
    const cmd = `npx skills add ${repo}`;
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
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search skills.sh…"
          className="flex-1 min-w-[200px]"
        />
        {loading && <span className="font-mono text-[10px] text-muted">searching…</span>}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setQ(s)}
            className="font-mono text-[10px] px-2 py-0.5 border-2 border-line bg-paper hover:bg-stone transition-colors"
          >
            #{s}
          </button>
        ))}
      </div>

      {note && <p className="font-mono text-[10px] text-muted mb-2">{note}</p>}

      <div key={q} className={clsx("t-skel", revealed && "is-revealed")}>
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
              const repo = s.repo ?? s.source;
              // `npx skills add` only takes owner/repo. Anything else (a bare
              // registry name, a docs host) would copy a command that cannot
              // resolve, so the action is disabled instead.
              const installable = repo.includes("/");
              const on = selectedIds.has(s.id);
              const installs = fmtInstalls(s.installs);
              return (
                <div
                  key={s.id}
                  className={clsx(
                    "text-left p-2.5 border-2 border-line transition-all",
                    on ? "bg-fill text-on-fill" : "bg-paper",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold truncate">{s.name}</span>
                    {installs && (
                      <span className={clsx("font-mono text-[9px] shrink-0", on ? "text-on-fill-muted" : "text-muted")}>
                        ↓{installs}
                      </span>
                    )}
                  </div>
                  <div className={clsx("font-mono text-[10px] truncate mt-0.5", on ? "text-on-fill-muted" : "text-coral")}>
                    {repo}
                  </div>
                  <div className="mt-2">
                    {onToggle ? (
                      <button
                        onClick={() => onToggle({ id: s.id, name: s.name, repo })}
                        disabled={!installable}
                        title={installable ? undefined : `${repo} is not an owner/repo`}
                        className={clsx(
                          "w-full font-pixel text-[9px] uppercase py-1 border-2 border-line transition-colors",
                          "disabled:opacity-40 disabled:pointer-events-none",
                          on ? "bg-paper text-ink" : "bg-fill text-on-fill hover:bg-coral",
                        )}
                      >
                        {on ? "remove [x]" : installable ? "add [ ]" : "no repo"}
                      </button>
                    ) : (
                      <button
                        onClick={() => copyInstall(repo, s.id)}
                        disabled={!installable}
                        title={
                          installable
                            ? `copies "npx skills add ${repo}"`
                            : `${repo} is not an owner/repo`
                        }
                        className={clsx(
                          "w-full font-pixel text-[9px] uppercase py-1 border-2 border-line transition-colors",
                          "disabled:opacity-40 disabled:pointer-events-none",
                          copiedId === s.id
                            ? "bg-ok text-paper normal-case tracking-normal"
                            : "bg-fill text-on-fill hover:bg-coral",
                        )}
                      >
                        {copiedId === s.id
                          ? `✓ npx skills add ${repo}`
                          : installable
                            ? "copy install"
                            : "no repo"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!loading && results.length === 0 && (
              <p className="font-mono text-xs text-muted col-span-full py-6 text-center">no skills found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
