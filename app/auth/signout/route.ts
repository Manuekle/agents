import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

// POST, not GET: a GET sign-out can be fired by any image tag or prefetch on a
// page the user visits, logging them out without them asking.
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
