---
title: DESIGN — creagent design system
summary: Colour tokens, typography, spacing, motion tokens and component primitives. The single source of truth for any visual change.
version: 1.0.0
updated: 2026-08-05
area: design / frontend
audience: ai-agent, designer, frontend
source_of_truth: app/globals.css, components/ui.tsx, app/layout.tsx
read_when: Editing anything visual — colour, type, spacing, borders, motion, a new component.
skip_when: Backend, data, API or MCP work.
tokens_est: ~2.2k
---

# DESIGN

Art direction: **pixel · dither · ASCII**, warm paper ground, single coral accent.
Everything is hard-edged. **There are no border radii anywhere in this app.**

## 1. Hard rules

| Rule | Why |
|---|---|
| No `border-radius`. Ever. | The whole system is a pixel grid; one rounded corner breaks it. |
| No `transition-all`. Name the properties. | `all` tweens layout properties and janks. |
| No `blur()` on pixel art / sprites. | Resampling turns bitmap art to mush. Blur is allowed on plain text and bars only. |
| Colour comes from tokens, never hex, in components. | Themes swap by token; a literal hex survives the theme switch and breaks dark mode. |
| Every animation needs a `prefers-reduced-motion` escape. | See the two `@media (prefers-reduced-motion: reduce)` blocks in `app/globals.css`. |
| Mascot motion is **translate-only** (whole pixels). | `rotate`/`scale` resample the sprite. |
| Text on coral uses `--coral-text`, not `--coral`. | `--coral` on paper is 3.06:1 — under AA at 10–11px. |

## 2. Colour tokens

Tokens are split by **role**, not by lightness: `ink` (text), `line` (outline), `shadow` (drop).
Defined in `app/globals.css` — `:root` (light) and `[data-theme="dark"]`, exposed to Tailwind v4 through `@theme inline` as `--color-*` (so `bg-paper`, `text-muted`, `border-line` all work).

| Token | Role | Light | Dark |
|---|---|---|---|
| `--paper` | page ground | `#f7f5f0` | `#15130f` |
| `--stone` | raised surface | `#eae4d7` | `#221f19` |
| `--stone-deep` | deeper surface | `#d9d2c2` | `#322c23` |
| `--coral` | accent **fill / border** | `#ef5c47` | `#f4705c` |
| `--coral-deep` | accent hover | `#d44430` | `#ff8a76` |
| `--coral-text` | accent **as type / CTA fill** | `#b8371f` | = `--coral` |
| `--ink` | primary text | `#17150f` | `#e9e3d6` |
| `--ink-soft` | secondary text | `#3c3629` | `#bdb6a6` |
| `--muted` | labels, 10px type | `#665f52` | `#9a9182` |
| `--line` | outline (~1.5:1 vs paper) | `#cbc3b2` | `#3b352b` |
| `--shadow` | hard-edged drop | `rgba(23,21,15,.13)` | `rgba(0,0,0,.55)` |
| `--dot` | dither speckle | `rgba(23,21,15,.22)` | `rgba(233,227,214,.14)` |
| `--fill` / `--fill-hover` | solid button | `#4a4338` / `#35302a` | `#342e26` / `#453e33` |
| `--on-fill` / `--on-fill-muted` | type on `--fill` | `#f7f5f0` / `#bdb3a0` | `#efe9dc` / `#bdb3a0` |
| `--ok` | success only | `#2a7a3c` | `#3f9d52` |
| `--stage-base`, `--glow-*` | mascot stage lighting | — | — |

Aliases: `--background` = `--paper`, `--foreground` = `--ink`.
`--paper-light/-dark`, `--stone-light/-dark`, `--coral-light/-dark` exist because the theme wipe paints the **incoming** theme while `<html>` still carries the outgoing one.

### Contrast floor
AA (4.5:1) on every text token, measured against both `--paper` and `--stone` — labels run at 10–11px, so nothing marginal ships. `--muted` is 5.80:1 / 4.99:1; `--coral-text` is 5.35:1 / 4.6:1.

### Green
`--ok` is deliberately outside the base palette. Use it for copy-confirm / success feedback only — never as decoration.

## 3. Typography

Four faces, loaded in `app/layout.tsx`, exposed as `--font-sans|mono|pixel|serif`:

| Class | Face | Rules |
|---|---|---|
| default / `font-sans` | Geist Sans | `font-weight: 600`, `letter-spacing: -0.06em` |
| `font-mono` | Geist Mono | weight 400, tracking 0 (its own metrics) |
| `font-pixel` | **Silkscreen** (real bitmap, 8px grid) | weight 400, `letter-spacing: .01em`, **font smoothing OFF**, no `tracking-wide` |
| `font-serif` | Habibi | display / og-image use |

Buttons and labels are `font-pixel` uppercase at 11px; badges are `font-mono` uppercase at 10px.

## 4. Space, borders, grid

- `--px: 4px` — the pixel unit. Offsets and shadows are multiples of it.
- `.pixel-border` — `2px solid var(--line)` + `4px 4px 0 0 var(--shadow)`.
- `.pixel-border-sm` — same border + `2px 2px 0` shadow (buttons, small panels).
- Canvas grid: `GRID = 8` units, `NODE_W = 26` (208px), agent node 11 (88px), component node 7 (56px) — `lib/graph.ts`.
- Canvas ink: freehand is quantised to `QUANT = 0.5` grid units (4px) and drawn with square caps and mitred joins, so a hand-drawn stroke comes out as pixel art rather than as an ink line pasted over it. Ink colour is a **token name** (`ink`, `coral`, `ok`, `muted`, `paper` — `INK_COLORS` in `lib/annotations.ts`), never a hex: a drawing made in light mode has to survive the theme wipe.
- Focus: `outline: 2px solid var(--coral)` (offset `2px`, `-2px` on the canvas surface). Never remove it.

## 5. Texture

- `.dither-stone` — stone + 1px dot at 6px pitch.
- `.grain::before` — animated speckle, `steps(4)`, 1.2s.
- `.pixelated` — `image-rendering: pixelated` for sprite `<img>`.
- Modal scrim is a **4px conic checker**, not `backdrop-filter: blur()` — a gaussian blur is the one soft edge that reads as a different art direction.

## 6. Motion

All timings live as CSS custom properties in `:root` (`app/globals.css`, MOTION section). JS reads them back through `lib/motion.ts` (`motionMs`, `motionNum`, `cssBezier`) — **never hardcode a duration in JS**.

House curve: `cubic-bezier(0.22, 1, 0.36, 1)`. Springy pop: `cubic-bezier(0.34, 1.36, 0.64, 1)`.

| Family | Key tokens |
|---|---|
| modal | `--modal-open-dur: 250ms` / `--modal-close-dur: 150ms` (close is faster: dismissal gets out of the way) |
| panel / drawer | `--panel-open-dur: 400ms`, `--panel-close-dur: 350ms`, `--panel-blur: 2px` |
| card resize / node move | `--resize-dur: 250ms` |
| canvas | `--canvas-state-dur: 150ms`, `--canvas-pan-dur: 320ms`, `--canvas-node-in-dur: 260ms` |
| tabs marker | `--tabs-dur: 250ms` |
| accordion | `--acc-expand` / `--acc-collapse: 250ms` (`grid-template-rows 0fr→1fr`, no JS measurement) |
| text reveal | `--stagger-dur: 500ms`, `--stagger-stagger: 40ms`, `--stagger-blur: 3px` |
| skeleton / reveal | `--pulse-dur: 1000ms`, `--reveal-dur: 400ms` |
| burst / like | `--burst-dur: 600ms`, `--pop-dur: 350ms` |
| tilt | `--tilt-follow: 300ms`, `--tilt-return: 400ms` (springier return) |
| success check | `--check-*-dur: 500ms`, path length `--check-path-len: 31` |

Recipes are transitions.dev, house-adapted (no radius, no blur on sprites). Class prefix is `t-*`.

## 7. Component primitives — `components/ui.tsx`

`SuccessCheck` · `ResizeBox` · `Panel` · `PixelButton` · `Badge` · `Field` · `TextInput` · `TextArea` · `Segmented` · `Select` · `Notice` · `StatePanel` · `PageLoading`

- `PixelButton` variants: `solid` (bg-fill), `coral` (**bg-coral-text**, primary CTA), `ghost` (bg-paper). Press state is `translate 2px` + shadow removal.
- `Badge` tones: `stone`, `coral` (bg-coral-text), `ink`.
- `Field` takes `group` whenever the children are a *set* of controls — a `<label>` otherwise adopts control #1 and hovering any sibling lights it up.
- `Notice` tones: `error` (coral-deep border + text, `role="alert"`), `info` (line border on stone, `role="status"`). Takes one optional `action` on the right. Every user-visible failure goes through it — no hand-rolled bordered `<p>`.
- `StatePanel` is a whole route in one state: mascot in a `mascot-stage`, `SCREAMING_SNAKE` pixel title, body, actions, footnote. Used by `error.tsx`, `not-found.tsx` and `PageLoading`. `PageLoading` is the Suspense fallback for the routes that read search params (`/build`, `/demo`, `/login`).
- `app/global-error.tsx` is the one file that cannot use any of this — it replaces the document, so it gets no `globals.css` and no fonts. It inlines the palette, the 2px border and the offset shadow instead of falling back to unstyled defaults.

Build new UI out of these before writing a new one.

## 8. HeroUI bridge

HeroUI paints from its own tokens. `.heroui-brand` remaps `--accent`, `--default`, etc. to the palette instead of restyling slots, so component behaviour and states survive. Sliders are squared (`border-radius: 0` on track/fill/thumb) and the visible thumb is `::after`.

## 9. Scrollbars

Exactly one visible bar in the app: the page's (`html`, 12px, coral thumb on stone track, square). Every inner pane hides its bar (`body, body *`). Scrolling itself is never disabled.

## 10. Theme

`data-theme` on `<html>`, set by a head script before first paint. The toggle plays a full-screen block wipe (`.t-wipe`, `lib/theme-wipe.ts`): dark floods **up**, light rains **down**, every cell `steps(1)` — never a cross-fade. Theme-conditional glyphs use `.icon-when-light` / `.icon-when-dark`.

## Related
[ARCHITECTURE.md](ARCHITECTURE.md) · [DATA.md](DATA.md) · [API.md](API.md)
