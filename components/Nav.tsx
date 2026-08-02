"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/build", label: "Build" },
  { href: "/skills", label: "Skills" },
  { href: "/mcp", label: "MCP" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="grid place-items-center w-7 h-7 bg-coral pixel-border-sm text-paper font-pixel text-[10px]">
            a.
          </span>
          <span className="font-pixel text-sm lowercase tracking-tight group-hover:text-coral transition-colors">
            agents.dev
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "font-mono text-xs px-3 py-1.5 border-2 transition-colors",
                  active
                    ? "border-ink bg-ink text-paper"
                    : "border-transparent hover:border-ink hover:bg-stone",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function PoweredBy() {
  return (
    <div className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
      <span className="w-1.5 h-1.5 bg-coral rounded-full animate-pulse" />
      powered by ai
    </div>
  );
}
