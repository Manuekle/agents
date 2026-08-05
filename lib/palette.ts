// The palette's open signal lives here rather than in CommandPalette.tsx:
// a file that exports both a component and a plain value drops out of Fast
// Refresh, so every edit to the palette forced a full page reload.
//
// An event rather than React context — the only caller is the nav's search
// button, and a provider wrapped around the whole tree would be a lot of
// wiring for one consumer.

export const PALETTE_OPEN_EVENT = "agents-dev:open-palette";

/** Open the command palette from anywhere. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(PALETTE_OPEN_EVENT));
}
