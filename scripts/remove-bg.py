#!/usr/bin/env python3
"""
Transparent-background maker for the mascot pixel art.

Naive "delete all white" would punch holes through the chef hat, parachute,
thought bubble, magnifier lens, headphones band, etc. — they all contain white.
So we flood-fill from the image border and only clear the white that is
CONNECTED to the edge. Interior whites are preserved.

Usage:
    python3 scripts/remove-bg.py <input_dir> <output_dir> [tolerance]

Reads every PNG/JPG in <input_dir>, writes a transparent RGBA PNG (same name)
to <output_dir>.
"""
import sys
from collections import deque
from pathlib import Path
from PIL import Image

TOL = 30  # how close to pure white counts as background


def is_whiteish(px, tol):
    r, g, b = px[0], px[1], px[2]
    return (255 - r) <= tol and (255 - g) <= tol and (255 - b) <= tol


def strip(path: Path, out: Path, tol: int):
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()

    bg = bytearray(w * h)  # 1 = background, flood-filled
    q = deque()

    def consider(x, y):
        if 0 <= x < w and 0 <= y < h and not bg[y * w + x] and is_whiteish(px[x, y], tol):
            bg[y * w + x] = 1
            q.append((x, y))

    # seed from every border pixel
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

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG")
    return sum(bg)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    in_dir = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    tol = int(sys.argv[3]) if len(sys.argv) > 3 else TOL

    files = sorted(
        p for p in in_dir.iterdir()
        if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
    )
    if not files:
        print(f"no images in {in_dir}")
        sys.exit(1)

    for p in files:
        cleared = strip(p, out_dir / f"{p.stem}.png", tol)
        print(f"  {p.name:24} -> {p.stem}.png  ({cleared} px cleared)")
    print(f"done: {len(files)} images -> {out_dir}")


if __name__ == "__main__":
    main()
