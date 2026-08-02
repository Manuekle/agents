"use client";

import { useEffect, useRef } from "react";

// Animated ordered-dither field — the signature "pixel Claude" blob.
// Renders black/paper cells thresholded by a Bayer 4x4 matrix against a
// slow-moving noise field. Pure canvas, no libs.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function DitherField({
  cell = 8,
  className,
  intensity = 1,
}: {
  cell?: number;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;

    // canvas can't use CSS vars — sample them, and resample on theme flips
    let ink = "#17150f";
    let paper = "#f7f5f0";
    let coral = "#ef5c47";

    const readTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      ink = cs.getPropertyValue("--ink").trim() || ink;
      paper = cs.getPropertyValue("--paper").trim() || paper;
      coral = cs.getPropertyValue("--coral").trim() || coral;
    };
    readTheme();

    const themeObserver = new MutationObserver(readTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, Math.floor(r.width / cell));
      h = Math.max(1, Math.floor(r.height / cell));
      canvas.width = w * cell;
      canvas.height = h * cell;
    };
    resize();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const render = (t: number) => {
      const time = t * 0.00012;
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          // smooth field: two drifting sine lobes -> 0..1
          const nx = x / w;
          const ny = y / h;
          const v =
            0.5 +
            0.5 *
              Math.sin(nx * 6 + time * 6) *
              Math.cos(ny * 5 - time * 5) *
              intensity;
          const threshold = (BAYER[y % 4][x % 4] + 0.5) / 16;
          if (v > threshold) {
            // rare coral pixels near the leading edge for accent
            ctx.fillStyle =
              v > threshold + 0.03 && v < threshold + 0.06 ? coral : ink;
            ctx.fillRect(x * cell, y * cell, cell, cell);
          }
        }
      }
      if (!reduced) raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      themeObserver.disconnect();
    };
  }, [cell, intensity]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
