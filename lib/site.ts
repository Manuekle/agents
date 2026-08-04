// Absolute base for canonicals, og:image and the sitemap. Hardcoding a domain
// the project does not own points those at someone else's host, so this reads
// the deployment: NEXT_PUBLIC_SITE_URL first, then the Vercel production
// domain, then localhost for `next dev`.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

// Central site config.
export const SITE = {
  name: "agents",
  tagline: "Build AI agents. Ship your skills.",
  author: "Manuekle",
  // this project — the star count and the GitHub link both point here
  githubRepo: "Manuekle/agents",
  githubUrl: "https://github.com/Manuekle/agents",
  // upstream CLI this builds on, linked separately in the footer
  upstreamUrl: "https://github.com/vercel-labs/skills",
  registry: "https://skills.sh",
};

export function fmtCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}
