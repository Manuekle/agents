"use client";

import { useEffect, useRef, useState } from "react";
import { GitHubIcon, StarIcon } from "@/components/icons";
import { SITE, fmtCount } from "@/lib/site";
import { useStars } from "@/lib/stars";
import { clsx } from "@/lib/clsx";

const PARTICLES = 8;

// One reel per digit. The strip stacks 0-9 `spins` times over, then lands on
// the target digit, so the column spins before settling instead of cutting.
function Reel({ digit, index, play }: { digit: string; index: number; play: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const strip = ref.current;
    if (!strip) return;
    const cell = 16;
    const spins = 2 + index;
    const target = Number(digit);

    if (!play) {
      strip.style.transition = "none";
      strip.style.transform = `translateY(-${target * cell}px)`;
      return;
    }

    strip.style.transition = "none";
    strip.style.transform = "translateY(0)";
    void strip.offsetHeight; // reflow, or the tween has nothing to start from
    strip.style.transition = `transform var(--reel-dur) var(--reel-ease) ${index * 80}ms`;
    strip.style.transform = `translateY(-${(spins * 10 + target) * cell}px)`;
  }, [digit, index, play]);

  const spins = 2 + index;
  const cells = Array.from({ length: spins * 10 + 10 }, (_, i) => i % 10);

  return (
    <span className="t-reel-col">
      <span ref={ref} className="t-reel-strip">
        {cells.map((n, i) => (
          <span key={i} className="t-reel-digit">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

function Count({ value }: { value: number | null }) {
  const text = value === null ? "—" : fmtCount(value);
  const [play, setPlay] = useState(false);

  // Spin once, when the real count replaces the placeholder.
  useEffect(() => {
    if (value === null) return;
    setPlay(true);
  }, [value]);

  if (value === null) return <span className="font-mono text-[11px]">—</span>;

  let digitIndex = -1;
  return (
    <span className="t-reel font-mono text-[11px]">
      {text.split("").map((ch, i) => {
        if (ch < "0" || ch > "9") {
          return (
            <span key={i} className="t-reel-digit">
              {ch}
            </span>
          );
        }
        digitIndex += 1;
        return <Reel key={i} digit={ch} index={digitIndex} play={play} />;
      })}
    </span>
  );
}

// "Star on GitHub" pill — live stargazer count, with a burst on click.
export function GitHubStars({ className }: { className?: string }) {
  const stars = useStars();
  const rootRef = useRef<HTMLAnchorElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Each particle gets its own vector so the spray reads organic rather than
  // as a rotating ring of eight identical dots.
  //
  // The class is toggled straight on the node instead of through state: React
  // batches a false/true pair in one handler into a single render, so the
  // class never leaves the DOM and the animation — which fills forwards —
  // stays parked on its last keyframe instead of replaying.
  const fire = () => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>(".t-burst i").forEach((dot, i) => {
      const angle = (i / PARTICLES) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const dist = 14 + Math.random() * 14;
      dot.style.setProperty("--px", `${Math.cos(angle) * dist}px`);
      dot.style.setProperty("--py", `${Math.sin(angle) * dist}px`);
      dot.style.setProperty("--psize", `${0.7 + Math.random() * 0.8}`);
      dot.style.setProperty("--pdur", `${480 + Math.random() * 260}ms`);
      dot.style.setProperty("--pdelay", `${Math.random() * 60}ms`);
      dot.style.setProperty("--pend", `${0.3 + Math.random() * 0.5}`);
    });
    root.classList.remove("is-bursting");
    void root.offsetWidth; // reflow, or re-adding the class is a no-op
    root.classList.add("is-bursting");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => root.classList.remove("is-bursting"), 900);
  };

  return (
    <a
      ref={rootRef}
      href={SITE.githubUrl}
      target="_blank"
      rel="noreferrer noopener"
      onClick={fire}
      className={clsx(
        "group relative inline-flex items-stretch border-2 border-line pixel-border-sm bg-paper hover:bg-stone transition-colors select-none",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 px-2.5 py-1.5 border-r-2 border-line">
        <GitHubIcon size={14} />
        <span className="font-pixel text-[10px] uppercase">Star</span>
      </span>
      <span className="relative flex items-center gap-1 px-2.5 py-1.5 bg-fill text-on-fill group-hover:bg-coral transition-colors">
        {/* pop rides the same class toggle, scoped from the root */}
        <span className="inline-flex t-star-icon">
          <StarIcon size={12} className="text-coral group-hover:text-paper" />
        </span>
        <Count value={stars} />
        <span className="t-burst" aria-hidden>
          {Array.from({ length: PARTICLES }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      </span>
    </a>
  );
}
