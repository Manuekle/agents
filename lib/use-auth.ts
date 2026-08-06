"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase/client";
import { SUPABASE_CONFIGURED } from "./supabase/env";
import { readUser } from "./supabase/answer";

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

    // `readUser` and not `getUser().then(d => Boolean(d.data.user))`: an
    // unreachable auth endpoint answers with a null user and an error, and
    // reading only the user turned every network blip into a sign-out. On an
    // unknowable answer this stays `null`, and every consumer treats unknown
    // as "do not gate" — so the app looks normal rather than locking a
    // signed-in user out of their own nav.
    void readUser(sb).then((answer) => {
      if (alive && answer.signedIn !== null) setSignedIn(answer.signedIn);
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
