import { isAuthRetryableFetchError, isAuthSessionMissingError } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// The one place that decides what "are you signed in" means.
//
// `getUser()` does not throw when the answer is bad — it resolves with
// `{ data: { user: null }, error }`, and every caller in this app used to read
// only the first half. So a Supabase outage, a dropped Wi-Fi, or a 502 from the
// auth endpoint all arrived looking exactly like a deliberate sign-out, and the
// app acted on it: padlocks appeared in the nav, the home page said "Agents
// live in an account. Sign in and this fills up", /mcp offered a sign-in
// button, and the proxy redirected the composer to /demo. All of it aimed at
// someone who was, and stayed, signed in.
//
// A `try/catch` does not fix that either — there is nothing to catch.
//
// The distinction that matters is not error / no error, it is: does this
// response tell us something about the session, or only about the network?

/** Signed in, signed out, or — the case that was missing — not knowable yet. */
export interface AuthAnswer {
  /** `null` means "could not tell". Never treat it as signed out. */
  signedIn: boolean | null;
  /** The verified user, for the two call sites that render their profile. */
  user: User | null;
  userId: string | null;
}

const UNKNOWN: AuthAnswer = { signedIn: null, user: null, userId: null };
const SIGNED_OUT: AuthAnswer = { signedIn: false, user: null, userId: null };

/**
 * Ask an already-created client who the user is, and grade the answer.
 *
 * Always `getUser()`, never `getSession()`: getSession reads the cookie
 * without verifying it, so a forged one would read as a valid login.
 */
export async function readUser(supabase: SupabaseClient): Promise<AuthAnswer> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error) return { signedIn: Boolean(user), user, userId: user?.id ?? null };

    // "There is no session here" — the ordinary signed-out answer, and the one
    // that arrives for every first-time visitor. This is a real answer.
    if (isAuthSessionMissingError(error)) return SIGNED_OUT;

    // The request never got a usable reply: offline, DNS, CORS, a hung
    // endpoint. Says nothing about the session.
    if (isAuthRetryableFetchError(error)) return UNKNOWN;

    // Anything 5xx is the auth service having a bad time, not a verdict on the
    // user. `status` is absent on errors that never reached the server.
    if (!error.status || error.status >= 500) return UNKNOWN;

    // What is left is the server answering, with a status, that this session is
    // no good — expired past refresh, revoked, malformed. Signed out is the
    // correct and safe reading, and the one that lets the sign-in page do its
    // job instead of leaving the user stuck in "checking…".
    return SIGNED_OUT;
  } catch {
    // getUser is not documented to throw, but a client constructed against a
    // broken environment can. Same reading as an unreachable endpoint.
    return UNKNOWN;
  }
}
