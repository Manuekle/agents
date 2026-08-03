"use client";

type Theme = "light" | "dark";

// Block size of one wipe cell. 48px keeps the grid chunky enough to read as
// pixel art and keeps the node count sane: ~570 cells on a 1440×900 desktop,
// ~160 on a phone. At 24px a desktop wipe would build 2 300 nodes for 700ms.
const CELL = 48;

const SWEEP_IN = 220; // ms for the cover edge to cross the viewport
const SWEEP_OUT = 200; // ms for the uncover edge to follow it
const JITTER = 70; // per-cell random delay — dithers the edge, kills the flat band
const LIFE = 110; // ms a single cell spends going edge-colour -> fill
const SPARK = 0.12; // share of cells that flash coral instead of stone

// The screen is fully covered once the last cover cell has turned opaque, which
// is max(d-in) = SWEEP_IN + JITTER. Everything after that point is hidden, so
// the theme flip and the uncover phase both start from here.
const COVER = SWEEP_IN + JITTER + 30;
const TOTAL = COVER + SWEEP_OUT + JITTER + LIFE;

let running: HTMLElement | null = null;
let timers: number[] = [];

/**
 * Run the pixel wipe, calling `apply` at the moment the screen is fully
 * covered. `apply` is where the theme actually flips — doing it on click would
 * repaint the page in plain sight behind a transparent overlay.
 */
export function themeWipe(next: Theme, apply: () => void) {
  if (typeof window === "undefined") {
    apply();
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    apply();
    return;
  }

  // A second click mid-wipe: drop the in-flight overlay rather than stacking
  // two full-screen grids. Its pending timers go with it — a stale apply()
  // would otherwise flip the theme partway through the NEW wipe's cover phase,
  // in plain sight.
  running?.remove();
  timers.forEach(window.clearTimeout);
  timers = [];

  const cols = Math.ceil(window.innerWidth / CELL);
  const rows = Math.ceil(window.innerHeight / CELL);
  const span = Math.max(1, rows - 1);

  const root = document.createElement("div");
  root.className = `t-wipe ${next === "dark" ? "to-dark" : "to-light"}`;
  root.setAttribute("aria-hidden", "true");
  root.style.gridTemplateColumns = `repeat(${cols}, ${CELL}px)`;
  root.style.gridAutoRows = `${CELL}px`;
  root.style.setProperty("--wipe-life", `${LIFE}ms`);

  const frag = document.createDocumentFragment();
  for (let r = 0; r < rows; r++) {
    // Direction is the whole point of the effect: dark floods up from the
    // bottom, light comes down from the top. `p` is the row's position along
    // that axis, 0 at the leading edge.
    const p = next === "dark" ? (rows - 1 - r) / span : r / span;
    const inRow = p * SWEEP_IN;
    const outRow = COVER + p * SWEEP_OUT;
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("i");
      cell.style.setProperty("--d-in", `${inRow + Math.random() * JITTER}ms`);
      cell.style.setProperty("--d-out", `${outRow + Math.random() * JITTER}ms`);
      if (Math.random() < SPARK) cell.className = "is-spark";
      frag.appendChild(cell);
    }
  }
  root.appendChild(frag);
  document.body.appendChild(root);
  running = root;

  timers = [
    window.setTimeout(apply, COVER - 20),
    window.setTimeout(() => {
      root.remove();
      if (running === root) running = null;
    }, TOTAL + 80),
  ];
}
