#!/usr/bin/env python3
"""
Mascot pipeline v2: per-sprite white removal + body-normalized sizing.

Background removal (flood fill from the border) keeps interior whites, but two
sprites need special handling:
  - rocket: its body is near-pure-white and merges with the white bg, so it
    uses a low tolerance to avoid the flood bridging into the body.
  - paragliding: has ENCLOSED pure-white bg pockets between the strings that the
    border flood can't reach, so it gets an extra "kill pure white" pass.

Sizing: every sprite is scaled so its CREATURE BODY (largest orange connected
component) has the same absolute height, then centred on a shared square canvas.
Because the canvas is identical for all, a contain-fit render shows every body
at the same size — regardless of how far props (pan, rocket, parachute) extend.

Usage: python3 scripts/build-mascots.py <raw_dir> <out_dir>
"""
import sys
from collections import deque
from pathlib import Path
from PIL import Image

TARGET_BODY_H = 200  # absolute body height every sprite is scaled to
MARGIN = 24

# per-sprite background tolerance (default 10)
TOL = {}
# sprites whose enclosed pure-white pockets are BACKGROUND -> remove them
KILL_PURE_WHITE = {"paragliding"}
# sprites whose enclosed removed regions are interior HIGHLIGHTS -> refill white
# (rocket's white body highlights read as bg-white and get flooded away)
FILL_HOLES = {"rocket"}
PURE = 250  # >= this on all channels counts as pure white


def is_whiteish(px, tol):
    r, g, b = px[0], px[1], px[2]
    return (255 - r) <= tol and (255 - g) <= tol and (255 - b) <= tol


def flood_clear(img, tol):
    w, h = img.size
    px = img.load()
    bg = bytearray(w * h)
    q = deque()

    def consider(x, y):
        if 0 <= x < w and 0 <= y < h and not bg[y * w + x] and is_whiteish(px[x, y], tol):
            bg[y * w + x] = 1
            q.append((x, y))

    for x in range(w):
        consider(x, 0)
        consider(x, h - 1)
    for y in range(h):
        consider(0, y)
        consider(w - 1, y)
    while q:
        x, y = q.popleft()
        consider(x + 1, y)
        consider(x - 1, y)
        consider(x, y + 1)
        consider(x, y - 1)

    for y in range(h):
        row = y * w
        for x in range(w):
            if bg[row + x]:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)


def kill_pure_white(img):
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and r >= PURE and g >= PURE and b >= PURE:
                px[x, y] = (r, g, b, 0)


def fill_enclosed_holes(img):
    """Transparent pixels NOT reachable from the border are interior holes
    (highlights wrongly keyed out) — refill them opaque white."""
    w, h = img.size
    px = img.load()
    ext = bytearray(w * h)  # reachable-from-border transparency
    q = deque()

    def consider(x, y):
        if 0 <= x < w and 0 <= y < h and not ext[y * w + x] and px[x, y][3] == 0:
            ext[y * w + x] = 1
            q.append((x, y))

    for x in range(w):
        consider(x, 0)
        consider(x, h - 1)
    for y in range(h):
        consider(0, y)
        consider(w - 1, y)
    while q:
        x, y = q.popleft()
        consider(x + 1, y)
        consider(x - 1, y)
        consider(x, y + 1)
        consider(x, y - 1)

    filled = 0
    for y in range(h):
        row = y * w
        for x in range(w):
            if px[x, y][3] == 0 and not ext[row + x]:
                px[x, y] = (255, 255, 255, 255)
                filled += 1
    return filled


def is_orange(r, g, b):
    return r > 150 and (r - b) > 55 and g > 45 and g < (r - 15)


def body_bbox(img):
    """Bounding box of the largest orange connected component (the creature)."""
    small = img.convert("RGBA").resize((img.width // 3, img.height // 3))
    px = small.load()
    w, h = small.size
    mask = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 128 and is_orange(r, g, b):
                mask[y * w + x] = 1
    seen = bytearray(w * h)
    best = None
    bestn = 0
    for sy in range(h):
        for sx in range(w):
            i = sy * w + sx
            if mask[i] and not seen[i]:
                q = deque([(sx, sy)])
                seen[i] = 1
                n = 0
                x0 = x1 = sx
                y0 = y1 = sy
                while q:
                    x, y = q.popleft()
                    n += 1
                    x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y)
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and mask[ny * w + nx] and not seen[ny * w + nx]:
                            seen[ny * w + nx] = 1
                            q.append((nx, ny))
                if n > bestn:
                    bestn = n
                    best = (x0 * 3, y0 * 3, x1 * 3, y1 * 3)
    return best


def main():
    raw, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in raw.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"})

    # pass 1: bg-remove, measure body, compute per-sprite scale + scaled full size
    prepared = []
    max_dim = 0
    for p in files:
        im = Image.open(p).convert("RGBA")
        flood_clear(im, TOL.get(p.stem, 10))
        if p.stem in KILL_PURE_WHITE:
            kill_pure_white(im)
        if p.stem in FILL_HOLES:
            fill_enclosed_holes(im)
        bb = im.getbbox()
        im = im.crop(bb)  # trim transparent margin
        body = body_bbox(im)
        bh = (body[3] - body[1]) if body else im.height
        scale = TARGET_BODY_H / max(1, bh)
        nw, nh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
        im = im.resize((nw, nh), Image.NEAREST)
        prepared.append((p.stem, im))
        max_dim = max(max_dim, nw, nh)

    canvas = max_dim + 2 * MARGIN
    # pass 2: center each on the shared canvas
    for stem, im in prepared:
        out_img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
        out_img.paste(im, ((canvas - im.width) // 2, (canvas - im.height) // 2), im)
        out_img.save(out / f"{stem}.png", "PNG")
        print(f"  {stem:14} body->{TARGET_BODY_H}  placed {im.width}x{im.height} on {canvas}")
    print(f"done: {len(prepared)} sprites, canvas={canvas}")


if __name__ == "__main__":
    main()
