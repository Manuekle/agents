"use client";

import { useSyncExternalStore } from "react";
import type { Agent } from "./types";
import { normalizeGraph } from "./graph";
import { supabaseBrowser } from "./supabase/client";

// Agents live in Supabase. Reads stay synchronous: the DB hydrates into an
// in-memory cache, and writes update the cache first and persist after.
//
// The localStorage half is now a migration path rather than a way to work.
// The composer needs an account (see lib/access.ts), so nothing new is written
// locally — but agents composed before that was true are still sitting in
// people's browsers, and the upsert in applyUser below is what carries them
// into the account on first sign-in. Removing it would strand them.

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
let lastError: string | null = null;

function emit() {
  for (const l of listeners) l();
}

function setError(message: string | null) {
  if (lastError === message) return;
  lastError = message;
  emit();
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
  graph: unknown;
  mascot: string;
  accent: string;
  created_at: string;
};

function toAgent(r: Row): Agent {
  const base: Agent = {
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
  // Rows written before the canvas existed have no graph; normalizeGraph
  // builds one from the flat picks rather than the app having to branch on
  // "does this agent have a structure yet" everywhere downstream.
  return { ...base, graph: normalizeGraph(r.graph, base) };
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
    graph: a.graph ?? null,
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
    if (!Array.isArray(parsed) || parsed.length === 0) return EMPTY;
    // Same reason as toAgent: anything saved before the canvas has no graph,
    // and localStorage is where most first-time agents live.
    return (parsed as Agent[]).map((a) => ({ ...a, graph: normalizeGraph(a.graph, a) }));
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
    else {
      // Silently keeping them local was the old behaviour, and it looked
      // exactly like signing in had eaten the user's agents: the account's
      // list renders, theirs is not in it, and nothing says why. The usual
      // cause is the plan's agent cap refusing a batch bigger than the plan.
      setError(
        error.message.includes("agent limit")
          ? `Couldn't move ${local.length} agent${local.length === 1 ? "" : "s"} from this browser into your account — that would pass your plan's agent limit. They are still here; see /pricing.`
          : `Couldn't move ${local.length} agent${local.length === 1 ? "" : "s"} from this browser into your account. They are still saved on this device.`,
      );
    }
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
  setError(null);

  const sb = userId ? supabaseBrowser() : null;
  if (!sb || !userId) return;

  // Optimistic, but not blindly so: the plan's agent cap is a database
  // trigger, so a save can be refused after the cache already showed it
  // saved. Rolling back is the difference between "you hit your limit" and
  // an agent that quietly disappears on the next reload.
  void sb
    .from("agents")
    .upsert(toRow(agent, userId))
    .then(({ error }) => {
      if (!error) return;
      persist(list);
      setError(
        error.message.includes("agent limit")
          ? "You've reached your plan's agent limit — see /pricing."
          : "Couldn't save to your account. Your changes are still here.",
      );
    });
}

export function deleteAgent(id: string) {
  const list = read();
  persist(list.filter((a) => a.id !== id));

  const sb = userId ? supabaseBrowser() : null;
  if (!sb || !userId) return;

  void sb
    .from("agents")
    .delete()
    .eq("id", id)
    .then(({ error }) => {
      if (error) {
        persist(list);
        setError("Couldn't delete from your account.");
      }
    });
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

/** Last write failure, e.g. hitting the plan's agent cap. */
export function useStoreError(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => lastError,
    () => null,
  );
}
