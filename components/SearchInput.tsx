"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import { cssBezier, isDarkTheme, motionMs, motionNum, prefersReducedMotion } from "@/lib/motion";

/**
 * A search field with the transitions.dev clear-with-dissolve on its × button:
 * the typed query flies down, blurs and fades while a soft streak ignites under
 * each word, and the placeholder falls in from above to take its place.
 *
 * The frame loop is not decoration for its own sake — it is the only way to get
 * the streak: its rise/peak/fall envelope and its per-word gradient stack (one
 * ellipse per word, measured off the real font) cannot be written as static
 * keyframes. Everything it reads comes from the `--clear-*` / `--glow-*` tokens
 * in globals.css.
 *
 * `loading` is drawn as a dot inside the field rather than as a word beside it.
 * A "searching…" label that appears and disappears next to a control is a
 * reflow on every keystroke — on narrow screens it wraps the whole row. The
 * announcement belongs to the caller's live region; this is `aria-hidden`.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  loading = false,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  // The placeholder cannot do this job: it is gone the moment someone types.
  label: string;
  loading?: boolean;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const pholdRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  // The class React paints, and the guard the frame loop reads. Same fact, two
  // homes: React owns `className`, so a re-render mid-clear would wipe an
  // imperatively added class straight off the wrap.
  const [clearing, setClearing] = useState(false);
  const busy = useRef(false);

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );

  /**
   * One `radial-gradient` stack: four overlapping ellipses per word, laid out
   * along the bottom edge at the position that word occupies in the field. The
   * text is measured with the input's own resolved font, so the streaks sit
   * under the glyphs at any breakpoint (the field is 16px below `sm`, 14px at
   * and above it).
   */
  const buildGlow = useCallback((text: string) => {
    const wrap = wrapRef.current;
    const input = inputRef.current;
    const ctx = document.createElement("canvas").getContext("2d");
    if (!wrap || !input || !ctx) return "";

    const style = getComputedStyle(input);
    ctx.font = style.font;
    // White on dark paper, black on light: the layer blends `screen` in dark
    // mode and `multiply` in light, and each only shows one of the two.
    const rgb = isDarkTheme() ? "255,255,255" : "0,0,0";
    const w = wrap.clientWidth || 280;
    const padLeft = parseFloat(style.paddingLeft) || 12;
    const spread = motionNum("--glow-spread", 1.5);
    const layers: string[] = [];
    let x = 0;

    // Split keeps the separators, so whitespace still advances x without
    // getting a streak of its own.
    text.split(/(\s+)/).forEach((seg) => {
      const segW = ctx.measureText(seg).width;
      if (seg.trim()) {
        const cx = padLeft + x + segW / 2;
        const hw = Math.max(segW * 0.45, 8) * spread;
        (
          [
            [0, 0.8, 7, 0.22],
            [hw * 0.45, 0.55, 8, 0.18],
            [-hw * 0.4, 0.65, 6, 0.16],
            [hw * 0.15, 0.9, 5, 0.14],
          ] as const
        ).forEach(([dx, rwm, rh, a]) => {
          const lx = (((cx + dx) / w) * 100).toFixed(2);
          layers.push(
            `radial-gradient(ellipse ${Math.max(hw * rwm, 2).toFixed(1)}px ${rh}px at ${lx}% 100%, rgba(${rgb},${a}), transparent)`,
          );
        });
      }
      x += segW;
    });
    return layers.join(", ");
  }, []);

  const clear = useCallback(() => {
    const wrap = wrapRef.current;
    const input = inputRef.current;
    const mirror = mirrorRef.current;
    const phold = pholdRef.current;
    const glow = glowRef.current;
    if (!wrap || !input || !mirror || !phold || !glow) return;
    if (busy.current || !value) return;

    // The field is emptied first either way — the animation is how the old
    // value leaves, never a gate on it leaving.
    const text = value;
    onChange("");
    if (prefersReducedMotion()) return;

    busy.current = true;
    setClearing(true);
    // Non-breaking spaces, written as an escape so the literal cannot be
    // normalised away by an editor: the mirror is a flex box, and ordinary
    // spaces at either end of the value would collapse and shift the words
    // off the glyphs they are supposed to be flying away from.
    mirror.textContent = text.replace(/ /g, "\u00a0");

    const total = motionMs("--clear-dur", 1000);
    const outDur = motionMs("--clear-out-dur", 400);
    const inDur = motionMs("--clear-in-dur", 400);
    const outFly = motionNum("--clear-out-fly", 12);
    const inFly = motionNum("--clear-in-fly", 12);
    const blur = motionNum("--clear-blur", 2);
    const delay = motionMs("--glow-delay", 50);
    const peakAt = motionNum("--glow-peak-at", 0.15);
    const glowOpacity = motionNum("--glow-opacity", 0.42);
    const root = getComputedStyle(document.documentElement);
    const easeOut = cssBezier(root.getPropertyValue("--clear-out-ease"));
    const easeIn = cssBezier(root.getPropertyValue("--clear-in-ease"));

    glow.style.background = buildGlow(mirror.textContent);
    glow.style.opacity = "0";
    phold.style.transform = `translateY(-${inFly}px)`;
    phold.style.opacity = "0.9";
    phold.style.filter = `blur(${blur}px)`;

    const t0 = performance.now();
    const tick = (now: number) => {
      const el = now - t0;

      const eo = easeOut(Math.min(1, el / outDur));
      mirror.style.transform = `translateY(${(eo * outFly).toFixed(1)}px)`;
      mirror.style.opacity = (1 - eo).toFixed(3);
      mirror.style.filter = `blur(${(eo * blur).toFixed(1)}px)`;

      const ei = easeIn(Math.min(1, el / inDur));
      phold.style.transform = `translateY(${(-inFly + ei * inFly).toFixed(1)}px)`;
      phold.style.opacity = (0.9 + ei * 0.1).toFixed(3);
      phold.style.filter = `blur(${(blur - ei * blur).toFixed(1)}px)`;

      // Rise to the peak, then fall for the rest of the run: the streak is a
      // flare, not a fade, so its two halves have different lengths.
      let g = 0;
      if (el > delay) {
        const gp = Math.min(1, (el - delay) / Math.max(1, total - delay));
        g = gp < peakAt ? gp / peakAt : 1 - (gp - peakAt) / (1 - peakAt);
      }
      glow.style.opacity = (g * glowOpacity).toFixed(3);

      if (el < total) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      frame.current = null;
      // Every inline style written above is dropped, so the resting field is
      // described by the stylesheet again and the next clear starts clean.
      mirror.style.cssText = "";
      phold.style.cssText = "";
      mirror.textContent = "";
      glow.style.opacity = "0";
      glow.style.background = "";
      busy.current = false;
      setClearing(false);
    };
    frame.current = requestAnimationFrame(tick);
  }, [buildGlow, onChange, value]);

  // The × is inside the field, so a click on it would blur the input and cost
  // the caret. Refusing the default focus move keeps typing where it was.
  const keepFocus = (e: React.SyntheticEvent) => {
    if (document.activeElement === inputRef.current) e.preventDefault();
  };

  return (
    <div
      ref={wrapRef}
      className={clsx(
        "t-clear bg-paper border-2 border-line transition-shadow",
        "focus-within:shadow-[2px_2px_0_0_var(--coral)] focus-within:border-coral",
        value && "has-value",
        clearing && "is-clearing",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        aria-busy={loading}
        // No placeholder attribute: the fake one below is the layer that flies
        // in, and two of them would render on top of each other.
        className={clsx(
          // 16px below `sm`: iOS Safari zooms the whole page in when an input's
          // text is smaller than that, and the user has to pinch back out.
          "w-full bg-transparent px-3 py-2 font-mono text-base sm:text-sm outline-none",
          // Constant, not conditional on the dot or the ×: right padding that
          // changes with state moves the text under the caret.
          "pr-14",
        )}
      />
      {/* Same padding and type as the input, so the flying text starts on the
          glyphs it replaces rather than beside them. */}
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="t-clear-mirror px-3 font-mono text-base sm:text-sm"
      />
      <div
        ref={pholdRef}
        aria-hidden="true"
        className="t-clear-placeholder px-3 font-mono text-base sm:text-sm text-muted"
      >
        {placeholder}
      </div>
      <div ref={glowRef} aria-hidden="true" className="t-clear-glow" />

      {/* Above the glow, or the streak would darken the controls with it. */}
      <div className="absolute inset-y-0 right-0 z-[4] flex items-center gap-2 pr-2">
        {loading && (
          <span
            aria-hidden="true"
            className="t-pulse-dot size-1.5 bg-coral shrink-0"
          />
        )}
        {value && !clearing && (
          <button
            type="button"
            onPointerDown={keepFocus}
            onMouseDown={keepFocus}
            onClick={clear}
            aria-label="Clear search"
            className={clsx(
              "grid place-items-center size-5 shrink-0 border-2 border-line bg-paper",
              "font-mono text-[10px] leading-none text-muted",
              "hover:bg-stone hover:text-ink transition-colors",
              // The chip stays 20px — it has to sit inside the field without
              // crowding the text — but 20×20 is under the 24px target minimum,
              // and this is the control people reach for on a phone after
              // mistyping. The pseudo-element carries the hit area out to 24
              // without moving the box that is drawn. Nothing else in the row is
              // a target, so the extra 2px cannot overlap one.
              "relative before:absolute before:-inset-0.5 before:content-['']",
            )}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
