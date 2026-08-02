"use client";

import { useSyncExternalStore } from "react";
import type { Agent } from "./types";

const KEY = "agents-dev:agents";
const listeners = new Set<() => void>();
let cache: Agent[] | null = null;

// useSyncExternalStore compares snapshots by identity, so every no-agents path
// must hand back this same array — a fresh `[]` reads as "changed" each call
// and React loops.
const EMPTY: Agent[] = [];

function read(): Agent[] {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    cache = [];
  }
  return cache!;
}

function write(next: Agent[]) {
  cache = next;
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function saveAgent(agent: Agent) {
  const list = read();
  const idx = list.findIndex((a) => a.id === agent.id);
  if (idx >= 0) {
    const copy = [...list];
    copy[idx] = agent;
    write(copy);
  } else {
    write([agent, ...list]);
  }
}

export function deleteAgent(id: string) {
  write(read().filter((a) => a.id !== id));
}

// Hoisted so their identity is stable across renders — an inline subscribe
// makes React tear down and re-add the listener on every render.
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function readServer(): Agent[] {
  return EMPTY;
}

export function useAgents(): Agent[] {
  return useSyncExternalStore(subscribe, read, readServer);
}
