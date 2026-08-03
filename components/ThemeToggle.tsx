"use client";

import { useEffect, useState } from "react";
import { clsx } from "@/lib/clsx";
import { SunIcon, MoonIcon } from "@/components/icons";

type Theme = "light" | "dark";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={clsx(
        "inline-flex items-center justify-center w-8 h-8 border-2 border-line bg-paper text-ink hover:bg-stone transition-colors cursor-pointer",
        className,
      )}
    >
      {/* Both icons ship; CSS keyed off <html data-theme> picks one. `theme`
          state only settles after hydration, so choosing in JS would paint the
          wrong icon for a frame on every dark-mode load. */}
      <span className="icon-when-light">
        <MoonIcon size={14} />
      </span>
      <span className="icon-when-dark">
        <SunIcon size={14} />
      </span>
    </button>
  );
}
