import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Habibi reaches the DOM through next/font/google, but Satori (behind
// ImageResponse) needs raw font bytes, so the ttf is vendored in /assets.
// Cached per process — every generated image reads the same file.
let habibiPromise: Promise<Buffer> | null = null;

export async function habibiFont() {
  habibiPromise ??= readFile(join(process.cwd(), "assets/Habibi-Regular.ttf"));
  return {
    name: "Habibi",
    data: await habibiPromise,
    weight: 400 as const,
    style: "normal" as const,
  };
}

// Satori has no filesystem and won't fetch a relative URL, so the mark has to
// be inlined as a data URI. Vendored next to the font for the same reason:
// both are read off disk at render time. Cached per process.
let logoPromise: Promise<string> | null = null;

export async function logoDataUri() {
  logoPromise ??= readFile(join(process.cwd(), "assets/logo-mark.png")).then(
    (buf) => `data:image/png;base64,${buf.toString("base64")}`,
  );
  return logoPromise;
}

// Mirrors the light-theme tokens in app/globals.css. Generated images can't
// read CSS vars, and they always render on the light ground.
export const BRAND = {
  paper: "#f7f5f0",
  ink: "#17150f",
  coral: "#ef5c47",
  muted: "#7e776a",
} as const;
