"use client";

import { useEffect, useRef } from "react";
import { LABEL_LINE, LABEL_SIZE, type Annotation } from "@/lib/annotations";
import { GRID } from "@/lib/graph";

// The label layer.
//
// Real text in the DOM rather than <text> in an <svg>: it wraps, it selects,
// and it reads out to a screen reader like text instead of like a path.
//
// The layer is `pointer-events: none`. Hit-testing happens in the canvas
// against the model (see `hitAnnotation`), so a label parked over a node never
// swallows the click meant for it.

export interface AnnotationLayerProps {
  annotations: Annotation[];
  selected?: string | null;
  /** Rendered as an editor by the canvas, so the static copy stays out of it. */
  editingId?: string | null;
}

export function AnnotationLayer({ annotations, selected, editingId }: AnnotationLayerProps) {
  return (
    <>
      {annotations.map((a) =>
        a.id === editingId ? null : <Label key={a.id} a={a} selected={a.id === selected} />,
      )}
    </>
  );
}

function Label({ a, selected }: { a: Annotation; selected: boolean }) {
  return (
    <div
      className="t-ink-text absolute font-mono whitespace-pre-wrap break-words pointer-events-none"
      data-selected={selected ? "" : undefined}
      style={{
        left: a.x * GRID,
        top: a.y * GRID,
        width: a.w * GRID,
        color: "var(--ink)",
        fontSize: LABEL_SIZE,
        lineHeight: LABEL_LINE,
      }}
    >
      {a.text || " "}
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
 * The live editor for a label. A real <textarea> parked in world space rather
 * than a contenteditable: it gets a caret, undo, IME and selection for free,
 * and none of that is worth reimplementing on a <div>.
 */
export function AnnotationEditor({ a, onChange, onDone }: AnnotationEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Caret at the end, not over the whole string: a label reopened to add a
    // word should not lose its contents to the next keystroke.
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  return (
    <textarea
      ref={ref}
      value={a.text}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation(); // the canvas' own shortcuts are not for a text field
        // Enter commits, ⇧Enter breaks the line.
        if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
          e.preventDefault();
          onDone();
        }
      }}
      className="t-ink-editor absolute font-mono resize-none outline-none border-2 px-0.5"
      style={{
        left: a.x * GRID,
        top: a.y * GRID,
        width: a.w * GRID,
        height: a.h * GRID,
        color: "var(--ink)",
        borderColor: "var(--coral)",
        background: "color-mix(in oklab, var(--paper) 92%, transparent)",
        fontSize: LABEL_SIZE,
        lineHeight: LABEL_LINE,
      }}
      placeholder="label…"
      aria-label="Label text"
    />
  );
}
