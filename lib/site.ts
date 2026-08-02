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
