import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
        const forwardedHost = request.headers.get("x-forwarded-host");
        const base =
          process.env.NODE_ENV === "development"
            ? origin
            : forwardedHost
              ? `https://${forwardedHost}`
              : origin;
        return NextResponse.redirect(`${base}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=1`);
}
