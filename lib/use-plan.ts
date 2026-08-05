"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase/client";
import type { PlanId } from "./plans";

export interface PlanState {
  /** null while unknown or signed out. */
  plan: PlanId | null;
  signedIn: boolean;
  /** Drafts used this calendar month, or null when unknown. */
  draftsUsed: number | null;
}

/**
 * The signed-in user's plan and this month's AI usage, read straight from the
 * tables. Both are RLS-guarded to the owner, so this can only ever see its
 * own row — and the values here are for display: the limits that actually bind
 * are enforced in the database.
 */
export function usePlan(): PlanState {
  const [state, setState] = useState<PlanState>({
    plan: null,
    signedIn: false,
    draftsUsed: null,
  });

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    let alive = true;

    const load = async (uid: string | null) => {
      if (!uid) {
        if (alive) setState({ plan: null, signedIn: false, draftsUsed: null });
        return;
      }

      const month = new Date();
      const firstOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
        .toISOString()
        .slice(0, 10);

      const [profile, usage] = await Promise.all([
        sb.from("profiles").select("plan").eq("id", uid).maybeSingle(),
        sb.from("ai_usage").select("drafts").eq("user_id", uid).eq("month", firstOfMonth).maybeSingle(),
      ]);

      if (!alive) return;
      setState({
        plan: ((profile.data?.plan as PlanId) ?? "free"),
        signedIn: true,
        draftsUsed: usage.data?.drafts ?? 0,
      });
    };

    sb.auth.getUser().then(({ data }) => void load(data.user?.id ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) =>
      void load(session?.user?.id ?? null),
    );
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
