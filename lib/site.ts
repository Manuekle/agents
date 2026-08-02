// Central site config.
export const SITE = {
  name: "agents.dev",
  tagline: "Build AI agents. Ship your skills.",
  // upstream project powering the skills engine
  githubRepo: "vercel-labs/skills",
  githubUrl: "https://github.com/vercel-labs/skills",
  registry: "https://skills.sh",
};

export function fmtCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}
