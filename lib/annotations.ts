// The canvas' drawing layer.
//
// The graph says what the agent *is*. Annotations say what the person building
// it was thinking: a circle round the branch that is not finished, an arrow
// from the retriever to the thing it feeds, a sticky note with the API key
// question nobody has answered yet. None of it exports, none of it installs —
// it rides along in the same jsonb document as the nodes so it survives a
// reload and a share link without a second table or a second save path.
//
// Geometry is in grid units, exactly like `GraphNode.x/y`, so a drawing pans
// and zooms with the nodes it was drawn around instead of floating over them.

export interface Point {
  x: number;
  y: number;
}

export type AnnotationKind =
  | "pen"
  | "marker"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "text"
  | "note";

/**
 * Ink is named by token, never by hex. A drawing made in light mode has to
 * still be legible after the theme wipe, and a stored `#17150f` would be a
 * black scribble on a black canvas the moment someone switches.
 */
export type InkColor = "ink" | "coral" | "ok" | "muted" | "paper";

export interface Annotation {
  id: string;
  kind: AnnotationKind;
  color: InkColor;
  /** Stroke weight in world pixels at 100% zoom. See `WEIGHTS`. */
  weight: number;
  /** pen · marker · line · arrow — the path, in grid units. */
  points?: Point[];
  /** rect · ellipse · text · note — the box, in grid units. */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /** text · note. */
  text?: string;
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ------------------------------------------------------------------ palette

export const INK_COLORS: { id: InkColor; label: string; css: string }[] = [
  { id: "ink", label: "Ink", css: "var(--ink)" },
  { id: "coral", label: "Coral", css: "var(--coral)" },
  { id: "ok", label: "Green", css: "var(--ok)" },
  { id: "muted", label: "Muted", css: "var(--muted)" },
  // Paper is the white-out: a stroke that hides what is under it, and the only
  // way to correct a drawing without erasing the whole stroke.
  { id: "paper", label: "Paper", css: "var(--paper)" },
];

export function inkCss(color: InkColor): string {
  return INK_COLORS.find((c) => c.id === color)?.css ?? "var(--ink)";
}

/** Thin · medium · thick. Three is enough to be expressive and still one tap. */
export const WEIGHTS = [2, 4, 8] as const;

/**
 * A marker is a pen with the nib opened up and the ink thinned out. Kept as a
 * pair of multipliers rather than a second weight scale so "thick" means the
 * same thing to both tools.
 */
export const MARKER_SCALE = 3;
export const MARKER_ALPHA = 0.32;

// ------------------------------------------------------------------ helpers

let seq = 0;
export function newAnnotationId(): string {
  seq += 1;
  return `a-${Date.now().toString(36)}-${seq.toString(36)}`;
}

export function isStrokeKind(k: AnnotationKind): boolean {
  return k === "pen" || k === "marker" || k === "line" || k === "arrow";
}

export function isBoxKind(k: AnnotationKind): boolean {
  return k === "rect" || k === "ellipse" || k === "text" || k === "note";
}

export function isTextKind(k: AnnotationKind): boolean {
  return k === "text" || k === "note";
}

/**
 * Freehand, quantised to half a grid unit.
 *
 * A raw pointer trail is a smooth curve, and a smooth curve is the one thing
 * this design does not have anywhere: every border, wire and glyph in the app
 * lands on whole pixels. Snapping each sample to 4px makes a hand-drawn stroke
 * come out as pixel art rather than as an ink line pasted over pixel art — and
 * it drops the point count of a long scribble by an order of magnitude, which
 * is what keeps the stored document small.
 */
export const QUANT = 0.5;

export function quantize(p: Point): Point {
  return { x: Math.round(p.x / QUANT) * QUANT, y: Math.round(p.y / QUANT) * QUANT };
}

/** Append a sample, dropping the ones that land on the point already there. */
export function pushPoint(points: Point[], p: Point): Point[] {
  const q = quantize(p);
  const last = points[points.length - 1];
  if (last && last.x === q.x && last.y === q.y) return points;
  return [...points, q];
}

/** Default box for a shape dropped rather than dragged, in grid units. */
export const NOTE_W = 20;
export const NOTE_H = 12;
export const TEXT_W = 20;
export const TEXT_H = 3;

export function annotationBounds(a: Annotation): Box {
  if (a.points && a.points.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of a.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX, maxY };
  }
  const x = a.x ?? 0;
  const y = a.y ?? 0;
  return { minX: x, minY: y, maxX: x + (a.w ?? 0), maxY: y + (a.h ?? 0) };
}

/** Bounding box of a whole layer. `null` when there is nothing drawn. */
export function annotationsBounds(list: Annotation[]): Box | null {
  if (list.length === 0) return null;
  let box: Box | null = null;
  for (const a of list) {
    const b = annotationBounds(a);
    box = box
      ? {
          minX: Math.min(box.minX, b.minX),
          minY: Math.min(box.minY, b.minY),
          maxX: Math.max(box.maxX, b.maxX),
          maxY: Math.max(box.maxY, b.maxY),
        }
      : b;
  }
  return box;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len = vx * vx + vy * vy;
  // A zero-length segment is a dot: the distance is to the dot itself.
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len));
  const dx = p.x - (a.x + t * vx);
  const dy = p.y - (a.y + t * vy);
  return Math.hypot(dx, dy);
}

/**
 * The topmost annotation under a point, or null.
 *
 * Walked back to front because later entries paint over earlier ones, so the
 * one you can see is the one you must be able to grab. `tol` is in grid units
 * and comes from the canvas, which scales it by the zoom — a 2px stroke has to
 * stay grabbable at 40%.
 */
export function hitAnnotation(list: Annotation[], p: Point, tol: number): string | null {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const a = list[i];
    if (a.points && a.points.length > 0) {
      const reach = tol + a.weight / 16;
      if (a.points.length === 1) {
        if (Math.hypot(p.x - a.points[0].x, p.y - a.points[0].y) <= reach) return a.id;
        continue;
      }
      for (let j = 1; j < a.points.length; j += 1) {
        if (distToSegment(p, a.points[j - 1], a.points[j]) <= reach) return a.id;
      }
      continue;
    }
    const b = annotationBounds(a);
    if (p.x >= b.minX - tol && p.x <= b.maxX + tol && p.y >= b.minY - tol && p.y <= b.maxY + tol) {
      return a.id;
    }
  }
  return null;
}

/** Every annotation whose box overlaps a world rect. Marquee and erase-drag. */
export function annotationsInRect(list: Annotation[], a: Point, b: Point): string[] {
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  return list
    .filter((an) => {
      const box = annotationBounds(an);
      return box.minX < x2 && box.maxX > x1 && box.minY < y2 && box.maxY > y1;
    })
    .map((an) => an.id);
}

export function moveAnnotation(a: Annotation, dx: number, dy: number): Annotation {
  if (a.points) return { ...a, points: a.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  return { ...a, x: (a.x ?? 0) + dx, y: (a.y ?? 0) + dy };
}

export function duplicateAnnotation(a: Annotation, dx = 2, dy = 2): Annotation {
  return { ...moveAnnotation(a, dx, dy), id: newAnnotationId() };
}

/**
 * The SVG `d` for a stroke. Straight segments and mitred joins, because a
 * quantised path drawn with round joins reads as a smoothed curve again and
 * throws away the point of quantising it.
 */
export function strokePath(points: Point[], grid: number): string {
  if (points.length === 0) return "";
  const head = `M ${points[0].x * grid} ${points[0].y * grid}`;
  if (points.length === 1) {
    // A single tap still has to leave a mark, or a dotted line is impossible.
    return `${head} L ${points[0].x * grid + 0.01} ${points[0].y * grid}`;
  }
  return head + points.slice(1).map((p) => ` L ${p.x * grid} ${p.y * grid}`).join("");
}

/** The two barbs of an arrow head, as one path. Sized off the stroke weight. */
export function arrowHead(from: Point, to: Point, grid: number, weight: number): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return "";
  const ux = dx / len;
  const uy = dy / len;
  // In world pixels, then divided back into grid units — the head has to grow
  // with the pen, not with how long the line happens to be.
  const size = Math.max(6, weight * 2.5);
  const back = size / grid;
  const side = back * 0.55;
  const bx = to.x - ux * back;
  const by = to.y - uy * back;
  const p1 = { x: bx - uy * side, y: by + ux * side };
  const p2 = { x: bx + uy * side, y: by - ux * side };
  return `M ${p1.x * grid} ${p1.y * grid} L ${to.x * grid} ${to.y * grid} L ${p2.x * grid} ${p2.y * grid}`;
}

// -------------------------------------------------------------- (de)serialize

const KINDS: AnnotationKind[] = ["pen", "marker", "line", "arrow", "rect", "ellipse", "text", "note"];
const COLORS: InkColor[] = ["ink", "coral", "ok", "muted", "paper"];

/**
 * Anything arriving from storage, a share link or the API. A malformed drawing
 * is dropped rather than repaired: unlike a node, nothing downstream depends on
 * it existing, so the safe failure is for it not to be there.
 */
export function normalizeAnnotations(raw: unknown): Annotation[] {
  if (!Array.isArray(raw)) return [];
  const out: Annotation[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const a = item as Annotation;
    if (typeof a.id !== "string" || seen.has(a.id)) continue;
    if (!KINDS.includes(a.kind)) continue;
    const points = Array.isArray(a.points)
      ? a.points
          .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
          .map((p) => ({ x: p.x, y: p.y }))
      : undefined;
    if (isStrokeKind(a.kind) && (!points || points.length === 0)) continue;
    if (isBoxKind(a.kind) && !(Number.isFinite(a.x) && Number.isFinite(a.y))) continue;
    seen.add(a.id);
    out.push({
      id: a.id,
      kind: a.kind,
      color: COLORS.includes(a.color) ? a.color : "ink",
      weight: Number.isFinite(a.weight) ? Math.min(24, Math.max(1, a.weight)) : 2,
      ...(points ? { points } : {}),
      ...(Number.isFinite(a.x) ? { x: a.x } : {}),
      ...(Number.isFinite(a.y) ? { y: a.y } : {}),
      ...(Number.isFinite(a.w) ? { w: a.w } : {}),
      ...(Number.isFinite(a.h) ? { h: a.h } : {}),
      ...(typeof a.text === "string" ? { text: a.text.slice(0, 2000) } : {}),
    });
  }
  return out;
}
