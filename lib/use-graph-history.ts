"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentGraph } from "./graph";

// Undo for the canvas.
//
// The graph is not the source of truth — the `Agent` record is, and the graph
// is one field on it — so history cannot own the state. It sits beside it:
// every edit goes through `commit`, which stashes the outgoing graph and then
// hands the new one to whoever does own it.
//
// Snapshots rather than inverse operations. A graph is a few hundred small
// objects; storing a hundred of them costs less than the bug budget of writing
// an undo for every edit path, and every edit here is already immutable.

const LIMIT = 100;

// A drag fires onChange on every pointermove. Without coalescing, one gesture
// that moves a node 200px would cost 60 presses of ⌘Z to take back.
const COALESCE_MS = 600;

export interface GraphHistory {
  /** Apply an edit and record it. `tag` merges consecutive edits of a kind. */
  commit: (next: AgentGraph, tag?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Forget everything — for when a different agent is loaded into the page. */
  reset: () => void;
}

export function useGraphHistory(
  graph: AgentGraph,
  apply: (next: AgentGraph) => void,
): GraphHistory {
  // Read inside callbacks that are bound once. Keeping the live graph in a ref
  // means `commit` never goes stale and never re-creates on every keystroke.
  const current = useRef(graph);
  current.current = graph;

  const past = useRef<AgentGraph[]>([]);
  const future = useRef<AgentGraph[]>([]);
  const lastTag = useRef<{ tag: string; at: number } | null>(null);

  // Depth is what the toolbar renders from, and refs do not re-render.
  const [depth, setDepth] = useState({ past: 0, future: 0 });
  const sync = useCallback(() => {
    setDepth({ past: past.current.length, future: future.current.length });
  }, []);

  const commit = useCallback(
    (next: AgentGraph, tag?: string) => {
      const prev = current.current;
      if (next === prev) return;

      const now = Date.now();
      const merge = !!tag && lastTag.current?.tag === tag && now - lastTag.current.at < COALESCE_MS;
      if (!merge) past.current = [...past.current, prev].slice(-LIMIT);
      lastTag.current = tag ? { tag, at: now } : null;

      // A new edit after an undo abandons the redo branch — the same rule every
      // editor uses, and the only one that does not need a tree in the UI.
      future.current = [];
      apply(next);
      sync();
    },
    [apply, sync],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(current.current);
    // Whatever gesture was being coalesced is over the moment history moves.
    lastTag.current = null;
    apply(prev);
    sync();
  }, [apply, sync]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(current.current);
    lastTag.current = null;
    apply(next);
    sync();
  }, [apply, sync]);

  const reset = useCallback(() => {
    past.current = [];
    future.current = [];
    lastTag.current = null;
    sync();
  }, [sync]);

  return { commit, undo, redo, canUndo: depth.past > 0, canRedo: depth.future > 0, reset };
}
