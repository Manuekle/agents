# Mascot assets

Pixel-art PNGs, one per state slot, on a transparent 1024×1024 canvas.

These ship exactly as authored — they already come background-free, so they
no longer pass through scripts/remove-bg.py or the NEAREST resize step. Each
slot file is a byte-for-byte copy of its source in _raw/.

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

Sources live in _raw/ under the same slot names. Rendered with
image-rendering: pixelated.
