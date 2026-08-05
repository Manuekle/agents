"use client";

import { useSyncExternalStore } from "react";
import { supabaseBrowser } from "./supabase/client";
import { SUPABASE_CONFIGURED } from "./supabase/env";
import type { PlanId } from "./plans";

export interface PlanState {
  /** null while unknown or signed out. */
  plan: PlanId | null;
  signedIn: boolean;
  /** Drafts used this calendar month, or null when unknown. */
  draftsUsed: number | null;
  /** True until the first read for the current user lands. */
  loading: boolean;
}

/**
 * The signed-in user's plan and this month's AI usage, read straight from the
 * tables. Both are RLS-guarded to the owner, so this can only ever see its
 * own row — and the values here are for display: the limits that actually bind
 * are enforced in the database.
 *
 * One module-level store rather than a hook with its own effect, because the
 * plan is now read in four places at once (the nav's usage pill, the composer,
 * the onboarding quota line, the pricing cards). A per-component effect meant
 * one `profiles` + one `ai_usage` round trip *each*, on every mount.
 */

// The state the server renders and the client hydrates with. Both must agree,
// so "unknown" is the shared starting point rather than "signed out".
const INITIAL: PlanState = { plan: null, signedIn: false, draftsUsed: null, loading: true };
const SIGNED_OUT: PlanState = { plan: null, signedIn: false, draftsUsed: null, loading: false };

let state: PlanState = INITIAL;
let userId: string | null = null;
let started = false;
const listeners = new Set<() => void>();

function set(next: PlanState) {
  state = next;
  for (const l of listeners) l();
}

/** The first of the current month, UTC — the key `ai_usage` rows are stored on. */
function currentMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

async function load(uid: string | null, force = false) {
  // `onAuthStateChange` fires on every token refresh and on window focus, all
  // of them reporting the same user. Re-reading two tables each time is two
  // round trips for an answer we already have, so only a real change (or an
  // explicit refresh after spending quota) goes to the network.
  if (!force && uid === userId && !state.loading) return;

  userId = uid;
  if (!uid) {
    set(SIGNED_OUT);
    return;
  }

  const sb = supabaseBrowser();
  if (!sb) return;

  const [profile, usage] = await Promise.all([
    sb.from("profiles").select("plan").eq("id", uid).maybeSingle(),
    sb.from("ai_usage").select("drafts").eq("user_id", uid).eq("month", currentMonth()).maybeSingle(),
  ]);

  // A response for a user who has since signed out (or signed in as someone
  // else) is stale by definition and must not overwrite the live state.
  if (userId !== uid) return;

  set({
    plan: (profile.data?.plan as PlanId) ?? "free",
    signedIn: true,
    draftsUsed: usage.data?.drafts ?? 0,
    loading: false,
  });
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  const sb = supabaseBrowser();
  if (!sb) {
    // No Supabase on this deploy: there are no accounts, so there is no plan
    // to report and nothing is metered. Settling here stops every consumer
    // sitting on a loading state that will never resolve.
    set(SIGNED_OUT);
    return;
  }

  // `.catch` is not optional here: every consumer keys "still reading" off
  // `loading`, so an auth endpoint that is down would otherwise leave the
  // usage meters spinning for the rest of the session.
  void sb.auth
    .getUser()
    .then(({ data }) => load(data.user?.id ?? null))
    .catch(() => set(SIGNED_OUT));
  sb.auth.onAuthStateChange((_e, session) => void load(session?.user?.id ?? null));
}

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Re-read plan and usage. Called after anything that spends quota — a hosted
 * draft — so the counter moves without waiting for a reload.
 */
export function refreshPlan() {
  if (userId) void load(userId, true);
}

export function usePlan(): PlanState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
}

/** Whether accounts exist on this deploy at all. */
export const PLANS_ENABLED = SUPABASE_CONFIGURED;
