import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_CONFIGURED, SUPABASE_KEY, SUPABASE_URL } from "./env";
import { readUser } from "./answer";

/** Server client for route handlers and server components. */
export async function supabaseServer() {
  if (!SUPABASE_CONFIGURED) return null;
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. Safe to swallow: the proxy
          // refreshes the session on every request, so the write this call
          // wanted to make has already happened there.
        }
      },
    },
  });
}

/**
 * The signed-in user's id, or null. Always `getUser()` and never
 * `getSession()` on the server — getSession reads the cookie without verifying
 * it, so a forged cookie would look like a valid login.
 *
 * Goes through `readUser` so an unreachable auth service does not come back
 * here indistinguishable from a deliberate sign-out. Callers that need to tell
 * those apart should use `readUser` directly; this collapses both to null, and
 * so must only ever be used where "not signed in" is the safe reading.
 */
export async function currentUserId(): Promise<string | null> {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  return (await readUser(supabase)).userId;
}
