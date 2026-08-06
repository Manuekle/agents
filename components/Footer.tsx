"use client";

import Link from "next/link";
import { GitHubStars } from "@/components/GitHubStars";
import { DitherGradient } from "@/components/dither-kit/gradient";
import { StarIcon, StarOutlineIcon, GitHubIcon, HeartIcon } from "@/components/icons";
import { SITE, fmtCount } from "@/lib/site";
import { useStars } from "@/lib/stars";
import { DEMO_PATH, requiresAccount } from "@/lib/access";
import { useSignedIn } from "@/lib/use-auth";

// --coral is #ef5c47; the gradient takes a hue and rebuilds the fill at fixed
// saturation/lightness, and 8° lands on rgb(239,81,57).
const CORAL_HUE = 8;

const COLS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Build",
    links: [
      { label: "Demo", href: DEMO_PATH },
      { label: "New agent", href: "/new" },
      { label: "Onboarding", href: "/onboarding" },
      { label: "Composer", href: "/build" },
      { label: "Skills", href: "/skills" },
      { label: "MCP bridge", href: "/mcp" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "skills.sh", href: SITE.registry, external: true },
      { label: "npx skills", href: SITE.upstreamUrl, external: true },
      { label: "GitHub", href: SITE.githubUrl, external: true },
      { label: "Sponsor", href: SITE.sponsorUrl, external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

// Real stargazer count, not a made-up rating: the filled stars reflect the
// actual GitHub stars (capped at 5) so the footer never lies about popularity.
function Rating() {
  const stars = useStars();

  const filled = Math.min(stars ?? 0, 5);
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="flex text-coral">
        {Array.from({ length: 5 }).map((_, i) =>
          i < filled ? (
            <StarIcon key={i} size={13} />
          ) : (
            <StarOutlineIcon key={i} size={13} className="text-ink" />
          ),
        )}
      </span>
      {/* ink-soft, not muted: this line sits low in the block where the dither
          wash is near full density, and 10px muted over it measures ~4.1:1. */}
      <span className="font-mono text-[10px] text-ink-soft">
        {stars === null ? "—" : `${fmtCount(stars)} star${stars === 1 ? "" : "s"}`}
      </span>
    </div>
  );
}

export function Footer() {
  // Same rule as the nav: signed out, a link to a gated page goes to the demo
  // carrying where it was pointing. `null` means auth has not resolved yet and
  // must not read as signed out.
  const signedIn = useSignedIn();
  const hrefFor = (href: string) =>
    signedIn === false && requiresAccount(href)
      ? `${DEMO_PATH}?from=${encodeURIComponent(href)}`
      : href;

  return (
    <footer className="relative mt-20 border-t-2 border-line bg-stone">
      {/* Passed as a hue rather than the pack's "orange" seed: that one is
          rgb(255,150,50), a brighter and cooler orange than this palette
          owns, while hue 8 resolves to rgb(239,81,57) — within a few points
          of --coral. It dissolves to transparent, so the stone underneath
          carries dark mode with no second set of values. */}
      <DitherGradient from={CORAL_HUE} direction="up" cell={5} opacity={0.22} />
      {/* `relative` is required, not cosmetic: the canvas is positioned, so
          a static sibling paints under it whatever the DOM order. */}
      <div className="relative mx-auto max-w-6xl px-5 py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        {/* brand */}
        <div>
          <Link href="/" className="group inline-flex items-center gap-2">
            <img
              src="/logo-mark.png"
              alt=""
              width={28}
              height={28}
              className="pixelated shrink-0"
            />
            <span className="font-serif text-2xl leading-none lowercase group-hover:text-coral transition-colors">
              {SITE.name}
            </span>
          </Link>
          <p className="mt-3 font-mono text-xs text-ink-soft max-w-xs leading-relaxed">
            Scrape skills, compose agents, export to Claude Code, Codex &amp; any
            MCP model. All pixel, all custom.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <GitHubStars />
          </div>
          <div className="mt-4">
            <Rating />
          </div>
        </div>

        {/* link columns */}
        {COLS.map((col) => (
          // Three navigation landmarks side by side, plus the two in the header.
          // Unlabelled they all announce as "navigation", so a reader jumping
          // by landmark gets five identical stops and has to enter each one to
          // find out which is which. The column heading already names it.
          <nav key={col.title} aria-label={col.title}>
            {/* h2, not h3. The footer is on every route, including ones whose
                main content is an h1 and nothing else (/skills, /login, the
                loading states) — as h3 these were the first heading after the
                page title on those, so the outline read h1 → h3 and a reader
                moving by level heard a rung that was not there. Nothing here
                sits under a section heading, so h2 is also just the true depth. */}
            <h2 className="font-pixel text-[10px] uppercase mb-3 flex items-center gap-1.5">
              {col.title}
            </h2>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-mono text-xs text-ink-soft hover:text-coral-text transition-colors inline-flex items-center gap-1"
                    >
                      {l.label === "GitHub" && <GitHubIcon size={12} />}
                      {l.label === "Sponsor" && (
                        <HeartIcon size={12} className="text-coral-text" />
                      )}
                      {/* Inherits the link's ink-soft instead of --muted: over
                          the wash the muted glyph fell under 4.5:1, and the
                          arrow moving with the hover colour reads better. */}
                      {l.label} <span aria-hidden>↗</span>
                    </a>
                  ) : (
                    <Link
                      href={hrefFor(l.href)}
                      className="font-mono text-xs text-ink-soft hover:text-coral-text transition-colors"
                    >
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
