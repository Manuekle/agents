# Mascot assets

Pixel-art PNGs, one per state slot, on a transparent 256×256 canvas.

The sources are authored at 1024×1024 and live in `assets/mascots-raw/` —
outside `public/`, so the 13 MB of originals never ship to the browser. The
served copies are a NEAREST-neighbour 4× downscale (1024 → 256), which is
lossless for pixel art at an integer ratio and takes the served set from
13 MB to ~870 KB. The largest on-screen render is 120 px, so 256 still covers 2× DPI.

Slots:
- sherlock.png
- wizard.png
- coffee.png
- rocket.png
- headphones.png
- paragliding.png
- sleeping.png
- working.png
- thinking.png
- cooking.png

Regenerate from the raws:

```bash
python3 - <<'PY'
from PIL import Image
import glob, os
for p in sorted(glob.glob('assets/mascots-raw/*.png')):
    out = os.path.join('public/mascots', os.path.basename(p))
    Image.open(p).convert('RGBA').resize((256, 256), Image.NEAREST).save(out, optimize=True)
PY
```

Rendered with `image-rendering: pixelated`.
