"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { Panel, PixelButton } from "@/components/ui";

// The route-level boundary. Every page in this app is a client component, so
// an exception anywhere in one — a bad share payload, a registry response in a
// shape nobody expected — used to take the whole route down to a blank screen
// in production. This is what it lands on instead: the nav and footer stay,
// and `reset` re-renders the segment without a full reload.
//
// Errors from the root layout itself cannot reach here; ./global-error.tsx
// catches those.

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The only record of what happened: there is no error reporter wired up,
    // and a boundary that swallows the exception makes the bug unfindable.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <Panel className="p-8 text-center">
        <div className="grain mascot-stage relative pixel-border-sm p-6 inline-block">
          <Mascot state="sleeping" size={96} animate={false} />
        </div>
        <h1 className="font-pixel text-sm mt-5">SOMETHING_BROKE</h1>
        <p className="mt-3 font-mono text-xs text-ink-soft leading-relaxed">
          This page hit an error. Your saved agents are untouched — they live in
          your account, not in this view.
        </p>

        {/* The digest is the only handle on a production stack trace, which is
            stripped from the client. Worth showing so a report can name it. */}
        {error.digest && (
          <p className="mt-3 font-mono text-[10px] text-muted">
            reference: <code>{error.digest}</code>
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <PixelButton variant="coral" onClick={reset}>
            Try again
          </PixelButton>
          <Link href="/">
            <PixelButton variant="ghost">Back home</PixelButton>
          </Link>
        </div>
      </Panel>
    </div>
  );
}
