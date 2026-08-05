import type { MascotState } from "./mascot";
import { AITMPL_KINDS, componentId, kindOfArg, type AitmplKind } from "./aitmpl";
import type { Agent, PickedSkill } from "./types";

// The composer's canvas model.
//
// An agent used to be one prompt with a flat list of picks. That stopped
// describing what people actually build: an orchestrator that owns the plan and
// hands work to specialists, each specialist carrying only the components it
// needs. The graph makes that structure explicit and editable.
//
// Structure is the graph's job; `Agent.skills` stays as the flat union of every
// component in it. Everything downstream that only needs "what do I install"
// (install commands, the manifest, the old share payload) keeps reading that
// list and does not have to learn about nodes.

// ---------------------------------------------------------------- node kinds

/** Nodes that carry a prompt and can own components. */
export type AgentNodeKind = "orchestrator" | "subagent";

/** Nodes that are a picked component. One per aitmpl kind, plus skills.sh. */
export type ComponentNodeKind = AitmplKind;

export type NodeKind = AgentNodeKind | ComponentNodeKind;

export function isAgentKind(k: NodeKind): k is AgentNodeKind {
  return k === "orchestrator" || k === "subagent";
}

export function isComponentKind(k: NodeKind): k is ComponentNodeKind {
  return k in AITMPL_KINDS;
}

// ------------------------------------------------------------------- shapes

/**
 * One box on the canvas. Agent nodes and component nodes share a type because
 * they share every canvas concern — position, selection, dragging, wiring — and
 * splitting them into a union made every renderer branch twice for no gain.
 * Which fields are meaningful is decided by `kind`.
 */
export interface GraphNode {
  id: string;
  kind: NodeKind;
  /** Grid units, not pixels. See GRID — the canvas multiplies on render. */
  x: number;
  y: number;

  /** Display name. For a component this is the component's own name. */
  name: string;

  // --- agent nodes only ---
  role?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  mascot?: MascotState;

  // --- component nodes only ---
  /** skills.sh install target, `owner/repo`. */
  repo?: string;
  /** aitmpl CLI flag pair, e.g. `--hook pre-commit/lint`. */
  installArg?: string;
  /**
   * The catalog id this node was picked from. Node ids have to be unique — the
   * same skill can legitimately sit under two different specialists — so the
   * catalog id is kept separately, and it is what the component browser
   * matches its checkmarks against.
   */
  refId?: string;
}

/** `from` owns `to`: an orchestrator owns a subagent, an agent owns a component. */
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
}

export interface AgentGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// The canvas works in grid units so a drag can snap without fighting float
// drift, and so a saved graph is resolution-independent.
export const GRID = 8;
export const NODE_W = 26; // grid units — 208px
export const AGENT_NODE_H = 11; // 88px
export const COMPONENT_NODE_H = 7; // 56px

export function nodeHeight(kind: NodeKind): number {
  return isAgentKind(kind) ? AGENT_NODE_H : COMPONENT_NODE_H;
}

// ------------------------------------------------------------------ helpers

let seq = 0;
function nid(prefix: string): string {
  // Time alone collides when a paste adds five nodes in the same millisecond.
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

export function newNodeId(): string {
  return nid("n");
}

export function newEdgeId(): string {
  return nid("e");
}

/** The one orchestrator. Every graph has exactly one; see `normalizeGraph`. */
export function orchestratorOf(graph: AgentGraph): GraphNode | undefined {
  return graph.nodes.find((n) => n.kind === "orchestrator");
}

export function nodeById(graph: AgentGraph, id: string | null): GraphNode | undefined {
  return id ? graph.nodes.find((n) => n.id === id) : undefined;
}

export function subagentsOf(graph: AgentGraph): GraphNode[] {
  return graph.nodes.filter((n) => n.kind === "subagent");
}

/** Component nodes wired directly under `ownerId`. */
export function componentsOf(graph: AgentGraph, ownerId: string): GraphNode[] {
  const owned = new Set(graph.edges.filter((e) => e.from === ownerId).map((e) => e.to));
  return graph.nodes.filter((n) => owned.has(n.id) && isComponentKind(n.kind));
}

/** Subagent nodes wired directly under `ownerId`. */
export function childAgentsOf(graph: AgentGraph, ownerId: string): GraphNode[] {
  const owned = new Set(graph.edges.filter((e) => e.from === ownerId).map((e) => e.to));
  return graph.nodes.filter((n) => owned.has(n.id) && n.kind === "subagent");
}

/** Every node with no incoming edge — orphans the canvas should still draw. */
export function rootNodes(graph: AgentGraph): GraphNode[] {
  const targeted = new Set(graph.edges.map((e) => e.to));
  return graph.nodes.filter((n) => !targeted.has(n.id));
}

/** A component node as the flat pick the installers understand. */
export function nodeToPick(n: GraphNode): PickedSkill {
  return n.repo
    ? { id: n.id, name: n.name, repo: n.repo }
    : { id: n.id, name: n.name, installArg: n.installArg };
}

export function pickToNode(p: PickedSkill, x: number, y: number): GraphNode {
  const kind: ComponentNodeKind = p.repo ? "skills" : (kindOfArg(p.installArg) ?? "skills");
  return {
    id: newNodeId(),
    kind,
    x,
    y,
    name: p.name,
    repo: p.repo,
    installArg: p.installArg,
    refId: p.id,
  };
}

/**
 * The components under one agent, identified by catalog id — what the
 * component browser needs to know which rows to tick. Distinct from
 * `graphPicks`, which identifies by node so the flat list stays unique.
 */
export function componentPicksFor(graph: AgentGraph, ownerId: string): PickedSkill[] {
  return componentsOf(graph, ownerId).map((n) => ({
    id: n.refId ?? n.id,
    name: n.name,
    repo: n.repo,
    installArg: n.installArg,
  }));
}

/** The node under `ownerId` that came from catalog id `refId`, if any. */
export function componentNodeFor(
  graph: AgentGraph,
  ownerId: string,
  refId: string,
): GraphNode | undefined {
  return componentsOf(graph, ownerId).find((n) => (n.refId ?? n.id) === refId);
}

/** How a component identifies itself: owner/repo, or the CLI component id. */
export function nodeRef(n: GraphNode): string {
  return n.repo ?? componentId(n.installArg) ?? n.name;
}

/**
 * The flat pick list for a graph, in canvas order. This is what `Agent.skills`
 * mirrors, so installs and the manifest keep working untouched.
 */
export function graphPicks(graph: AgentGraph): PickedSkill[] {
  return graph.nodes.filter((n) => isComponentKind(n.kind)).map(nodeToPick);
}

// ------------------------------------------------------------------ edit ops

/** Wire `from` to `to`, refusing duplicates, self-links and cycles. */
export function connect(graph: AgentGraph, from: string, to: string): AgentGraph {
  if (from === to) return graph;
  if (graph.edges.some((e) => e.from === from && e.to === to)) return graph;
  // A component belongs to one owner: a second incoming edge would duplicate
  // it in both agents' exports, and there is no ambiguity worth preserving.
  const target = nodeById(graph, to);
  if (!target) return graph;
  if (isComponentKind(target.kind) || target.kind === "subagent") {
    graph = { ...graph, edges: graph.edges.filter((e) => e.to !== to) };
  }
  // Nothing may own the orchestrator, and no cycle may form — an export walks
  // the tree, and a loop would walk forever.
  if (target.kind === "orchestrator") return graph;
  if (reaches(graph, to, from)) return graph;
  return { ...graph, edges: [...graph.edges, { id: newEdgeId(), from, to }] };
}

/** True when `to` is reachable from `from` by following edges. */
function reaches(graph: AgentGraph, from: string, to: string): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const at = stack.pop() as string;
    if (at === to) return true;
    if (seen.has(at)) continue;
    seen.add(at);
    for (const e of graph.edges) if (e.from === at) stack.push(e.to);
  }
  return false;
}

export function disconnect(graph: AgentGraph, edgeId: string): AgentGraph {
  return { ...graph, edges: graph.edges.filter((e) => e.id !== edgeId) };
}

/** Every node at or below `id`, following ownership edges. */
export function subtreeOf(graph: AgentGraph, id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const at = stack.pop() as string;
    if (out.has(at)) continue;
    out.add(at);
    for (const e of graph.edges) if (e.from === at) stack.push(e.to);
  }
  return out;
}

/**
 * Copy a node and everything under it, re-parented to the original's owner and
 * offset so the copy is visibly a second thing. Duplicating a specialist has to
 * bring its components — a copy that arrives empty is not the specialist you
 * asked to duplicate, and re-picking six tools by hand is the work the canvas
 * exists to avoid.
 */
export function duplicateSubtree(graph: AgentGraph, id: string): { graph: AgentGraph; ids: string[] } {
  const node = nodeById(graph, id);
  if (!node || node.kind === "orchestrator") return { graph, ids: [] };

  const members = subtreeOf(graph, id);
  const remap = new Map<string, string>();
  const clones: GraphNode[] = [];
  for (const n of graph.nodes) {
    if (!members.has(n.id)) continue;
    const copy: GraphNode = { ...n, id: newNodeId(), x: n.x + NODE_W + 4, y: n.y + 2 };
    remap.set(n.id, copy.id);
    clones.push(copy);
  }

  // Internal edges are rewired between clones; the one edge coming in from
  // outside is re-pointed at the copy so it lands under the same owner.
  const edges: GraphEdge[] = [];
  for (const e of graph.edges) {
    if (members.has(e.from) && members.has(e.to)) {
      edges.push({ id: newEdgeId(), from: remap.get(e.from)!, to: remap.get(e.to)! });
    } else if (e.to === id) {
      edges.push({ id: newEdgeId(), from: e.from, to: remap.get(id)! });
    }
  }

  return {
    graph: { nodes: [...graph.nodes, ...clones], edges: [...graph.edges, ...edges] },
    ids: clones.map((c) => c.id),
  };
}

/**
 * Duplicate several nodes at once. A selection can hold both a specialist and
 * something under it, and copying each in turn would paste the inner one twice
 * — once on its own and once inside its parent's copy. Only a node that was
 * really copied claims its subtree, so a selection containing the orchestrator
 * (which is never duplicated) does not silently swallow everything else in it.
 */
export function duplicateMany(graph: AgentGraph, ids: string[]): { graph: AgentGraph; ids: string[] } {
  let next = graph;
  const covered = new Set<string>();
  const made: string[] = [];
  for (const id of ids) {
    if (covered.has(id)) continue;
    const result = duplicateSubtree(next, id);
    if (result.ids.length === 0) continue;
    for (const inner of subtreeOf(next, id)) covered.add(inner);
    next = result.graph;
    made.push(result.ids[0]);
  }
  return { graph: next, ids: made };
}

/** Move a set of nodes by the same delta, in one pass. */
export function moveNodes(graph: AgentGraph, ids: Set<string>, dx: number, dy: number): AgentGraph {
  if (dx === 0 && dy === 0) return graph;
  return {
    ...graph,
    nodes: graph.nodes.map((n) => (ids.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)),
  };
}

/** Nodes whose box intersects a world-space rectangle. Marquee selection. */
export function nodesInRect(
  graph: AgentGraph,
  a: { x: number; y: number },
  b: { x: number; y: number },
): string[] {
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  return graph.nodes
    .filter((n) => {
      const nx2 = n.x + NODE_W;
      const ny2 = n.y + nodeHeight(n.kind);
      return n.x < x2 && nx2 > x1 && n.y < y2 && ny2 > y1;
    })
    .map((n) => n.id);
}

/** How close, in grid units, an edge has to be to another to snap to it. */
const SNAP = 1.5;

/**
 * Alignment guides for a node being dragged: the lines it is close enough to
 * share with a stationary node, and the snapped position that lands it exactly
 * on them. Excalidraw's tell — you feel the alignment before you see it.
 */
export function snapTo(
  graph: AgentGraph,
  id: string,
  x: number,
  y: number,
  moving: Set<string>,
): { x: number; y: number; vx: number | null; hy: number | null } {
  const node = nodeById(graph, id);
  if (!node) return { x, y, vx: null, hy: null };
  const h = nodeHeight(node.kind);

  // Left / centre / right, and top / middle / bottom: aligning a node by its
  // centre is the common case, and edge-only snapping misses it entirely.
  const xs: [number, number][] = [
    [x, 0],
    [x + NODE_W / 2, NODE_W / 2],
    [x + NODE_W, NODE_W],
  ];
  const ys: [number, number][] = [
    [y, 0],
    [y + h / 2, h / 2],
    [y + h, h],
  ];

  let best: { d: number; at: number; off: number } | null = null;
  let bestY: { d: number; at: number; off: number } | null = null;

  for (const other of graph.nodes) {
    if (other.id === id || moving.has(other.id)) continue;
    const oh = nodeHeight(other.kind);
    for (const at of [other.x, other.x + NODE_W / 2, other.x + NODE_W]) {
      for (const [edge, off] of xs) {
        const d = Math.abs(edge - at);
        if (d <= SNAP && (!best || d < best.d)) best = { d, at, off };
      }
    }
    for (const at of [other.y, other.y + oh / 2, other.y + oh]) {
      for (const [edge, off] of ys) {
        const d = Math.abs(edge - at);
        if (d <= SNAP && (!bestY || d < bestY.d)) bestY = { d, at, off };
      }
    }
  }

  return {
    x: best ? best.at - best.off : x,
    y: bestY ? bestY.at - bestY.off : y,
    vx: best ? best.at : null,
    hy: bestY ? bestY.at : null,
  };
}

/**
 * Remove a node and everything below it. Deleting a subagent that owns three
 * skills should not leave those skills floating with no owner — they were
 * chosen *for* that specialist.
 */
export function removeNode(graph: AgentGraph, id: string): AgentGraph {
  const node = nodeById(graph, id);
  if (!node || node.kind === "orchestrator") return graph; // the root is not deletable

  const doomed = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const at = stack.pop() as string;
    if (doomed.has(at)) continue;
    doomed.add(at);
    for (const e of graph.edges) if (e.from === at) stack.push(e.to);
  }

  return {
    nodes: graph.nodes.filter((n) => !doomed.has(n.id)),
    edges: graph.edges.filter((e) => !doomed.has(e.from) && !doomed.has(e.to)),
  };
}

export function updateNode(graph: AgentGraph, id: string, patch: Partial<GraphNode>): AgentGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
  };
}

export function addNode(graph: AgentGraph, node: GraphNode, ownerId?: string): AgentGraph {
  const withNode: AgentGraph = { ...graph, nodes: [...graph.nodes, node] };
  return ownerId ? connect(withNode, ownerId, node.id) : withNode;
}

// ------------------------------------------------------------------- layout

/**
 * First free slot under `ownerId`, so a node added from a button lands
 * somewhere sensible instead of on top of an existing one.
 */
export function slotUnder(graph: AgentGraph, ownerId: string): { x: number; y: number } {
  const owner = nodeById(graph, ownerId);
  const base = owner ?? { x: 0, y: 0 };
  const siblings = graph.edges.filter((e) => e.from === ownerId).length;
  const col = siblings % 3;
  const row = Math.floor(siblings / 3);
  return {
    x: base.x + (col - 1) * (NODE_W + 4),
    y: base.y + AGENT_NODE_H + 6 + row * (COMPONENT_NODE_H + 4),
  };
}

/** Bounding box of every node, in grid units. Empty graphs get a unit box. */
export function graphBounds(graph: AgentGraph): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (graph.nodes.length === 0) return { minX: 0, minY: 0, maxX: NODE_W, maxY: AGENT_NODE_H };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of graph.nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_W);
    maxY = Math.max(maxY, n.y + nodeHeight(n.kind));
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Re-lay the whole graph as a tidy top-down tree. Dragging is the point of the
 * canvas, but a graph that arrived from a share link or an older save has no
 * positions worth keeping, and a jumble is worse than an opinion.
 */
export function autoLayout(graph: AgentGraph): AgentGraph {
  const root = orchestratorOf(graph);
  if (!root) return graph;

  const placed = new Map<string, { x: number; y: number }>();
  // Cursor per depth: each row fills left to right, so siblings never overlap
  // and a wide branch simply pushes the next one along.
  const cursor = new Map<number, number>();

  const walk = (id: string, depth: number) => {
    if (placed.has(id)) return;
    const x = cursor.get(depth) ?? 0;
    const rowStep = AGENT_NODE_H + 8;
    placed.set(id, { x, y: depth * rowStep });
    cursor.set(depth, x + NODE_W + 4);
    for (const e of graph.edges.filter((edge) => edge.from === id)) walk(e.to, depth + 1);
  };

  walk(root.id, 0);
  // Anything unreachable still needs a home — park it on a row of its own.
  let orphanX = 0;
  const orphanY = (Math.max(0, ...[...placed.values()].map((p) => p.y)) + AGENT_NODE_H + 12);
  for (const n of graph.nodes) {
    if (placed.has(n.id)) continue;
    placed.set(n.id, { x: orphanX, y: orphanY });
    orphanX += NODE_W + 4;
  }

  return {
    ...graph,
    nodes: graph.nodes.map((n) => ({ ...n, ...(placed.get(n.id) ?? { x: n.x, y: n.y }) })),
  };
}

// -------------------------------------------------------------- (de)serialize

/**
 * Build a graph for an agent that has none: the orchestrator plus one node per
 * existing pick, all wired to it. This is what every agent saved before the
 * canvas existed gets on first open, so nothing has to be migrated in the DB.
 */
export function graphFromAgent(agent: Agent): AgentGraph {
  const root: GraphNode = {
    id: "orchestrator",
    kind: "orchestrator",
    x: 0,
    y: 0,
    name: agent.name,
    role: agent.role,
    systemPrompt: agent.systemPrompt,
    model: agent.model,
    temperature: agent.temperature,
    mascot: agent.mascot,
  };
  // Node ids are generated, not taken from the pick — the same catalog entry
  // can sit under two specialists, so a pick's id cannot be a node's identity.
  const picks = agent.skills.map((s) => pickToNode(s, 0, 0));
  const graph: AgentGraph = {
    nodes: [root, ...picks],
    edges: picks.map((n) => ({ id: newEdgeId(), from: root.id, to: n.id })),
  };
  return autoLayout(graph);
}

/** A fresh specialist, inheriting the model of whoever will own it. */
export function newSubagent(parent: GraphNode | undefined, x: number, y: number): GraphNode {
  return {
    id: newNodeId(),
    kind: "subagent",
    x,
    y,
    name: "New specialist",
    role: "specialist",
    systemPrompt: "",
    model: parent?.model,
    temperature: parent?.temperature,
    mascot: "thinking",
  };
}

/**
 * Force the invariants the rest of the app relies on: exactly one
 * orchestrator, no dangling edges, no duplicate ids. Anything arriving from
 * storage, a share link or the API goes through here first.
 */
export function normalizeGraph(raw: unknown, fallback: Agent): AgentGraph {
  if (!raw || typeof raw !== "object") return graphFromAgent(fallback);
  const g = raw as Partial<AgentGraph>;
  if (!Array.isArray(g.nodes) || g.nodes.length === 0) return graphFromAgent(fallback);

  const seen = new Set<string>();
  const nodes: GraphNode[] = [];
  for (const n of g.nodes) {
    if (!n || typeof n !== "object") continue;
    const node = n as GraphNode;
    if (typeof node.id !== "string" || seen.has(node.id)) continue;
    if (!isAgentKind(node.kind) && !isComponentKind(node.kind)) continue;
    seen.add(node.id);
    nodes.push({
      ...node,
      x: Number.isFinite(node.x) ? node.x : 0,
      y: Number.isFinite(node.y) ? node.y : 0,
      name: typeof node.name === "string" ? node.name : "untitled",
    });
  }

  // Exactly one root. Extra orchestrators become subagents rather than being
  // dropped — losing a whole branch is worse than demoting it.
  let rootSeen = false;
  for (const n of nodes) {
    if (n.kind !== "orchestrator") continue;
    if (rootSeen) n.kind = "subagent";
    rootSeen = true;
  }
  if (!rootSeen) {
    nodes.unshift({
      id: "orchestrator",
      kind: "orchestrator",
      x: 0,
      y: 0,
      name: fallback.name,
      role: fallback.role,
      systemPrompt: fallback.systemPrompt,
      model: fallback.model,
      temperature: fallback.temperature,
      mascot: fallback.mascot,
    });
  }

  const ids = new Set(nodes.map((n) => n.id));
  const edgeSeen = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const e of Array.isArray(g.edges) ? g.edges : []) {
    if (!e || typeof e !== "object") continue;
    const edge = e as GraphEdge;
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) continue;
    const key = `${edge.from}->${edge.to}`;
    if (edgeSeen.has(key)) continue;
    edgeSeen.add(key);
    edges.push({ id: typeof edge.id === "string" ? edge.id : newEdgeId(), from: edge.from, to: edge.to });
  }

  return { nodes, edges };
}

// ------------------------------------------------------------- agent <-> graph

/** The agent an orchestrator node describes, merged back onto the record. */
export function agentFromGraph(agent: Agent, graph: AgentGraph): Agent {
  const root = orchestratorOf(graph);
  return {
    ...agent,
    name: root?.name ?? agent.name,
    role: root?.role ?? agent.role,
    systemPrompt: root?.systemPrompt ?? agent.systemPrompt,
    model: root?.model ?? agent.model,
    temperature: root?.temperature ?? agent.temperature,
    mascot: root?.mascot ?? agent.mascot,
    skills: graphPicks(graph),
    graph,
  };
}

/** Push edited agent fields back onto the orchestrator node. */
export function syncRootFromAgent(graph: AgentGraph, agent: Agent): AgentGraph {
  const root = orchestratorOf(graph);
  if (!root) return graph;
  return updateNode(graph, root.id, {
    name: agent.name,
    role: agent.role,
    systemPrompt: agent.systemPrompt,
    model: agent.model,
    temperature: agent.temperature,
    mascot: agent.mascot,
  });
}

// ------------------------------------------------------------------- reading

/** Depth-first walk from the orchestrator, for exports that need an order. */
export function walkAgents(graph: AgentGraph): { node: GraphNode; depth: number }[] {
  const root = orchestratorOf(graph);
  if (!root) return [];
  const out: { node: GraphNode; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (node: GraphNode, depth: number) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    out.push({ node, depth });
    for (const child of childAgentsOf(graph, node.id)) visit(child, depth + 1);
  };
  visit(root, 0);
  return out;
}

/** Problems worth surfacing in the canvas before someone exports a broken tree. */
export function graphIssues(graph: AgentGraph): string[] {
  const issues: string[] = [];
  const reachable = new Set(walkAgents(graph).map((w) => w.node.id));

  for (const n of graph.nodes) {
    if (isComponentKind(n.kind)) {
      const owner = graph.edges.find((e) => e.to === n.id);
      if (!owner) issues.push(`"${n.name}" is not wired to any agent — it will not be installed.`);
      else if (!reachable.has(owner.from)) {
        issues.push(`"${n.name}" hangs off an agent the orchestrator cannot reach.`);
      }
      continue;
    }
    if (n.kind === "subagent" && !reachable.has(n.id)) {
      issues.push(`Subagent "${n.name}" is not connected to the orchestrator.`);
    }
    if (n.kind === "subagent" && !n.systemPrompt?.trim()) {
      issues.push(`Subagent "${n.name}" has no system prompt.`);
    }
  }
  return issues;
}
