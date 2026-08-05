// The little "powered by ai" line under every page title.
//
// It used to live in Nav.tsx, which was fine while the pages rendered the nav
// themselves. The nav is in the root layout now, so every page was importing a
// module for the one export it does not use — this is the same component with
// an honest home.

export function PoweredBy() {
  return (
    <div className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
      <span className="w-1.5 h-1.5 bg-coral rounded-full t-pulse-dot" />
      {/* data-text duplicates the string so ::before can clip the sweep to
          the same glyphs — keep the two in sync. */}
      <span className="t-shimmer" data-text="powered by ai">
        powered by ai
      </span>
    </div>
  );
}
