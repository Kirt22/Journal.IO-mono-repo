#!/usr/bin/env python3
"""Recover real transparency from an image with a checkerboard painted into it.

Image tools that render a "transparent" preview and then export RGB leave the
checkerboard baked in as pixels. The result looks transparent and is not: the
alpha channel is absent, and compositing it over anything shows the grey
squares.

This is recoverable here because the two things never overlap in value. The
checker is mid-grey (~218 and ~237) and fully desaturated; the badge artwork is
pure white and a saturated orange. So alpha comes from two independent signals —
brightness above the checker's ceiling, and saturation — and the foreground is
snapped back to the two flat colours it was drawn in rather than left carrying
the grey it was blended with.

Usage: dekey_checkerboard.py in.png out.png
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

# The checker's lighter square tops out around 238. Anything brighter than the
# floor is artwork; the ramp to the ceiling keeps antialiased edges soft rather
# than stair-stepped.
WHITE_FLOOR = 244
WHITE_CEIL = 253

# Saturation at which a pixel is taken as fully the orange mark, and the noise
# floor below it. The floor is not optional: the checker is desaturated only in
# intent, and carries 1-2 units of compression noise. Ramping straight from
# zero turned every one of those into a few units of alpha, which is invisible
# on its own and, across 770k background pixels, a full grey haze once the
# badge is composited.
SATURATION_FLOOR = 14
SATURATION_FULL = 70
SATURATION_IS_ORANGE = 35

WHITE = (255, 255, 255)


def dekey(image: Image.Image, orange: tuple[int, int, int]) -> Image.Image:
    source = image.convert("RGB")
    out = Image.new("RGBA", source.size, (0, 0, 0, 0))
    src, dst = source.load(), out.load()
    width, height = source.size

    for y in range(height):
        for x in range(width):
            r, g, b = src[x, y]
            saturation = max(r, g, b) - min(r, g, b)

            from_white = (max(r, g, b) - WHITE_FLOOR) / (WHITE_CEIL - WHITE_FLOOR)
            from_orange = (saturation - SATURATION_FLOOR) / (SATURATION_FULL - SATURATION_FLOOR)
            alpha = max(0.0, min(1.0, max(from_white, from_orange)))
            if alpha <= 0.0:
                continue

            colour = orange if saturation > SATURATION_IS_ORANGE else WHITE
            dst[x, y] = colour + (round(alpha * 255),)

    return out


def dominant_orange(image: Image.Image) -> tuple[int, int, int]:
    """The artwork's own accent colour, rather than a guessed brand hex."""
    from collections import Counter

    source = image.convert("RGB")
    width, height = source.size
    pixels = source.load()
    counts: Counter = Counter()
    for y in range(0, height, 3):
        for x in range(0, width, 3):
            pixel = pixels[x, y]
            if max(pixel) - min(pixel) > 60:
                counts[pixel] += 1
    if not counts:
        raise SystemExit("no saturated pixels found; is this the right image?")
    return counts.most_common(1)[0][0]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("out", type=Path)
    args = parser.parse_args()

    with Image.open(args.source) as handle:
        orange = dominant_orange(handle)
        keyed = dekey(handle, orange)

    box = keyed.getchannel("A").getbbox()
    if box is None:
        raise SystemExit("nothing survived keying; thresholds are wrong for this image")
    keyed = keyed.crop(box)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    keyed.save(args.out)
    print(f"wrote {args.out} at {keyed.size[0]}x{keyed.size[1]}, accent {orange}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
