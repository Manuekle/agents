"use client";

import { useEffect, useState } from "react";
import { MASCOTS, type MascotState } from "@/lib/mascot";
import { clsx } from "@/lib/clsx";

// Which slots are known to be missing a PNG. Only failures are recorded: the
// sprite is rendered optimistically and `onError` is what demotes it, so a slot
// that is fine never needs an entry.
const missing: Record<string, boolean> = {};

// Below this the idle loop is a twitch, not a character: a 40px sprite bobbing
// in a picker or on a canvas node reads as jitter, and a grid of them is a
// screenful of unrelated motion. Only the one mascot a screen shows big enough
// to be the subject animates.
const ANIMATE_ABOVE = 72;

export function Mascot({
  state,
  size = 96,
  className,
  animate,
}: {
  state: MascotState;
  size?: number;
  className?: string;
  /** Defaults to on for `size >= 72`. Pass explicitly to override. */
  animate?: boolean;
}) {
  const def = MASCOTS[state];
  const animated = animate ?? size >= ANIMATE_ABOVE;
  const src = `/mascots/${def.slot}.png`;

  // Optimistic, and that is the fix rather than an oversight.
  //
  // This used to start at `false` and only render the <img> after a JS
  // `new Image()` round-trip resolved, so on every cold load — every visitor's
  // first paint, on a page whose mascot is the subject — the ASCII face was
  // drawn first and swapped for the sprite a beat later. Since the sprites are
  // shipped in `public/`, the failure it was guarding against is the rare case,
  // not the common one. The <img> goes in immediately and `onError` demotes it,
  // so the fallback appears only where the asset genuinely is not there.
  const [broken, setBroken] = useState<boolean>(() => missing[src] ?? false);

  // The slot can change under a mounted component (the picker on the home page
  // does exactly that), so a previously failed slot must not keep a new one
  // demoted — and vice versa.
  useEffect(() => setBroken(missing[src] ?? false), [src]);

  return (
    <div
      className={clsx("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-label={def.label}
      role="img"
    >
      <div
        className={clsx(animated && "will-change-transform", animated && def.anim)}
        style={{ width: size, height: size }}
      >
        {!broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            // The wrapper is already `role="img"` carrying the same label, and
            // a named image inside a named image is announced twice.
            alt=""
            width={size}
            height={size}
            onError={() => {
              missing[src] = true;
              setBroken(true);
            }}
            className="pixelated w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-paper pixel-border-sm">
            <span className="font-pixel text-ink leading-none" style={{ fontSize: Math.max(9, size * 0.15) }}>
              {def.ascii}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
