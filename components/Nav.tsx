"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "@/lib/clsx";
import { GitHubStars } from "@/components/GitHubStars";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MenuIcon, CloseIcon } from "@/components/icons";
import { AuthButton } from "@/components/AuthButton";

// `match` lists the extra path prefixes that should light the tab — the
// onboarding wizard is part of the New flow, so it must not leave the nav
// with nothing highlighted.
const LINKS: { href: string; label: string; match?: string[] }[] = [
  { href: "/", label: "Home" },
  { href: "/new", label: "New", match: ["/onboarding"] },
  { href: "/build", label: "Build" },
  { href: "/skills", label: "Skills" },
  { href: "/mcp", label: "MCP" },
  { href: "/pricing", label: "Pricing" },
];

function isActive(path: string, link: (typeof LINKS)[number]): boolean {
  if (link.href === "/") return path === "/";
  if (path.startsWith(link.href)) return true;
  return link.match?.some((m) => path.startsWith(m)) ?? false;
}

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // Navigating with the drawer open would otherwise leave it hanging over the
  // page it just moved to.
  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
        <Link href="/" className="group flex items-center gap-2">
          {/* The mark is pixel art, so it scales with nearest-neighbour rather
              than being resampled into mush. */}
          <img
            src="/logo-mark.png"
            alt=""
            width={28}
            height={28}
            className="pixelated shrink-0"
          />
          {/* Habibi wordmark as live text — scales at any DPI and inherits the
              theme colour, which a rasterised logo could not. */}
          <span className="font-serif text-2xl leading-none lowercase group-hover:text-coral transition-colors">
            agents
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Five tabs overflow a 375px viewport, so below `sm` the whole set
              moves into the drawer and this bar keeps only the trigger. */}
          <nav className="hidden sm:flex items-center gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "font-mono text-xs px-2 sm:px-3 py-1.5 border-2 transition-colors",
                  isActive(path, l)
                    ? "border-line bg-fill text-on-fill"
                    : "border-transparent hover:border-line hover:bg-stone",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Visibility lives on the wrapper, not on GitHubStars' own className:
              the pill's base classes already set `inline-flex`, and Tailwind
              emits `hidden` earlier in the sheet, so a `hidden` passed through
              className would silently lose the cascade and the pill would
              overflow the bar on phones. */}
          <span className="hidden sm:inline-flex">
            <GitHubStars />
          </span>
          <span className="hidden sm:inline-flex">
            <AuthButton />
          </span>
          <ThemeToggle />

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="nav-drawer"
            aria-label={open ? "Close menu" : "Open menu"}
            className="sm:hidden grid place-items-center w-9 h-9 border-2 border-line bg-paper hover:bg-stone transition-colors cursor-pointer"
          >
            {/* Both icons occupy the same grid cell; only their opacity, blur
                and scale change, so the button never reflows mid-swap. */}
            <span className="t-icon-swap" data-state={open ? "b" : "a"}>
              <span className="t-icon" data-icon="a">
                <MenuIcon size={16} />
              </span>
              <span className="t-icon" data-icon="b">
                <CloseIcon size={16} />
              </span>
            </span>
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER — the clip wrapper tweens height so the page below is
          pushed down in step with the panel instead of jumping. */}
      <div id="nav-drawer" className="sm:hidden t-panel-clip" data-open={open}>
        <div className="t-panel-slide border-t-2 border-line" data-open={open}>
          <nav className="mx-auto max-w-6xl px-5 py-3 flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                tabIndex={open ? undefined : -1}
                className={clsx(
                  "font-mono text-xs px-3 py-2 border-2 transition-colors",
                  isActive(path, l)
                    ? "border-line bg-fill text-on-fill"
                    : "border-transparent hover:border-line hover:bg-stone",
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="pt-2 mt-1 border-t-2 border-line flex flex-wrap items-center gap-2">
              <GitHubStars />
              <AuthButton compact />
            </div>
          </nav>
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
