"use client";

import { useEffect, useState } from "react";
import { GitHubIcon, StarIcon } from "@/components/icons";
import { SITE, fmtCount } from "@/lib/site";
import { clsx } from "@/lib/clsx";

// "Star on GitHub" pill — live stargazer count from the GitHub API.
export function GitHubStars({ className }: { className?: string }) {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`https://api.github.com/repos/${SITE.githubRepo}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d.stargazers_count === "number") setStars(d.stargazers_count);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <a
      href={SITE.githubUrl}
      target="_blank"
      rel="noreferrer noopener"
      className={clsx(
        "group inline-flex items-stretch border-2 border-ink pixel-border-sm bg-paper hover:bg-stone transition-colors select-none",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 px-2.5 py-1.5 border-r-2 border-ink">
        <GitHubIcon size={14} />
        <span className="font-pixel text-[10px] uppercase">Star</span>
      </span>
      <span className="flex items-center gap-1 px-2.5 py-1.5 bg-ink text-paper group-hover:bg-coral transition-colors">
        <StarIcon size={12} className="text-coral group-hover:text-paper" />
        <span className="font-mono text-[11px] tabular-nums">
          {stars === null ? "—" : fmtCount(stars)}
        </span>
      </span>
    </a>
  );
}
