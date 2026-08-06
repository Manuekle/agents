"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import { cssTimeMs } from "@/lib/motion";
import { Mascot } from "@/components/Mascot";
import {
  CollapseIcon,
  CursorIcon,
  DownloadIcon,
  ExpandIcon,
  HandIcon,
  LockIcon,
  LockOpenIcon,
  MinusIcon,
  PlusIcon,
  TextIcon,
} from "@/components/icons";
import { KIND_META } from "@/lib/aitmpl";
import {
  GRID,
  KIND_LABEL,
  NODE_W,
  addAnnotation,
  alignNodes,
  autoLayout,
  collapsedCount,
  connect,
  detachNode,
  disconnect,
  distributeNodes,
  duplicateMany,
  graphAnnotations,
  graphBounds,
  isAgentKind,
  isComponentKind,
  mascotOf,
  moveNodes,
  nodeById,
  nodeHeight,
  nodeRef,
  nodesInRect,
  removeAnnotations,
  removeNode,
  snapTo,
  subtreeOf,
  toggleCollapse,
  updateAnnotation,
  updateNode,
  visibleGraph,
  TINT_COLORS,
  tintCss,
  type AgentGraph,
  type AlignEdge,
  type GraphNode,
} from "@/lib/graph";
import {
  LABEL_H,
  LABEL_W,
  annotationBounds,
  duplicateAnnotation,
  hitAnnotation,
  moveAnnotation,
  newAnnotationId,
  type Annotation,
  type Point,
} from "@/lib/annotations";
import { exportCanvas } from "@/lib/canvas-export";
import { AnnotationEditor, AnnotationLayer } from "@/components/canvas/Annotations";
import { ContextMenu, type MenuEntry } from "@/components/canvas/ContextMenu";
import type { GraphHistory } from "@/lib/use-graph-history";

// The composer's canvas. Nodes are real DOM elements inside one transformed
// world, not shapes in a <canvas>: they have to be focusable, readable by a
// screen reader and movable from the keyboard, and a bitmap surface gives up
// all three. The SVG layers under them draw the wires and the ink.
//
// Interaction follows the editor everyone already knows: left-drag on empty
// space is a marquee, space or middle-drag pans, ⌘Z undoes, ⌘D duplicates,
// nodes snap to their neighbours' edges and centres, and right-click opens the
// commands for whatever is under the pointer.

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;

/** How near, in device pixels, a click has to be to grab a label. */
const INK_HIT_PX = 7;

interface Viewport {
  x: number;
  y: number;
  z: number;
}

/**
 * Everything the dock can put the pointer into.
 *
 * Three. A drawing set lived here — pen, marker, eraser, shapes, arrows, a
 * palette and three weights — and none of it survived contact with what this
 * canvas is for: the wires draw themselves, so a line tool only ever produced
 * something that looked like a wire and was not one, and colour belongs to the
 * node (`tint`), which is the copy that exports.
 */
type Tool = "select" | "hand" | "label";

/** A drag in flight. `null` when the pointer is not doing anything. */
type Drag =
  | { mode: "pan"; startX: number; startY: number; originX: number; originY: number }
  | { mode: "node"; id: string; grabX: number; grabY: number; origins: Map<string, Point> }
  | { mode: "link"; from: string; x: number; y: number }
  | { mode: "marquee"; from: Point; to: Point; base: string[] }
  | { mode: "ink"; id: string; grab: Point; origin: Annotation };

/** Right-click target: a node, a wire, a label, or bare canvas. */
interface Menu {
  x: number;
  y: number;
  world: Point;
  nodeId: string | null;
  edgeId: string | null;
  inkId: string | null;
}

export interface AgentCanvasProps {
  graph: AgentGraph;
  /** `tag` merges consecutive edits of one kind into a single undo step. */
  onChange: (next: AgentGraph, tag?: string) => void;
  /** Every selected node. The first is what the inspector edits. */
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
  /**
   * Create a specialist — the page owns what a new one is. `at` places it at
   * a pointer; `ownerId` names who owns it. The menu's "under this" passes an
   * owner and no point, because "under this" means that node's next free slot
   * and not wherever the menu happened to be opened. Neither is passed by the
   * double-click path, which means "here, under whoever is active".
   */
  onAddSubagent?: (at?: Point, ownerId?: string) => void;
  /**
   * "Take me to this node's fields." The canvas can rename a node in place but
   * not write its prompt, so the menu hands that off to whoever owns the form.
   */
  onEditNode?: (id: string) => void;
  /**
   * Frozen layout: nodes cannot be moved, wired, added or deleted, and no
   * label can be written. Selecting, panning, zooming and editing fields all
   * still work — this is the "stop me nudging the tree while I read it" lock,
   * not read-only mode. Controlled by the page so its own toolbar buttons can
   * grey out too.
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

/** Ctrl on Windows and Linux, ⌘ on a Mac — one predicate for every shortcut. */
const mod = (e: React.KeyboardEvent) => e.metaKey || e.ctrlKey;

export function AgentCanvas({
  graph,
  onChange,
  selection,
  onSelectionChange,
  onAddSubagent,
  onEditNode,
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
  const [tool, setTool] = useState<Tool>("select");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [guides, setGuides] = useState<{ vx: number | null; hy: number | null }>({
    vx: null,
    hy: null,
  });
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // ---- labels -------------------------------------------------------------
  const [inkSel, setInkSel] = useState<string | null>(null);
  const [editingInk, setEditingInk] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

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
  // True once the user has taken the camera themselves. Until then the canvas
  // keeps reframing the graph as the surface settles — see the fit effects.
  const userMoved = useRef(false);

  // Copy/paste is in-canvas, not the system clipboard: what is being copied is
  // a subtree of a graph this page owns, and serialising it out to text only to
  // parse it back adds a format nobody else reads.
  const clipboard = useRef<string[]>([]);

  const selected = useMemo(() => new Set(selection), [selection]);
  const drawings = graphAnnotations(graph);

  /**
   * The graph as it is drawn. A folded branch is hidden from hit-testing, the
   * marquee, the guides, the minimap and `fit` — everything that answers "what
   * is on screen" — while every edit still goes through the real graph.
   */
  const shown = useMemo(() => visibleGraph(graph), [graph]);
  const shownRef = useRef(shown);
  shownRef.current = shown;

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

  /** The grab radius for a label, in grid units at the current zoom. */
  const inkTol = () => INK_HIT_PX / (viewRef.current.z * GRID);

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
    userMoved.current = true;
    if (easeTimer.current) {
      clearTimeout(easeTimer.current);
      easeTimer.current = null;
    }
    setEasing(false);
    setView(next);
  }, []);

  const zoomAt = useCallback((factor: number, clientX?: number, clientY?: number) => {
    userMoved.current = true;
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
    // An unmeasured surface would frame the graph against nothing and land on
    // MIN_ZOOM. It happens for a frame on mount before the stylesheet applies
    // the shell's height, and a canvas that opens at 40% for no reason reads
    // as broken.
    if (box.width < 2 || box.height < 2) return;
    const b = graphBounds(shownRef.current);
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
    const node = nodeById(shownRef.current, id);
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
  //
  // Waits for the surface to have a size: the first pass can run against a box
  // the stylesheet has not given a height to yet, and the latch would then burn
  // the one fit this canvas gets on a measurement of nothing.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || graph.nodes.length === 0 || size.w < 2 || size.h < 2) return;
    fitted.current = true;
    fit();
  }, [fit, graph.nodes.length, size.w, size.h]);

  // …and again on every later size change, until the user takes the camera.
  //
  // Having a size is not the same as having the *final* size: the first
  // measurement routinely lands before the web fonts, the page's scrollbar and
  // the shell's own height have finished moving the box, and the one fit above
  // then frames the graph against a surface tens of pixels smaller than the one
  // it ends up in — visibly off-centre, for the rest of the session. Panning,
  // zooming or a wheel gesture ends this: from that point the view is the
  // user's, and reframing it would be the canvas fighting them.
  // Size only, deliberately: this must not become a second "refit when the
  // graph changes", which is the thing the composer cannot have.
  useEffect(() => {
    if (!fitted.current || userMoved.current) return;
    if (size.w < 2 || size.h < 2 || shownRef.current.nodes.length === 0) return;
    fit();
  }, [fit, size.w, size.h]);

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
    // Whatever is highlighted, in the order the eye would expect: the drawing
    // you just clicked, then the wire, then the nodes.
    if (inkSel) {
      onChange(removeAnnotations(graphRef.current, [inkSel]));
      setInkSel(null);
      return;
    }
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
  }, [edgeId, inkSel, onChange, onSelectionChange]);

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

  /**
   * Paste at the pointer rather than beside the original. `duplicateMany` puts
   * a copy one node-width to the right, which is right for ⌘D and wrong for a
   * paste aimed somewhere on purpose — so the fresh subtree is translated as a
   * whole to land its top-left corner where the menu was opened.
   */
  const pasteAt = useCallback(
    (at: Point) => {
      if (lockedRef.current || clipboard.current.length === 0) return;
      const result = duplicateMany(graphRef.current, clipboard.current);
      if (result.ids.length === 0) return;
      const members = new Set<string>();
      for (const id of result.ids) for (const m of subtreeOf(result.graph, id)) members.add(m);
      let minX = Infinity;
      let minY = Infinity;
      for (const n of result.graph.nodes) {
        if (!members.has(n.id)) continue;
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
      }
      const moved = moveNodes(
        result.graph,
        members,
        Math.round(at.x - minX),
        Math.round(at.y - minY),
      );
      onChange(moved);
      onSelectionChange(result.ids);
    },
    [onChange, onSelectionChange],
  );

  /** Every node this command should touch: the selection, or the one clicked. */
  const targets = useCallback(
    (id: string | null): string[] => {
      if (id && !selectionRef.current.includes(id)) return [id];
      return selectionRef.current.length > 0 ? selectionRef.current : id ? [id] : [];
    },
    [],
  );

  // ---- labels -------------------------------------------------------------

  /** Drop a label somewhere and open it for typing straight away. */
  const placeLabel = useCallback(
    (at: Point) => {
      if (lockedRef.current) return;
      const a: Annotation = {
        id: newAnnotationId(),
        x: Math.round(at.x),
        y: Math.round(at.y),
        w: LABEL_W,
        h: LABEL_H,
        text: "",
      };
      onChange(addAnnotation(graphRef.current, a));
      setInkSel(a.id);
      setEditingInk(a.id);
      // Placed once, not armed: the next click should select, not litter a
      // second empty label wherever it lands.
      setTool("select");
    },
    [onChange],
  );

  /**
   * Take the gesture if the label tool is armed. Called from both the surface
   * and the nodes — a label can be written over a card, and a tool that stops
   * at the edge of one would be unable to annotate the thing being annotated.
   */
  const beginLabel = (e: React.PointerEvent): boolean => {
    if (locked || e.button !== 0 || tool !== "label") return false;
    e.stopPropagation();
    e.preventDefault(); // no focus ring jumping onto the node underneath
    placeLabel(toWorld(e.clientX, e.clientY));
    return true;
  };

  // ---- pointer ------------------------------------------------------------

  const panning = drag?.mode === "pan";
  const handMode = tool === "hand" || spaceHeld;
  const inking = !locked && tool === "label";

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
    if (beginLabel(e)) return;

    setEdgeId(null);
    const at = toWorld(e.clientX, e.clientY);

    // A label under the pointer wins over the marquee. Nodes never get here —
    // they stop the event themselves — so this is genuinely "empty canvas or a
    // label written on it".
    const hit = hitAnnotation(drawings, at, inkTol());
    if (hit) {
      const a = drawings.find((x) => x.id === hit);
      setInkSel(hit);
      onSelectionChange([]);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      if (a && !locked) {
        const b = annotationBounds(a);
        setDrag({ mode: "ink", id: hit, grab: { x: at.x - b.minX, y: at.y - b.minY }, origin: a });
      }
      return;
    }
    setInkSel(null);
    setEditingInk(null);

    const additive = e.shiftKey;
    if (!additive) onSelectionChange([]);
    setDrag({ mode: "marquee", from: at, to: at, base: additive ? selectionRef.current : [] });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onNodePointerDown = (e: React.PointerEvent, node: GraphNode) => {
    if (e.button !== 0) return;
    if (beginLabel(e)) return;
    e.stopPropagation();
    setMenu(null);
    setEdgeId(null);
    setInkSel(null);

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

    if (drag.mode === "ink") {
      const b = annotationBounds(drag.origin);
      // Whole grid units, like a node: the design is pixel art, and text parked
      // on a fractional unit renders between device pixels.
      const to = { x: Math.round(w.x - drag.grab.x), y: Math.round(w.y - drag.grab.y) };
      const moved = moveAnnotation(drag.origin, to.x - b.minX, to.y - b.minY);
      onChange(updateAnnotation(graphRef.current, drag.id, moved), `ink:${drag.id}`);
      return;
    }

    if (drag.mode === "link") {
      setDrag({ ...drag, x: w.x, y: w.y });
      return;
    }

    if (drag.mode === "marquee") {
      setDrag({ ...drag, to: w });
      const hit = nodesInRect(shownRef.current, drag.from, w);
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
      const snapped = snapTo(shownRef.current, drag.id, x, y, new Set(drag.origins.keys()));
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
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    // A double-tap with the label tool armed is two labels, not a rename.
    if (locked || inking) return;
    const el = e.target as HTMLElement;
    const nodeId = el.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
    // Double-click a node to rename it in place — the gesture every canvas
    // editor has, and the shortest path from "that name is wrong" to fixed.
    if (nodeId) {
      setRenaming(nodeId);
      onSelectionChange([nodeId]);
      return;
    }
    const at = toWorld(e.clientX, e.clientY);
    const hit = hitAnnotation(drawings, at, inkTol());
    if (hit) {
      setInkSel(hit);
      setEditingInk(hit);
      return;
    }
    onAddSubagent?.(at);
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const host = hostRef.current;
    if (!host) return;
    const box = host.getBoundingClientRect();
    const el = e.target as HTMLElement;
    const nodeId = el.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId ?? null;
    const overEdge = el.closest<SVGElement>("[data-edge-id]")?.dataset.edgeId ?? null;
    const world = toWorld(e.clientX, e.clientY);
    const overInk = nodeId || overEdge ? null : hitAnnotation(drawings, world, inkTol());
    // Right-clicking a node that is not in the selection acts on that node —
    // the menu must never operate on something the user cannot see is targeted.
    if (nodeId && !selectionRef.current.includes(nodeId)) onSelectionChange([nodeId]);
    if (overEdge) setEdgeId(overEdge);
    if (overInk) {
      setInkSel(overInk);
      onSelectionChange([]);
    }
    setMenu({ x: e.clientX - box.left, y: e.clientY - box.top, world, nodeId, edgeId: overEdge, inkId: overInk });
  };

  // ---- keyboard -----------------------------------------------------------

  /** Single-key tool shortcuts, in the order the dock shows them. */
  const TOOL_KEYS: Record<string, Tool> = {
    v: "select",
    h: "hand",
    t: "label",
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " && !spaceRef.current) {
      spaceRef.current = true;
      setSpaceHeld(true);
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      // Peel one layer at a time. Escaping a menu or an open label must never
      // also throw away the enlarged view.
      if (editingInk) {
        setEditingInk(null);
        return;
      }
      if (renaming) {
        setRenaming(null);
        return;
      }
      const hadFocus = menu || edgeId || inkSel || selection.length > 0;
      onSelectionChange([]);
      setEdgeId(null);
      setInkSel(null);
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
      onSelectionChange(shown.nodes.map((n) => n.id));
      return;
    }
    if (mod(e) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      if (inkSel) {
        const a = drawings.find((x) => x.id === inkSel);
        if (a && !locked) {
          const copy = duplicateAnnotation(a);
          onChange(addAnnotation(graph, copy));
          setInkSel(copy.id);
        }
        return;
      }
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

    if (e.key === "F2" && selection.length === 1 && !locked) {
      e.preventDefault();
      setRenaming(selection[0]);
      return;
    }

    // Tool shortcuts. Modifier-free and lowercase only, so ⌘A stays select-all
    // and a capital letter typed into a field that bubbled here does nothing.
    if (!mod(e) && !e.altKey && !e.shiftKey && TOOL_KEYS[e.key]) {
      const next = TOOL_KEYS[e.key];
      if (locked && next === "label") return;
      e.preventDefault();
      setTool(next);
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

  // The lock takes the pointer out of writing mode: a locked canvas still armed
  // with the label tool is one stray click from an edit it promised to refuse.
  useEffect(() => {
    if (locked && tool === "label") setTool("select");
  }, [locked, tool]);

  // ---- wires --------------------------------------------------------------

  const wires = useMemo(() => {
    const out: { id: string; d: string; from: GraphNode; to: GraphNode }[] = [];
    for (const e of shown.edges) {
      const from = nodeById(shown, e.from);
      const to = nodeById(shown, e.to);
      if (!from || !to) continue;
      out.push({ id: e.id, d: wirePath(from, to), from, to });
    }
    return out;
  }, [shown]);

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
    !locked &&
    (selection.some((id) => nodeById(graph, id)?.kind !== "orchestrator") || !!edgeId || !!inkSel);

  const editingAnnotation = editingInk ? drawings.find((a) => a.id === editingInk) : undefined;

  // ---- the menu -----------------------------------------------------------

  /**
   * What right-click offers, built fresh for whatever is under the pointer.
   * The menu component knows how to render and drive a list of entries; only
   * this has the graph, the selection and the history it takes to fill one in.
   */
  const menuEntries = (m: Menu): MenuEntry[] => {
    const ink = m.inkId ? drawings.find((a) => a.id === m.inkId) : undefined;

    // --- a label ---------------------------------------------------------
    if (ink) {
      return [
        { kind: "head", id: "h", label: "label" },
        {
          kind: "item",
          id: "edit",
          label: "edit text",
          hint: "dbl",
          disabled: locked,
          run: () => setEditingInk(ink.id),
        },
        {
          kind: "item",
          id: "dup",
          label: "duplicate",
          hint: "⌘D",
          disabled: locked,
          run: () => {
            const copy = duplicateAnnotation(ink);
            onChange(addAnnotation(graph, copy));
            setInkSel(copy.id);
          },
        },
        { kind: "rule", id: "r1" },
        {
          kind: "item",
          id: "del",
          label: "delete label",
          hint: "⌫",
          disabled: locked,
          run: () => {
            onChange(removeAnnotations(graph, [ink.id]));
            setInkSel(null);
          },
        },
      ];
    }

    // --- a wire ----------------------------------------------------------
    if (m.edgeId) {
      const edge = graph.edges.find((x) => x.id === m.edgeId);
      return [
        { kind: "head", id: "h", label: "wire" },
        {
          kind: "item",
          id: "cut",
          label: "disconnect wire",
          hint: "⌫",
          disabled: locked,
          run: () => {
            onChange(disconnect(graph, m.edgeId as string));
            setEdgeId(null);
          },
        },
        {
          kind: "item",
          id: "ends",
          label: "select both ends",
          disabled: !edge,
          run: () => edge && onSelectionChange([edge.from, edge.to]),
        },
        { kind: "rule", id: "r1" },
        ...canvasEntries(m),
      ];
    }

    // --- a node ----------------------------------------------------------
    const node = nodeById(graph, m.nodeId);
    if (node) {
      const ids = targets(node.id);
      const many = ids.length > 1;
      const agentish = isAgentKind(node.kind);
      const hidden = collapsedCount(graph, node.id);
      const removable = ids.some((id) => nodeById(graph, id)?.kind !== "orchestrator");
      const owned = graph.edges.some((e) => e.to === node.id);

      return [
        { kind: "head", id: "h", label: `${KIND_LABEL[node.kind]} · ${node.name}` },
        {
          kind: "item",
          id: "rename",
          label: "rename",
          hint: "F2",
          disabled: locked,
          run: () => setRenaming(node.id),
        },
        ...(onEditNode
          ? ([
              {
                kind: "item",
                id: "fields",
                label: agentish ? "edit prompt & model" : "show in panel",
                run: () => {
                  onSelectionChange([node.id]);
                  onEditNode(node.id);
                },
              },
            ] as MenuEntry[])
          : []),
        ...(agentish && (hidden > 0 || node.collapsed)
          ? ([
              {
                kind: "item",
                id: "fold",
                label: node.collapsed ? `unfold ${hidden} hidden` : `fold ${hidden} below`,
                run: () => {
                  onChange(toggleCollapse(graph, node.id));
                  // Anything folded away must not stay selected — the panels
                  // below would keep editing a node nobody can see.
                  if (!node.collapsed) onSelectionChange([node.id]);
                },
              },
            ] as MenuEntry[])
          : []),
        {
          kind: "sub",
          id: "tint",
          label: many ? `colour tag (${ids.length})` : "colour tag",
          disabled: locked,
          items: [
            {
              kind: "item" as const,
              id: "t-none",
              label: "none",
              checked: !node.tint,
              run: () => {
                let next = graph;
                for (const id of ids) next = updateNode(next, id, { tint: undefined });
                onChange(next);
              },
            },
            ...TINT_COLORS.map((c) => ({
              kind: "item" as const,
              id: `t-${c.id}`,
              label: c.label.toLowerCase(),
              swatch: c.css,
              checked: node.tint === c.id,
              run: () => {
                let next = graph;
                for (const id of ids) next = updateNode(next, id, { tint: c.id });
                onChange(next);
              },
            })),
          ],
        },
        { kind: "rule", id: "r1" },
        {
          kind: "item",
          id: "dup",
          label: many ? `duplicate ${ids.length}` : "duplicate",
          hint: "⌘D",
          disabled: locked || !removable,
          run: () => duplicateIds(ids),
        },
        {
          kind: "item",
          id: "copy",
          label: "copy",
          hint: "⌘C",
          run: () => {
            clipboard.current = ids;
          },
        },
        ...(agentish && onAddSubagent
          ? ([
              {
                kind: "item",
                id: "add",
                label: "add subagent under this",
                disabled: locked,
                run: () => {
                  onSelectionChange([node.id]);
                  // The owner goes across explicitly: the page reads it from
                  // the selection otherwise, and the selection it would read
                  // is the one from before the line above.
                  onAddSubagent(undefined, node.id);
                },
              },
            ] as MenuEntry[])
          : []),
        {
          kind: "item",
          id: "detach",
          label: "detach from parent",
          disabled: locked || !owned,
          run: () => {
            let next = graph;
            for (const id of ids) next = detachNode(next, id);
            onChange(next);
          },
        },
        {
          kind: "sub",
          id: "select",
          label: "select",
          items: [
            {
              kind: "item" as const,
              id: "s-sub",
              label: "this branch",
              run: () => onSelectionChange([...subtreeOf(shown, node.id)]),
            },
            {
              kind: "item" as const,
              id: "s-kind",
              label: `every ${KIND_LABEL[node.kind]}`,
              run: () =>
                onSelectionChange(shown.nodes.filter((n) => n.kind === node.kind).map((n) => n.id)),
            },
            {
              kind: "item" as const,
              id: "s-all",
              label: "everything",
              run: () => onSelectionChange(shown.nodes.map((n) => n.id)),
            },
          ],
        },
        {
          kind: "sub",
          id: "align",
          label: "align",
          // Two nodes is the smallest thing that can be out of line with
          // something; below that the whole submenu is a no-op.
          disabled: locked || ids.length < 2,
          items: [
            ...(
              [
                ["left", "left edges"],
                ["center-x", "centres ↕"],
                ["right", "right edges"],
                ["top", "top edges"],
                ["middle", "centres ↔"],
                ["bottom", "bottom edges"],
              ] as [AlignEdge, string][]
            ).map(([edge, label]) => ({
              kind: "item" as const,
              id: `a-${edge}`,
              label,
              run: () => onChange(alignNodes(graph, ids, edge)),
            })),
            { kind: "rule" as const, id: "a-r" },
            {
              kind: "item" as const,
              id: "d-x",
              label: "space across",
              disabled: ids.length < 3,
              run: () => onChange(distributeNodes(graph, ids, "x")),
            },
            {
              kind: "item" as const,
              id: "d-y",
              label: "space down",
              disabled: ids.length < 3,
              run: () => onChange(distributeNodes(graph, ids, "y")),
            },
          ],
        },
        { kind: "rule", id: "r2" },
        {
          kind: "item",
          id: "del",
          label: many ? `delete ${ids.length}` : "delete",
          hint: "⌫",
          disabled: !canDelete || !removable,
          run: () => {
            let next = graph;
            for (const id of ids) next = removeNode(next, id);
            onChange(next);
            onSelectionChange([]);
          },
        },
      ];
    }

    // --- bare canvas -----------------------------------------------------
    return canvasEntries(m);
  };

  /** The exported file's name — the agent's, not "canvas". */
  const exportName = () => {
    const root = graph.nodes.find((n) => n.kind === "orchestrator");
    const slug = (root?.name ?? "agent")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `${slug || "agent"}-canvas`;
  };

  /** The commands that belong to the surface itself, not to anything on it. */
  const canvasEntries = (m: Menu): MenuEntry[] => [
    { kind: "head", id: "hc", label: "canvas" },
    ...(onAddSubagent
      ? ([
          {
            kind: "item",
            id: "sub",
            label: "add subagent here",
            hint: "dbl",
            disabled: locked,
            run: () => onAddSubagent(m.world),
          },
        ] as MenuEntry[])
      : []),
    {
      kind: "item",
      id: "label",
      label: "add label here",
      hint: "T",
      disabled: locked,
      run: () => placeLabel(m.world),
    },
    {
      kind: "item",
      id: "paste",
      label: "paste here",
      hint: "⌘V",
      disabled: locked || clipboard.current.length === 0,
      run: () => pasteAt(m.world),
    },
    { kind: "rule", id: "rc1" },
    {
      kind: "item",
      id: "all",
      label: "select all",
      hint: "⌘A",
      run: () => onSelectionChange(shown.nodes.map((n) => n.id)),
    },
    {
      kind: "item",
      id: "tidy",
      label: "tidy into a tree",
      disabled: locked,
      run: () => onChange(autoLayout(graph)),
    },
    {
      kind: "sub",
      id: "export",
      label: "export image",
      items: [
        {
          kind: "item" as const,
          id: "x-png",
          label: "png (2×)",
          run: () => void exportCanvas(graph, "png", exportName()),
        },
        {
          kind: "item" as const,
          id: "x-svg",
          label: "svg (vector)",
          run: () => void exportCanvas(graph, "svg", exportName()),
        },
      ],
    },
    {
      kind: "sub",
      id: "view",
      label: "view",
      items: [
        { kind: "item" as const, id: "fit", label: "fit to view", hint: "⌘0", run: fit },
        {
          kind: "item" as const,
          id: "z100",
          label: "zoom to 100%",
          run: () => zoomAt(1 / viewRef.current.z),
        },
        {
          kind: "item" as const,
          id: "fsx",
          label: fullscreen ? "leave fullscreen" : "fullscreen",
          run: fullscreen ? exitFullscreen : enterFullscreen,
        },
      ],
    },
    ...(onLockedChange
      ? ([
          {
            kind: "item",
            id: "lock",
            label: locked ? "unlock canvas" : "lock canvas",
            run: () => onLockedChange(!locked),
          },
        ] as MenuEntry[])
      : []),
    ...(drawings.length > 0
      ? ([
          { kind: "rule", id: "rc2" },
          {
            kind: "item",
            id: "clear",
            label: `clear ${drawings.length} label${drawings.length === 1 ? "" : "s"}`,
            disabled: locked,
            run: () => {
              onChange({ ...graph, annotations: [] });
              setInkSel(null);
            },
          },
        ] as MenuEntry[])
      : []),
  ];

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
        {/* TOOLBAR — the view, not the tools. What the pointer does lives in
            the dock on the surface, where it is next to the thing it acts on
            and does not fight the toolbar for width on a phone. */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b-2 border-line bg-stone overflow-x-auto">
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
          {/* PNG on the press, both formats on the right-click menu: one is the
              answer 90% of the time, and a toolbar with two export buttons on it
              is a toolbar nobody reads. */}
          <CanvasButton
            onClick={() => void exportCanvas(graph, "png", exportName())}
            label="Export the canvas as a PNG — right-click the canvas for SVG"
          >
            <DownloadIcon size={11} />
          </CanvasButton>
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
            inking && "is-inking",
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
                    style={{ pointerEvents: inking ? "none" : "stroke" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setEdgeId(w.id);
                      setInkSel(null);
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
                  y1={(graphBounds(shown).minY - 4) * GRID}
                  x2={guides.vx * GRID}
                  y2={(graphBounds(shown).maxY + 4) * GRID}
                />
              )}
              {guides.hy !== null && (
                <line
                  className="t-guide"
                  x1={(graphBounds(shown).minX - 4) * GRID}
                  y1={guides.hy * GRID}
                  x2={(graphBounds(shown).maxX + 4) * GRID}
                  y2={guides.hy * GRID}
                />
              )}
            </svg>

            {/* LABELS — over the wires, under the nodes. A label is a comment
                on the graph, so it must be readable across it without ever
                being in the way of clicking one. */}
            <AnnotationLayer annotations={drawings} selected={inkSel} editingId={editingInk} />

            {shown.nodes.map((n) => (
              <CanvasNode
                key={n.id}
                node={n}
                selected={selected.has(n.id)}
                hovered={hoverId === n.id}
                linking={drag?.mode === "link"}
                dragging={drag?.mode === "node" && selected.has(n.id)}
                hiddenCount={n.collapsed ? collapsedCount(graph, n.id) : 0}
                renaming={renaming === n.id}
                onRename={(name) => {
                  onChange(updateNode(graph, n.id, { name }), `rename:${n.id}`);
                }}
                onRenameDone={() => setRenaming(null)}
                onToggleFold={() => onChange(toggleCollapse(graph, n.id))}
                onPointerDown={(e) => onNodePointerDown(e, n)}
                onPortPointerDown={(e) => onPortPointerDown(e, n)}
                onEnter={() => setHoverId(n.id)}
                onLeave={() => setHoverId((id) => (id === n.id ? null : id))}
                onSelect={() => onSelectionChange([n.id])}
              />
            ))}

            {/* The live editor sits above the nodes: a label being typed into
                is the only thing on the canvas that owns the keyboard. */}
            {editingAnnotation && (
              <AnnotationEditor
                a={editingAnnotation}
                onChange={(text) =>
                  onChange(
                    updateAnnotation(graph, editingAnnotation.id, { text }),
                    `text:${editingAnnotation.id}`,
                  )
                }
                onDone={() => {
                  setEditingInk(null);
                  // An empty label is an accident — a click with the label tool
                  // still armed. Leaving it would litter the canvas with
                  // invisible, un-clickable boxes.
                  if (!editingAnnotation.text.trim()) {
                    onChange(removeAnnotations(graph, [editingAnnotation.id]));
                    setInkSel(null);
                  }
                  hostRef.current?.focus();
                }}
              />
            )}

            {marquee && (
              <div
                className="t-marquee absolute pointer-events-none"
                style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }}
              />
            )}
          </div>

          {/* TOOL DOCK — pinned to the surface, top-left, where every editor
              this borrows from puts it. */}
          <ToolDock tool={tool} onTool={setTool} locked={locked} />

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
                nothing here can be moved, wired, labelled or deleted
              </>
            ) : locked ? (
              <>
                canvas locked — nodes stay put. select, pan and zoom still work
                <br />
                unlock from the toolbar to move, wire or label
              </>
            ) : tool === "label" ? (
              <>
                label — click anywhere to write · Esc cancels
                <br />
                double-click a label to edit it, drag it to move it
              </>
            ) : (
              <>
                drag to select · space or middle-drag to pan · ⌘scroll to zoom
                <br />
                right-click for everything · double-click a node to rename · T to label
              </>
            )}
          </div>

          {/* Eased, not instant: clicking the map is asking the canvas to take
              you somewhere, and a cut loses which direction you travelled. */}
          <Minimap graph={shown} view={view} size={size} selected={selected} onJump={easeViewTo} />

          {menu && (
            <ContextMenu
              at={{ x: menu.x, y: menu.y }}
              size={size}
              entries={menuEntries(menu)}
              onClose={() => {
                setMenu(null);
                hostRef.current?.focus();
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- tool dock

/**
 * Three buttons, in one column.
 *
 * This was a two-column grid of eleven, plus a palette and a weight picker.
 * Everything past "select, pan, write a note" was a drawing app growing inside
 * a graph editor: the wires already draw themselves, so a line tool made
 * things that looked like wires and were not, and a colour picked here only
 * ever tinted marks that no export, install or share link carries.
 */
function ToolDock({
  tool,
  onTool,
  locked,
}: {
  tool: Tool;
  onTool: (t: Tool) => void;
  locked: boolean;
}) {
  return (
    <div
      className="t-dock absolute top-2 left-2 flex flex-col gap-1 p-1 border-2 border-line"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label="Canvas tools"
      aria-orientation="vertical"
    >
      <DockButton
        active={tool === "select"}
        label="Select (V) — drag to marquee"
        onClick={() => onTool("select")}
      >
        <CursorIcon size={11} />
      </DockButton>
      <DockButton
        active={tool === "hand"}
        label="Hand (H, or hold space) — drag to pan"
        onClick={() => onTool("hand")}
      >
        <HandIcon size={11} />
      </DockButton>
      {/* Writing is the one thing a locked canvas refuses here, and a button
          that only ever refuses is worse than one that is not there. */}
      {!locked && (
        <DockButton
          active={tool === "label"}
          label="Label (T) — click to write on the canvas"
          onClick={() => onTool("label")}
        >
          <TextIcon size={11} />
        </DockButton>
      )}
    </div>
  );
}

function DockButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        "w-6 h-6 grid place-items-center border-2 border-line cursor-pointer transition-colors duration-100",
        active ? "bg-fill text-on-fill" : "bg-paper hover:bg-stone",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- node

interface CanvasNodeProps {
  node: GraphNode;
  selected: boolean;
  hovered: boolean;
  linking: boolean;
  dragging: boolean;
  /** How many nodes this one is folding away. 0 when it is not folded. */
  hiddenCount: number;
  renaming: boolean;
  onRename: (name: string) => void;
  onRenameDone: () => void;
  onToggleFold: () => void;
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
  hiddenCount,
  renaming,
  onRename,
  onRenameDone,
  onToggleFold,
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
        selected ? "border-coral is-selected" : node.tint ? "has-tint" : "border-line",
        dragging && "is-dragging",
        linking && hovered && "is-droppable",
      )}
      style={{
        left: node.x * GRID,
        top: node.y * GRID,
        width: NODE_W * GRID,
        height: nodeHeight(node.kind) * GRID,
        // The tag is a border colour, not a fill: a filled node stops being a
        // card in this system and starts being a button.
        ...(node.tint ? ({ "--tint": tintCss(node.tint) } as React.CSSProperties) : {}),
      }}
      onPointerDown={onPointerDown}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      {/* The focusable surface. A button rather than the box itself so the
          whole node is reachable by Tab and activatable by Enter, while the
          pointer drag stays on the wrapper.

          Both handlers are for the *keyboard* only. Every pointer route to a
          selection — plain click, shift-click, right-click, the start of a drag
          — is already resolved on pointerdown, by code that knows about the
          modifier and about what was selected before. Letting the click through
          as well would overwrite that with "just this node", which is how
          shift-clicking a second node used to end up selecting only the second
          one, and how right-clicking a multi-selection used to collapse it and
          grey out the align commands the menu was opened for. */}
      <button
        type="button"
        // detail 0 is an activation with no pointer behind it: Enter or Space.
        onClick={(e) => e.detail === 0 && onSelect()}
        // …and focus counts only when it arrived by Tab. A pointer press
        // focuses the button too, right after the pointerdown that already
        // decided the selection.
        onFocus={(e) => e.target.matches(":focus-visible") && onSelect()}
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

      {/* Rename in place. An input on top of the node rather than a dialog:
          the name is right there, and a modal for one field is a modal too
          many. Rendered over the button so the drag handler underneath cannot
          steal the click that puts the caret somewhere. */}
      {renaming && (
        <input
          autoFocus
          defaultValue={node.name}
          aria-label="Node name"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              onRename((e.target as HTMLInputElement).value.trim() || node.name);
              onRenameDone();
            }
            if (e.key === "Escape") onRenameDone();
          }}
          onBlur={(e) => {
            onRename(e.target.value.trim() || node.name);
            onRenameDone();
          }}
          className="t-node-rename absolute left-1 right-1 top-1/2 -translate-y-1/2 px-1 py-0.5 font-mono text-[11px] border-2 border-coral bg-paper text-ink outline-none"
        />
      )}

      {/* Folded: the node wears the count of what it is hiding, and pressing it
          puts the branch back. Rendered as its own control so the fold can be
          undone without going back to the menu that made it. */}
      {hiddenCount > 0 && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleFold}
          title={`Unfold ${hiddenCount} hidden node${hiddenCount === 1 ? "" : "s"}`}
          aria-label={`Unfold ${hiddenCount} hidden nodes`}
          className="t-fold absolute -bottom-[9px] left-1/2 -translate-x-1/2 px-1 font-pixel text-[7px] uppercase border-2 border-line bg-stone text-ink cursor-pointer"
        >
          +{hiddenCount}
        </button>
      )}

      {/* Wire port. Only agent nodes can own things, so only they get one.
          A folded node has no port: wiring something onto a branch you cannot
          see is a change with no feedback. */}
      {agentish && hiddenCount === 0 && (
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
  const ink = graphAnnotations(graph);
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
      aria-label={`Graph overview: ${graph.nodes.length} node${graph.nodes.length === 1 ? "" : "s"}`}
    >
      {/* Drawings first and faint: they set the extent of the map, so leaving
          them out entirely would make the box lie about how far the world goes. */}
      {ink.map((a) => {
        const box = annotationBounds(a);
        const at = toMap(box.minX, box.minY);
        return (
          <rect
            key={a.id}
            x={at.x}
            y={at.y}
            width={Math.max(1, (box.maxX - box.minX) * scale)}
            height={Math.max(1, (box.maxY - box.minY) * scale)}
            className="t-minimap-ink"
          />
        );
      })}
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

// ---------------------------------------------------------------- chrome

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
        // `min-h-6`/`min-w-6`: at 10px type and `py-0.5` these came out 18-20px
        // tall, under the 24px target minimum, and they sit shoulder to shoulder
        // in the bar so nothing about the spacing rescues them. The dock buttons
        // to the left were already 24 — this makes the row agree with itself.
        "inline-flex shrink-0 items-center justify-center min-h-6 min-w-6 font-mono text-[10px] px-2 py-0.5 border-2 border-line transition-colors cursor-pointer",
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
