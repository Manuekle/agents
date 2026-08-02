"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, PixelButton, TextInput } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import type { PickedSkill, Skill } from "@/lib/types";

const SUGGESTIONS = ["react", "next", "testing", "database", "security", "tailwind", "docs", "ai"];

function fmtInstalls(n?: number) {
  if (!n) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export function SkillBrowser({
  selected,
  onToggle,
  initialQuery = "react",
}: {
  // present -> selectable mode (composer); absent -> browse/copy mode
  selected?: PickedSkill[];
  onToggle?: (s: PickedSkill) => void;
  initialQuery?: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIds = new Set((selected ?? []).map((s) => s.id));

  const run = async (query: string) => {
    setLoading(true);
    setNote(null);
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

  const copyInstall = (repo: string, id: string) => {
    navigator.clipboard?.writeText(`npx skills add ${repo}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1200);
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
            className="font-mono text-[10px] px-2 py-0.5 border-2 border-ink bg-paper hover:bg-stone transition-colors"
          >
            #{s}
          </button>
        ))}
      </div>

      {note && <p className="font-mono text-[10px] text-muted mb-2">{note}</p>}

      <div className="grid sm:grid-cols-2 gap-2 max-h-[420px] overflow-auto pr-1">
        {results.map((s) => {
          const repo = s.repo ?? s.source;
          const on = selectedIds.has(s.id);
          const installs = fmtInstalls(s.installs);
          return (
            <div
              key={s.id}
              className={clsx(
                "text-left p-2.5 border-2 border-ink transition-all",
                on ? "bg-ink text-paper" : "bg-paper",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold truncate">{s.name}</span>
                {installs && (
                  <span className={clsx("font-mono text-[9px] shrink-0", on ? "text-stone" : "text-muted")}>
                    ↓{installs}
                  </span>
                )}
              </div>
              <div className={clsx("font-mono text-[10px] truncate mt-0.5", on ? "text-stone" : "text-coral")}>
                {repo}
              </div>
              <div className="mt-2">
                {onToggle ? (
                  <button
                    onClick={() => onToggle({ id: s.id, name: s.name, repo })}
                    className={clsx(
                      "w-full font-pixel text-[9px] uppercase py-1 border-2 border-ink transition-colors",
                      on ? "bg-paper text-ink" : "bg-ink text-paper hover:bg-coral",
                    )}
                  >
                    {on ? "remove [x]" : "add [ ]"}
                  </button>
                ) : (
                  <button
                    onClick={() => copyInstall(repo, s.id)}
                    className="w-full font-pixel text-[9px] uppercase py-1 border-2 border-ink bg-ink text-paper hover:bg-coral transition-colors"
                  >
                    {copiedId === s.id ? "copied ✓" : "copy install"}
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
  );
}
