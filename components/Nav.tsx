"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { GitHubStars } from "@/components/GitHubStars";
import { ThemeToggle } from "@/components/ThemeToggle";

// `match` lists the extra path prefixes that should light the tab — the
// onboarding wizard is part of the New flow, so it must not leave the nav
// with nothing highlighted.
//
// Five tabs overflow a 375px viewport, so Home drops out below `sm`: the
// wordmark to its left already links home, making it the one redundant item.
const LINKS: { href: string; label: string; match?: string[]; desktopOnly?: boolean }[] = [
  { href: "/", label: "Home", desktopOnly: true },
  { href: "/new", label: "New", match: ["/onboarding"] },
  { href: "/build", label: "Build" },
  { href: "/skills", label: "Skills" },
  { href: "/mcp", label: "MCP" },
];

function isActive(path: string, link: (typeof LINKS)[number]): boolean {
  if (link.href === "/") return path === "/";
  if (path.startsWith(link.href)) return true;
  return link.match?.some((m) => path.startsWith(m)) ?? false;
}

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
              const active = isActive(path, l);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={clsx(
                    "font-mono text-xs px-2 sm:px-3 py-1.5 border-2 transition-colors",
                    l.desktopOnly && "hidden sm:block",
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
          {/* Visibility lives on the wrapper, not on GitHubStars' own className:
              the pill's base classes already set `inline-flex`, and Tailwind
              emits `hidden` earlier in the sheet, so a `hidden` passed through
              className would silently lose the cascade and the pill would
              overflow the bar on phones. */}
          <span className="hidden sm:inline-flex">
            <GitHubStars />
          </span>
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
      {/* data-text duplicates the string so ::before can clip the sweep to
          the same glyphs — keep the two in sync. */}
      <span className="t-shimmer" data-text="powered by ai">
        powered by ai
      </span>
    </div>
  );
}
