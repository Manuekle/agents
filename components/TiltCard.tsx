"use client";

import { useRef, type ReactNode } from "react";
import { clsx } from "@/lib/clsx";

// Pointer-tracked 3D tilt. The outer wrapper is the hit area and never
// transforms — reading coordinates off the element that is itself rotating
// feeds its own movement back in and the card jitters.
export function TiltCard({
  children,
  className,
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const wrap = wrapRef.current;
    const card = cardRef.current;
    if (!wrap || !card) return;
    const r = wrap.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    card.classList.add("is-tilting");
    wrap.classList.add("is-hover");
    card.style.setProperty("--tilt-ry", `${(px - 0.5) * 2 * max}deg`);
    card.style.setProperty("--tilt-rx", `${-(py - 0.5) * 2 * max}deg`);
    card.style.setProperty("--tilt-gx", `${px * 100}%`);
    card.style.setProperty("--tilt-gy", `${py * 100}%`);
  };

  const leave = () => {
    const wrap = wrapRef.current;
    const card = cardRef.current;
    if (!wrap || !card) return;
    // Drop .is-tilting so the slower return easing takes over on the way back.
    card.classList.remove("is-tilting");
    wrap.classList.remove("is-hover");
    card.style.setProperty("--tilt-rx", "0deg");
    card.style.setProperty("--tilt-ry", "0deg");
  };

  return (
    <div ref={wrapRef} className="t-tilt" onPointerMove={move} onPointerLeave={leave}>
      <div ref={cardRef} className={clsx("t-tilt-card relative", className)}>
        {children}
        <span className="t-tilt-glare" aria-hidden />
      </div>
    </div>
  );
}
