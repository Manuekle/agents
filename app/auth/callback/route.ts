import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

/**
 * The origin to land on after the exchange.
 *
 * `x-forwarded-host` is what a load balancer in front of the app sets, and
 * behind one it is the only way to know the name the visitor actually typed —
 * `origin` there is the internal address. But it is a request header, so a host
 * this app does not answer to is a host an attacker can name: unchecked, the
 * final hop of a sign-in becomes an open redirect that carries the site's own
 * credibility into it. Trusted only when it matches the deployment's own
 * domain; anything else falls back to the origin the request actually reached.
 */
function redirectBase(origin: string, forwardedHost: string | null): string {
  // `next dev` sits on no proxy, and its origin is already the right answer.
  if (process.env.NODE_ENV === "development" || !forwardedHost) return origin;
  let expected: string;
  try {
    expected = new URL(SITE_URL).host;
  } catch {
    return origin;
  }
  return forwardedHost.toLowerCase() === expected.toLowerCase()
    ? `https://${forwardedHost}`
    : origin;
}

// Where GitHub sends the user back. Exchanges the one-time code for a session
// cookie, then returns them to wherever they started.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Only ever redirect to our own paths — an absolute `next` would turn this
  // into an open redirect that borrows the site's credibility.
  const raw = searchParams.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  if (code) {
    const supabase = await supabaseServer();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const base = redirectBase(origin, request.headers.get("x-forwarded-host"));
        return NextResponse.redirect(`${base}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=1`);
}
