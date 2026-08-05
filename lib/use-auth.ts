"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase/client";
import { SUPABASE_CONFIGURED } from "./supabase/env";

/**
 * Whether anyone is signed in. `null` while that is still unknown — the first
 * render, on the server and again during hydration, cannot know, and a
 * component that treats "unknown" as "signed out" flashes the wrong state at a
 * signed-in user on every navigation.
 *
 * Deliberately lighter than `usePlan()`: this asks auth and nothing else, so a
 * component that only needs to know whether to offer a link does not pull two
 * table reads with it.
 */
export function useSignedIn(): boolean | null {
  // A deploy with no Supabase credentials has no sign-in at all, and nothing
  // is gated on one — so "signed in" is the answer that keeps it usable.
  const [signedIn, setSignedIn] = useState<boolean | null>(
    SUPABASE_CONFIGURED ? null : true,
  );

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    let alive = true;

    sb.auth.getUser().then(({ data }) => {
      if (alive) setSignedIn(Boolean(data.user));
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (alive) setSignedIn(Boolean(session?.user));
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return signedIn;
}
