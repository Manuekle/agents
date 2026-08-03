"use client";

import { useEffect, useState } from "react";
import { SITE } from "./site";

// The star count is rendered in three places per page (nav pill, footer pill,
// footer rating). Unauthenticated api.github.com allows 60 requests/hour/IP,
// so three fetches per page view burns the budget in ~20 views and every
// pill then falls back to "—". One in-flight promise per page load, reused
// by every consumer.
let pending: Promise<number | null> | null = null;

function fetchStars(): Promise<number | null> {
  pending ??= fetch(`https://api.github.com/repos/${SITE.githubRepo}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d && typeof d.stargazers_count === "number" ? d.stargazers_count : null))
    .catch(() => null);
  return pending;
}

export function useStars(): number | null {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetchStars().then((n) => {
      if (alive) setStars(n);
    });
    return () => {
      alive = false;
    };
  }, []);

  return stars;
}
