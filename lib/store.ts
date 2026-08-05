"use client";

import { useSyncExternalStore } from "react";
import type { Agent } from "./types";
import { supabaseBrowser } from "./supabase/client";

// Agents live in Supabase once you sign in and in localStorage until then, so
// the composer works with no account at all. Reads stay synchronous either
// way: the DB hydrates into the same in-memory cache the local path uses, and
// writes update the cache first and persist after.

const KEY = "agents-dev:agents";
const listeners = new Set<() => void>();

// useSyncExternalStore compares snapshots by identity, so every no-agents path
// must hand back this same array — a fresh `[]` reads as "changed" each call
// and React loops.
const EMPTY: Agent[] = [];

let cache: Agent[] | null = null;
let userId: string | null = null;
let loading = false;
let started = false;

function emit() {
  for (const l of listeners) l();
}

// ---- row mapping ----------------------------------------------------------

type Row = {
  id: string;
  name: string;
  role: string;
  system_prompt: string;
  target: string;
  model: string;
  temperature: number;
  skills: Agent["skills"];
  mascot: string;
  accent: string;
  created_at: string;
};

function toAgent(r: Row): Agent {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    systemPrompt: r.system_prompt,
    target: r.target as Agent["target"],
    model: r.model,
    temperature: r.temperature,
    skills: Array.isArray(r.skills) ? r.skills : [],
    mascot: r.mascot as Agent["mascot"],
    accent: r.accent,
    createdAt: new Date(r.created_at).getTime(),
  };
}

function toRow(a: Agent, uid: string) {
  return {
    user_id: uid,
    id: a.id,
    name: a.name,
    role: a.role,
    system_prompt: a.systemPrompt,
    target: a.target,
    model: a.model,
    temperature: a.temperature,
    skills: a.skills,
    mascot: a.mascot,
    accent: a.accent,
    created_at: new Date(a.createdAt).toISOString(),
  };
}

// ---- local storage --------------------------------------------------------

function readLocal(): Agent[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeLocal(next: Agent[]) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
}

// ---- auth-driven hydration ------------------------------------------------

/**
 * Called once, lazily, from the first `useAgents()` on the client. Signing in
 * pulls the account's agents; signing out drops back to whatever is local.
 */
function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  const sb = supabaseBrowser();
  if (!sb) return; // no Supabase configured — localStorage is the whole story

  sb.auth.getUser().then(({ data }) => void applyUser(data.user?.id ?? null));
  sb.auth.onAuthStateChange((_event, session) => {
    void applyUser(session?.user?.id ?? null);
  });
}

async function applyUser(id: string | null) {
  if (id === userId) return;
  userId = id;

  if (!id) {
    // Signed out: the account's agents are not ours to keep in memory.
    cache = null;
    emit();
    return;
  }

  loading = true;
  emit();

  const sb = supabaseBrowser();
  if (!sb) return;

  // Anything composed before signing in comes along, so a first login doesn't
  // look like it wiped the user's work.
  const local = readLocal();
  if (local.length > 0) {
    const { error } = await sb.from("agents").upsert(local.map((a) => toRow(a, id)));
    // Only clear once the rows are safely in the account — a failed upsert
    // followed by a clear would destroy the only copy.
    if (!error) writeLocal([]);
  }

  const { data } = await sb
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });

  cache = data && data.length > 0 ? (data as Row[]).map(toAgent) : EMPTY;
  loading = false;
  emit();
}

// ---- public API -----------------------------------------------------------

function read(): Agent[] {
  if (cache) return cache;
  if (userId) return EMPTY; // signed in, still hydrating
  // Parsed once into the cache, never per call: useSyncExternalStore compares
  // snapshots by identity, and a fresh JSON.parse each read is a new array
  // every time — which React sees as an endless stream of changes.
  cache = readLocal();
  return cache;
}

function persist(next: Agent[]) {
  cache = next.length > 0 ? next : EMPTY;
  if (!userId) writeLocal(next);
  emit();
}

export function saveAgent(agent: Agent) {
  const list = read();
  const idx = list.findIndex((a) => a.id === agent.id);
  const next = idx >= 0 ? list.map((a) => (a.id === agent.id ? agent : a)) : [agent, ...list];
  persist(next);

  const sb = userId ? supabaseBrowser() : null;
  // Fire-and-forget: the cache already reflects the change, so awaiting here
  // would only make the button feel slow.
  if (sb && userId) void sb.from("agents").upsert(toRow(agent, userId));
}

export function deleteAgent(id: string) {
  persist(read().filter((a) => a.id !== id));

  const sb = userId ? supabaseBrowser() : null;
  if (sb && userId) void sb.from("agents").delete().eq("id", id);
}

// Hoisted so their identity is stable across renders — an inline subscribe
// makes React tear down and re-add the listener on every render.
function subscribe(cb: () => void) {
  start();
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

/** True while an account's agents are still being fetched. */
export function useAgentsLoading(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => loading,
    () => false,
  );
}
