"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { GitHubStars } from "@/components/GitHubStars";
import { ThemeToggle } from "@/components/ThemeToggle";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/build", label: "Build" },
  { href: "/skills", label: "Skills" },
  { href: "/mcp", label: "MCP" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b-2 border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
        <Link href="/" className="group flex items-center">
          {/* Habibi wordmark as live text — scales at any DPI and inherits the
              theme colour, which a rasterised logo could not. */}
          <span className="font-serif text-2xl leading-none lowercase group-hover:text-coral transition-colors">
            agents
          </span>
        </Link>

        <div className="flex items-center gap-2">
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
                      ? "border-line bg-fill text-on-fill"
                      : "border-transparent hover:border-line hover:bg-stone",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <GitHubStars className="hidden sm:inline-flex" />
          <ThemeToggle />
        </div>
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
