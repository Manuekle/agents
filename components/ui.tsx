"use client";

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
        variant === "solid" && "bg-ink text-paper hover:bg-ink-soft",
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
        "inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border-2 border-ink",
        tone === "stone" && "bg-stone text-ink",
        tone === "coral" && "bg-coral text-paper",
        tone === "ink" && "bg-ink text-paper",
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
        "w-full bg-paper border-2 border-ink px-3 py-2 font-mono text-sm outline-none",
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
        "w-full bg-paper border-2 border-ink px-3 py-2 font-mono text-sm outline-none resize-y",
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
    <div className="inline-flex border-2 border-ink flex-wrap">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={clsx(
            "font-mono text-xs px-3 py-1.5 border-r-2 border-ink last:border-r-0 transition-colors cursor-pointer",
            value === o.id ? "bg-ink text-paper" : "bg-paper hover:bg-stone",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
