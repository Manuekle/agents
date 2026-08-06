"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { Panel, PixelButton, Badge, Notice, PageLoading } from "@/components/ui";
import { GitHubIcon, ArrowRightIcon } from "@/components/icons";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/env";
import { useSignedIn } from "@/lib/use-auth";

function Login() {
  const params = useSearchParams();
  // Where to land afterwards. Only ever one of our own paths: an absolute
  // `next` would make this an open redirect wearing the site's credibility,
  // and the callback route rejects one too — this is the near half of that.
  const raw = params.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  const [busy, setBusy] = useState(false);
  // `?error=1` is what /auth/callback redirects here with when the code could
  // not be exchanged for a session. Nothing read it before, so a failed OAuth
  // round trip landed the user back on a page that looked like they had simply
  // never pressed the button.
  const [error, setError] = useState<string | null>(
    params.get("error") ? "That sign-in didn't complete. Try again." : null,
  );

  // Already signed in — usually someone who followed a stale /login link, or
  // came back to a tab that signed in elsewhere. Offering the button again
  // would send them through GitHub for a session they already have.
  const signedIn = useSignedIn();

  const signIn = async () => {
    const sb = supabaseBrowser();
    if (!sb) return;
    setBusy(true);
    setError(null);

    const { error } = await sb.auth.signInWithOAuth({
      provider: "github",
      options: {
        // Comes back to our own callback, which trades the code for a session
        // and then returns the user to where they were.
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setError(error.message);
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mx-auto max-w-md px-5 py-12">
        <h1 className="font-pixel text-xs sm:text-sm mb-1">SIGN_IN</h1>
        <Panel className="p-6 mt-6 text-center">
          <div className="grain mascot-stage relative pixel-border-sm p-6 inline-block">
            <Mascot state="coffee" size={88} />
          </div>

          <h2 className="font-sans font-bold text-lg mt-4">Keep your agents</h2>
          <p className="font-mono text-xs text-muted mt-1.5 leading-relaxed">
            The composer, the AI drafts and the MCP tokens all belong to an
            account. Signing in is free, and anything you composed on this
            browser before comes with you.
          </p>

          {SUPABASE_CONFIGURED && signedIn === null ? (
            // Auth has not answered yet. Showing the GitHub button here and
            // replacing it with "Signed in" a beat later is the same flicker
            // the nav's AuthButton already guards against, and on this page it
            // is the whole content of the card.
            <div className="mt-5 h-[42px] border-2 border-line bg-stone grid place-items-center">
              <span className="font-mono text-[10px] text-muted" role="status">
                checking your session…
              </span>
            </div>
          ) : SUPABASE_CONFIGURED && signedIn ? (
            <div className="mt-5">
              <Badge tone="coral">Signed in</Badge>
              <p className="font-mono text-[11px] text-muted mt-2 leading-relaxed">
                You already have a session on this browser. Carry on where you
                were headed — sign out from the nav if you meant to switch
                accounts.
              </p>
              <Link href={next} className="block mt-4">
                <PixelButton variant="coral" className="w-full">
                  <span className="inline-flex items-center gap-1.5">
                    {next === "/" ? "Go home" : `Continue to ${next}`}
                    <ArrowRightIcon size={12} />
                  </span>
                </PixelButton>
              </Link>
            </div>
          ) : SUPABASE_CONFIGURED ? (
            <>
              <PixelButton
                variant="coral"
                onClick={signIn}
                disabled={busy}
                className="mt-5 w-full"
              >
                <span className="inline-flex items-center gap-2">
                  <GitHubIcon size={14} />
                  {busy ? "Redirecting…" : "Continue with GitHub"}
                </span>
              </PixelButton>
              {error && (
                <Notice className="mt-3 text-left">{error}</Notice>
              )}
            </>
          ) : (
            // Says what is actually wrong instead of showing a button that
            // cannot work: this deploy has no Supabase credentials.
            <div className="mt-5">
              <Badge tone="coral">Not configured</Badge>
              <p className="font-mono text-[11px] text-muted mt-2 leading-relaxed">
                Accounts are off on this deploy — set{" "}
                <code className="text-coral-text">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code className="text-coral-text">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
                to switch them on. With no way to sign in there is nothing to
                gate, so the composer stays open on this deploy.
              </p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoading what="sign-in" />}>
      <Login />
    </Suspense>
  );
}
