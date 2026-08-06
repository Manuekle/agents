"use client";

import { useSyncExternalStore } from "react";
import { supabaseBrowser } from "./supabase/client";
import { SUPABASE_CONFIGURED } from "./supabase/env";
import { readUser } from "./supabase/answer";
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
// Whether any auth answer has been applied yet — a different question to
// `state.loading`. Two answers race on start: `onAuthStateChange` fires
// INITIAL_SESSION from the stored session immediately, and `readUser` lands
// the verified one a moment later. Without this the second slipped past the
// guard below while the first was mid-read, and both tables were read twice.
let answered = false;
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
  if (!force && answered && uid === userId) return;

  answered = true;
  userId = uid;
  if (!uid) {
    set(SIGNED_OUT);
    return;
  }

  // Published the moment auth answers, before the two table reads — because
  // *being signed in* is already known here, and it is a different question to
  // "what plan are they on". Consumers that only asked the first one were
  // being handed `signedIn: false` for as long as the reads took: /mcp offered
  // a signed-in user a "Sign in to create a token" button, which is the app
  // telling them they are logged out while they are logged in.
  set({ ...state, signedIn: true, loading: true });

  const sb = supabaseBrowser();
  if (!sb) return set({ ...state, loading: false });

  const [profile, usage] = await Promise.all([
    sb.from("profiles").select("plan").eq("id", uid).maybeSingle(),
    sb.from("ai_usage").select("drafts").eq("user_id", uid).eq("month", currentMonth()).maybeSingle(),
  ]).catch(() => [null, null] as const);

  // A response for a user who has since signed out (or signed in as someone
  // else) is stale by definition and must not overwrite the live state.
  if (userId !== uid) return;

  // The reads failed, but the session did not: staying signed-in with an
  // unknown plan is the honest state, and it settles `loading` so nothing sits
  // on a spinner forever. `plan: null` renders as "no plan shown", never as
  // "signed out".
  if (!profile || !usage) {
    set({ ...state, signedIn: true, loading: false });
    return;
  }

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

  // An unknowable answer settles `loading` and says nothing else. It used to
  // fall through to SIGNED_OUT, which turns "we could not reach auth" into the
  // assertion "you are not signed in" — the wrong half of the guess to be
  // confident about, and one a signed-in user reads as having been logged out.
  //
  // Settling matters on its own: every consumer keys "still reading" off
  // `loading`, so an auth endpoint that is down would otherwise leave the usage
  // meters spinning for the rest of the session.
  void readUser(sb).then((answer) => {
    if (answer.signedIn === null) return set({ ...state, loading: false });
    return load(answer.userId);
  });
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
