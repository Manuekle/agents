"use client";

import { useEffect, useRef, useState } from "react";
import { HeartIcon, HeartSolidIcon } from "@/components/icons";
import { clsx } from "@/lib/clsx";

const PARTICLES = 8;
const KEY = "hearted";

/**
 * "Leave a heart" — a local appreciation toggle, not a claim that anyone
 * sponsored anything: the real ask sits next to it as a link to GitHub
 * Sponsors. The filled state persists so a returning visitor keeps theirs.
 */
export function HeartButton({ className }: { className?: string }) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // Starts false on both server and first client paint — reading storage
  // during render would hydrate a filled heart against an empty one.
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "1") setLiked(true);
    } catch {
      // private mode / storage disabled — the toggle just does not persist
    }
    return () => window.clearTimeout(timer.current);
  }, []);

  // Each particle gets its own vector, matching the star pill: eight identical
  // dots on a ring read as a spinner, not a burst.
  const fire = () => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>(".t-burst i").forEach((dot, i) => {
      const angle = (i / PARTICLES) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const dist = 16 + Math.random() * 16;
      dot.style.setProperty("--px", `${Math.cos(angle) * dist}px`);
      dot.style.setProperty("--py", `${Math.sin(angle) * dist}px`);
      dot.style.setProperty("--psize", `${0.7 + Math.random() * 0.8}`);
      dot.style.setProperty("--pdur", `${480 + Math.random() * 260}ms`);
      dot.style.setProperty("--pdelay", `${Math.random() * 60}ms`);
      dot.style.setProperty("--pend", `${0.3 + Math.random() * 0.5}`);
    });
    // Toggled on the node rather than through state: React batches a
    // false/true pair from one handler into a single render, so the class
    // would never leave the DOM and the forwards-filling animation would
    // stay parked on its last keyframe instead of replaying.
    root.classList.remove("is-bursting");
    void root.offsetWidth; // reflow, or re-adding the class is a no-op
    root.classList.add("is-bursting");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => root.classList.remove("is-bursting"), 900);
  };

  const toggle = () => {
    const next = !liked;
    setLiked(next);
    try {
      if (next) localStorage.setItem(KEY, "1");
      else localStorage.removeItem(KEY);
    } catch {
      // ignore — see above
    }
    if (next) fire(); // un-hearting is a correction, not something to celebrate
  };

  return (
    <button
      ref={rootRef}
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      data-liked={liked}
      className={clsx(
        "t-like group relative inline-flex items-center gap-2 px-3 py-2 select-none cursor-pointer",
        "border-2 border-line pixel-border-sm bg-paper hover:bg-stone",
        "transition-[background-color,box-shadow,translate] duration-150",
        "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        className,
      )}
    >
      <span className="relative inline-flex">
        <span className="t-like-icon">
          <span className="t-icon-swap" data-state={liked ? "b" : "a"}>
            <span className="t-icon" data-icon="a">
              <HeartIcon size={16} />
            </span>
            <span className="t-icon" data-icon="b">
              <HeartSolidIcon size={16} />
            </span>
          </span>
        </span>
        <span className="t-burst" aria-hidden>
          {Array.from({ length: PARTICLES }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      </span>
      {/* The label does not swap with the state: "Hearted" is six characters
          shorter, so the button would resize mid-pop and the spring would
          land on a box that moved under it. The fill and the burst say it,
          and aria-pressed says it to a screen reader. */}
      <span className="font-pixel text-[10px] uppercase">Leave a heart</span>
    </button>
  );
}
