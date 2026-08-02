"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

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
        "font-pixel text-[11px] uppercase tracking-wide px-4 py-2 pixel-border-sm transition-all",
        "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        "disabled:opacity-40 disabled:pointer-events-none cursor-pointer select-none",
        variant === "solid" && "bg-fill text-on-fill hover:bg-fill-hover",
        variant === "coral" && "bg-coral text-paper hover:bg-coral-deep",
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
        tone === "coral" && "bg-coral text-paper",
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
        "w-full bg-paper border-2 border-line px-3 py-2 font-mono text-sm outline-none",
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
        "w-full bg-paper border-2 border-line px-3 py-2 font-mono text-sm outline-none resize-y",
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
  return (
    <div className="inline-flex border-2 border-line flex-wrap">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={clsx(
            "font-mono text-xs px-3 py-1.5 border-r-2 border-line last:border-r-0 transition-colors cursor-pointer",
            value === o.id ? "bg-fill text-on-fill" : "bg-paper hover:bg-stone",
          )}
        >
          {o.label}
        </button>
      ))}
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
  options: { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={clsx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(
          "w-full flex items-center justify-between gap-2 bg-paper border-2 border-line px-3 py-2 font-mono text-sm cursor-pointer transition-shadow",
          open ? "shadow-[2px_2px_0_0_var(--coral)] border-coral" : "hover:bg-stone",
        )}
      >
        <span className="truncate">
          {current?.label}
          {current?.hint && <span className="text-muted"> · {current.hint}</span>}
        </span>
        <span className={clsx("font-pixel text-[9px] transition-transform", open && "rotate-180")}>
          ▼
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 bg-paper border-2 border-line pixel-border-sm max-h-60 overflow-auto"
        >
          {options.map((o) => {
            const sel = o.id === value;
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={clsx(
                  "w-full text-left px-3 py-2 font-mono text-sm flex items-center justify-between gap-2 border-b-2 border-line last:border-b-0 transition-colors cursor-pointer",
                  sel ? "bg-fill text-on-fill" : "hover:bg-stone",
                )}
              >
                <span className="truncate">{o.label}</span>
                {o.hint && (
                  <span className={clsx("font-mono text-[10px] shrink-0", sel ? "text-on-fill-muted" : "text-muted")}>
                    {o.hint}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
