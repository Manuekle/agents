import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_CONFIGURED, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

// Next 16 renamed Middleware to Proxy; same file-convention slot, root-level.
//
// This only refreshes the auth cookie. It deliberately does NOT gate routes:
// the composer, registry and MCP docs all work signed-out against
// localStorage, and redirecting them to a login page would wall off the parts
// of the site that need no account at all. Ownership is enforced by RLS in the
// database, which a proxy check could never substitute for anyway.

export async function proxy(request: NextRequest) {
  if (!SUPABASE_CONFIGURED) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Nothing may run between createServerClient and getUser(): the call is what
  // rotates the refresh token, and work in between has been the usual cause of
  // users being logged out at random.
  await supabase.auth.getUser();

  // A shared cache holding a response carrying someone's session cookie would
  // hand that session to the next visitor.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
