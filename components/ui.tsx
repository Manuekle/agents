"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import { CheckIcon } from "@/components/icons";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// Animated confirmation tick. `shown` false keeps it at opacity 0 with the
// stroke undrawn; flipping it to true runs fade + rotate + blur + Y-bob while
// the checkmark draws itself.
export function SuccessCheck({
  shown,
  size = 12,
  className,
}: {
  shown: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={clsx("t-success-check", className)}
      data-state={shown ? "in" : "out"}
      aria-hidden
    >
      <CheckIcon size={size} />
    </span>
  );
}

// Tween a box to its content's natural height. CSS cannot transition
// `auto` -> `auto`, so the content is measured and the pixel value written
// back to the wrapper — without this, swapping a long CLAUDE.md for a short
// mcp.json makes the sidebar jump. `max` caps the box and lets it scroll.
export function ResizeBox({
  children,
  max,
  className,
}: {
  children: ReactNode;
  max: number;
  className?: string;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    // Observing the inner element, never the wrapper we resize — observing
    // the wrapper would feed its own height back in as a new measurement.
    const measure = () => setHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={clsx("t-resize overflow-auto", className)}
      style={height === null ? undefined : { height: Math.min(height, max) }}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}

export function Panel({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "aside";
}) {
  return (
    <Tag className={clsx("bg-paper pixel-border relative", className)}>{children}</Tag>
  );
}

export function PixelButton({
  children,
  variant = "solid",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "ghost" | "coral";
}) {
  return (
    <button
      {...rest}
      className={clsx(
        // No extra tracking and never wrap: Silkscreen already ships wide
        // sidebearings, so `tracking-wide` on an uppercase label pushed short
        // buttons like "Save agent" onto two lines.
        // Named properties, not `transition-all`: this is the app's button
        // primitive, and `all` animates layout properties too.
        "font-pixel text-[11px] uppercase px-4 py-2 pixel-border-sm whitespace-nowrap",
        "transition-[background-color,color,box-shadow,translate] duration-150",
        "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        "disabled:opacity-40 disabled:pointer-events-none cursor-pointer select-none",
        variant === "solid" && "bg-fill text-on-fill hover:bg-fill-hover",
        // `bg-coral-text`, not `bg-coral`: paper on the lighter coral is
        // 3.06:1, and this is the primary CTA at 11px. The darker value is
        // 5.35:1 and reads as the same colour. Dark mode aliases the two, so
        // the button is unchanged there.
        variant === "coral" && "bg-coral-text text-paper hover:bg-coral-deep",
        variant === "ghost" && "bg-paper text-ink hover:bg-stone",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "stone",
  className,
}: {
  children: ReactNode;
  tone?: "stone" | "coral" | "ink";
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border-2 border-line",
        tone === "stone" && "bg-stone text-ink",
        // Same reason as the coral PixelButton: paper on the lighter coral is
        // 3.06:1, and badges run at 10px.
        tone === "coral" && "bg-coral-text text-paper",
        tone === "ink" && "bg-fill text-on-fill",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-pixel text-[10px] uppercase tracking-wide">{label}</span>
        {hint && <span className="font-mono text-[10px] text-muted">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return (
    <input
      {...props}
      className={clsx(
        // 16px below `sm`: iOS Safari zooms the whole page in when an input's
        // text is smaller than that, and the user has to pinch back out.
        "w-full bg-paper border-2 border-line px-3 py-2 font-mono text-base sm:text-sm outline-none",
        "focus:shadow-[2px_2px_0_0_var(--coral)] focus:border-coral transition-shadow",
        props.className,
      )}
    />
  );
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={clsx(
        // 16px below `sm` for the same iOS zoom reason as TextInput.
        "w-full bg-paper border-2 border-line px-3 py-2 font-mono text-base sm:text-sm outline-none resize-y",
        "focus:shadow-[2px_2px_0_0_var(--coral)] focus:border-coral transition-shadow",
        props.className,
      )}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const measured = useRef(false);

  // Slide a marker to the active button instead of repainting backgrounds.
  // The first placement is written with transitions suspended, or the marker
  // would fly in from the left edge on mount.
  useEffect(() => {
    const wrap = wrapRef.current;
    const marker = markerRef.current;
    if (!wrap || !marker) return;

    const place = (animate: boolean) => {
      const active = wrap.querySelector<HTMLElement>(`[data-seg="${value}"]`);
      if (!active) return;
      if (!animate) {
        marker.style.transition = "none";
      }
      // Track the row too, not just the column: the strip is flex-wrap, and on
      // narrow screens it breaks onto two rows — a marker stretched top-to-bottom
      // would then paint over both rows at once.
      marker.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
      marker.style.width = `${active.offsetWidth}px`;
      marker.style.height = `${active.offsetHeight}px`;
      if (!animate) {
        void marker.offsetWidth;
        marker.style.transition = "";
      }
    };

    place(measured.current);
    measured.current = true;

    const ro = new ResizeObserver(() => place(false));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [value, options]);

  return (
    // Below `sm` the strip is a two-up grid rather than a free-wrapping row:
    // wrapping at natural widths left a ragged tail (three tabs, then one
    // stranded against dead space). Each cell takes half the width and a lone
    // last tab grows across the full row, so every row ends flush.
    <div
      ref={wrapRef}
      className="relative flex sm:inline-flex flex-wrap border-2 border-line"
    >
      <span ref={markerRef} className="t-tabs-marker" aria-hidden />
      {options.map((o, i) => {
        // Borders come off the map index, never `even:`/`last:` — the marker
        // span is the first DOM child, so every nth-child rule would be off
        // by one against the buttons.
        const rightColumn = i % 2 === 1;
        const lastRowStart = Math.floor((options.length - 1) / 2) * 2;
        return (
          <button
            key={o.id}
            data-seg={o.id}
            onClick={() => onChange(o.id)}
            className={clsx(
              "relative z-10 font-mono text-xs px-3 py-1.5 transition-colors cursor-pointer",
              "grow basis-[calc(50%-2px)] sm:grow-0 sm:basis-auto",
              // Mobile draws grid lines: a divider down the middle and one
              // under every row but the last. Desktop reverts to a single row
              // of right-hand dividers.
              "border-line",
              rightColumn ? "border-r-0" : "border-r-2",
              i >= lastRowStart ? "border-b-0" : "border-b-2",
              "sm:border-b-0",
              i === options.length - 1 ? "sm:border-r-0" : "sm:border-r-2",
              value === o.id ? "text-on-fill" : "hover:bg-stone",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Custom pixel dropdown — replaces the native <select> so the options list
// matches the design instead of the OS chrome.
export function Select<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { id: T; label: string; hint?: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // The visually highlighted option. Focus never leaves the trigger — the
  // listbox is driven by `aria-activedescendant`, which is the APG pattern and
  // the reason arrow keys work at all.
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.findIndex((o) => o.id === value)),
  );
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const baseId = useId();
  const current = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    // Reopening always starts from the current value, not from wherever the
    // highlight was left last time.
    setActiveIndex(Math.max(0, options.findIndex((o) => o.id === value)));
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the highlighted option in view when arrowing past the scroll edge.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const commit = (i: number) => {
    const opt = options[i];
    if (!opt) return;
    onChange(opt.id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Full APG listbox keyboard contract, handled on the trigger because that is
  // where focus stays.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (i + step + options.length) % options.length);
    } else if (e.key === "Home" || e.key === "End") {
      if (!open) return;
      e.preventDefault();
      setActiveIndex(e.key === "Home" ? 0 : options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) commit(activeIndex);
      else setOpen(true);
    }
  };

  return (
    <div ref={ref} className={clsx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        ref={triggerRef}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-list` : undefined}
        aria-activedescendant={open ? `${baseId}-opt-${activeIndex}` : undefined}
        className={clsx(
          "w-full flex items-center justify-between gap-2 bg-paper border-2 border-line px-3 py-2 font-mono text-sm cursor-pointer transition-shadow",
          open ? "shadow-[2px_2px_0_0_var(--coral)] border-coral" : "hover:bg-stone",
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          {current?.icon && <span className="shrink-0 flex items-center">{current.icon}</span>}
          <span className="truncate">
            {current?.label}
            {current?.hint && <span className="text-muted"> · {current.hint}</span>}
          </span>
        </span>
        <span className={clsx("font-pixel text-[9px] transition-transform", open && "rotate-180")}>
          ▼
        </span>
      </button>

      {open && (
        <div
          ref={listRef}
          id={`${baseId}-list`}
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 bg-paper border-2 border-line pixel-border-sm max-h-60 overflow-auto"
        >
          {options.map((o, i) => {
            const sel = o.id === value;
            const activeOpt = i === activeIndex;
            return (
              // A div, not a button: options are not separately focusable in a
              // listbox — the trigger keeps focus and points at the active one
              // with aria-activedescendant. Tabbable options would put every
              // model in the page's tab order.
              <div
                key={o.id}
                id={`${baseId}-opt-${i}`}
                data-idx={i}
                role="option"
                aria-selected={sel}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => commit(i)}
                className={clsx(
                  "w-full text-left px-3 py-2 font-mono text-sm flex items-center justify-between gap-2 border-b-2 border-line last:border-b-0 transition-colors cursor-pointer",
                  sel ? "bg-fill text-on-fill" : activeOpt ? "bg-stone" : "",
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {o.icon && <span className="shrink-0 flex items-center">{o.icon}</span>}
                  <span className="truncate">{o.label}</span>
                </span>
                {o.hint && (
                  <span className={clsx("font-mono text-[10px] shrink-0", sel ? "text-on-fill-muted" : "text-muted")}>
                    {o.hint}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
