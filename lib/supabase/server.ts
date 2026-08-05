import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_CONFIGURED, SUPABASE_KEY, SUPABASE_URL } from "./env";

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
 * The signed-in user, or null. Always `getUser()` and never `getSession()` on
 * the server — getSession reads the cookie without verifying it, so a forged
 * cookie would look like a valid login.
 */
export async function currentUser() {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
