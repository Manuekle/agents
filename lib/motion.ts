/**
 * Reading the motion tokens back out of CSS, for the transitions whose timing
 * lives in JS. Every value here comes from `:root` in globals.css, so tuning a
 * token there retunes the JS-driven transitions too — no second source of
 * truth to keep in sync.
 */

/**
 * A CSS `<time>` token in milliseconds.
 *
 * Not `parseFloat`: the build minifies `150ms` down to `.15s`, so reading the
 * token that way yields 0.15 and every timer keyed off it fires on the next
 * tick — which silently skips whatever it was meant to be waiting for.
 */
export function cssTimeMs(value: string, fallback: number): number {
  const raw = value.trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : n * 1000;
}

/** A custom property off `<html>`, raw. */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name);
}

/** A duration token off `<html>`, in ms. */
export function motionMs(name: string, fallback: number): number {
  return cssTimeMs(cssVar(name), fallback);
}

/** A unitless or `px` token off `<html>`, as a number. */
export function motionNum(name: string, fallback: number): number {
  const n = parseFloat(cssVar(name));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Minimal `cubic-bezier(x1, y1, x2, y2)` sampler, so a transition driven from
 * JS eases identically to one handed to the compositor. Newton-Raphson on the
 * x polynomial — eight iterations is well past visual convergence.
 *
 * Anything that is not a cubic-bezier token (`ease-in-out`, `linear`, an empty
 * string from a variable that does not exist) falls back to linear rather than
 * throwing: a transition that runs with the wrong curve is a nuisance, one
 * that crashes the frame loop is a bug.
 */
export function cssBezier(value: string): (t: number) => number {
  const m = String(value).match(
    /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/,
  );
  if (!m) return (t) => t;
  const [x1, y1, x2, y2] = m.slice(1).map(parseFloat);
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i++) {
      const dx = ((ax * s + bx) * s + cx) * s - t;
      const d = (3 * ax * s + 2 * bx) * s + cx;
      if (Math.abs(dx) < 1e-6 || d === 0) break;
      s -= dx / d;
    }
    return ((ay * s + by) * s + cy) * s;
  };
}

/** The OS-level "less motion, please". */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The theme currently painted on `<html>`. */
export function isDarkTheme(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark";
}
