"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { copyText } from "@/lib/copy";
import { KIND_META, kindOfArg } from "@/lib/aitmpl";
import { PALETTE_OPEN_EVENT } from "@/lib/palette";
import type { Skill } from "@/lib/types";

// One search box over everything the app can reach: the pages, and both
// component registries. Mounted once in the root layout so ⌘K works from any
// route, including ones with no browser on them.

// Both variants render the same three slots: what it is called, what it is,
// and where it came from. Keeping the field names shared stops the row
// component from having to branch on `kind` just to lay itself out.
interface PageRow {
  kind: "page";
  id: string;
  label: string;
  detail: string; // what the page is for
  hint: string; // always "page"
  href: string;
}

interface ComponentRow {
  kind: "component";
  id: string;
  label: string;
  detail: string; // owner/repo or component id
  hint: string; // which registry
  command: string | null;
}

type Row = PageRow | ComponentRow;

function page(id: string, label: string, href: string, detail: string): PageRow {
  return { kind: "page", id, label, href, detail, hint: "page" };
}

const PAGES: PageRow[] = [
  page("p-home", "Home", "/", "landing"),
  page("p-new", "New agent", "/new", "choose a starting point"),
  page("p-onboarding", "Onboarding", "/onboarding", "AI-assisted draft"),
  page("p-build", "Build", "/build", "the composer"),
  page("p-skills", "Skills", "/skills", "browse both registries"),
  page("p-mcp", "MCP server", "/mcp", "serve an agent over MCP"),
  page("p-pricing", "Pricing", "/pricing", "plans"),
];

function matchPages(q: string): PageRow[] {
  const needle = q.toLowerCase();
  if (!needle) return PAGES;
  return PAGES.filter(
    (p) => p.label.toLowerCase().includes(needle) || p.detail.toLowerCase().includes(needle),
  );
}

function installOf(s: Skill): string | null {
  const repo = s.repo ?? s.source;
  if (repo.includes("/")) return `npx skills add ${repo}`;
  if (s.installArg) return `npx claude-code-templates@latest ${s.installArg} --yes`;
  return null;
}

function toRow(s: Skill, kindLabel: string): ComponentRow {
  return {
    kind: "component",
    id: s.id,
    label: s.name,
    hint: kindLabel,
    detail: s.repo ?? s.slug,
    command: installOf(s),
  };
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>(PAGES);
  // The query `rows` was computed for. Typing is debounced, so between a
  // keystroke and its results the list on screen answers an older question —
  // and Enter on it would open whatever the previous query ranked first.
  const [rowsQuery, setRowsQuery] = useState("");
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Every search increments this; a response whose token is stale is dropped.
  // Without it a slow "re" can land after a fast "react" and replace it.
  const token = useRef(0);

  // ---- open / close -------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_OPEN_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    // Autofocus fires before the dialog paints on some browsers, so focus is
    // taken here instead.
    inputRef.current?.focus();
    inputRef.current?.select();
    // The page behind must not scroll while the overlay owns the viewport.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ---- search -------------------------------------------------------------

  const search = useCallback(async (query: string) => {
    const mine = ++token.current;
    const pages = matchPages(query);

    if (query.trim().length < 2) {
      setRows(pages);
      setRowsQuery(query);
      setActive(0);
      return;
    }

    setBusy(true);
    // Both registries at once: which one a component lives in is an install
    // detail, and nobody searching for "postgres" knows or cares up front.
    const [live, catalog] = await Promise.allSettled([
      fetch(`/api/skills?q=${encodeURIComponent(query)}`).then((r) => r.json()),
      fetch(
        `/api/skills?source=aitmpl&kind=all&q=${encodeURIComponent(query)}&sort=installs`,
      ).then((r) => r.json()),
    ]);
    if (mine !== token.current) return;

    const out: Row[] = [...pages];
    if (live.status === "fulfilled") {
      for (const s of (live.value.skills ?? []).slice(0, 6) as Skill[]) {
        out.push(toRow(s, "skills.sh"));
      }
    }
    if (catalog.status === "fulfilled") {
      for (const s of (catalog.value.skills ?? []).slice(0, 10) as Skill[]) {
        // Which feed a hit came from is the useful label here — "hooks" tells
        // you what you found in a way "aitmpl" does not.
        const meta = KIND_META.find((k) => k.id === kindOfArg(s.installArg));
        out.push(toRow(s, `aitmpl · ${meta?.label ?? "component"}`));
      }
    }

    setRows(out);
    setRowsQuery(query);
    setActive(0);
    setBusy(false);
  }, []);

  // True while the visible list still answers an older query.
  const stale = rowsQuery !== q;

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search(q), 220);
    return () => clearTimeout(t);
  }, [q, open, search]);

  // ---- activation ---------------------------------------------------------

  const close = () => {
    setOpen(false);
    setQ("");
    setRows(PAGES);
    setRowsQuery("");
    setActive(0);
  };

  const choose = async (row: Row) => {
    if (row.kind === "page") {
      close();
      router.push(row.href);
      return;
    }
    if (!row.command) return;
    if (await copyText(row.command)) {
      setToast(`copied ${row.command}`);
      setTimeout(() => setToast(null), 1800);
      close();
    }
  };

  // Keeps the highlighted row in view when moving by keyboard past the fold.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({
      block: "nearest",
    });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return close();
    if (e.key === "ArrowDown" || (e.key === "n" && e.ctrlKey)) {
      e.preventDefault();
      setActive((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp" || (e.key === "p" && e.ctrlKey)) {
      e.preventDefault();
      setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Typing a query and hitting Enter before the debounce fires must not
      // open the previous query's top hit. Run the search now instead; the
      // second Enter, on results that match what is typed, does the opening.
      if (stale) {
        search(q);
        return;
      }
      const row = rows[active];
      if (row) choose(row);
    }
  };

  if (!open) {
    return toast ? (
      <div
        role="status"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 font-mono text-[10px] px-3 py-2 border-2 border-line bg-paper"
      >
        {toast}
      </div>
    ) : null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-ink/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        // mousedown, not click: a drag that starts inside the panel and ends
        // on the backdrop would otherwise close it mid-selection.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-xl border-2 border-line bg-paper" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-2 border-b-2 border-line px-3">
          <span className="font-mono text-[10px] text-muted shrink-0">›</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages, skills, hooks, MCP servers…"
            aria-label="Search"
            className="flex-1 bg-transparent py-3 font-mono text-xs outline-none placeholder:text-muted"
          />
          {(busy || stale) && (
            <span className="font-mono text-[10px] text-muted shrink-0">…</span>
          )}
          <kbd className="font-mono text-[9px] text-muted border-2 border-line px-1.5 py-0.5 shrink-0">
            esc
          </kbd>
        </div>

        {/* Dimmed while the list answers an older query, so a row that is
            about to be replaced does not read as a settled result. */}
        <div
          ref={listRef}
          className={clsx("max-h-[52vh] overflow-auto transition-opacity", stale && "opacity-50")}
        >
          {rows.map((row, i) => (
            <button
              key={row.id}
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(row)}
              disabled={row.kind === "component" && !row.command}
              className={clsx(
                "w-full text-left px-3 py-2 flex items-baseline gap-2 transition-colors",
                "disabled:opacity-40 disabled:pointer-events-none",
                i === active ? "bg-fill text-on-fill" : "hover:bg-stone",
              )}
            >
              <span className="font-mono text-xs truncate">{row.label}</span>
              <span
                className={clsx(
                  "font-mono text-[10px] truncate",
                  i === active ? "text-on-fill-muted" : "text-coral",
                )}
              >
                {row.detail}
              </span>
              <span
                className={clsx(
                  "font-mono text-[9px] ml-auto shrink-0",
                  i === active ? "text-on-fill-muted" : "text-muted",
                )}
              >
                {row.hint}
              </span>
            </button>
          ))}
          {!busy && rows.length === 0 && (
            <p className="font-mono text-xs text-muted py-8 text-center">nothing found</p>
          )}
        </div>

        <div className="border-t-2 border-line px-3 py-1.5 flex gap-3 font-mono text-[9px] text-muted">
          <span>↑↓ move</span>
          <span>⏎ open / copy install</span>
        </div>
      </div>
    </div>
  );
}
