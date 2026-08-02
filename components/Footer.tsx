"use client";

import Link from "next/link";
import { PoweredBy } from "@/components/Nav";
import { GitHubStars } from "@/components/GitHubStars";
import { StarIcon, StarOutlineIcon, GitHubIcon } from "@/components/icons";
import { SITE } from "@/lib/site";

const COLS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Build",
    links: [
      { label: "Composer", href: "/build" },
      { label: "Skills", href: "/skills" },
      { label: "MCP bridge", href: "/mcp" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "skills.sh", href: SITE.registry, external: true },
      { label: "npx skills", href: "https://github.com/vercel-labs/skills", external: true },
      { label: "GitHub", href: SITE.githubUrl, external: true },
    ],
  },
];

function Rating() {
  return (
    <div className="inline-flex items-center gap-1.5" title="loved by builders">
      <span className="flex text-coral">
        {Array.from({ length: 4 }).map((_, i) => (
          <StarIcon key={i} size={13} />
        ))}
        <StarOutlineIcon size={13} className="text-ink" />
      </span>
      <span className="font-mono text-[10px] text-muted">4.8 · loved by builders</span>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t-2 border-line bg-stone">
      <div className="mx-auto max-w-6xl px-5 py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        {/* brand */}
        <div>
          <Link href="/" className="group inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="w-7 h-7 object-contain theme-invert" />
            <span className="font-pixel text-sm lowercase tracking-tight group-hover:text-coral transition-colors">
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
          <nav key={col.title}>
            <h3 className="font-pixel text-[10px] uppercase mb-3 flex items-center gap-1.5">
              {col.title}
            </h3>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-mono text-xs text-ink-soft hover:text-coral transition-colors inline-flex items-center gap-1"
                    >
                      {l.label === "GitHub" && <GitHubIcon size={12} />}
                      {l.label} <span className="text-muted">↗</span>
                    </a>
                  ) : (
                    <Link
                      href={l.href}
                      className="font-mono text-xs text-ink-soft hover:text-coral transition-colors"
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

      {/* bottom bar */}
      <div className="border-t-2 border-line">
        <div className="mx-auto max-w-6xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-[10px] text-muted">
            {SITE.name} © {new Date().getFullYear()}
          </span>
          <PoweredBy />
        </div>
      </div>
    </footer>
  );
}
