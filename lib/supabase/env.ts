// Supabase renamed the browser-safe key from "anon" to "publishable" partway
// through 2025, and projects created either side of that use different names.
// Accepting both means the same code works whichever one the dashboard handed
// out, instead of failing with an empty-string client.
//
// `||` and not `??` on every one of these, and that is the whole point.
//
// An env var that is *present but empty* is the normal shape of a var that has
// been declared and not filled: a blank line in a `.env`, a Vercel project
// variable created but left empty, an exported shell var carried into `next
// dev`. `??` only falls through on null/undefined, so an empty
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY won the coalesce, the anon key sitting
// right there was never read, and SUPABASE_CONFIGURED came out false — which
// the app renders as "accounts are off on this deploy": no sign-in button, no
// account control in the nav, nothing at all where the user expects to be.
// The credentials were correct the whole time.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

/**
 * Auth is optional: the whole composer works signed-out against localStorage,
 * so every call site checks this rather than assuming a client exists. Without
 * it a project with no Supabase env vars would throw on first render.
 *
 * Because "off" is a silent, whole-feature switch, a half-configured deploy —
 * a URL with no key, or a key with no URL — is worth saying out loud rather
 * than letting it read as a deliberate opt-out.
 */
export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY);

if (!SUPABASE_CONFIGURED && (SUPABASE_URL || SUPABASE_KEY)) {
  console.warn(
    `[supabase] accounts are OFF: ${
      SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL is set but the key is empty" : "a key is set but NEXT_PUBLIC_SUPABASE_URL is empty"
    }. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or _ANON_KEY), then restart — env is read once at startup.`,
  );
}
