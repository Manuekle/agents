"use client";

import { useEffect, useRef } from "react";
import { clsx } from "@/lib/clsx";
import {
  MARKER_ALPHA,
  MARKER_SCALE,
  annotationBounds,
  arrowHead,
  inkCss,
  isTextKind,
  strokePath,
  type Annotation,
} from "@/lib/annotations";
import { GRID } from "@/lib/graph";

// The drawing layer, split in two because the two halves are different media:
// strokes and shapes are vector and live in one <svg>, while text and notes are
// real text and live in the DOM, where they wrap, select and read out to a
// screen reader like text instead of like a path.
//
// Both layers are `pointer-events: none`. Hit-testing happens in the canvas
// against the model (see `hitAnnotation`), because the eraser has to find what
// it is dragging over rather than what a pointer happens to land on, and a 2px
// stroke is not a pointer target at 40% zoom no matter what the DOM thinks.

export interface AnnotationLayerProps {
  annotations: Annotation[];
  /** The stroke being drawn right now. Not in the graph until pointerup. */
  draft?: Annotation | null;
  selected?: string | null;
  /** Rendered as an editor by the canvas, so the static copy stays out of it. */
  editingId?: string | null;
}

export function AnnotationLayer({ annotations, draft, selected, editingId }: AnnotationLayerProps) {
  const all = draft ? [...annotations, draft] : annotations;
  const vector = all.filter((a) => !isTextKind(a.kind));
  const text = all.filter((a) => isTextKind(a.kind) && a.id !== editingId);
  const chosen = selected ? all.find((a) => a.id === selected) : undefined;

  return (
    <>
      <svg
        className="absolute top-0 left-0 overflow-visible pointer-events-none"
        width="1"
        height="1"
        aria-hidden="true"
      >
        {vector.map((a) => (
          <Vector key={a.id} a={a} />
        ))}
        {chosen && <SelectionBox a={chosen} />}
      </svg>

      {text.map((a) => (
        <TextBlock key={a.id} a={a} />
      ))}
    </>
  );
}

function Vector({ a }: { a: Annotation }) {
  const css = inkCss(a.color);
  const marker = a.kind === "marker";
  const stroke = {
    stroke: css,
    strokeWidth: marker ? a.weight * MARKER_SCALE : a.weight,
    opacity: marker ? MARKER_ALPHA : 1,
  };

  if (a.kind === "rect" || a.kind === "ellipse") {
    const b = annotationBounds(a);
    const x = b.minX * GRID;
    const y = b.minY * GRID;
    const w = (b.maxX - b.minX) * GRID;
    const h = (b.maxY - b.minY) * GRID;
    return a.kind === "rect" ? (
      <rect className="t-ink" x={x} y={y} width={w} height={h} style={stroke} />
    ) : (
      <ellipse
        className="t-ink"
        cx={x + w / 2}
        cy={y + h / 2}
        rx={Math.max(0, w / 2)}
        ry={Math.max(0, h / 2)}
        style={stroke}
      />
    );
  }

  const points = a.points ?? [];
  if (points.length === 0) return null;
  return (
    <g>
      <path className="t-ink" d={strokePath(points, GRID)} style={stroke} />
      {a.kind === "arrow" && points.length > 1 && (
        <path
          className="t-ink"
          d={arrowHead(points[points.length - 2], points[points.length - 1], GRID, a.weight)}
          style={stroke}
        />
      )}
    </g>
  );
}

/** A dashed box round whatever is selected, one device pixel at any zoom. */
function SelectionBox({ a }: { a: Annotation }) {
  const b = annotationBounds(a);
  const pad = 4;
  return (
    <rect
      className="t-ink-sel"
      x={b.minX * GRID - pad}
      y={b.minY * GRID - pad}
      width={(b.maxX - b.minX) * GRID + pad * 2}
      height={(b.maxY - b.minY) * GRID + pad * 2}
    />
  );
}

/** Type size from pen weight: thin, normal, headline. */
export function textSize(weight: number): number {
  return weight <= 2 ? 12 : weight <= 4 ? 16 : 24;
}

function TextBlock({ a }: { a: Annotation }) {
  const css = inkCss(a.color);
  const note = a.kind === "note";
  return (
    <div
      className={clsx(
        "t-ink-text absolute font-mono whitespace-pre-wrap break-words pointer-events-none",
        note && "t-ink-note border-2 px-1.5 py-1 overflow-hidden",
      )}
      style={{
        left: (a.x ?? 0) * GRID,
        top: (a.y ?? 0) * GRID,
        width: (a.w ?? 0) * GRID,
        ...(note ? { height: (a.h ?? 0) * GRID } : {}),
        color: note ? "var(--ink)" : css,
        fontSize: textSize(a.weight),
        lineHeight: 1.35,
        ...(note
          ? {
              borderColor: css,
              // A note is a tinted card, not a coloured block: the text on it
              // has to stay readable in both themes, so the colour goes into
              // the wash and the ink token keeps the contrast.
              background: `color-mix(in oklab, ${css} 16%, var(--paper))`,
            }
          : {}),
      }}
    >
      {a.text || (note ? "" : " ")}
    </div>
  );
}

// ------------------------------------------------------------------- editor

export interface AnnotationEditorProps {
  a: Annotation;
  onChange: (text: string) => void;
  onDone: () => void;
}

/**
 * The live editor for a text or note annotation. A real <textarea> parked in
 * world space rather than a contenteditable: it gets a caret, undo, IME and
 * selection for free, and none of that is worth reimplementing on a <div>.
 */
export function AnnotationEditor({ a, onChange, onDone }: AnnotationEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const note = a.kind === "note";
  const css = inkCss(a.color);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Caret at the end, not over the whole string: a note reopened to add one
    // line should not lose its contents to the next keystroke.
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  return (
    <textarea
      ref={ref}
      value={a.text ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation(); // the canvas' own shortcuts are not for a text field
        // Enter commits a label, ⇧Enter breaks the line — a note is a paragraph
        // and gets the opposite deal, where plain Enter is a new line.
        if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey && !note)) {
          e.preventDefault();
          onDone();
        }
      }}
      className={clsx(
        "t-ink-editor absolute font-mono resize-none outline-none border-2",
        note ? "px-1.5 py-1" : "px-0.5",
      )}
      style={{
        left: (a.x ?? 0) * GRID,
        top: (a.y ?? 0) * GRID,
        width: (a.w ?? 0) * GRID,
        height: note ? (a.h ?? 0) * GRID : Math.max(24, textSize(a.weight) * 1.6),
        color: note ? "var(--ink)" : css,
        borderColor: "var(--coral)",
        background: note
          ? `color-mix(in oklab, ${css} 16%, var(--paper))`
          : "color-mix(in oklab, var(--paper) 92%, transparent)",
        fontSize: textSize(a.weight),
        lineHeight: 1.35,
      }}
      placeholder={note ? "note…" : "label…"}
      aria-label={note ? "Note text" : "Label text"}
    />
  );
}
