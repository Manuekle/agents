"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CONFIGURED, SUPABASE_KEY, SUPABASE_URL } from "./env";

// Annotated rather than inferred: `ReturnType<typeof createBrowserClient>`
// resolves the generic to its default, and every auth callback downstream then
// lands on an implicit `any`.
let cached: SupabaseClient | null = null;

/** Browser client, or null when Supabase isn't configured for this deploy. */
export function supabaseBrowser(): SupabaseClient | null {
  if (!SUPABASE_CONFIGURED) return null;
  // One instance per tab. createBrowserClient is cheap, but a fresh client per
  // call would each keep their own auth listener and refresh timer.
  cached ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return cached;
}
