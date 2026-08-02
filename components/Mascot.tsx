"use client";

import { useEffect, useState } from "react";
import { MASCOTS, type MascotState } from "@/lib/mascot";
import { clsx } from "@/lib/clsx";

const PARTICLE: Partial<Record<MascotState, string>> = {
  sleeping: "z",
  cooking: "~",
  coffee: "°",
  rocket: "*",
  thinking: "?",
  wizard: "✦",
};

// Cache which slots have a real PNG so we never flash a broken-image icon.
const loaded: Record<string, boolean> = {};

export function Mascot({
  state,
  size = 96,
  className,
}: {
  state: MascotState;
  size?: number;
  className?: string;
}) {
  const def = MASCOTS[state];
  const src = `/mascots/${def.slot}.png`;
  const [ok, setOk] = useState<boolean>(loaded[src] ?? false);
  const particle = PARTICLE[state];

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
      {particle && (
        <div className="absolute -top-1 right-0 font-pixel text-coral text-xs pointer-events-none">
          <span className="rise inline-block">{particle}</span>
        </div>
      )}

      <div className={clsx("will-change-transform", def.anim)} style={{ width: size, height: size }}>
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
