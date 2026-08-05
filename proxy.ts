import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_CONFIGURED, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { DEMO_PATH, gateReason, requiresAccount } from "@/lib/access";

// Next 16 renamed Middleware to Proxy; same file-convention slot, root-level.
//
// Two jobs, in this order:
//
//   1. Refresh the auth cookie. Server Components cannot set cookies, so
//      without this hop a token that expires mid-visit is never renewed and the
//      user is quietly signed out on their next navigation.
//   2. Turn a signed-out visitor away from the pages that need an account,
//      sending them to /demo — a pre-loaded simulation of the composer — rather
//      than to a login wall with nothing behind it.
//
// The gate is an optimistic check in the sense the Next docs mean: it decides
// what gets *rendered*. Every route it protects checks again for itself (see
// lib/api-auth.ts), and ownership of the data underneath is enforced by RLS in
// the database, which a proxy check could never substitute for.

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
  //
  // getUser, never getSession: getSession trusts the cookie as it finds it, so
  // a forged one would read as a valid login — which matters now that this
  // answer decides whether a page is served at all.
  let signedIn = false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  } catch {
    // Auth unreachable (refresh endpoint down): serve the page anyway instead
    // of 500ing the whole site. The session cookie is left as-is and the next
    // request retries the refresh. A gated page falls through to the demo,
    // which is the safe direction to fail in.
  }

  // A shared cache holding a response carrying someone's session cookie would
  // hand that session to the next visitor.
  response.headers.set("Cache-Control", "private, no-store");

  const { pathname } = request.nextUrl;
  if (signedIn || !requiresAccount(pathname)) return response;

  // An API caller gets a status it can act on; a browser gets the demo.
  if (pathname.startsWith("/api/")) {
    return carryCookies(
      NextResponse.json(
        { error: `Sign in to use this — it ${gateReason(pathname)}.` },
        { status: 401, headers: { "cache-control": "private, no-store" } },
      ),
      response,
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = DEMO_PATH;
  url.search = "";
  // Where they were headed, so the demo can send them straight back there once
  // they sign in instead of dropping them on the home page.
  url.searchParams.set("from", pathname);
  return carryCookies(NextResponse.redirect(url), response);
}

/**
 * Move the refreshed session onto a response we are returning *instead of* the
 * one Supabase wrote its cookies to. Dropping them is the classic proxy bug:
 * the refresh happens, the new token is thrown away, and the user is logged out
 * at random — the exact failure this file exists to prevent.
 */
function carryCookies(target: NextResponse, source: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|webmanifest|json)$).*)",
  ],
};
