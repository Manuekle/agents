"use client";

import { useSyncExternalStore } from "react";
import type { Agent } from "./types";

const KEY = "agents-dev:agents";
const listeners = new Set<() => void>();
let cache: Agent[] | null = null;

function read(): Agent[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
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

export function useAgents(): Agent[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => [],
  );
}
