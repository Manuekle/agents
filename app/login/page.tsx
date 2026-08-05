"use client";

import { useState } from "react";
import { Nav, PoweredBy } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Mascot } from "@/components/Mascot";
import { Panel, PixelButton, Badge } from "@/components/ui";
import { GitHubIcon } from "@/components/icons";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/env";

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });

    if (error) {
      setError(error.message);
      setBusy(false);
    }
  };

  return (
    <div>
      <Nav />
      <div className="mx-auto max-w-md px-5 py-12">
        <h1 className="font-pixel text-xs sm:text-sm mb-1">SIGN_IN</h1>
        <PoweredBy />

        <Panel className="p-6 mt-6 text-center">
          <div className="grain mascot-stage relative pixel-border-sm p-6 inline-block">
            <Mascot state="coffee" size={88} />
          </div>

          <h2 className="font-sans font-bold text-lg mt-4">Keep your agents</h2>
          <p className="font-mono text-xs text-muted mt-1.5 leading-relaxed">
            Signing in saves your agents to your account instead of this
            browser. Anything you have already composed comes with you.
          </p>

          {SUPABASE_CONFIGURED ? (
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
                <p className="mt-3 font-mono text-[11px] text-coral-deep border-2 border-coral-deep px-3 py-2">
                  {error}
                </p>
              )}
            </>
          ) : (
            // Says what is actually wrong instead of showing a button that
            // cannot work: this deploy has no Supabase credentials.
            <div className="mt-5">
              <Badge tone="coral">Not configured</Badge>
              <p className="font-mono text-[11px] text-muted mt-2 leading-relaxed">
                Accounts are off on this deploy — set{" "}
                <code className="text-coral">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code className="text-coral">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
                to switch them on. The composer works signed-out either way.
              </p>
            </div>
          )}
        </Panel>
      </div>
      <Footer />
    </div>
  );
}
