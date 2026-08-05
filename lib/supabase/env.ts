// Supabase renamed the browser-safe key from "anon" to "publishable" partway
// through 2025, and projects created either side of that use different names.
// Accepting both means the same code works whichever one the dashboard handed
// out, instead of failing with an empty-string client.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/**
 * Auth is optional: the whole composer works signed-out against localStorage,
 * so every call site checks this rather than assuming a client exists. Without
 * it a project with no Supabase env vars would throw on first render.
 */
export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY);
