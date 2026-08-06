"use client";

import { useEffect } from "react";

// The last resort: an error thrown by the root layout replaces the whole
// document, so this file has to ship its own <html> and <body> and gets none of
// the layout's work — no next/font, no globals.css, no theme attribute, and no
// app components, which would render unstyled here.
//
// It used to answer that by giving up on the design entirely: a bare cream box
// with a system font, which is the one screen in the app that does not look
// like the app, shown at the exact moment a user is deciding whether the thing
// is broken. Everything the design needs is inlined below instead — the same
// palette, the same 2px pixel border with its hard offset shadow, the same
// mascot from /public, the same uppercase mono voice.
//
// Two things are re-implemented rather than imported, and both are deliberate:
//
//   * the palette, as one <style> block. It carries the same values as
//     globals.css and both ways of choosing a theme — the `theme` key the
//     ThemeToggle writes, applied by the script below, and a
//     prefers-color-scheme fallback for when localStorage is unreadable.
//   * the mascot, as a plain <img> on /mascots/sleeping.png. A static file
//     needs no JS, so it survives whatever took the layout down.

const PALETTE = `
:root {
  color-scheme: light;
  --paper: #f7f5f0;
  --stone: #eae4d7;
  --ink: #17150f;
  --ink-soft: #3c3629;
  --muted: #6b6354;
  --line: #17150f;
  --shadow: rgba(23, 21, 15, 0.28);
  --coral: #b8371f;
  --on-coral: #f7f5f0;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { color-scheme: dark; --paper: #15130f; --stone: #221f19; --ink: #e9e3d6; --ink-soft: #bdb6a6; --muted: #9a9182; --line: #3b352b; --shadow: rgba(0, 0, 0, 0.55); --coral: #f4705c; --on-coral: #15130f; }
}
:root[data-theme="dark"] { color-scheme: dark; --paper: #15130f; --stone: #221f19; --ink: #e9e3d6; --ink-soft: #bdb6a6; --muted: #9a9182; --line: #3b352b; --shadow: rgba(0, 0, 0, 0.55); --coral: #f4705c; --on-coral: #15130f; }

* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 2rem;
  background: var(--paper); color: var(--ink);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
.ge-panel {
  max-width: 34rem; width: 100%; text-align: center; padding: 2rem 1.75rem;
  background: var(--paper); border: 2px solid var(--line); box-shadow: 4px 4px 0 0 var(--shadow);
}
.ge-stage {
  display: inline-block; padding: 1.25rem; background: var(--stone);
  border: 2px solid var(--line); box-shadow: 2px 2px 0 0 var(--shadow);
}
/* The sprite is pixel art: nearest-neighbour, never resampled into mush. */
.ge-stage img { display: block; width: 88px; height: 88px; image-rendering: pixelated; }
.ge-title { margin: 1.25rem 0 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.12em; }
.ge-body { margin: 0.75rem 0 0; font-size: 0.75rem; line-height: 1.75; color: var(--ink-soft); }
.ge-ref { margin: 0.75rem 0 0; font-size: 0.65rem; color: var(--muted); }
.ge-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; margin-top: 1.5rem; }
.ge-btn {
  font: inherit; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em;
  padding: 0.6rem 1.1rem; border: 2px solid var(--line); box-shadow: 2px 2px 0 0 var(--shadow);
  text-decoration: none; cursor: pointer; transition: translate 150ms, box-shadow 150ms;
}
/* Same press as PixelButton: the button moves into its own shadow. */
.ge-btn:active { translate: 2px 2px; box-shadow: none; }
.ge-btn--coral { background: var(--coral); color: var(--on-coral); }
.ge-btn--ghost { background: var(--paper); color: var(--ink); }
@media (prefers-reduced-motion: reduce) { .ge-btn { transition: none; } }
`;

/**
 * Apply the theme the user actually chose.
 *
 * Not the root layout's `<script>` trick: that one runs during HTML parsing on
 * a hard navigation, and there is no HTML parse here — React replaces the whole
 * document on the client, and a `<script>` inserted through a DOM update never
 * executes. So this runs as an effect, and the media query in the stylesheet
 * covers the frame before it lands.
 *
 * Same key and same fallback order as the layout, so a user who picked light
 * on a dark OS is not thrown into dark by an error page.
 */
function useChosenTheme() {
  useEffect(() => {
    try {
      const chosen = localStorage.getItem("theme");
      if (chosen === "dark" || chosen === "light") {
        document.documentElement.setAttribute("data-theme", chosen);
      }
    } catch {
      // Storage blocked (private mode, third-party cookie rules). The
      // prefers-color-scheme fallback in the stylesheet already has this.
    }
  }, []);
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useChosenTheme();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: PALETTE }} />
      </head>
      <body>
        <div className="ge-panel">
          <div className="ge-stage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascots/sleeping.png" alt="" width={88} height={88} />
          </div>
          <h1 className="ge-title">creagent — something broke</h1>
          <p className="ge-body">
            The app failed to start. Reloading usually clears it; if it does
            not, the deploy is having a bad time and nothing you did caused it.
          </p>
          {error.digest && <p className="ge-ref">reference: {error.digest}</p>}
          <div className="ge-actions">
            <button type="button" onClick={reset} className="ge-btn ge-btn--coral">
              Try again
            </button>
            <a href="/" className="ge-btn ge-btn--ghost">
              Back home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
