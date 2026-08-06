"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import { AngleLeftIcon } from "@/components/icons";

// The canvas' right-click menu.
//
// It renders entries and nothing else: what a command *does* needs the graph,
// the selection and the history, and all three live in the canvas. So the
// canvas builds the list and this owns only the parts a menu has to get right
// on its own — where it lands, what has focus, and what the arrow keys do.
//
// One level of submenu, deliberately. Two levels means a diagonal mouse path
// across a live parent item, and every menu that has tried it has needed a
// "safe triangle" hack to stay usable.

export type MenuEntry =
  | {
      kind: "item";
      id: string;
      label: string;
      hint?: string;
      disabled?: boolean;
      /** Draws a colour chip instead of a leading gap. */
      swatch?: string;
      /** Marks the current value inside a submenu. */
      checked?: boolean;
      run: () => void;
    }
  | { kind: "sub"; id: string; label: string; disabled?: boolean; items: MenuEntry[] }
  | { kind: "rule"; id: string }
  | { kind: "head"; id: string; label: string };

export interface ContextMenuProps {
  /** Where the pointer was, in surface pixels. */
  at: { x: number; y: number };
  /** The surface, so the menu can stay inside it. */
  size: { w: number; h: number };
  entries: MenuEntry[];
  onClose: () => void;
}

const isFocusable = (e: MenuEntry) =>
  (e.kind === "item" || e.kind === "sub") && !e.disabled;

export function ContextMenu({ at, size, entries, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: at.x, top: at.y });
  const [cursor, setCursor] = useState(() => entries.findIndex(isFocusable));
  const [openSub, setOpenSub] = useState<string | null>(null);

  // Measured, not estimated. The menu's height depends on what is in it — a
  // right-click on a node offers twice as many commands as one on bare canvas —
  // and a constant guess either clipped the long menu or floated the short one.
  // Layout effect, so the clamp lands before the browser paints.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setPos({
      // Flip rather than slide when there is no room below: a menu whose top
      // has been pushed up covers the thing that was right-clicked.
      left: at.x + w > size.w ? Math.max(0, at.x - w) : at.x,
      top: at.y + h > size.h ? Math.max(0, at.y - h) : at.y,
    });
  }, [at.x, at.y, size.w, size.h, entries.length]);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const move = (dir: 1 | -1) => {
    setCursor((cur) => {
      let i = cur;
      for (let n = 0; n < entries.length; n += 1) {
        i = (i + dir + entries.length) % entries.length;
        if (isFocusable(entries[i])) return i;
      }
      return cur;
    });
    setOpenSub(null);
  };

  const activate = (entry: MenuEntry) => {
    if (entry.kind === "sub") {
      setOpenSub(entry.id);
      return;
    }
    if (entry.kind !== "item" || entry.disabled) return;
    entry.run();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // The canvas listens for Delete, ⌘D and the arrows too, and a menu that
    // lets them through would run the command twice.
    e.stopPropagation();
    const entry = entries[cursor];
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        if (openSub) setOpenSub(null);
        else onClose();
        return;
      case "ArrowDown":
        e.preventDefault();
        move(1);
        return;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        return;
      case "Home":
        e.preventDefault();
        setCursor(entries.findIndex(isFocusable));
        return;
      case "End": {
        e.preventDefault();
        for (let i = entries.length - 1; i >= 0; i -= 1) {
          if (isFocusable(entries[i])) {
            setCursor(i);
            break;
          }
        }
        return;
      }
      case "ArrowRight":
        if (entry?.kind === "sub" && !entry.disabled) {
          e.preventDefault();
          setOpenSub(entry.id);
        }
        return;
      case "ArrowLeft":
        e.preventDefault();
        setOpenSub(null);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (entry) activate(entry);
        return;
    }
  };

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="menu"
      aria-label="Canvas actions"
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        // Focus moving inside the menu (into a submenu) is not a dismissal.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className="t-menu absolute z-20 min-w-[184px] border-2 border-line bg-paper py-1 outline-none"
      style={{ left: pos.left, top: pos.top }}
    >
      {entries.map((entry, i) => {
        if (entry.kind === "rule") return <Rule key={entry.id} />;
        if (entry.kind === "head") return <Head key={entry.id}>{entry.label}</Head>;
        const active = i === cursor;
        if (entry.kind === "sub") {
          return (
            <Submenu
              key={entry.id}
              entry={entry}
              active={active}
              open={openSub === entry.id}
              onOpen={() => {
                setCursor(i);
                setOpenSub(entry.id);
              }}
              onCloseSub={() => setOpenSub(null)}
              onRun={onClose}
              // Right by default; left when the parent is already against the
              // right edge of the surface.
              flip={pos.left + 184 + 180 > size.w}
              surfaceH={size.h}
            />
          );
        }
        return (
          <Item
            key={entry.id}
            entry={entry}
            active={active}
            onHover={() => {
              setCursor(i);
              setOpenSub(null);
            }}
            onRun={() => activate(entry)}
          />
        );
      })}
    </div>
  );
}

function Item({
  entry,
  active,
  onHover,
  onRun,
}: {
  entry: Extract<MenuEntry, { kind: "item" }>;
  active?: boolean;
  onHover?: () => void;
  onRun: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={entry.disabled}
      onPointerEnter={onHover}
      onClick={onRun}
      className={clsx(
        "flex w-full items-center justify-between gap-4 px-2.5 py-1 font-mono text-[10px] text-left transition-colors duration-100 cursor-pointer",
        "disabled:opacity-40 disabled:pointer-events-none",
        active ? "bg-stone" : "hover:bg-stone",
      )}
    >
      <span className="inline-flex items-center gap-1.5 min-w-0">
        {entry.swatch && (
          <span
            aria-hidden="true"
            className="w-2.5 h-2.5 border-2 border-line shrink-0"
            style={{ background: entry.swatch }}
          />
        )}
        <span className="truncate">{entry.label}</span>
      </span>
      <span className="text-muted shrink-0">{entry.checked ? "·on" : entry.hint}</span>
    </button>
  );
}

function Submenu({
  entry,
  active,
  open,
  onOpen,
  onCloseSub,
  onRun,
  flip,
  surfaceH,
}: {
  entry: Extract<MenuEntry, { kind: "sub" }>;
  active?: boolean;
  open: boolean;
  onOpen: () => void;
  onCloseSub: () => void;
  onRun: () => void;
  flip: boolean;
  surfaceH: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  // The parent menu clamps itself to the surface; a submenu used not to, and
  // one opened near the bottom ran straight out of the canvas' clipped box —
  // `align` has nine entries and only the first three were ever reachable.
  // Same treatment, measured for the same reason: the length depends on what
  // is in it.
  const [lift, setLift] = useState(0);
  useLayoutEffect(() => {
    if (!open) {
      setLift(0);
      return;
    }
    const wrap = wrapRef.current;
    const sub = subRef.current;
    const menu = wrap?.offsetParent as HTMLElement | null;
    if (!wrap || !sub || !menu) return;
    // This row's top edge in surface coordinates: the menu is positioned
    // against the surface, and the row against the menu.
    const rowTop = menu.offsetTop + wrap.offsetTop - 4;
    const over = rowTop + sub.offsetHeight - surfaceH;
    // Never lifted past the top edge — a submenu that overhangs both ways is
    // taller than the canvas, and clipping the end of it beats clipping the
    // start, which is where the labels are.
    setLift(over > 0 ? Math.min(over, Math.max(0, rowTop)) : 0);
  }, [open, surfaceH, entry.items.length]);

  return (
    <div ref={wrapRef} className="relative" onPointerLeave={onCloseSub}>
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={entry.disabled}
        onPointerEnter={onOpen}
        onClick={onOpen}
        className={clsx(
          "flex w-full items-center justify-between gap-4 px-2.5 py-1 font-mono text-[10px] text-left transition-colors duration-100 cursor-pointer",
          "disabled:opacity-40 disabled:pointer-events-none",
          active || open ? "bg-stone" : "hover:bg-stone",
        )}
      >
        {entry.label}
        {/* The left-pointing chevron mirrored — the set has no right one, and a
            rotated glyph keeps the same pixel grid as everything beside it. */}
        <span className="text-muted inline-flex -scale-x-100">
          <AngleLeftIcon size={9} />
        </span>
      </button>
      {open && (
        <div
          ref={subRef}
          role="menu"
          aria-label={entry.label}
          className={clsx(
            "t-menu absolute z-30 min-w-[164px] border-2 border-line bg-paper py-1",
            flip ? "right-full" : "left-full",
          )}
          style={{ top: -4 - lift }}
        >
          {entry.items.map((sub) =>
            sub.kind === "rule" ? (
              <Rule key={sub.id} />
            ) : sub.kind === "head" ? (
              <Head key={sub.id}>{sub.label}</Head>
            ) : sub.kind === "item" ? (
              <Item
                key={sub.id}
                entry={sub}
                onRun={() => {
                  sub.run();
                  onRun();
                }}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pt-1 pb-0.5 font-pixel text-[7px] uppercase text-muted select-none">
      {children}
    </div>
  );
}

function Rule() {
  return <div className="my-1 border-t-2 border-line" aria-hidden="true" />;
}
