import type { Skill } from "./types";

// Seed catalog. The /api/skills route enriches this with scraped entries and
// falls back to it when the network source is unreachable.
export const SEED_SKILLS: Skill[] = [
  { id: "sk-brainstorm", name: "Brainstorming", slug: "brainstorming", category: "Product", source: "anthropic-skills", description: "Explore intent & requirements before any build.", tags: ["planning", "product"], installs: 4210 },
  { id: "sk-frontend", name: "Frontend Design", slug: "frontend-design", category: "Design", source: "anthropic-skills", description: "Distinctive, intentional UI direction & typography.", tags: ["ui", "design", "css"], installs: 9821 },
  { id: "sk-a11y", name: "Accessibility", slug: "accessibility", category: "Quality", source: "anthropic-skills", description: "WCAG 2.2 audits, keyboard nav, screen-reader support.", tags: ["a11y", "audit"], installs: 3120 },
  { id: "sk-canvas", name: "Canvas Design", slug: "canvas-design", category: "Design", source: "anthropic-skills", description: "Posters, art & static pieces via design philosophy.", tags: ["art", "png", "pdf"], installs: 2740 },
  { id: "sk-dataviz", name: "Data Viz", slug: "dataviz", category: "Design", source: "anthropic-skills", description: "Charts & dashboards that read as one system.", tags: ["charts", "svg"], installs: 5310 },
  { id: "sk-review", name: "Code Review", slug: "review", category: "Engineering", source: "gstack", description: "Pre-landing PR review with severity-tagged findings.", tags: ["review", "git"], installs: 6650 },
  { id: "sk-investigate", name: "Investigate", slug: "investigate", category: "Engineering", source: "gstack", description: "Systematic debugging & root-cause tracing.", tags: ["debug"], installs: 4400 },
  { id: "sk-ship", name: "Ship", slug: "ship", category: "Engineering", source: "gstack", description: "Detect base branch, test, bump, changelog, open PR.", tags: ["release", "git"], installs: 3980 },
  { id: "sk-qa", name: "QA", slug: "qa", category: "Quality", source: "gstack", description: "Systematically QA a web app & fix bugs found.", tags: ["qa", "browser"], installs: 2210 },
  { id: "sk-seo", name: "SEO", slug: "seo", category: "Growth", source: "searchfit-seo", description: "Meta tags, structured data, sitemap optimization.", tags: ["seo", "growth"], installs: 5120 },
  { id: "sk-vercel-deploy", name: "Vercel Deploy", slug: "deploy", category: "DevOps", source: "vercel", description: "Preview & production deploys to Vercel.", tags: ["deploy", "vercel"], installs: 7300 },
  { id: "sk-ai-sdk", name: "AI SDK", slug: "ai-sdk", category: "AI", source: "vercel", description: "Chat, streaming, tool calling & agents with AI SDK.", tags: ["ai", "llm"], installs: 8800 },
  { id: "sk-prisma", name: "Prisma Expert", slug: "prisma-expert", category: "Data", source: "prisma", description: "Schema design, migrations & query optimization.", tags: ["db", "orm"], installs: 4010 },
  { id: "sk-sentry", name: "Sentry Workflow", slug: "sentry-workflow", category: "DevOps", source: "sentry", description: "Fix production issues with Sentry context.", tags: ["monitoring"], installs: 2600 },
  { id: "sk-transitions", name: "Transitions", slug: "transitions-dev", category: "Design", source: "gstack", description: "Production-ready CSS transitions for web apps.", tags: ["motion", "css"], installs: 3350 },
  { id: "sk-security", name: "Security Review", slug: "security-review", category: "Quality", source: "anthropic-skills", description: "Audit code for vulnerabilities before shipping.", tags: ["security"], installs: 4900 },
];

export const CATEGORIES = [
  "All",
  "Engineering",
  "Design",
  "AI",
  "Quality",
  "DevOps",
  "Data",
  "Growth",
  "Product",
];
