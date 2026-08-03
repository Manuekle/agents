import type { Skill } from "./types";

// Offline fallback for /api/skills: served when the query is too short for the
// skills.sh API (which needs q >= 2) or when skills.sh is unreachable.
//
// Every entry carries a real `repo`. The browser falls back to `source` when
// `repo` is missing, and a bare source ("gstack", "vercel") is not an
// owner/repo — it produced install lines like `npx skills add vercel` that
// cannot resolve. The repos below were resolved against the live skills.sh index.
//
// `installs` is deliberately absent: these are hand-curated entries and any
// count here would be invented. Live results carry the registry's real numbers.
export const SEED_SKILLS: Skill[] = [
  { id: "sk-brainstorm", name: "Brainstorming", slug: "brainstorming", category: "Product", source: "skills.sh", repo: "obra/superpowers", description: "Explore intent & requirements before any build.", tags: ["planning", "product"] },
  { id: "sk-frontend", name: "Frontend Design", slug: "frontend-design", category: "Design", source: "skills.sh", repo: "anthropics/skills", description: "Distinctive, intentional UI direction & typography.", tags: ["ui", "design", "css"] },
  { id: "sk-a11y", name: "Accessibility", slug: "accessibility", category: "Quality", source: "skills.sh", repo: "addyosmani/web-quality-skills", description: "WCAG 2.2 audits, keyboard nav, screen-reader support.", tags: ["a11y", "audit"] },
  { id: "sk-canvas", name: "Canvas Design", slug: "canvas-design", category: "Design", source: "skills.sh", repo: "anthropics/skills", description: "Posters, art & static pieces via design philosophy.", tags: ["art", "png", "pdf"] },
  { id: "sk-dataviz", name: "Data Viz", slug: "dataviz", category: "Design", source: "skills.sh", repo: "mikeandrusyak/dataviz-skill", description: "Charts & dashboards that read as one system.", tags: ["charts", "svg"] },
  { id: "sk-review", name: "Code Review", slug: "review", category: "Engineering", source: "skills.sh", repo: "mattpocock/skills", description: "Pre-landing PR review with severity-tagged findings.", tags: ["review", "git"] },
  { id: "sk-investigate", name: "Investigate", slug: "investigate", category: "Engineering", source: "skills.sh", repo: "launchdarkly/agent-skills", description: "Systematic debugging & root-cause tracing.", tags: ["debug"] },
  { id: "sk-ship", name: "Ship", slug: "ship", category: "Engineering", source: "skills.sh", repo: "camacho/ai-skills", description: "Detect base branch, test, bump, changelog, open PR.", tags: ["release", "git"] },
  { id: "sk-qa", name: "QA", slug: "qa", category: "Quality", source: "skills.sh", repo: "mattpocock/skills", description: "Systematically QA a web app & fix bugs found.", tags: ["qa", "browser"] },
  { id: "sk-seo", name: "SEO", slug: "seo", category: "Growth", source: "skills.sh", repo: "addyosmani/web-quality-skills", description: "Meta tags, structured data, sitemap optimization.", tags: ["seo", "growth"] },
  { id: "sk-vercel-deploy", name: "Vercel Deploy", slug: "deploy", category: "DevOps", source: "skills.sh", repo: "vercel/vercel-deploy-claude-code-plugin", description: "Preview & production deploys to Vercel.", tags: ["deploy", "vercel"] },
  { id: "sk-ai-sdk", name: "AI SDK", slug: "ai-sdk", category: "AI", source: "skills.sh", repo: "vercel/ai", description: "Chat, streaming, tool calling & agents with AI SDK.", tags: ["ai", "llm"] },
  { id: "sk-prisma", name: "Prisma Expert", slug: "prisma-expert", category: "Data", source: "skills.sh", repo: "sickn33/antigravity-awesome-skills", description: "Schema design, migrations & query optimization.", tags: ["db", "orm"] },
  { id: "sk-sentry", name: "Sentry Workflow", slug: "sentry-workflow", category: "DevOps", source: "skills.sh", repo: "getsentry/sentry-for-ai", description: "Fix production issues with Sentry context.", tags: ["monitoring"] },
  { id: "sk-transitions", name: "Transitions", slug: "transitions-dev", category: "Design", source: "skills.sh", repo: "jakubantalik/transitions-dev", description: "Production-ready CSS transitions for web apps.", tags: ["motion", "css"] },
  { id: "sk-security", name: "Security Review", slug: "security-review", category: "Quality", source: "skills.sh", repo: "getsentry/skills", description: "Audit code for vulnerabilities before shipping.", tags: ["security"] },
];
