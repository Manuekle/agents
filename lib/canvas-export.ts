// The canvas as a picture.
//
// Two formats out of one drawing pass. Geometry is decided once, into a flat
// list of primitives, and each backend only knows how to put a rect, a path, a
// piece of text or a bitmap onto its own surface. Writing the layout twice —
// once for SVG, once for a 2D context — is how the two silently drift until
// the PNG and the SVG of the same graph stop being the same picture.
//
// What comes out is what is *on screen*: a folded branch stays folded, because
// exporting a view that shows more than the view does is a surprise, not a
// feature. Selection, hover, guides and the marquee are chrome and never go in.
//
// Fonts: the SVG names the families and does not embed them, so a standalone
// file falls back to the reader's monospace. That is the honest trade — the
// text stays real text, selectable and editable in whatever opens it. The PNG
// is drawn through a 2D context inside the page, where the app's own fonts are
// already loaded, so it comes out exact.

import { KIND_META } from "./aitmpl";
import {
  GRID,
  KIND_LABEL,
  NODE_W,
  collapsedCount,
  graphAnnotations,
  graphBounds,
  isAgentKind,
  isComponentKind,
  nodeHeight,
  nodeRef,
  visibleGraph,
  type AgentGraph,
  type GraphNode,
} from "./graph";
import {
  MARKER_ALPHA,
  MARKER_SCALE,
  annotationBounds,
  arrowHead,
  isTextKind,
  strokePath,
  type Annotation,
  type InkColor,
} from "./annotations";
import { MASCOTS } from "./mascot";
import { mascotOf } from "./graph";

// ------------------------------------------------------------------- scene

type Family = "mono" | "pixel";

export type Prim =
  | {
      t: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      fill?: string;
      fillOpacity?: number;
      stroke?: string;
      sw?: number;
    }
  | {
      t: "path";
      d: string;
      stroke: string;
      sw: number;
      opacity?: number;
    }
  | {
      t: "ellipse";
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      stroke: string;
      sw: number;
      opacity?: number;
    }
  | {
      t: "text";
      x: number;
      /** Baseline, not the top: both backends place text from the baseline. */
      y: number;
      text: string;
      size: number;
      fill: string;
      family: Family;
      bold?: boolean;
      upper?: boolean;
    }
  | { t: "image"; x: number; y: number; w: number; h: number; src: string };

export interface Scene {
  width: number;
  height: number;
  background: string;
  prims: Prim[];
  /** Resolved font stacks, read off the live document. */
  fonts: Record<Family, string>;
}

/** Every colour the export needs, resolved from the theme in force right now. */
interface Ink {
  paper: string;
  stone: string;
  line: string;
  ink: string;
  inkSoft: string;
  muted: string;
  coral: string;
  ok: string;
}

function readInk(): Ink {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    paper: v("--paper", "#f7f5f0"),
    stone: v("--stone", "#eae4d7"),
    line: v("--line", "#cbc3b2"),
    ink: v("--ink", "#17150f"),
    inkSoft: v("--ink-soft", "#3c3629"),
    muted: v("--muted", "#665f52"),
    coral: v("--coral", "#ef5c47"),
    ok: v("--ok", "#2a7a3c"),
  };
}

function inkColor(c: InkColor, ink: Ink): string {
  switch (c) {
    case "coral":
      return ink.coral;
    case "ok":
      return ink.ok;
    case "muted":
      return ink.muted;
    case "paper":
      return ink.paper;
    default:
      return ink.ink;
  }
}

/** The font stacks the page is actually using, so the SVG names the same ones. */
function readFonts(): Record<Family, string> {
  const probe = document.createElement("span");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const read = (cls: string, fallback: string) => {
    probe.className = cls;
    const f = getComputedStyle(probe).fontFamily;
    return f || fallback;
  };
  const fonts = {
    mono: read("font-mono", "ui-monospace, monospace"),
    pixel: read("font-pixel", "monospace"),
  };
  probe.remove();
  return fonts;
}

// Monospace, so a character is a fixed fraction of the size and a line can be
// clipped without measuring. Both backends clip identically because the clip
// happens here, before either of them sees the string.
const MONO_CH = 0.6;
const PIXEL_CH = 0.72;

function fit(text: string, size: number, maxW: number, family: Family): string {
  const ch = size * (family === "pixel" ? PIXEL_CH : MONO_CH);
  const max = Math.max(1, Math.floor(maxW / ch));
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}

/** Break a paragraph to a width, honouring the line breaks already in it. */
function wrap(text: string, size: number, maxW: number): string[] {
  const max = Math.max(1, Math.floor(maxW / (size * MONO_CH)));
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (para.length <= max) {
      out.push(para);
      continue;
    }
    let line = "";
    for (const word of para.split(" ")) {
      if (line.length === 0) line = word;
      else if (line.length + 1 + word.length <= max) line += ` ${word}`;
      else {
        out.push(line);
        line = word;
      }
      // A single word longer than the box is broken rather than left to
      // overflow — a pasted URL is the common case.
      while (line.length > max) {
        out.push(line.slice(0, max));
        line = line.slice(max);
      }
    }
    out.push(line);
  }
  return out;
}

// ------------------------------------------------------------------ drawing

const PAD = 32;

/**
 * The whole picture, in export pixels. Mirrors what the canvas renders, in the
 * same order — wires, ink, nodes — so overlaps come out the way they look.
 */
export function buildScene(graph: AgentGraph): Scene {
  const g = visibleGraph(graph);
  const ink = readInk();
  const b = graphBounds(g);
  const offX = -b.minX * GRID + PAD;
  const offY = -b.minY * GRID + PAD;
  const prims: Prim[] = [];

  const X = (v: number) => v * GRID + offX;
  const Y = (v: number) => v * GRID + offY;

  // --- wires ---------------------------------------------------------------
  for (const e of g.edges) {
    const from = g.nodes.find((n) => n.id === e.from);
    const to = g.nodes.find((n) => n.id === e.to);
    if (!from || !to) continue;
    const x1 = X(from.x + NODE_W / 2);
    const y1 = Y(from.y + nodeHeight(from.kind));
    const x2 = X(to.x + NODE_W / 2);
    const y2 = Y(to.y);
    const mid = Math.max(y1 + GRID, (y1 + y2) / 2);
    prims.push({
      t: "path",
      d: `M ${x1} ${y1} L ${x1} ${mid} L ${x2} ${mid} L ${x2} ${y2}`,
      stroke: ink.line,
      sw: 2,
    });
  }

  // --- the drawing layer ---------------------------------------------------
  for (const a of graphAnnotations(graph)) drawAnnotation(prims, a, ink, offX, offY);

  // --- nodes ---------------------------------------------------------------
  for (const n of g.nodes) drawNode(prims, n, graph, ink, X(n.x), Y(n.y));

  return {
    width: Math.max(1, (b.maxX - b.minX) * GRID + PAD * 2),
    height: Math.max(1, (b.maxY - b.minY) * GRID + PAD * 2),
    background: ink.paper,
    prims,
    fonts: readFonts(),
  };
}

function drawAnnotation(prims: Prim[], a: Annotation, ink: Ink, offX: number, offY: number) {
  const color = inkColor(a.color, ink);
  const marker = a.kind === "marker";
  const sw = marker ? a.weight * MARKER_SCALE : a.weight;
  const opacity = marker ? MARKER_ALPHA : undefined;
  const box = annotationBounds(a);
  const x = box.minX * GRID + offX;
  const y = box.minY * GRID + offY;
  const w = (box.maxX - box.minX) * GRID;
  const h = (box.maxY - box.minY) * GRID;

  if (a.kind === "rect") {
    prims.push({ t: "rect", x, y, w, h, stroke: color, sw });
    return;
  }
  if (a.kind === "ellipse") {
    prims.push({ t: "ellipse", cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2, stroke: color, sw });
    return;
  }
  if (isTextKind(a.kind)) {
    const size = a.weight <= 2 ? 12 : a.weight <= 4 ? 16 : 24;
    const pad = a.kind === "note" ? 6 : 0;
    if (a.kind === "note") {
      // The note's wash, then its border — a tinted card, the way the canvas
      // draws it, with the ink token carrying the contrast for the text.
      prims.push({ t: "rect", x, y, w, h, fill: color, fillOpacity: 0.16 });
      prims.push({ t: "rect", x, y, w, h, stroke: color, sw: 2 });
    }
    const lines = wrap(a.text ?? "", size, Math.max(8, w - pad * 2));
    const lh = size * 1.35;
    lines.forEach((line, i) => {
      const baseline = y + pad + lh * i + size * 0.85;
      // Clipped to the card: a note is a fixed box on the canvas and must not
      // grow one in the export.
      if (a.kind === "note" && baseline > y + h - 2) return;
      prims.push({
        t: "text",
        x: x + pad,
        y: baseline,
        text: line,
        size,
        fill: a.kind === "note" ? ink.ink : color,
        family: "mono",
      });
    });
    return;
  }

  const points = (a.points ?? []).map((p) => ({ x: p.x + offX / GRID, y: p.y + offY / GRID }));
  if (points.length === 0) return;
  prims.push({ t: "path", d: strokePath(points, GRID), stroke: color, sw, opacity });
  if (a.kind === "arrow" && points.length > 1) {
    prims.push({
      t: "path",
      d: arrowHead(points[points.length - 2], points[points.length - 1], GRID, a.weight),
      stroke: color,
      sw,
      opacity,
    });
  }
}

function drawNode(
  prims: Prim[],
  n: GraphNode,
  full: AgentGraph,
  ink: Ink,
  x: number,
  y: number,
) {
  const w = NODE_W * GRID;
  const h = nodeHeight(n.kind) * GRID;
  const agentish = isAgentKind(n.kind);
  const border = n.tint ? inkColor(n.tint, ink) : ink.line;

  prims.push({
    t: "rect",
    x,
    y,
    w,
    h,
    fill: n.kind === "orchestrator" ? ink.stone : ink.paper,
    stroke: border,
    sw: 2,
  });

  // Same 8/6 padding and 28px sprite the node component uses, so a screenshot
  // and an export line up character for character.
  const padX = 8;
  let textX = x + padX;
  if (agentish) {
    prims.push({
      t: "image",
      x: x + padX,
      y: y + 8,
      w: 28,
      h: 28,
      src: `/mascots/${MASCOTS[mascotOf(n)].slot}.png`,
    });
    textX = x + padX + 28 + 6;
  }

  const meta = isComponentKind(n.kind) ? KIND_META.find((k) => k.id === n.kind) : undefined;
  const badgeW = meta ? meta.label.length * 7 * PIXEL_CH + 8 : 0;
  const textW = w - (textX - x) - padX - (meta ? badgeW + 6 : 0);

  prims.push({
    t: "text",
    x: textX,
    y: y + 16,
    text: fit(KIND_LABEL[n.kind].toUpperCase(), 8, textW, "pixel"),
    size: 8,
    fill: ink.muted,
    family: "pixel",
  });
  prims.push({
    t: "text",
    x: textX,
    y: y + 30,
    text: fit(n.name, 11, textW, "mono"),
    size: 11,
    fill: ink.ink,
    family: "mono",
    bold: true,
  });
  prims.push({
    t: "text",
    x: textX,
    y: y + 42,
    text: fit(agentish ? (n.role ?? "") : nodeRef(n), 9, textW, "mono"),
    size: 9,
    fill: ink.muted,
    family: "mono",
  });
  if (agentish && n.model) {
    prims.push({
      t: "text",
      x: textX,
      y: y + 54,
      text: fit(n.model, 9, textW, "mono"),
      size: 9,
      fill: ink.muted,
      family: "mono",
    });
  }

  if (meta) {
    const bx = x + w - padX - badgeW;
    prims.push({ t: "rect", x: bx, y: y + 6, w: badgeW, h: 14, fill: ink.stone, stroke: ink.line, sw: 2 });
    prims.push({
      t: "text",
      x: bx + 4,
      y: y + 16,
      text: meta.label.toUpperCase(),
      size: 7,
      fill: ink.ink,
      family: "pixel",
    });
  }

  // The fold's count. Without it an exported graph silently loses a branch and
  // says nothing about where it went.
  if (n.collapsed) {
    const hidden = collapsedCount(full, n.id);
    if (hidden > 0) {
      const label = `+${hidden}`;
      const bw = label.length * 7 * PIXEL_CH + 8;
      const bx = x + w / 2 - bw / 2;
      prims.push({ t: "rect", x: bx, y: y + h - 7, w: bw, h: 14, fill: ink.stone, stroke: ink.line, sw: 2 });
      prims.push({
        t: "text",
        x: bx + 4,
        y: y + h + 3,
        text: label,
        size: 7,
        fill: ink.ink,
        family: "pixel",
      });
    }
  }
}

// --------------------------------------------------------------------- SVG

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A standalone SVG. Bitmaps are inlined as data URIs — a file that reaches for
 * `/mascots/working.png` is a picture that only works on this origin, which is
 * not a picture anyone can send anywhere.
 */
export async function sceneToSvg(scene: Scene): Promise<string> {
  const sprites = new Map<string, string>();
  for (const p of scene.prims) {
    if (p.t !== "image" || sprites.has(p.src)) continue;
    const data = await toDataUri(p.src);
    if (data) sprites.set(p.src, data);
  }

  const body = scene.prims
    .map((p) => {
      switch (p.t) {
        case "rect":
          return `<rect x="${r(p.x)}" y="${r(p.y)}" width="${r(p.w)}" height="${r(p.h)}"${
            p.fill ? ` fill="${p.fill}"` : ` fill="none"`
          }${p.fillOpacity !== undefined ? ` fill-opacity="${p.fillOpacity}"` : ""}${
            p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.sw ?? 2}"` : ""
          }/>`;
        case "path":
          return `<path d="${p.d}" fill="none" stroke="${p.stroke}" stroke-width="${p.sw}" stroke-linecap="square" stroke-linejoin="miter"${
            p.opacity !== undefined ? ` opacity="${p.opacity}"` : ""
          }/>`;
        case "ellipse":
          return `<ellipse cx="${r(p.cx)}" cy="${r(p.cy)}" rx="${r(p.rx)}" ry="${r(p.ry)}" fill="none" stroke="${p.stroke}" stroke-width="${p.sw}"${
            p.opacity !== undefined ? ` opacity="${p.opacity}"` : ""
          }/>`;
        case "text":
          return `<text x="${r(p.x)}" y="${r(p.y)}" fill="${p.fill}" font-family="${esc(
            scene.fonts[p.family],
          )}" font-size="${p.size}"${p.bold ? ` font-weight="700"` : ""} xml:space="preserve">${esc(
            p.text,
          )}</text>`;
        case "image": {
          const href = sprites.get(p.src);
          if (!href) return "";
          return `<image x="${r(p.x)}" y="${r(p.y)}" width="${r(p.w)}" height="${r(
            p.h,
          )}" href="${href}" style="image-rendering:pixelated"/>`;
        }
      }
    })
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r(scene.width)}" height="${r(
    scene.height,
  )}" viewBox="0 0 ${r(scene.width)} ${r(scene.height)}" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="${scene.background}"/>
  ${body}
</svg>`;
}

const r = (n: number) => Math.round(n * 100) / 100;

async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    // A missing sprite drops out of the picture; it is not worth failing an
    // export over, and every mascot slot legitimately may have no PNG yet.
    return null;
  }
}

// --------------------------------------------------------------------- PNG

/**
 * Rasterised through a 2D context rather than by loading the SVG into an
 * <img>: an SVG drawn as an image is sandboxed — it cannot reach the page's
 * fonts — so that route produces a picture in the wrong typeface every time.
 */
export async function sceneToPng(scene: Scene, scale = 2): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(scene.width * scale);
  canvas.height = Math.ceil(scene.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  // Pixel art, up-scaled: smoothing is what turns a 28px sprite to mush.
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = scene.background;
  ctx.fillRect(0, 0, scene.width, scene.height);

  const sprites = new Map<string, HTMLImageElement>();
  for (const p of scene.prims) {
    if (p.t !== "image" || sprites.has(p.src)) continue;
    const img = await loadImage(p.src);
    if (img) sprites.set(p.src, img);
  }

  for (const p of scene.prims) {
    ctx.globalAlpha = 1;
    switch (p.t) {
      case "rect":
        if (p.fill) {
          ctx.globalAlpha = p.fillOpacity ?? 1;
          ctx.fillStyle = p.fill;
          ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.globalAlpha = 1;
        }
        if (p.stroke) {
          ctx.strokeStyle = p.stroke;
          ctx.lineWidth = p.sw ?? 2;
          // Inset by half the stroke: a canvas stroke straddles the path, and
          // a 2px border drawn on the box edge lands half outside it.
          const i = (p.sw ?? 2) / 2;
          ctx.strokeRect(p.x + i, p.y + i, p.w - i * 2, p.h - i * 2);
        }
        break;
      case "path":
        ctx.globalAlpha = p.opacity ?? 1;
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = p.sw;
        ctx.lineCap = "square";
        ctx.lineJoin = "miter";
        ctx.stroke(new Path2D(p.d));
        ctx.globalAlpha = 1;
        break;
      case "ellipse":
        ctx.globalAlpha = p.opacity ?? 1;
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = p.sw;
        ctx.beginPath();
        ctx.ellipse(p.cx, p.cy, Math.max(0, p.rx), Math.max(0, p.ry), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      case "text":
        ctx.fillStyle = p.fill;
        ctx.font = `${p.bold ? "700 " : ""}${p.size}px ${scene.fonts[p.family]}`;
        ctx.textBaseline = "alphabetic";
        ctx.fillText(p.text, p.x, p.y);
        break;
      case "image": {
        const img = sprites.get(p.src);
        if (img) ctx.drawImage(img, p.x, p.y, p.w, p.h);
        break;
      }
    }
  }

  return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ------------------------------------------------------------------ download

/** Build the file and hand it to the browser. One call from the menu. */
export async function exportCanvas(graph: AgentGraph, format: "png" | "svg", name = "agent-canvas") {
  const scene = buildScene(graph);
  const blob =
    format === "svg"
      ? new Blob([await sceneToSvg(scene)], { type: "image/svg+xml" })
      : await sceneToPng(scene);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.${format}`;
  a.click();
  // Revoked on the next turn of the loop, not inline: a click() only *starts*
  // the download, and pulling the blob out from under it in the same tick is
  // how a 300KB SVG arrives as a zero-byte file in Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
