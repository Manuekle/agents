import type { MascotState } from "./mascot";
import { agentFromGraph, autoLayout, type AgentGraph, type GraphEdge, type GraphNode } from "./graph";
import type { Agent } from "./types";

// The agent the signed-out demo builds in front of you.
//
// It is a real `Agent` running through the real graph and export code, not a
// screenshot of one: the CLAUDE.md and agent.json the last step prints are
// produced by the same `exportAgent` the composer uses, so what a visitor is
// shown is what they would actually get. Nothing here is fetched, drafted or
// saved — the point of the demo is that it needs no account and spends nothing.
//
// Every id is a literal. The graph helpers mint ids from `Date.now()`, which is
// correct for a live edit and wrong for a constant that is rendered on the
// server and then hydrated on the client — the two would disagree and React
// would blow the tree away.

// ------------------------------------------------------------------- the brief

/** The onboarding answers, as if someone had typed them. */
export const DEMO_BRIEF = {
  purpose: "run our release: review every diff, chase the failing tests, then cut the tag",
  domain: "Next.js app on Vercel, Postgres, Playwright e2e",
  tone: "Direct",
  target: "claude-code",
  teamName: "Acme platform",
} as const;

/** The registry queries the drafting model emitted from that brief. */
export const DEMO_SEARCH_TERMS = ["code review", "testing", "release"];

/**
 * What skills.sh handed back for those queries. Real owner/repo pairs: the demo
 * prints them inside an `npx skills add` line, and an invented repo there is an
 * install command that cannot resolve.
 */
export const DEMO_CANDIDATES = [
  { name: "Security Review", repo: "getsentry/skills", picked: true },
  { name: "Vercel React Best Practices", repo: "vercel-labs/agent-skills", picked: true },
  { name: "QA", repo: "mattpocock/skills", picked: true },
  { name: "Transitions", repo: "jakubantalik/transitions-dev", picked: false },
  { name: "Prisma Expert", repo: "prisma/skills", picked: false },
];

// -------------------------------------------------------------------- the graph

/**
 * `step` is the point in the script at which a node appears. Everything at or
 * below the current step is on the canvas; the rest has not been added yet.
 */
type DemoNode = GraphNode & { step: number };

const NODES: DemoNode[] = [
  {
    step: 0,
    id: "demo-root",
    kind: "orchestrator",
    x: 0,
    y: 0,
    name: "Release Captain",
    role: "owns the release end to end",
    systemPrompt:
      "You own the release. Plan it, delegate it, and do not do it all yourself.\n" +
      "Hand every diff to the reviewer and every red suite to the test runner. " +
      "Cut the tag only once both come back clean.",
    model: "claude-opus-5",
    temperature: 0.4,
    mascot: "working",
  },
  {
    step: 2,
    id: "demo-c-security",
    kind: "skills",
    x: 0,
    y: 0,
    name: "Security Review",
    repo: "getsentry/skills",
    refId: "demo-c-security",
  },
  {
    step: 3,
    id: "demo-reviewer",
    kind: "subagent",
    x: 0,
    y: 0,
    name: "Diff Reviewer",
    role: "reads every diff before it lands",
    systemPrompt:
      "You review diffs. One line per finding, severity first, no praise. " +
      "Say nothing about formatting unless it changes meaning.",
    model: "claude-opus-5",
    temperature: 0.2,
    mascot: "sherlock",
  },
  {
    step: 3,
    id: "demo-c-react",
    kind: "skills",
    x: 0,
    y: 0,
    name: "Vercel React Best Practices",
    repo: "vercel-labs/agent-skills",
    refId: "demo-c-react",
  },
  {
    step: 3,
    id: "demo-tests",
    kind: "subagent",
    x: 0,
    y: 0,
    name: "Test Runner",
    role: "chases the suite until it is green",
    systemPrompt:
      "You run the suite, read the failure, and fix the cause rather than the " +
      "assertion. Report what broke and why, not what you tried.",
    model: "claude-sonnet-5",
    temperature: 0.3,
    mascot: "cooking",
  },
  {
    step: 3,
    id: "demo-c-qa",
    kind: "skills",
    x: 0,
    y: 0,
    name: "QA",
    repo: "mattpocock/skills",
    refId: "demo-c-qa",
  },
];

const EDGES: GraphEdge[] = [
  { id: "demo-e1", from: "demo-root", to: "demo-c-security" },
  { id: "demo-e2", from: "demo-root", to: "demo-reviewer" },
  { id: "demo-e3", from: "demo-root", to: "demo-tests" },
  { id: "demo-e4", from: "demo-reviewer", to: "demo-c-react" },
  { id: "demo-e5", from: "demo-tests", to: "demo-c-qa" },
];

/** The finished graph, laid out once. Positions are stable across steps. */
const LAID_OUT = autoLayout({
  nodes: NODES.map(({ step: _step, ...node }) => node),
  edges: EDGES,
});

const STEP_OF = new Map(NODES.map((n) => [n.id, n.step]));

/** What the composer opens on before anything has been drafted into it. */
const UNTITLED = { name: "Untitled Agent", role: "general assistant", systemPrompt: "" };

/**
 * The canvas as it stood at `step`. Nodes keep the position they hold in the
 * finished layout, so the tree grows into place instead of rearranging itself
 * under the viewer every time something is added.
 */
export function demoGraphAt(step: number): AgentGraph {
  const nodes = LAID_OUT.nodes
    .filter((n) => (STEP_OF.get(n.id) ?? 0) <= step)
    // Before the draft lands the orchestrator is the empty one `newAgent()`
    // creates, so the first step shows what a real cold start looks like
    // rather than an agent that named itself before anyone asked.
    .map((n) => (step < 1 && n.kind === "orchestrator" ? { ...n, ...UNTITLED } : n));
  const visible = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    edges: LAID_OUT.edges.filter((e) => visible.has(e.from) && visible.has(e.to)),
  };
}

// -------------------------------------------------------------------- the agent

const BASE: Agent = {
  id: "demo-release-captain",
  name: "Release Captain",
  role: "owns the release end to end",
  systemPrompt: "",
  target: "claude-code",
  model: "claude-opus-5",
  temperature: 0.4,
  skills: [],
  mascot: "working",
  accent: "#f95c4b",
  // Fixed, not Date.now(): this record is rendered on the server and hydrated
  // on the client, and a timestamp would differ between the two.
  createdAt: 0,
};

/** The agent record as it stands at `step` — the same shape the composer edits. */
export function demoAgentAt(step: number): Agent {
  return agentFromGraph(BASE, demoGraphAt(step));
}

/** The finished article, for the export panel. */
export const DEMO_AGENT = demoAgentAt(Number.MAX_SAFE_INTEGER);

// -------------------------------------------------------------------- the script

export interface DemoStep {
  key: string;
  /** Nav label — short enough for the step rail. */
  label: string;
  title: string;
  blurb: string;
  mascot: MascotState;
  /** What the real app calls this, so the demo maps onto the actual routes. */
  where: string;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    key: "brief",
    label: "Brief",
    title: "Say what it should do",
    blurb:
      "Four questions. No prompt engineering, no blank page — the answers become the brief a model drafts from.",
    mascot: "thinking",
    where: "/onboarding",
  },
  {
    key: "persona",
    label: "Draft",
    title: "A model writes the persona",
    blurb:
      "Name, role and system prompt, drafted from the brief — then yours to edit, field by field.",
    mascot: "wizard",
    where: "/onboarding",
  },
  {
    key: "skills",
    label: "Skills",
    title: "Picked out of a live registry",
    blurb:
      "The model searches skills.sh with its own queries and chooses from what actually came back, so every repo resolves.",
    mascot: "sherlock",
    where: "/build",
  },
  {
    key: "delegate",
    label: "Delegate",
    title: "Split the work across specialists",
    blurb:
      "An orchestrator that plans, specialists that do. Each one carries only the components it needs.",
    mascot: "working",
    where: "/build",
  },
  {
    key: "export",
    label: "Export",
    title: "Ship it to the tool you use",
    blurb:
      "CLAUDE.md, AGENTS.md, .cursorrules, GEMINI.md or raw MCP — plus one install command for every component.",
    mascot: "rocket",
    where: "/build",
  },
];

/** The step a node first appears at, for the canvas caption. */
export const LAST_STEP = DEMO_STEPS.length - 1;
