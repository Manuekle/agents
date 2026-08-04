"use client";

import { useEffect, useState } from "react";
import Confetti from "react-confetti";

// Louder than the site's two brand tones on purpose — confetti only reads as
// celebration when it out-shouts the page it lands on. Coral leads so the
// burst still belongs to this palette.
const COLORS = [
  "#ef5c47",
  "#f59e0b",
  "#fde047",
  "#28d26e",
  "#22d3ee",
  "#358ff3",
  "#a855f7",
  "#f05abe",
];

// The same 4x4 Bayer matrix the mascots and the charts are dithered with, so
// the pieces read as pixel art rather than smooth paper flakes.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

type Particle = { w: number; h: number; density?: number };

// react-confetti calls this with the particle as `this`, on a context already
// translated and rotated into place with fillStyle set to the piece's colour.
function drawDitherSquare(this: Particle, ctx: CanvasRenderingContext2D) {
  // Rolled once and cached on the particle. Recomputing per frame would make
  // the texture crawl instead of holding still while the piece tumbles.
  // Capped well below 1: past ~0.7 the matrix fills in and the piece reads as
  // a plain solid square, which defeats the point.
  this.density ??= 0.35 + Math.random() * 0.3;

  // Floor the size so a 5px particle still gets a 2px cell — below that the
  // gaps close up and the dither is invisible.
  const size = Math.max(this.w, 14);
  const cell = Math.max(2, Math.round(size / 4));
  const origin = -Math.round((cell * 4) / 2);

  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if (BAYER[y][x] / 16 >= this.density) continue;
      ctx.fillRect(origin + x * cell, origin + y * cell, cell, cell);
    }
  }
}

/**
 * Full-screen dithered confetti. Bump `token` to fire a burst; it emits a
 * fixed number of pieces and unmounts once the last one has left the screen.
 */
export function DitherConfetti({ token }: { token: number }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const sync = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    if (token === 0) return;
    // Decorative, so it sits out entirely when the visitor asks for less
    // motion — there is nothing to convey that the button state doesn't.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setRunning(true);
  }, [token]);

  if (!running || size.w === 0) return null;

  return (
    <Confetti
      key={token}
      width={size.w}
      height={size.h}
      colors={COLORS}
      numberOfPieces={180}
      recycle={false}
      gravity={0.26}
      friction={0.99}
      drawShape={drawDitherSquare}
      // Unmount on the real completion callback rather than a guessed timeout,
      // which would blink the stragglers out mid-fall.
      onConfettiComplete={() => setRunning(false)}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60 }}
    />
  );
}
