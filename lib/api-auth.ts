import { NextResponse } from "next/server";
import { SUPABASE_CONFIGURED } from "./supabase/env";
import { supabaseServer } from "./supabase/server";

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
  const {
    data: { user },
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

  if (user) return { ok: true, userId: user.id };

  return {
    ok: false,
    response: NextResponse.json(
      { error: `Sign in to ${what}. The demo at /demo needs no account.` },
      { status: 401, headers: { "cache-control": "private, no-store" } },
    ),
  };
}
