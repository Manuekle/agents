import { KIND_META, componentId, kindOfArg, type AitmplKind } from "./aitmpl";
import { graphOf, subagentSpecs } from "./export";
import type { Agent } from "./types";

/**
 * The context pack: the `.md` files a repo needs so an agent can work in it
 * without being handed the whole project every turn.
 *
 * The target file an agent exports (CLAUDE.md, AGENTS.md, .cursorrules…) is
 * loaded on *every* turn, so it has to stay short — which means the durable
 * but situational knowledge has nowhere to live. That is what these are: one
 * file per task, each with frontmatter saying when to read it and when to skip
 * it, so a model can pass over a doc without spending it.
 *
 * They are scaffolds, not claims. This app knows the agent, never the repo it
 * will land in, so every section states what belongs there and leaves the
 * facts to whoever runs the agent — a generated doc that invented a colour
 * palette would be worse than no doc at all.
 */

export interface DocFile {
  /** Repo-relative path, e.g. `docs/DESIGN.md`. */
  path: string;
  /** Filename alone — what a single-file download is called. */
  filename: string;
  title: string;
  /** Why this agent got this file. Shown in the UI and in the index. */
  why: string;
  /** Rough token cost of the file, for the index table. */
  tokens: number;
  content: string;
}

type DocId =
  | "index"
  | "architecture"
  | "design"
  | "data"
  | "api"
  | "testing"
  | "security"
  | "operations"
  | "glossary";

interface DocSpec {
  id: DocId;
  path: string;
  title: string;
  area: string;
  /** Lowercase substrings that make this doc worth generating. */
  triggers: string[];
  /** Component kinds that imply it regardless of wording. */
  kinds?: AitmplKind[];
  /** Generated for every agent — the structural floor. */
  always?: boolean;
  readWhen: string;
  skipWhen: string;
  summary: string;
  /** Sections, in order: `[heading, guidance]`. */
  body: (agent: Agent) => string;
}

/** ~4 characters a token — close enough for a "what will this cost me" column. */
export function estimateTokens(text: string): number {
  return Math.round(text.length / 4);
}

/** `~1.2k` / `~800` — how the estimate reads in frontmatter and in the UI. */
export function formatTokens(n: number): string {
  return n >= 1000 ? `~${(n / 1000).toFixed(1)}k` : `~${n}`;
}

/**
 * Everything the agent says about itself, lowercased, as one string: role,
 * system prompt, every subagent's role and prompt, and every component name.
 * Relevance is matched against this rather than against the role alone —
 * "writes the migrations" usually shows up in a subagent, not in the title.
 */
function haystack(agent: Agent): string {
  const graph = graphOf(agent);
  const subs = subagentSpecs(graph);
  return [
    agent.name,
    agent.role,
    agent.systemPrompt,
    ...subs.flatMap((s) => [s.name, s.role, s.system]),
    ...agent.skills.map((s) => `${s.name} ${s.repo ?? ""} ${componentId(s.installArg) ?? ""}`),
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Whole-word match, not `includes`.
 *
 * Substrings are hopeless at this size: `ci` hides inside "precision" and
 * "efficiency", `db` inside "sandbox", `ui` inside "build" — every agent would
 * come out needing every doc. Multi-word triggers ("data model") still work,
 * because the boundaries are only at the ends.
 */
function hasTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

/** The component kinds present in the agent, so a doc can key off them. */
function kindsIn(agent: Agent): Set<AitmplKind> {
  return new Set(
    agent.skills.map((s) => (s.repo ? "skills" : (kindOfArg(s.installArg) ?? "skills"))),
  );
}

/**
 * The subagent whose wording matches a doc's triggers — the specialist that
 * area belongs to. Named in the doc so a delegated team knows who owns the
 * file, and left out when nothing matches rather than guessed at.
 */
function ownerOf(agent: Agent, triggers: string[]): string | null {
  const subs = subagentSpecs(graphOf(agent));
  const hit = subs.find((s) => {
    const text = `${s.name} ${s.role} ${s.system}`.toLowerCase();
    return triggers.some((t) => hasTerm(text, t));
  });
  return hit?.name ?? null;
}

// ---------------------------------------------------------------- sections --

/** `## Heading` + the italic line saying what belongs under it. */
function section(heading: string, guidance: string, extra = ""): string {
  return `## ${heading}\n\n_${guidance}_\n${extra ? `\n${extra}\n` : ""}`;
}

const TODO = "<!-- TODO: fill this in from the codebase. -->";
// A comment renders as an empty cell, and an empty row reads as a finished
// table with nothing in it. Inside a table the placeholder has to be visible.
const CELL = "TODO";

/** The component inventory as markdown — the one part these docs know for real. */
function componentTable(agent: Agent): string {
  if (agent.skills.length === 0) return "_No components picked yet._";
  const rows = KIND_META.flatMap((meta) => {
    const items = agent.skills.filter(
      (s) => (s.repo ? "skills" : (kindOfArg(s.installArg) ?? "skills")) === meta.id,
    );
    return items.map((s) => `| ${s.name} | ${meta.label} | \`${s.repo ?? componentId(s.installArg) ?? "?"}\` |`);
  });
  return `| Component | Kind | Installs as |\n|---|---|---|\n${rows.join("\n")}`;
}

// -------------------------------------------------------------- doc specs --

const SPECS: DocSpec[] = [
  {
    id: "architecture",
    path: "docs/ARCHITECTURE.md",
    title: "ARCHITECTURE",
    area: "engineering",
    triggers: [],
    always: true,
    summary: "Module map, boundaries and the flows that cross them.",
    readWhen: "Adding a route or module, or you need the file map before editing.",
    skipWhen: "A single-file change inside a module you already know.",
    body: (agent) => `${section(
      "Stack",
      "Language, framework, runtime and package manager — versions included, because a model will otherwise write for the version it was trained on.",
      `${TODO}`,
    )}
${section(
  "Map",
  "One row per top-level directory: what it owns, and what it must not.",
  `| Path | Owns |\n|---|---|\n| \`src/\` | ${CELL} |`,
)}
${section("Boundaries", "The rules that keep the map true — what may import what, and which direction dependencies run.", TODO)}
${section("Flows", "The two or three paths that actually matter, end to end. Name the files each one passes through.", TODO)}
${section(
  "Agent components in this repo",
  "Installed by the command in the export. Listed so a reader knows what is already available before adding more.",
  componentTable(agent),
)}`,
  },
  {
    id: "design",
    path: "docs/DESIGN.md",
    title: "DESIGN",
    area: "design / frontend",
    triggers: [
      "design",
      "ui",
      "ux",
      "frontend",
      "front-end",
      "css",
      "tailwind",
      "style",
      "styling",
      "component",
      "figma",
      "layout",
      "typography",
      "color",
      "colour",
      "theme",
      "animation",
      "motion",
      "accessibility",
      "a11y",
      "react",
      "vue",
      "svelte",
    ],
    summary: "Colour tokens, typography, spacing, motion and component primitives.",
    readWhen: "Editing anything visual — colour, type, spacing, borders, motion, a new component.",
    skipWhen: "Backend, data or infrastructure work.",
    body: () => `${section(
      "Hard rules",
      "The handful of rules that are never negotiable. A model breaks the unwritten ones first, so write them down.",
      `| Rule | Why |\n|---|---|\n| ${CELL} | |`,
    )}
${section(
  "Colour tokens",
  "Every token by role — text, surface, outline, accent, state — with its light and dark value. Roles, not lightness names: a component asking for `--ink` survives a theme swap, one asking for a hex does not.",
  `| Token | Role | Light | Dark |\n|---|---|---|---|\n| ${CELL} | | | |`,
)}
${section("Contrast floor", "The minimum ratio, and against which backgrounds it is measured. State it or it will not be met.", TODO)}
${section(
  "Typography",
  "Each face: where it loads from, which class selects it, and its weight/tracking rules.",
  `| Class | Face | Rules |\n|---|---|---|\n| ${CELL} | | |`,
)}
${section("Space and grid", "The base unit and what is a multiple of it. Radii, border widths, focus outlines.", TODO)}
${section(
  "Motion",
  "Durations and easings as named tokens, not numbers scattered through components. Say where they live and how JS reads them back.",
  `| Family | Tokens |\n|---|---|\n| ${CELL} | |`,
)}
${section("Component primitives", "The kit to build from before writing anything new — names, file, and each one's variants.", TODO)}
${section("Reduced motion", "What every animation does under `prefers-reduced-motion: reduce`.", TODO)}`,
  },
  {
    id: "data",
    path: "docs/DATA.md",
    title: "DATA",
    area: "data / backend",
    triggers: [
      "database",
      "db",
      "sql",
      "schema",
      "postgres",
      "postgresql",
      "supabase",
      "prisma",
      "mysql",
      "sqlite",
      "mongo",
      "orm",
      "migration",
      "query",
      "table",
      "data model",
      "analytics",
      "etl",
      "warehouse",
    ],
    summary: "Schema, access rules, migrations and where each limit is enforced.",
    readWhen: "Touching the schema, persistence, migrations or quotas.",
    skipWhen: "Visual or docs-only work.",
    body: () => `${section(
      "Tables",
      "One block per table: columns, keys, indexes, and the reason the key is shaped that way.",
      `### \`table_name\`\n\n${TODO}`,
    )}
${section("Access rules", "Row-level security or its equivalent. Which policies exist, and which write paths deliberately have none.", TODO)}
${section("Functions and triggers", "Anything the database does on its own, with its contract in one line.", TODO)}
${section("Where limits are enforced", "If a limit exists in both the app and the database, say so and say why — an app-only check is a suggestion when the database is reachable directly.", TODO)}
${section("Migrations", "Numbering, ordering, and the rule that shipped files are never edited.", TODO)}`,
  },
  {
    id: "api",
    path: "docs/API.md",
    title: "API",
    area: "backend / integrations",
    triggers: [
      "api",
      "endpoint",
      "rest",
      "graphql",
      "http",
      "backend",
      "server",
      "route",
      "webhook",
      "mcp",
      "integration",
      "sdk",
      "grpc",
      "microservice",
    ],
    kinds: ["mcps"],
    summary: "Endpoints, auth, rate limits and error contracts.",
    readWhen: "Adding or changing an endpoint, auth or an integration.",
    skipWhen: "UI-only or schema-only work.",
    body: () => `${section(
      "Endpoints",
      "One row per endpoint: method, path, who may call it, and what it costs to serve.",
      `| Endpoint | Method | Access |\n|---|---|---|\n| ${CELL} | | |`,
    )}
${section("Auth", "How a caller proves who it is, and where that check binds — the middleware redirect is never the check that binds.", TODO)}
${section("Rate limits", "Per endpoint, with its bucket. Shared buckets are a bug waiting to happen.", TODO)}
${section(
  "Errors",
  "The status codes this API actually returns and what each one means here.",
  `| Status | Meaning |\n|---|---|\n| ${CELL} | |`,
)}
${section("Rules for a new endpoint", "The checklist. Ordered, because order is the rule: gate, limit, validate, spend, call.", TODO)}`,
  },
  {
    id: "testing",
    path: "docs/TESTING.md",
    title: "TESTING",
    area: "quality",
    triggers: [
      "test",
      "testing",
      "qa",
      "e2e",
      "unit test",
      "integration test",
      "playwright",
      "cypress",
      "vitest",
      "jest",
      "pytest",
      "coverage",
      "regression",
      "tdd",
    ],
    summary: "How to run the suite, what must be covered, and what never is.",
    readWhen: "Writing or fixing tests, or before claiming something works.",
    skipWhen: "Docs-only changes.",
    body: () => `${section(
      "Commands",
      "The exact commands: whole suite, one file, watch mode. A model that has to guess will run the wrong one.",
      "```bash\n# TODO\n```",
    )}
${section("Layout", "Where tests live and how they are named.", TODO)}
${section("What must be covered", "The paths where a regression is expensive. Be specific — 'everything' is not a rule.", TODO)}
${section("What is not tested, on purpose", "So nobody adds a brittle suite for it later, and nobody reads the gap as an oversight.", TODO)}
${section("Fixtures and doubles", "How external services are stood in for, and which ones are never faked.", TODO)}`,
  },
  {
    id: "security",
    path: "docs/SECURITY.md",
    title: "SECURITY",
    area: "security",
    triggers: [
      "security",
      "auth",
      "authentication",
      "authorization",
      "oauth",
      "token",
      "secret",
      "credential",
      "password",
      "permission",
      "rls",
      "encryption",
      "vulnerability",
      "pentest",
      "compliance",
      "gdpr",
      "audit",
    ],
    summary: "Trust boundaries, secret handling and the changes that count as security changes.",
    readWhen: "Touching auth, secrets, tokens, permissions or anything that crosses a trust boundary.",
    skipWhen: "Purely cosmetic work.",
    body: () => `${section("Trust boundaries", "Where untrusted input enters. Everything else follows from this list.", TODO)}
${section("Secrets", "Which keys exist, where each one may appear, and which must never reach a client bundle.", TODO)}
${section("Identity", "How a session or token is verified, and what happens when the check cannot be completed — failing open and failing closed are both decisions and both belong here.", TODO)}
${section(
  "Security-sensitive files",
  "The files where any change is a security change and must be flagged as one in review.",
  `| File | Why |\n|---|---|\n| ${CELL} | |`,
)}
${section("Reporting", "Where a vulnerability report goes, and what response time it can expect.", TODO)}`,
  },
  {
    id: "operations",
    path: "docs/OPERATIONS.md",
    title: "OPERATIONS",
    area: "ops",
    triggers: [
      "deploy",
      "deployment",
      "ci",
      "cd",
      "pipeline",
      "docker",
      "kubernetes",
      "k8s",
      "vercel",
      "aws",
      "infra",
      "infrastructure",
      "rollback",
      "monitor",
      "observability",
      "logging",
      "incident",
      "on-call",
      "terraform",
    ],
    kinds: ["hooks", "settings"],
    summary: "Environments, deploy path, configuration and what to do when it breaks.",
    readWhen: "Deploying, changing configuration, or handling an incident.",
    skipWhen: "Local feature work that ships through the normal pipeline.",
    body: () => `${section(
      "Environments",
      "Each one: what it is for, its URL, and how it differs from production.",
      `| Environment | URL | Notes |\n|---|---|---|\n| ${CELL} | | |`,
    )}
${section("Deploy", "The path a commit takes to production, and who may trigger each step.", TODO)}
${section(
  "Configuration",
  "Every variable: what it does, whether it is required, and — for optional ones — what its absence turns off.",
  `| Variable | Required | Effect |\n|---|---|---|\n| ${CELL} | | |`,
)}
${section("Rollback", "The exact steps, written for someone reading them at 3am.", TODO)}
${section("Monitoring", "What is watched, where the dashboards are, and what pages a human.", TODO)}`,
  },
  {
    id: "glossary",
    path: "docs/GLOSSARY.md",
    title: "GLOSSARY",
    area: "domain",
    triggers: ["domain", "glossary", "terminology", "business logic", "ubiquitous language"],
    summary: "Domain terms, defined once, so every agent uses them the same way.",
    readWhen: "A term in the code or the prompts is doing work you cannot infer.",
    skipWhen: "Generic refactors that touch no domain concept.",
    body: (agent) => {
      const subs = subagentSpecs(graphOf(agent));
      const roster = subs.length
        ? `| Specialist | Owns |\n|---|---|\n${subs
            .map((s) => `| ${s.name} | ${s.role || CELL} |`)
            .join("\n")}`
        : "_No subagents — the orchestrator does the work itself._";
      return `${section(
        "Terms",
        "One row per term that a newcomer would guess wrong. Skip anything obvious from its name.",
        `| Term | Means |\n|---|---|\n| ${CELL} | |`,
      )}
${section(
  "Who does what",
  "The delegation tree in words, so a term always resolves to the specialist that owns it.",
  roster,
)}`;
    },
  },
];

/** Frontmatter — the block that lets a model skip a file without reading it. */
function frontmatter(fields: Record<string, string>): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---\n`;
}

/** `2026-08-05` in UTC, so a server render and a client render agree. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Which docs this agent warrants.
 *
 * Wording first, component kinds second: an agent that carries an MCP server
 * needs the API doc whether or not its prompt says the word. `always` specs
 * are the floor — every repo has a shape, so ARCHITECTURE is never optional.
 */
function chosenSpecs(agent: Agent): DocSpec[] {
  const text = haystack(agent);
  const kinds = kindsIn(agent);
  return SPECS.filter((spec) => {
    if (spec.always) return true;
    if (spec.kinds?.some((k) => kinds.has(k))) return true;
    return spec.triggers.some((t) => hasTerm(text, t));
  });
}

/** Why a spec was picked, in the words the UI and the index both spend. */
function whyOf(agent: Agent, spec: DocSpec): string {
  if (spec.always) return "every repo has one";
  const kinds = kindsIn(agent);
  const kindHit = spec.kinds?.find((k) => kinds.has(k));
  if (kindHit) return `carries ${KIND_META.find((m) => m.id === kindHit)?.label ?? kindHit}`;
  const text = haystack(agent);
  const hit = spec.triggers.find((t) => hasTerm(text, t));
  return hit ? `mentions "${hit}"` : "matched this agent";
}

/**
 * Frontmatter + heading + body + the Related footer, for one spec.
 *
 * Shared by the static scaffold (`body` is the TODO-filled template) and the
 * AI path (`body` is what the model wrote to replace it) so the two produce
 * the same shape of file — a reader should not be able to tell which path a
 * doc took just from its structure.
 */
function wrap(
  agent: Agent,
  spec: DocSpec,
  body: string,
  opts: { version: string; generatedBy: string },
): DocFile {
  const owner = spec.always ? null : ownerOf(agent, spec.triggers);
  const ownerLine = owner ? `\n> Owned by the **${owner}** subagent.\n` : "";
  const intro = `# ${spec.title}\n${ownerLine}\n`;
  const related = `\n## Related\n\n[Context map](README.md) — the other docs and when to read them.\n`;
  const draft = `${intro}${body.trim()}\n${related}`;

  const head = frontmatter({
    title: `${spec.title} — ${agent.name}`,
    summary: spec.summary,
    version: opts.version,
    updated: today(),
    area: spec.area,
    audience: "ai-agent",
    read_when: spec.readWhen,
    skip_when: spec.skipWhen,
    tokens_est: formatTokens(estimateTokens(draft)),
    generated_by: opts.generatedBy,
  });

  const content = `${head}\n${draft}`;
  return {
    path: spec.path,
    filename: spec.path.split("/").pop() as string,
    title: spec.title,
    why: whyOf(agent, spec),
    tokens: estimateTokens(content),
    content,
  };
}

function render(agent: Agent, spec: DocSpec): DocFile {
  return wrap(agent, spec, spec.body(agent), { version: "0.1.0", generatedBy: "agents.dev" });
}

function specByPath(path: string): DocSpec | undefined {
  return SPECS.find((s) => s.path === path);
}

/**
 * The scaffold handed to the model: the guidance-and-TODO body it is meant to
 * replace, plus enough of the agent's own words that "fill this in" has
 * something to fill it in *with*. Not the rendered file — frontmatter and the
 * Related footer are ours, not the model's, and get rebuilt by `withAiBody`
 * whatever it returns.
 */
export function docScaffold(
  agent: Agent,
  path: string,
): { title: string; area: string; body: string } | null {
  const spec = specByPath(path);
  if (!spec) return null;
  return { title: spec.title, area: spec.area, body: spec.body(agent) };
}

/**
 * Re-wraps a model's draft of one doc's body in the same frontmatter and
 * footer every generated doc gets, so an AI-filled file and a scaffold are
 * indistinguishable in shape — only `generated_by` says which one a reader is
 * holding.
 */
export function withAiBody(agent: Agent, path: string, filledBody: string): DocFile | null {
  const spec = specByPath(path);
  if (!spec) return null;
  return wrap(agent, spec, filledBody, {
    version: "1.0.0",
    generatedBy: "agents.dev + AI draft — verify before trusting",
  });
}

/** The index: the only file meant to be read every time, so it stays a table. */
function renderIndex(agent: Agent, docs: DocFile[], targetFile: string): DocFile {
  const rows = docs
    .map((d) => `| [${d.filename}](${d.filename}) | ${d.why} | ${formatTokens(d.tokens)} |`)
    .join("\n");

  const draft = `# Context map — ${agent.name}

These docs are split by **task**, not by chapter, so a model loads one file
instead of the whole project. Load the row that matches the work; leave the
rest unread.

| Doc | Generated because the agent | Cost |
|---|---|---|
${rows}

\`${targetFile}\` at the repo root is the entry point and stays short — it is
loaded on **every** turn, so anything durable but situational belongs in one of
the files above instead.

## House rules

1. **One file, one job.** A section only ever read by a different task belongs in that task's file.
2. **Frontmatter on every file** — \`read_when\` and \`skip_when\` are what let a model skip a doc without spending it.
3. **Headings are the chunk boundary.** \`#\` once, \`##\` per section. A wall of text is one unhelpful chunk.
4. **Tables over prose** for anything enumerable.
5. **Point at the source of truth, never copy it** — copied code drifts, and a drifted doc is worse than none.
6. **Facts, dated.** Bump \`updated\` and \`version\` when the content changes.
7. Replace every \`TODO\` before trusting a file. These are scaffolds: agents.dev knows the agent, not your repo.
`;

  const head = frontmatter({
    title: `Context map — ${agent.name}`,
    summary: "Which doc to load for which task, and what each one costs.",
    version: "0.1.0",
    updated: today(),
    area: "meta",
    audience: "ai-agent, human",
    read_when: "Always — it is the router.",
    skip_when: "Never.",
    tokens_est: formatTokens(estimateTokens(draft)),
    generated_by: "agents.dev",
  });

  const content = `${head}\n${draft}`;
  return {
    path: "docs/README.md",
    filename: "README.md",
    title: "Context map",
    why: "routes every other doc",
    tokens: estimateTokens(content),
    content,
  };
}

/**
 * The pack, index first.
 *
 * `targetFile` is whatever the agent exports as its always-loaded file, so the
 * index points at the real name — telling a Cursor user to keep `CLAUDE.md`
 * short helps nobody.
 */
export function docPack(agent: Agent, targetFile: string): DocFile[] {
  const specs = chosenSpecs(agent);
  const docs = specs.map((spec) => render(agent, spec));
  return [renderIndex(agent, docs, targetFile), ...docs];
}

/** Total cost of the pack — what the UI puts on the panel header. */
export function packTokens(docs: DocFile[]): number {
  return docs.reduce((sum, d) => sum + d.tokens, 0);
}
