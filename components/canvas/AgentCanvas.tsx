"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import { cssTimeMs } from "@/lib/motion";
import { Mascot } from "@/components/Mascot";
import {
  CollapseIcon,
  ExpandIcon,
  LockIcon,
  LockOpenIcon,
  MinusIcon,
  PlusIcon,
} from "@/components/icons";
import { KIND_META } from "@/lib/aitmpl";
import {
  GRID,
  NODE_W,
  autoLayout,
  connect,
  disconnect,
  duplicateMany,
  graphBounds,
  isAgentKind,
  isComponentKind,
  mascotOf,
  moveNodes,
  nodeById,
  nodeHeight,
  nodeRef,
  nodesInRect,
  removeNode,
  snapTo,
  type AgentGraph,
  type GraphNode,
  type NodeKind,
} from "@/lib/graph";
import type { GraphHistory } from "@/lib/use-graph-history";

// The composer's canvas. Nodes are real DOM elements inside one transformed
// world, not shapes in a <canvas>: they have to be focusable, readable by a
// screen reader and movable from the keyboard, and a bitmap surface gives up
// all three. The SVG layer under them draws the wires and nothing else.
//
// Interaction follows the editor everyone already knows: left-drag on empty
// space is a marquee, space or middle-drag pans, ⌘Z undoes, ⌘D duplicates,
// nodes snap to their neighbours' edges and centres.

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;

interface Viewport {
  x: number;
  y: number;
  z: number;
}

interface Point {
  x: number;
  y: number;
}

/** A drag in flight. `null` when the pointer is not doing anything. */
type Drag =
  | { mode: "pan"; startX: number; startY: number; originX: number; originY: number }
  | { mode: "node"; id: string; grabX: number; grabY: number; origins: Map<string, Point> }
  | { mode: "link"; from: string; x: number; y: number }
  | { mode: "marquee"; from: Point; to: Point; base: string[] };

/** Right-click target: a node, a wire, or bare canvas. */
interface Menu {
  x: number;
  y: number;
  world: Point;
  nodeId: string | null;
  edgeId: string | null;
}

export interface AgentCanvasProps {
  graph: AgentGraph;
  /** `tag` merges consecutive edits of one kind into a single undo step. */
  onChange: (next: AgentGraph, tag?: string) => void;
  /** Every selected node. The first is what the inspector edits. */
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
  /** Create a specialist at a canvas point — the page owns what a new one is. */
  onAddSubagent?: (at: Point) => void;
  /**
   * Frozen layout: nodes cannot be moved, wired, added or deleted. Selecting,
   * panning, zooming and editing a node's fields all still work — this is the
   * "stop me nudging the tree while I read it" lock, not read-only mode.
   * Controlled by the page so its own toolbar buttons can grey out too.
   */
  locked?: boolean;
  onLockedChange?: (locked: boolean) => void;
  /**
   * Refit the view whenever this value changes, on top of the fit on mount.
   *
   * Off by default and deliberately so: in the composer the graph changes on
   * every keystroke, and a view that reframes itself each time would yank the
   * canvas out from under someone who has just panned somewhere on purpose.
   * The demo is the opposite case — nobody is panning, and the graph grows
   * between steps — so it passes the step number here.
   */
  refitOn?: string | number;
  history?: GraphHistory;
  /** Rendered into the canvas toolbar, right-aligned. */
  toolbar?: React.ReactNode;
  className?: string;
}

const KIND_LABEL: Record<NodeKind, string> = {
  orchestrator: "orchestrator",
  subagent: "subagent",
  skills: "skill",
  agents: "subagent pkg",
  commands: "command",
  mcps: "mcp",
  hooks: "hook",
  settings: "setting",
};

/** Ctrl on Windows and Linux, ⌘ on a Mac — one predicate for every shortcut. */
const mod = (e: React.KeyboardEvent) => e.metaKey || e.ctrlKey;

export function AgentCanvas({
  graph,
  onChange,
  selection,
  onSelectionChange,
  onAddSubagent,
  locked = false,
  onLockedChange,
  refitOn,
  history,
  toolbar,
  className,
}: AgentCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Fullscreen is the modal transition's lifecycle, not a boolean: the surface
  // has to exist for a frame at its pre-open scale before it can animate up to
  // 1, and it has to outlive the close by --modal-close-dur so it can animate
  // back down instead of vanishing.
  const [fs, setFs] = useState<"off" | "entering" | "on" | "closing">("off");
  const fullscreen = fs !== "off";
  const [view, setView] = useState<Viewport>({ x: 40, y: 40, z: 1 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "hand">("select");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [guides, setGuides] = useState<{ vx: number | null; hy: number | null }>({
    vx: null,
    hy: null,
  });
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // True only while a *programmatic* camera move is in flight — fit, reveal,
  // a minimap jump. Those move the view on the user's behalf and read as a cut
  // without a tween, whereas a drag or a wheel is the user moving the camera
  // themselves and must track the pointer exactly. One flag, so the two cases
  // can share `setView` and still feel completely different.
  const [easing, setEasing] = useState(false);
  const easeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read in pointer handlers that are bound once; keeping them off the
  // dependency list stops every mousemove from re-binding the listeners.
  const viewRef = useRef(view);
  viewRef.current = view;
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const spaceRef = useRef(false);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  // A node's focus and click handlers exist for the keyboard. The pointer has
  // already decided the selection by the time they fire — mousedown focuses the
  // button *between* our pointerdown and pointerup — so without this a
  // shift-click would toggle a node into the selection and then immediately
  // reset the selection to that one node.
  const pointerSelect = useRef(false);

  // Copy/paste is in-canvas, not the system clipboard: what is being copied is
  // a subtree of a graph this page owns, and serialising it out to text only to
  // parse it back adds a format nobody else reads.
  const clipboard = useRef<string[]>([]);

  const selected = useMemo(() => new Set(selection), [selection]);

  // ---- coordinate helpers -------------------------------------------------

  /** Client pixels -> world grid units. */
  const toWorld = useCallback((clientX: number, clientY: number): Point => {
    const host = hostRef.current;
    const v = viewRef.current;
    if (!host) return { x: 0, y: 0 };
    const box = host.getBoundingClientRect();
    return {
      x: (clientX - box.left - v.x) / (v.z * GRID),
      y: (clientY - box.top - v.y) / (v.z * GRID),
    };
  }, []);

  // ---- viewport -----------------------------------------------------------

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  /**
   * Move the camera with a tween. Everything that moves the view *for* the
   * user goes through here; everything the user moves themselves calls
   * `setView` directly and stays frame-exact.
   */
  const easeViewTo = useCallback((next: Viewport | ((v: Viewport) => Viewport)) => {
    if (easeTimer.current) clearTimeout(easeTimer.current);
    setEasing(true);
    setView(next);
    const ms = cssTimeMs(
      getComputedStyle(document.documentElement).getPropertyValue("--canvas-pan-dur"),
      320,
    );
    // Dropped again afterwards so the next drag is not tweened. Without this
    // the flag would latch on after the first fit and every pan would lag the
    // pointer by a third of a second.
    easeTimer.current = setTimeout(() => setEasing(false), ms);
  }, []);

  useEffect(() => () => void (easeTimer.current && clearTimeout(easeTimer.current)), []);

  /** A user-driven view change. Cancels any tween still running. */
  const setViewNow = useCallback((next: Viewport | ((v: Viewport) => Viewport)) => {
    if (easeTimer.current) {
      clearTimeout(easeTimer.current);
      easeTimer.current = null;
    }
    setEasing(false);
    setView(next);
  }, []);

  const zoomAt = useCallback((factor: number, clientX?: number, clientY?: number) => {
    setEasing(false);
    setView((v) => {
      const host = hostRef.current;
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z * factor));
      if (!host || z === v.z) return { ...v, z };
      const box = host.getBoundingClientRect();
      // Anchor the zoom on the cursor (or the centre when there isn't one) so
      // the thing under the pointer stays under the pointer.
      const px = (clientX ?? box.left + box.width / 2) - box.left;
      const py = (clientY ?? box.top + box.height / 2) - box.top;
      const ratio = z / v.z;
      return { x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio, z };
    });
  }, []);

  const fit = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    // Layout box, not the painted one: entering fullscreen refits while the
    // shell is still scaling up from --modal-scale, and a measured rect would
    // frame the graph against a box 4% smaller than the one it lands in.
    const box = { width: host.clientWidth, height: host.clientHeight };
    const b = graphBounds(graphRef.current);
    const w = (b.maxX - b.minX) * GRID;
    const h = (b.maxY - b.minY) * GRID;
    const pad = 48;
    // Never magnifies past 1:1. Fitting a two-node graph to the viewport would
    // otherwise land on ~190% and render the pixel type at a size it was never
    // drawn for — fit means "get everything on screen", not "fill the screen".
    const z = Math.min(
      1,
      Math.max(MIN_ZOOM, Math.min((box.width - pad * 2) / w, (box.height - pad * 2) / h)),
    );
    easeViewTo({
      x: (box.width - w * z) / 2 - b.minX * GRID * z,
      y: (box.height - h * z) / 2 - b.minY * GRID * z,
      z,
    });
  }, [easeViewTo]);

  /** Pan just enough to bring a node on screen. No zoom change, ever. */
  const reveal = useCallback((id: string) => {
    const host = hostRef.current;
    const node = nodeById(graphRef.current, id);
    if (!host || !node) return;
    // Same reason as `fit`: the transform must not change what "on screen" means.
    const box = { width: host.clientWidth, height: host.clientHeight };
    const v = viewRef.current;
    const pad = 24;
    const left = node.x * GRID * v.z + v.x;
    const top = node.y * GRID * v.z + v.y;
    const right = left + NODE_W * GRID * v.z;
    const bottom = top + nodeHeight(node.kind) * GRID * v.z;

    let dx = 0;
    let dy = 0;
    if (left < pad) dx = pad - left;
    else if (right > box.width - pad) dx = box.width - pad - right;
    if (top < pad) dy = pad - top;
    else if (bottom > box.height - pad) dy = box.height - pad - bottom;
    if (dx === 0 && dy === 0) return; // already visible — do not nudge
    easeViewTo((cur) => ({ ...cur, x: cur.x + dx, y: cur.y + dy }));
  }, [easeViewTo]);

  // Selecting a node the viewport has scrolled away from — clicking a row in
  // the inspector, or adding a subagent that lands below the fold — should
  // bring it into view rather than silently changing what the panels edit.
  const primary = selection[0] ?? null;
  useEffect(() => {
    if (primary) reveal(primary);
  }, [primary, reveal]);

  // Frame the graph once, on mount. Re-fitting on every change would yank the
  // view out from under someone who has just panned somewhere deliberately.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || graph.nodes.length === 0) return;
    fitted.current = true;
    fit();
  }, [fit, graph.nodes.length]);

  // …and again on every `refitOn` change, for owners that have asked for it.
  // Separate effect rather than a condition inside the one above: that one is
  // a latch that must fire exactly once, and folding a repeating trigger into
  // it would mean the latch decides both.
  useEffect(() => {
    if (refitOn === undefined || graph.nodes.length === 0) return;
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refitOn]);

  // Non-passive so ctrl+wheel can preventDefault and zoom instead of letting
  // the browser page-zoom the whole app out from under the canvas.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.deltaY < 0 ? 1.08 : 1 / 1.08, e.clientX, e.clientY);
        return;
      }
      setViewNow((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, [zoomAt, setViewNow]);

  // ---- edit helpers -------------------------------------------------------

  /** Put a set of nodes at absolute positions. Drags recompute from origins
   *  rather than accumulating deltas, so a slow drag cannot drift. */
  const place = (g: AgentGraph, pos: Map<string, Point>): AgentGraph => ({
    ...g,
    nodes: g.nodes.map((n) => {
      const at = pos.get(n.id);
      return at ? { ...n, x: at.x, y: at.y } : n;
    }),
  });

  const deleteSelection = useCallback(() => {
    if (lockedRef.current) return;
    if (edgeId) {
      onChange(disconnect(graphRef.current, edgeId), undefined);
      setEdgeId(null);
      return;
    }
    let next = graphRef.current;
    for (const id of selectionRef.current) next = removeNode(next, id);
    if (next === graphRef.current) return;
    onChange(next);
    onSelectionChange([]);
  }, [edgeId, onChange, onSelectionChange]);

  const duplicateIds = useCallback(
    (ids: string[]) => {
      if (lockedRef.current) return;
      const result = duplicateMany(graphRef.current, ids);
      if (result.graph === graphRef.current) return;
      onChange(result.graph);
      onSelectionChange(result.ids);
    },
    [onChange, onSelectionChange],
  );

  // ---- pointer ------------------------------------------------------------

  const panning = drag?.mode === "pan";
  const handMode = tool === "hand" || spaceHeld;

  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    setMenu(null);
    if (e.button === 2) return; // the context menu handler owns right-click
    const v = viewRef.current;

    if (e.button === 1 || handMode) {
      setDrag({ mode: "pan", startX: e.clientX, startY: e.clientY, originX: v.x, originY: v.y });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    setEdgeId(null);
    const at = toWorld(e.clientX, e.clientY);
    const additive = e.shiftKey;
    if (!additive) onSelectionChange([]);
    setDrag({ mode: "marquee", from: at, to: at, base: additive ? selectionRef.current : [] });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onNodePointerDown = (e: React.PointerEvent, node: GraphNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setMenu(null);
    setEdgeId(null);
    pointerSelect.current = true;

    if (handMode) {
      const v = viewRef.current;
      setDrag({ mode: "pan", startX: e.clientX, startY: e.clientY, originX: v.x, originY: v.y });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Shift toggles membership and starts no drag: adding a fifth node to a
    // selection should not also nudge the other four.
    if (e.shiftKey) {
      const cur = selectionRef.current;
      onSelectionChange(cur.includes(node.id) ? cur.filter((id) => id !== node.id) : [...cur, node.id]);
      return;
    }

    // Dragging a node that is already part of a selection moves the whole
    // selection; dragging anything else selects it first.
    const ids = selectionRef.current.includes(node.id) ? selectionRef.current : [node.id];
    if (ids !== selectionRef.current) onSelectionChange(ids);

    // Locked: the click still selects, it just does not start a move.
    if (locked) return;

    const w = toWorld(e.clientX, e.clientY);
    const origins = new Map<string, Point>();
    for (const id of ids) {
      const n = nodeById(graphRef.current, id);
      if (n) origins.set(id, { x: n.x, y: n.y });
    }
    setDrag({ mode: "node", id: node.id, grabX: w.x - node.x, grabY: w.y - node.y, origins });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPortPointerDown = (e: React.PointerEvent, node: GraphNode) => {
    e.stopPropagation();
    e.preventDefault();
    if (locked) return;
    const w = toWorld(e.clientX, e.clientY);
    setDrag({ mode: "link", from: node.id, x: w.x, y: w.y });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;

    if (drag.mode === "pan") {
      // Never eased: the surface has to stay glued to the pointer.
      setViewNow((v) => ({
        ...v,
        x: drag.originX + (e.clientX - drag.startX),
        y: drag.originY + (e.clientY - drag.startY),
      }));
      return;
    }

    const w = toWorld(e.clientX, e.clientY);

    if (drag.mode === "link") {
      setDrag({ ...drag, x: w.x, y: w.y });
      return;
    }

    if (drag.mode === "marquee") {
      setDrag({ ...drag, to: w });
      const hit = nodesInRect(graphRef.current, drag.from, w);
      const merged = drag.base.length ? Array.from(new Set([...drag.base, ...hit])) : hit;
      onSelectionChange(merged);
      return;
    }

    // Snap to whole grid units: the design is pixel art, and a node parked on
    // a fractional unit puts its border between device pixels.
    let x = Math.round(w.x - drag.grabX);
    let y = Math.round(w.y - drag.grabY);

    // Alignment guides only while a single node moves. Snapping a whole
    // selection to one member's neighbours moves the others somewhere nobody
    // asked for, which reads as the canvas fighting the drag.
    if (drag.origins.size === 1 && !e.altKey) {
      const snapped = snapTo(graphRef.current, drag.id, x, y, new Set(drag.origins.keys()));
      x = Math.round(snapped.x);
      y = Math.round(snapped.y);
      setGuides({ vx: snapped.vx, hy: snapped.hy });
    }

    const origin = drag.origins.get(drag.id);
    if (!origin) return;
    const dx = x - origin.x;
    const dy = y - origin.y;
    const pos = new Map<string, Point>();
    for (const [id, at] of drag.origins) pos.set(id, { x: at.x + dx, y: at.y + dy });
    // Tagged per node: two quick drags of two different nodes are two things
    // that happened, and ⌘Z should take back one of them, not both.
    onChange(place(graphRef.current, pos), `drag:${drag.id}`);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (drag?.mode === "link") {
      // Which node the pointer is actually over, read off the DOM rather than
      // tracked during the drag — elementFromPoint is the only thing that
      // knows about z-order and overlap.
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const target = el?.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
      if (target) onChange(connect(graphRef.current, drag.from, target));
    }
    setDrag(null);
    setGuides({ vx: null, hy: null });
    pointerSelect.current = false;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (!onAddSubagent || locked) return;
    const el = e.target as HTMLElement;
    if (el.closest("[data-node-id]")) return; // double-click on a node is a rename gesture elsewhere
    onAddSubagent(toWorld(e.clientX, e.clientY));
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const host = hostRef.current;
    if (!host) return;
    const box = host.getBoundingClientRect();
    const el = e.target as HTMLElement;
    const nodeId = el.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId ?? null;
    const overEdge = el.closest<SVGElement>("[data-edge-id]")?.dataset.edgeId ?? null;
    // Right-clicking a node that is not in the selection acts on that node —
    // the menu must never operate on something the user cannot see is targeted.
    if (nodeId && !selectionRef.current.includes(nodeId)) onSelectionChange([nodeId]);
    if (overEdge) setEdgeId(overEdge);
    setMenu({
      x: e.clientX - box.left,
      y: e.clientY - box.top,
      world: toWorld(e.clientX, e.clientY),
      nodeId,
      edgeId: overEdge,
    });
  };

  // ---- keyboard -----------------------------------------------------------

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " && !spaceRef.current) {
      spaceRef.current = true;
      setSpaceHeld(true);
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      // Clear what is highlighted first; only a second press leaves fullscreen,
      // so escaping a menu never also throws away the enlarged view.
      const hadFocus = menu || edgeId || selection.length > 0;
      onSelectionChange([]);
      setEdgeId(null);
      setMenu(null);
      if (!hadFocus) exitFullscreen();
      return;
    }

    if (mod(e) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) history?.redo();
      else history?.undo();
      return;
    }
    if (mod(e) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      history?.redo();
      return;
    }
    if (mod(e) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      onSelectionChange(graph.nodes.map((n) => n.id));
      return;
    }
    if (mod(e) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicateIds(selection);
      return;
    }
    if (mod(e) && e.key.toLowerCase() === "c") {
      clipboard.current = selection;
      return;
    }
    if (mod(e) && e.key.toLowerCase() === "v") {
      e.preventDefault();
      duplicateIds(clipboard.current);
      return;
    }
    if (e.key === "0" && mod(e)) {
      e.preventDefault();
      fit();
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteSelection();
      return;
    }

    if (selection.length === 0 || locked) return;
    // Nudge. Shift moves by a node-ish step so it is usable for real layout,
    // not just for pixel-hunting.
    const step = e.shiftKey ? 4 : 1;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = delta[e.key];
    if (!move) return;
    e.preventDefault();
    onChange(moveNodes(graph, selected, move[0], move[1]), "nudge");
  };

  const onKeyUp = (e: React.KeyboardEvent) => {
    if (e.key !== " ") return;
    spaceRef.current = false;
    setSpaceHeld(false);
  };

  // Fullscreen is a fixed overlay rather than the Fullscreen API: the API is
  // unavailable on iOS Safari and takes the browser chrome with it, and what
  // this needs is only "give the graph the whole window".
  //
  // Enter/exit runs the modal open/close transition — same three classes and
  // the same close-then-cleanup timing every other overlay in this app uses.
  const enterFullscreen = useCallback(() => {
    setFs("entering");
    // Two frames, not one. The pre-open scale has to be *painted* before the
    // open state lands, and a single rAF callback runs before the paint of the
    // frame React committed it in — both states collapse into one style pass
    // and the open cuts instead of animating.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setFs((cur) => (cur === "entering" ? "on" : cur))),
    );
  }, []);

  const exitFullscreen = useCallback(() => {
    setFs((cur) => (cur === "off" ? cur : "closing"));
    // Read from the token rather than hardcoding, so retuning the close in CSS
    // cannot leave the DOM cleanup running to the old duration.
    // Reduced motion zeroes the transition in CSS, so waiting for it would
    // hold an already-invisible overlay over an empty spacer — a flash of gap
    // where the canvas should be.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const closeMs = reduced
      ? 0
      : cssTimeMs(
          getComputedStyle(document.documentElement).getPropertyValue("--modal-close-dur"),
          150,
        );
    window.setTimeout(() => setFs("off"), closeMs);
  }, []);

  const fsSettled = useRef(false);
  useEffect(() => {
    // The surface just changed size by a lot in either direction, so the old
    // zoom no longer frames anything sensible. Skip the mount pass — `fit` has
    // its own first-frame effect and running both fights over the viewport.
    if (!fsSettled.current) {
      fsSettled.current = true;
      return;
    }
    const frame = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(frame);
  }, [fullscreen, fit]);

  useEffect(() => {
    if (!fullscreen) return;
    // The page behind is fully covered; letting it scroll under the overlay
    // means leaving fullscreen drops you somewhere you never navigated to.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    hostRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  // A window blur while space is down would otherwise leave the canvas stuck
  // in hand mode with no key event coming to release it.
  useEffect(() => {
    const release = () => {
      spaceRef.current = false;
      setSpaceHeld(false);
    };
    window.addEventListener("blur", release);
    return () => window.removeEventListener("blur", release);
  }, []);

  // ---- wires --------------------------------------------------------------

  const wires = useMemo(() => {
    const out: { id: string; d: string; from: GraphNode; to: GraphNode }[] = [];
    for (const e of graph.edges) {
      const from = nodeById(graph, e.from);
      const to = nodeById(graph, e.to);
      if (!from || !to) continue;
      out.push({ id: e.id, d: wirePath(from, to), from, to });
    }
    return out;
  }, [graph]);

  const linkPreview =
    drag?.mode === "link"
      ? (() => {
          const from = nodeById(graph, drag.from);
          if (!from) return null;
          const x1 = (from.x + NODE_W / 2) * GRID;
          const y1 = (from.y + nodeHeight(from.kind)) * GRID;
          return `M ${x1} ${y1} L ${x1} ${(drag.y * GRID + y1) / 2} L ${drag.x * GRID} ${(drag.y * GRID + y1) / 2} L ${drag.x * GRID} ${drag.y * GRID}`;
        })()
      : null;

  const marquee =
    drag?.mode === "marquee"
      ? {
          left: Math.min(drag.from.x, drag.to.x) * GRID,
          top: Math.min(drag.from.y, drag.to.y) * GRID,
          width: Math.abs(drag.to.x - drag.from.x) * GRID,
          height: Math.abs(drag.to.y - drag.from.y) * GRID,
        }
      : null;

  const canDelete =
    !locked && (selection.some((id) => nodeById(graph, id)?.kind !== "orchestrator") || !!edgeId);

  return (
    <>
      {/* The overlay is `position: fixed`, so it leaves the flow and the page
          below closes the gap. That reflow is invisible while the canvas
          covers the screen and very visible as it fades back out, so a spacer
          of the same class holds the slot until the close finishes. */}
      {fullscreen && <div className={className} aria-hidden="true" />}
      <div
        className={clsx(
          "t-canvas-shell border-2 border-line bg-paper",
          fullscreen && "is-fullscreen t-modal",
          fs === "on" && "is-open",
          fs === "closing" && "is-closing",
          className,
        )}
      >
        {/* TOOLBAR */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b-2 border-line bg-stone overflow-x-auto">
          <CanvasButton
            onClick={() => setTool("select")}
            label="Select tool (V) — drag to marquee"
            active={tool === "select"}
          >
            select
          </CanvasButton>
          <CanvasButton
            onClick={() => setTool("hand")}
            label="Hand tool (hold space) — drag to pan"
            active={tool === "hand"}
          >
            hand
          </CanvasButton>
          <Divider />
          <CanvasButton onClick={() => zoomAt(1 / 1.2)} label="Zoom out">
            <MinusIcon size={10} />
          </CanvasButton>
          <span className="font-mono text-[10px] text-muted w-10 text-center tabular-nums">
            {Math.round(view.z * 100)}%
          </span>
          <CanvasButton onClick={() => zoomAt(1.2)} label="Zoom in">
            <PlusIcon size={10} />
          </CanvasButton>
          <CanvasButton onClick={fit} label="Fit graph to view (⌘0)">
            fit
          </CanvasButton>
          <CanvasButton
            onClick={() => onChange(autoLayout(graph))}
            label="Tidy the graph into a tree"
            disabled={locked}
          >
            tidy
          </CanvasButton>
          {history && (
            <>
              <Divider />
              <CanvasButton onClick={history.undo} label="Undo (⌘Z)" disabled={!history.canUndo}>
                undo
              </CanvasButton>
              <CanvasButton onClick={history.redo} label="Redo (⇧⌘Z)" disabled={!history.canRedo}>
                redo
              </CanvasButton>
            </>
          )}
          <Divider />
          {/* One button, two states. The icon shows what the next press does, so
              the lock reads at a glance without a label taking toolbar width.
              Disabled when the owner passes no handler — the demo mounts this
              canvas permanently locked, and a button offering to unlock it that
              then does nothing is worse than one that says it cannot. */}
          <CanvasButton
            onClick={() => onLockedChange?.(!locked)}
            disabled={!onLockedChange}
            label={
              !onLockedChange
                ? "This canvas is read-only"
                : locked
                  ? "Unlock the canvas"
                  : "Lock the canvas — nodes stay where they are"
            }
            active={locked}
          >
            {/* Denser shapes than the +/− glyphs beside them, so they get a
                couple of pixels more to stay legible at toolbar size. */}
            <span className="t-icon-swap" data-state={locked ? "b" : "a"}>
              <span className="t-icon" data-icon="a">
                <LockOpenIcon size={12} />
              </span>
              <span className="t-icon" data-icon="b">
                <LockIcon size={12} />
              </span>
            </span>
          </CanvasButton>
          <CanvasButton
            onClick={fullscreen ? exitFullscreen : enterFullscreen}
            label={fullscreen ? "Leave fullscreen (Esc)" : "Fullscreen"}
            active={fullscreen}
          >
            <span className="t-icon-swap" data-state={fullscreen ? "b" : "a"}>
              <span className="t-icon" data-icon="a">
                <ExpandIcon size={12} />
              </span>
              <span className="t-icon" data-icon="b">
                <CollapseIcon size={12} />
              </span>
            </span>
          </CanvasButton>
          <div className="ml-auto flex items-center gap-1.5">{toolbar}</div>
        </div>

        {/* SURFACE */}
        <div
          ref={hostRef}
          role="application"
          aria-label="Agent graph canvas"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onPointerDown={onBackgroundPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
          className={clsx(
            "t-canvas relative overflow-hidden outline-none",
            handMode && "is-hand",
            panning && "is-panning",
            locked && "is-locked",
            // The grid has to travel with the world, or a tweened camera slides
            // the nodes while the dots underneath them jump.
            easing && "is-easing",
          )}
          style={{
            // The dot grid lives on the surface, not the world, so it can scroll
            // with the pan without being scaled into mush by the zoom.
            backgroundSize: `${GRID * 2 * view.z}px ${GRID * 2 * view.z}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
        >
          <div
            className={clsx("t-canvas-world absolute top-0 left-0 origin-top-left", easing && "is-easing")}
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}
          >
            {/* WIRES — behind the nodes. The visible stroke never takes the
                pointer; a fat invisible twin next to it is what gets clicked, so
                a 2px line is still a real target. */}
            <svg
              className="absolute top-0 left-0 overflow-visible pointer-events-none"
              width="1"
              height="1"
              aria-hidden="true"
            >
              {wires.map((w) => (
                <g key={w.id}>
                  <path
                    d={w.d}
                    data-edge-id={w.id}
                    className="t-wire-hit"
                    style={{ pointerEvents: "stroke" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setEdgeId(w.id);
                      onSelectionChange([]);
                    }}
                  />
                  <path
                    d={w.d}
                    className={clsx(
                      "t-wire",
                      edgeId === w.id && "is-selected",
                      edgeId !== w.id &&
                        (selected.has(w.from.id) || selected.has(w.to.id)) &&
                        "is-active",
                    )}
                  />
                </g>
              ))}
              {linkPreview && <path d={linkPreview} className="t-wire is-preview" />}

              {/* Alignment guides — drawn in the world so they line up with the
                  node edges they describe, at any zoom. */}
              {guides.vx !== null && (
                <line
                  className="t-guide"
                  x1={guides.vx * GRID}
                  y1={(graphBounds(graph).minY - 4) * GRID}
                  x2={guides.vx * GRID}
                  y2={(graphBounds(graph).maxY + 4) * GRID}
                />
              )}
              {guides.hy !== null && (
                <line
                  className="t-guide"
                  x1={(graphBounds(graph).minX - 4) * GRID}
                  y1={guides.hy * GRID}
                  x2={(graphBounds(graph).maxX + 4) * GRID}
                  y2={guides.hy * GRID}
                />
              )}
            </svg>

            {graph.nodes.map((n) => (
              <CanvasNode
                key={n.id}
                node={n}
                selected={selected.has(n.id)}
                hovered={hoverId === n.id}
                linking={drag?.mode === "link"}
                dragging={drag?.mode === "node" && selected.has(n.id)}
                onPointerDown={(e) => onNodePointerDown(e, n)}
                onPortPointerDown={(e) => onPortPointerDown(e, n)}
                onEnter={() => setHoverId(n.id)}
                onLeave={() => setHoverId((id) => (id === n.id ? null : id))}
                onSelect={() => {
                  if (pointerSelect.current) return;
                  onSelectionChange([n.id]);
                }}
              />
            ))}

            {marquee && (
              <div
                className="t-marquee absolute pointer-events-none"
                style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }}
              />
            )}
          </div>

          {/* Legend, pinned to the surface so it never pans away.
              Backed like the minimap rather than floating bare: the world pans
              underneath it, so sooner or later a node slides behind the text,
              and 9px muted type over a node title is unreadable.
              The width is the row minus the minimap: both are pinned to the
              same bottom row, and at 375px a percentage cap put the legend's
              last character exactly on the map's left edge. 140px is the map
              (116) plus its right offset, this one's left offset and a gap. */}
          <div className="t-canvas-legend absolute bottom-2 left-2 max-w-[min(calc(100%-140px),22rem)] px-1.5 py-1 font-mono text-[9px] text-muted pointer-events-none select-none leading-relaxed">
            {locked && !onLockedChange ? (
              // Read-only for good: no toolbar button to point them at.
              <>
                read-only — select, pan and zoom still work
                <br />
                nothing here can be moved, wired or deleted
              </>
            ) : locked ? (
              <>
                canvas locked — nodes stay put. select, pan and zoom still work
                <br />
                unlock from the toolbar to move or wire anything
              </>
            ) : (
              <>
                drag to select · space or middle-drag to pan · ⌘scroll to zoom
                <br />
                drag the ▾ port to wire · ⌘D duplicate · ⌘Z undo · double-click for a subagent
              </>
            )}
          </div>

          {/* Eased, not instant: clicking the map is asking the canvas to take
              you somewhere, and a cut loses which direction you travelled. */}
          <Minimap graph={graph} view={view} size={size} selected={selected} onJump={easeViewTo} />

          {menu && (
            <ContextMenu
              menu={menu}
              graph={graph}
              size={size}
              selection={selection}
              canDelete={canDelete}
              locked={locked}
              onClose={() => setMenu(null)}
              onDuplicate={() => duplicateIds(selection)}
              onDelete={deleteSelection}
              onDisconnect={() => {
                if (!menu.edgeId) return;
                onChange(disconnect(graph, menu.edgeId));
                setEdgeId(null);
              }}
              onAddSubagent={onAddSubagent ? () => onAddSubagent(menu.world) : undefined}
              onSelectAll={() => onSelectionChange(graph.nodes.map((n) => n.id))}
              onTidy={() => onChange(autoLayout(graph))}
              onFit={fit}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- node

interface CanvasNodeProps {
  node: GraphNode;
  selected: boolean;
  hovered: boolean;
  linking: boolean;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPortPointerDown: (e: React.PointerEvent) => void;
  onEnter: () => void;
  onLeave: () => void;
  onSelect: () => void;
}

function CanvasNode({
  node,
  selected,
  hovered,
  linking,
  dragging,
  onPointerDown,
  onPortPointerDown,
  onEnter,
  onLeave,
  onSelect,
}: CanvasNodeProps) {
  const agentish = isAgentKind(node.kind);
  const meta = isComponentKind(node.kind) ? KIND_META.find((k) => k.id === node.kind) : undefined;

  return (
    <div
      data-node-id={node.id}
      className={clsx(
        "t-node absolute border-2 bg-paper select-none",
        agentish ? "pixel-border-sm" : "",
        node.kind === "orchestrator" && "t-node--root",
        selected ? "border-coral is-selected" : "border-line",
        dragging && "is-dragging",
        linking && hovered && "is-droppable",
      )}
      style={{
        left: node.x * GRID,
        top: node.y * GRID,
        width: NODE_W * GRID,
        height: nodeHeight(node.kind) * GRID,
      }}
      onPointerDown={onPointerDown}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      {/* The focusable surface. A button rather than the box itself so the
          whole node is reachable by Tab and activatable by Enter, while the
          pointer drag stays on the wrapper. */}
      <button
        type="button"
        onClick={onSelect}
        onFocus={onSelect}
        aria-pressed={selected}
        className="absolute inset-0 w-full h-full text-left px-2 py-1.5 cursor-grab active:cursor-grabbing"
      >
        <span className="sr-only">
          {KIND_LABEL[node.kind]}: {node.name}
        </span>
        <span aria-hidden="true" className="flex items-start gap-1.5 h-full">
          {agentish && (
            <span className="shrink-0 mt-0.5">
              {/* Every agent node wears its own mascot — the specialists too.
                  They briefly wore a generated dither glyph instead, because
                  they were all born "thinking" and six specialists were six
                  identical sprites; that is fixed at the source now (see
                  SUBAGENT_MASCOTS), so the canvas shows the same character the
                  card, the picker and the demo show for that agent.
                  Not animated: a dozen idle loops running out of phase behind
                  a drag is motion nobody asked for. The inspector's preview is
                  where a mascot animates. */}
              <Mascot state={mascotOf(node)} size={28} animate={false} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-pixel text-[8px] uppercase text-muted truncate">
              {KIND_LABEL[node.kind]}
            </span>
            <span className="block font-mono text-[11px] font-bold truncate leading-tight">
              {node.name}
            </span>
            <span className="block font-mono text-[9px] text-muted truncate">
              {agentish ? (node.role ?? "") : nodeRef(node)}
            </span>
            {agentish && node.model && (
              <span className="block font-mono text-[9px] text-muted truncate">{node.model}</span>
            )}
          </span>
          {meta && (
            <span className="shrink-0 font-pixel text-[7px] uppercase px-1 py-0.5 border-2 border-line bg-stone">
              {meta.label}
            </span>
          )}
        </span>
      </button>

      {/* Wire port. Only agent nodes can own things, so only they get one. */}
      {agentish && (
        <button
          type="button"
          aria-label={`Wire from ${node.name}`}
          onPointerDown={onPortPointerDown}
          className="t-port absolute left-1/2 -bottom-[7px] -translate-x-1/2 w-3 h-3 border-2 border-line bg-paper cursor-crosshair"
        >
          <span className="sr-only">drag to connect</span>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- minimap

const MAP_W = 116;
const MAP_H = 76;

/**
 * The whole graph at a glance, plus where the viewport is inside it. On a tree
 * that has grown past one screen this is the only way to know a branch exists
 * without panning around looking for it.
 */
function Minimap({
  graph,
  view,
  size,
  selected,
  onJump,
}: {
  graph: AgentGraph;
  view: Viewport;
  size: { w: number; h: number };
  selected: Set<string>;
  onJump: (v: Viewport) => void;
}) {
  const g = useMemo(() => graphBounds(graph), [graph]);
  if (graph.nodes.length === 0 || size.w === 0) return null;

  // The viewport, in world units, is what the surface currently shows.
  const vx = -view.x / (view.z * GRID);
  const vy = -view.y / (view.z * GRID);
  const vw = size.w / (view.z * GRID);
  const vh = size.h / (view.z * GRID);

  // The map frames the graph *and* the viewport. Framing the graph alone makes
  // a one-node agent fill the box edge to edge, which says nothing: the point
  // of the map is where things sit relative to what is on screen.
  const b = {
    minX: Math.min(g.minX, vx),
    minY: Math.min(g.minY, vy),
    maxX: Math.max(g.maxX, vx + vw),
    maxY: Math.max(g.maxY, vy + vh),
  };

  const pad = 4;
  const w = Math.max(1, b.maxX - b.minX);
  const h = Math.max(1, b.maxY - b.minY);
  const scale = Math.min((MAP_W - pad * 2) / w, (MAP_H - pad * 2) / h);
  const toMap = (x: number, y: number) => ({
    x: pad + (x - b.minX) * scale,
    y: pad + (y - b.minY) * scale,
  });

  const vTopLeft = toMap(vx, vy);

  /** Click anywhere on the map to centre the real viewport there. */
  const jump = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const worldX = (e.clientX - box.left - pad) / scale + b.minX;
    const worldY = (e.clientY - box.top - pad) / scale + b.minY;
    onJump({
      ...view,
      x: size.w / 2 - worldX * GRID * view.z,
      y: size.h / 2 - worldY * GRID * view.z,
    });
  };

  return (
    <svg
      className="t-minimap absolute bottom-2 right-2"
      width={MAP_W}
      height={MAP_H}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={jump}
      role="img"
      aria-label={`Graph overview: ${graph.nodes.length} nodes`}
    >
      {graph.nodes.map((n) => {
        const at = toMap(n.x, n.y);
        return (
          <rect
            key={n.id}
            x={at.x}
            y={at.y}
            width={Math.max(2, NODE_W * scale)}
            height={Math.max(2, nodeHeight(n.kind) * scale)}
            className={clsx(
              "t-minimap-node",
              n.kind === "orchestrator" && "is-root",
              selected.has(n.id) && "is-selected",
            )}
          />
        );
      })}
      <rect
        x={vTopLeft.x}
        y={vTopLeft.y}
        width={vw * scale}
        height={vh * scale}
        className="t-minimap-view"
      />
    </svg>
  );
}

// ---------------------------------------------------------------- menu

// Roughly what the menu measures. Used only to keep it inside the surface —
// close enough beats a layout pass that would flash the menu in the wrong place
// before moving it.
const MENU_W = 168;
const MENU_H = 190;

function ContextMenu({
  menu,
  graph,
  size,
  selection,
  canDelete,
  locked,
  onClose,
  onDuplicate,
  onDelete,
  onDisconnect,
  onAddSubagent,
  onSelectAll,
  onTidy,
  onFit,
}: {
  menu: Menu;
  graph: AgentGraph;
  size: { w: number; h: number };
  selection: string[];
  canDelete: boolean;
  locked: boolean;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDisconnect: () => void;
  onAddSubagent?: () => void;
  onSelectAll: () => void;
  onTidy: () => void;
  onFit: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Focus the menu so Escape and Tab behave, and so a click anywhere else
  // closes it through the blur rather than a document-wide listener.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const target = nodeById(graph, menu.nodeId);
  const dupable = !locked && selection.some((id) => nodeById(graph, id)?.kind !== "orchestrator");

  const run = (fn?: () => void) => () => {
    fn?.();
    onClose();
  };

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="menu"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="t-menu absolute z-10 min-w-[164px] border-2 border-line bg-paper py-1 outline-none"
      style={{
        left: Math.max(0, Math.min(menu.x, size.w - MENU_W)),
        top: Math.max(0, Math.min(menu.y, size.h - MENU_H)),
      }}
    >
      {menu.edgeId && (
        <MenuItem onClick={run(onDisconnect)} disabled={locked}>
          disconnect wire
        </MenuItem>
      )}
      {target && (
        <>
          <MenuItem onClick={run(onDuplicate)} disabled={!dupable} hint="⌘D">
            duplicate
          </MenuItem>
          <MenuItem onClick={run(onDelete)} disabled={!canDelete} hint="⌫">
            delete
          </MenuItem>
          <Rule />
        </>
      )}
      {onAddSubagent && (
        <MenuItem onClick={run(onAddSubagent)} disabled={locked}>
          add subagent here
        </MenuItem>
      )}
      <MenuItem onClick={run(onSelectAll)} hint="⌘A">
        select all
      </MenuItem>
      <Rule />
      <MenuItem onClick={run(onTidy)} disabled={locked}>
        tidy
      </MenuItem>
      <MenuItem onClick={run(onFit)} hint="⌘0">
        fit to view
      </MenuItem>
    </div>
  );
}

function MenuItem({
  onClick,
  disabled,
  hint,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 px-2.5 py-1 font-mono text-[10px] text-left hover:bg-stone disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
    >
      {children}
      {hint && <span className="text-muted">{hint}</span>}
    </button>
  );
}

function Rule() {
  return <div className="my-1 border-t-2 border-line" aria-hidden="true" />;
}

function Divider() {
  return <span className="w-px self-stretch bg-line" aria-hidden="true" />;
}

function CanvasButton({
  onClick,
  label,
  active,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center font-mono text-[10px] px-2 py-0.5 border-2 border-line transition-colors cursor-pointer",
        active ? "bg-fill text-on-fill" : "bg-paper hover:bg-stone",
        disabled && "opacity-40 pointer-events-none",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- geometry

/**
 * An orthogonal three-segment wire: down out of the parent, across, down into
 * the child. Beziers curve between device pixels, which is exactly the soft
 * edge this design does not have anywhere else.
 */
function wirePath(from: GraphNode, to: GraphNode): string {
  const x1 = (from.x + NODE_W / 2) * GRID;
  const y1 = (from.y + nodeHeight(from.kind)) * GRID;
  const x2 = (to.x + NODE_W / 2) * GRID;
  const y2 = to.y * GRID;
  // Meet halfway down the gap, but never less than one grid step below the
  // parent — a child dragged above its parent still gets a readable elbow.
  const mid = Math.max(y1 + GRID, (y1 + y2) / 2);
  return `M ${x1} ${y1} L ${x1} ${mid} L ${x2} ${mid} L ${x2} ${y2}`;
}
