"use client";

import { useEffect, useState } from "react";
import { MASCOTS, type MascotState } from "@/lib/mascot";
import { clsx } from "@/lib/clsx";

// Cache which slots have a real PNG so we never flash a broken-image icon.
const loaded: Record<string, boolean> = {};

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
  const [ok, setOk] = useState<boolean>(loaded[src] ?? false);

  // Preload: only render <img> once we know the asset exists.
  useEffect(() => {
    if (loaded[src] !== undefined) {
      setOk(loaded[src]);
      return;
    }
    const img = new Image();
    img.onload = () => {
      loaded[src] = true;
      setOk(true);
    };
    img.onerror = () => {
      loaded[src] = false;
      setOk(false);
    };
    img.src = src;
  }, [src]);

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
        {ok ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={def.label}
            width={size}
            height={size}
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
