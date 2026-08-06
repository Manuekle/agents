import { NextResponse } from "next/server";
import { SUPABASE_CONFIGURED } from "./supabase/env";
import { supabaseServer } from "./supabase/server";
import { readUser } from "./supabase/answer";

// The account check that actually binds.
//
// proxy.ts turns signed-out browsers away before they reach these routes, but a
// matcher change or a refactor can silently drop a path out of its coverage,
// and nothing about a proxy stops a direct POST from curl. The Next docs are
// explicit that the check belongs as close to the work as possible; this is
// that check, and the proxy is the redirect.

export type Gate =
  | { ok: true; userId: string | null }
  | { ok: false; response: NextResponse };

/**
 * Requires a signed-in account. `userId` is null only on a deploy with no
 * Supabase credentials at all — there is no way to sign in on one of those, so
 * gating it would lock the owner out of their own instance.
 */
export async function requireAccount(what: string): Promise<Gate> {
  if (!SUPABASE_CONFIGURED) return { ok: true, userId: null };

  const supabase = await supabaseServer();
  if (!supabase) return deny(what);

  const { signedIn, userId } = await readUser(supabase);
  if (signedIn === true && userId) return { ok: true, userId };

  // Unknown is still refused — this is the check that binds, and letting a
  // request through because auth was unreachable would spend real money for
  // nobody. What changes is what it *says*: a 401 reading "Sign in to draft an
  // agent" is a lie told to someone who is signed in, and the browser shows it
  // verbatim. This says the true thing and marks it retryable, so a client can
  // tell "you need an account" apart from "try that again".
  if (signedIn === null) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Couldn't check your session just now. Try that again in a moment." },
        {
          status: 503,
          headers: { "cache-control": "private, no-store", "retry-after": "5" },
        },
      ),
    };
  }

  return deny(what);
}

function deny(what: string): Gate {
  return {
    ok: false,
    response: NextResponse.json(
      { error: `Sign in to ${what}. The demo at /demo needs no account.` },
      { status: 401, headers: { "cache-control": "private, no-store" } },
    ),
  };
}
