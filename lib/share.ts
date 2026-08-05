import { MASCOTS } from "./mascot";
import { newEdgeId, normalizeGraph, type AgentGraph, type GraphNode } from "./graph";
import { TARGETS, type Agent, type PickedSkill } from "./types";

// A shared agent travels in the URL, not in the database. The `agents` table is
// owned-row-only by design (see supabase/migrations/0001_agents.sql), so a
// DB-backed link would need public rows, a second read path and a cleanup
// story. Encoding the spec itself means a link works for a signed-out stranger
// on first click, keeps working if the author deletes their copy, and costs no
// storage.
//
// The tradeoff is length: the URL grows with the system prompt. `MAX_ENCODED`
// keeps it inside what every browser and proxy handles.

// Short keys because every character is URL. The mapping is explicit rather
// than positional so a future field cannot silently shift the others.
interface Packed {
  n: string; // name
  r: string; // role
  p: string; // systemPrompt
  t: string; // target
  m: string; // model
  e: number; // temperature
  s: [string, string, 0 | 1][]; // [name, repo-or-installArg, isInstallArg]
  c: string; // mascot
  a: string; // accent
  // The canvas graph, packed positionally: a link that rebuilt the picks but
  // lost the orchestrator/subagent structure would drop the part of the agent
  // that took the most work to design.
  g?: PackedGraph;
}

// Nodes: [id, kind, x, y, name, role, prompt, model, temp, mascot, repo, arg].
// Positional and terse because every character is URL, and the graph is by far
// the biggest thing in the payload.
type PackedNode = [
  string, // id
  string, // kind
  number, // x
  number, // y
  string, // name
  string, // role
  string, // systemPrompt
  string, // model
  number, // temperature
  string, // mascot
  string, // repo
  string, // installArg
];

interface PackedGraph {
  n: PackedNode[];
  e: [string, string][]; // [from, to] — edge ids are regenerated on unpack
}

// Chrome and Safari take far more, but proxies and mail clients start
// truncating past ~8k. Anything over this is a system prompt that wants a file.
export const MAX_ENCODED = 6000;

function packSkills(skills: PickedSkill[]): Packed["s"] {
  return skills.map((s) => (s.repo ? [s.name, s.repo, 0] : [s.name, s.installArg ?? "", 1]));
}

function unpackSkills(raw: unknown): PickedSkill[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry, i): PickedSkill[] => {
    if (!Array.isArray(entry)) return [];
    const [name, target, isArg] = entry;
    if (typeof name !== "string" || typeof target !== "string" || !target) return [];
    // The id is not carried: it only has to be unique within this agent, and
    // regenerating it avoids trusting a stranger's string as a React key.
    const id = `shared-${i}-${target}`;
    return [isArg ? { id, name, installArg: target } : { id, name, repo: target }];
  });
}

function packGraph(graph: AgentGraph | undefined): PackedGraph | undefined {
  if (!graph) return undefined;
  return {
    n: graph.nodes.map((n) => [
      n.id,
      n.kind,
      Math.round(n.x),
      Math.round(n.y),
      n.name,
      n.role ?? "",
      n.systemPrompt ?? "",
      n.model ?? "",
      typeof n.temperature === "number" ? n.temperature : -1,
      n.mascot ?? "",
      n.repo ?? "",
      n.installArg ?? "",
    ]),
    e: graph.edges.map((e) => [e.from, e.to]),
  };
}

function unpackGraph(raw: unknown, fallback: Agent): AgentGraph | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const g = raw as Partial<PackedGraph>;
  if (!Array.isArray(g.n)) return undefined;

  const nodes: GraphNode[] = [];
  for (const row of g.n) {
    if (!Array.isArray(row) || typeof row[0] !== "string") continue;
    const [id, kind, x, y, name, role, prompt, model, temp, mascot, repo, arg] = row;
    // Every string is sliced: the payload came from a URL a stranger sent, and
    // an unbounded name would land straight in the canvas and the export.
    nodes.push({
      id: String(id).slice(0, 64),
      // normalizeGraph is what actually validates the kind; anything it does
      // not recognise is dropped there rather than trusted here.
      kind: kind as GraphNode["kind"],
      x: typeof x === "number" && Number.isFinite(x) ? x : 0,
      y: typeof y === "number" && Number.isFinite(y) ? y : 0,
      name: str(name, "untitled").slice(0, 80),
      role: str(role).slice(0, 160) || undefined,
      systemPrompt: str(prompt).slice(0, 8000) || undefined,
      model: str(model).slice(0, 80) || undefined,
      temperature: typeof temp === "number" && temp >= 0 && temp <= 2 ? temp : undefined,
      mascot: str(mascot) in MASCOTS ? (mascot as Agent["mascot"]) : undefined,
      repo: str(repo).slice(0, 200) || undefined,
      installArg: str(arg).slice(0, 200) || undefined,
    });
  }

  const edges = (Array.isArray(g.e) ? g.e : [])
    .filter((e): e is [string, string] => Array.isArray(e) && typeof e[0] === "string" && typeof e[1] === "string")
    .map(([from, to]) => ({ id: newEdgeId(), from, to }));

  return normalizeGraph({ nodes, edges }, fallback);
}

// base64url: `+/=` are all either reserved or padding in a query string, and
// percent-encoding them would undo the point of encoding compactly.
function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** The `?s=` payload for an agent, or null when it would be too long to share. */
export function encodeAgent(agent: Agent): string | null {
  const packed: Packed = {
    n: agent.name,
    r: agent.role,
    p: agent.systemPrompt,
    t: agent.target,
    m: agent.model,
    e: agent.temperature,
    s: packSkills(agent.skills),
    c: agent.mascot,
    a: agent.accent,
    g: packGraph(agent.graph),
  };
  const encoded = toBase64Url(JSON.stringify(packed));
  return encoded.length > MAX_ENCODED ? null : encoded;
}

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

/**
 * Rebuild an agent from a `?s=` payload. Every field is validated against what
 * the app accepts rather than trusted: the string came from a URL, so a bad
 * `target` would render a tool that does not exist and a bad `temperature`
 * would break the slider.
 */
export function decodeAgent(payload: string): Agent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(payload));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;

  const target = TARGETS.find((t) => t.id === p.t)?.id ?? "claude-code";
  const mascot = str(p.c) in MASCOTS ? (p.c as Agent["mascot"]) : "working";
  const temperature =
    typeof p.e === "number" && p.e >= 0 && p.e <= 2 ? p.e : 0.7;

  const agent: Agent = {
    // A shared agent is a new agent in whoever opened it: saving must not
    // overwrite a row the recipient already owns under the author's id.
    id: `agent-${Date.now().toString(36)}`,
    name: str(p.n, "Shared Agent").slice(0, 80),
    role: str(p.r).slice(0, 160),
    systemPrompt: str(p.p).slice(0, 8000),
    target,
    // Not checked against MODELS: the list moves as vendors ship, and an
    // unknown id here is a stale link, not an exploit. The Select falls back.
    model: str(p.m, "claude-opus-5").slice(0, 80),
    temperature,
    skills: unpackSkills(p.s).slice(0, 40),
    mascot,
    // Anything not a hex colour would land straight in a style attribute.
    accent: /^#[0-9a-f]{6}$/i.test(str(p.a)) ? str(p.a) : "#f95c4b",
    createdAt: Date.now(),
  };

  // A link written before graphs existed carries no `g`; normalizeGraph builds
  // one from the picks, so an old link still opens as a valid canvas.
  return { ...agent, graph: unpackGraph(p.g, agent) ?? normalizeGraph(null, agent) };
}

/** Absolute share URL for an agent, or null when the spec is too long. */
export function shareUrl(agent: Agent, origin: string): string | null {
  const encoded = encodeAgent(agent);
  return encoded ? `${origin}/build?s=${encoded}` : null;
}
