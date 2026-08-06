// The canvas' labels.
//
// The graph says what the agent *is*. A label says what the person building it
// was thinking: "this branch is not finished", "ask about the API key", a name
// for a cluster of nodes the tree structure cannot express. It does not export
// and it does not install — it rides along in the same jsonb document as the
// nodes so it survives a reload and a share link without a second table or a
// second save path.
//
// This layer used to be a whole drawing set — pen, marker, shapes, arrows, a
// five-colour palette and three stroke weights. None of it earned its place in
// a composer whose wires draw themselves: a freehand line is a scribble made
// with a mouse, a straight line duplicates a wire, and colour already has a
// home on the node itself (`GraphNode.tint`, which does export). What was left
// once those went is one thing people actually reach for — a piece of text,
// parked on the canvas.
//
// Geometry is in grid units, exactly like `GraphNode.x/y`, so a label pans and
// zooms with the nodes it was written about instead of floating over them.

export interface Point {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  /** Top-left corner, in grid units. */
  x: number;
  y: number;
  /** The box the text wraps inside, in grid units. */
  w: number;
  h: number;
  text: string;
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ------------------------------------------------------------------ metrics

/** Default box for a label, in grid units. */
export const LABEL_W = 20;
export const LABEL_H = 3;

/**
 * One size, in world pixels at 100% zoom. A picker for this existed and did
 * nothing a canvas needs: a label is a margin note, and a margin note that can
 * be set in 24pt is an invitation to build a poster on top of the graph.
 */
export const LABEL_SIZE = 12;
export const LABEL_LINE = 1.35;

// ------------------------------------------------------------------ helpers

let seq = 0;
export function newAnnotationId(): string {
  seq += 1;
  return `a-${Date.now().toString(36)}-${seq.toString(36)}`;
}

export function annotationBounds(a: Annotation): Box {
  return { minX: a.x, minY: a.y, maxX: a.x + a.w, maxY: a.y + a.h };
}

/** Bounding box of every label. `null` when there are none. */
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

/**
 * The topmost label under a point, or null.
 *
 * Walked back to front because later entries paint over earlier ones, so the
 * one you can see is the one you must be able to grab. `tol` is in grid units
 * and comes from the canvas, which scales it by the zoom.
 *
 * Hit-testing happens here against the model rather than in the DOM, because
 * the label layer is `pointer-events: none` — text that swallowed clicks would
 * make the node behind it unreachable.
 */
export function hitAnnotation(list: Annotation[], p: Point, tol: number): string | null {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const b = annotationBounds(list[i]);
    if (p.x >= b.minX - tol && p.x <= b.maxX + tol && p.y >= b.minY - tol && p.y <= b.maxY + tol) {
      return list[i].id;
    }
  }
  return null;
}

export function moveAnnotation(a: Annotation, dx: number, dy: number): Annotation {
  return { ...a, x: a.x + dx, y: a.y + dy };
}

export function duplicateAnnotation(a: Annotation, dx = 2, dy = 2): Annotation {
  return { ...moveAnnotation(a, dx, dy), id: newAnnotationId() };
}

// -------------------------------------------------------------- (de)serialize

/**
 * Anything arriving from storage, a share link or the API. A malformed label is
 * dropped rather than repaired: unlike a node, nothing downstream depends on it
 * existing, so the safe failure is for it not to be there.
 *
 * Entries from the old drawing set — anything with `points`, or a `kind` this
 * no longer has — fall out here on the same rule, without a special case.
 */
export function normalizeAnnotations(raw: unknown): Annotation[] {
  if (!Array.isArray(raw)) return [];
  const out: Annotation[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const a = item as Partial<Annotation> & { kind?: unknown; points?: unknown };
    if (typeof a.id !== "string" || seen.has(a.id)) continue;
    if (a.points !== undefined) continue;
    if (a.kind !== undefined && a.kind !== "text") continue;
    if (!(Number.isFinite(a.x) && Number.isFinite(a.y))) continue;
    if (typeof a.text !== "string") continue;
    seen.add(a.id);
    out.push({
      id: a.id,
      x: a.x as number,
      y: a.y as number,
      w: Number.isFinite(a.w) ? (a.w as number) : LABEL_W,
      h: Number.isFinite(a.h) ? (a.h as number) : LABEL_H,
      text: a.text.slice(0, 2000),
    });
  }
  return out;
}
