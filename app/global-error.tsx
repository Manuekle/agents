"use client";

import { useEffect } from "react";

// The last resort: an error thrown by the root layout replaces the whole
// document, so this file has to ship its own <html> and <body> and cannot use
// anything from the layout — no fonts, no theme attribute, no globals.css.
// That is why it is plain inline style rather than the app's components: they
// would render unstyled here and look more broken than this does.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          background: "#f7f5f0",
          color: "#1a1713",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <div style={{ maxWidth: "34rem", border: "2px solid #1a1713", padding: "1.5rem" }}>
          <h1 style={{ fontSize: "0.9rem", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            agents — something broke
          </h1>
          <p style={{ fontSize: "0.75rem", lineHeight: 1.7, marginTop: "0.75rem" }}>
            The app failed to start. Reloading usually clears it; if it does
            not, the deploy is having a bad time and nothing you did caused it.
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.7rem", marginTop: "0.75rem", opacity: 0.7 }}>
              reference: {error.digest}
            </p>
          )}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                font: "inherit",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                padding: "0.5rem 1rem",
                border: "2px solid #1a1713",
                background: "#ef5c47",
                color: "#f7f5f0",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                fontSize: "0.7rem",
                textTransform: "uppercase",
                padding: "0.5rem 1rem",
                border: "2px solid #1a1713",
                background: "#f7f5f0",
                color: "#1a1713",
                textDecoration: "none",
              }}
            >
              Back home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
