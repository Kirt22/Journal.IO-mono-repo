#!/usr/bin/env python3
"""Build the 1320x2868 App Store hero panel from a GPT Image plate.

The plate arrives 1024x1536 (2:3), which is neither the App Store panel size nor
its aspect. Two things therefore have to happen before anything is drawn on top:

1. The plate is scaled to full panel width and the remaining height below it is
   generated, rather than letterboxed or stretched.
2. Its gradient is remapped onto the one the shipped panels actually use.

Step 2 is not cosmetic. An image model reproduces a described gradient
approximately, and "approximately" is visible the moment panel 0 sits next to
panel 1 in a swipe: this plate came back with the coral glow blooming near the
top, reading +33 red against panel-1 at the same height. The fix is a per-row
correction toward a ramp measured from panel-1's own margins, so the two panels
share a gradient by construction instead of by eye.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import io
import math

import cairosvg
from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO_ROOT = Path(__file__).resolve().parents[1]
PANEL_DIR = REPO_ROOT / "frontend" / "journalio-panels"

PANEL_WIDTH = 1320
PANEL_HEIGHT = 2868

# Columns clear of the device and of panel 1's breakout mood card, so a row
# average over them is background and nothing else. Derived from the canvas
# width rather than fixed, because the iPad panels are 2064 wide and a list
# built for 1320 would sample the middle of them.
def _margin_columns(width: int) -> list[int]:
    band = round(width * 0.114)
    return list(range(8, band, 4)) + list(range(width - band, width - 8, 4))


MARGIN_COLUMNS = _margin_columns(PANEL_WIDTH)

# Cream type sits far above the background in luminance. Everything brighter
# than TYPE_FLOOR is protected from the colour correction at full strength,
# ramping in below it, so the headline keeps its own colour instead of being
# dragged toward the background delta.
TYPE_FLOOR = 90
TYPE_CEIL = 150


def _row_means(image: Image.Image) -> list[tuple[float, float, float]]:
    """Background colour per row, as a median over the margin columns.

    Median rather than mean, because a wide headline line overhangs the sampling
    margin. Averaging let those bright pixels pull the measured background up,
    the correction then over-darkened exactly those rows, and the result was a
    hard horizontal band across the panel at the second line of the headline.
    A median shrugs off that fraction of outliers; a mean cannot.
    """
    pixels = image.load()
    width, height = image.size
    columns = _margin_columns(width)
    middle = len(columns) // 2
    means = []
    for y in range(height):
        row = [pixels[x, y] for x in columns]
        means.append(tuple(sorted(pixel[c] for pixel in row)[middle] for c in range(3)))
    return means


def _smooth(series: list[tuple[float, float, float]], radius: int) -> list[tuple[float, float, float]]:
    """Box-blur the ramp down its length.

    A per-row mean carries the plate's own grain, and correcting toward an
    unsmoothed target would bake that noise into the output as horizontal
    banding. The gradient itself is smooth, so smoothing the target loses
    nothing real.
    """
    out = []
    n = len(series)
    for i in range(n):
        lo, hi = max(0, i - radius), min(n, i + radius + 1)
        window = series[lo:hi]
        count = len(window)
        out.append(tuple(sum(row[c] for row in window) / count for c in range(3)))
    return out


def reference_ramp(reference: Path, size: tuple[int, int] | None = None) -> list[tuple[float, float, float]]:
    """Background colour per row, measured off a shipped panel of the same size.

    The size is a parameter rather than a constant because the iPad set is a
    different canvas *and* a different gradient — it bottoms out around
    (100,50,37) where the iPhone set reaches (151,67,46). Borrowing the iPhone
    ramp for an iPad panel would leave it visibly hotter than its siblings.
    """
    expected = size or (PANEL_WIDTH, PANEL_HEIGHT)
    with Image.open(reference) as handle:
        image = handle.convert("RGB")
        if image.size != expected:
            raise SystemExit(f"reference panel must be {expected[0]}x{expected[1]}, got {image.size}")
        return _smooth(_row_means(image), 24)


def build_base(plate_path: Path, reference: Path) -> Image.Image:
    ramp = reference_ramp(reference)

    with Image.open(plate_path) as handle:
        plate = handle.convert("RGB")

    # Anchored top at full width. The plate covers the upper ~69% of the panel;
    # below that there is no art to scale, only gradient to continue.
    scaled_height = round(plate.height * PANEL_WIDTH / plate.width)
    plate = plate.resize((PANEL_WIDTH, scaled_height), Image.LANCZOS)

    canvas = Image.new("RGB", (PANEL_WIDTH, PANEL_HEIGHT))
    canvas.paste(plate, (0, 0))

    # Continue the plate below its own bottom edge by tiling its last rows. The
    # target ramp has plateaued by then, so the correction below flattens the
    # repeat into a solid field while keeping the grain that makes it read as
    # the same surface rather than flat fill.
    tail = plate.crop((0, scaled_height - 60, PANEL_WIDTH, scaled_height))
    y = scaled_height
    while y < PANEL_HEIGHT:
        canvas.paste(tail, (0, y))
        y += tail.height

    plate_means = _smooth(_row_means(canvas), 24)

    pixels = canvas.load()
    for y in range(PANEL_HEIGHT):
        target = ramp[y]
        source = plate_means[y]
        delta = (target[0] - source[0], target[1] - source[1], target[2] - source[2])
        if abs(delta[0]) < 0.5 and abs(delta[1]) < 0.5 and abs(delta[2]) < 0.5:
            continue
        for x in range(PANEL_WIDTH):
            r, g, b = pixels[x, y]
            # Protect the headline: full correction on background, tapering to
            # none on cream type.
            luma = 0.299 * r + 0.587 * g + 0.114 * b
            if luma >= TYPE_CEIL:
                continue
            weight = 1.0 if luma <= TYPE_FLOOR else (TYPE_CEIL - luma) / (TYPE_CEIL - TYPE_FLOOR)
            pixels[x, y] = (
                min(255, max(0, round(r + delta[0] * weight))),
                min(255, max(0, round(g + delta[1] * weight))),
                min(255, max(0, round(b + delta[2] * weight))),
            )

    # The join where the tiled tail begins is the one hard edge in the frame.
    seam = canvas.crop((0, scaled_height - 40, PANEL_WIDTH, scaled_height + 40))
    canvas.paste(seam.filter(ImageFilter.GaussianBlur(9)), (0, scaled_height - 40))
    return canvas


# ---------------------------------------------------------------- foreground

FONT_DIR = REPO_ROOT / "frontend" / "src" / "assets" / "fonts"
WORDMARK_FONT = FONT_DIR / "BricolageGrotesque-Bold.ttf"

CREAM = (250, 247, 244)
CORAL = (232, 116, 95)

# journal.io lockup, matching frontend/src/components/JournalWordmark.tsx. The
# tracking there is a ratio of the mark's size rather than a point value,
# because a value tuned at one size over-tightens at another, so the ratios are
# carried across rather than a baked-in pixel figure.
WORDMARK_SIZE = 76
WORDMARK_TOP = 250
WORDMARK_TRACKING_RATIO = -0.04
WORDMARK_IO_TRACKING_RATIO = -0.035

# The Product Hunt badge, supplied as artwork and de-keyed by
# scripts/dekey_checkerboard.py. It carries its own wreath, mark and wording,
# so nothing here draws or sets any of that.
BADGE_PATH = REPO_ROOT / "assets" / "badges" / "product-hunt-featured.png"
BADGE_WIDTH = 1000
BADGE_CENTRE_Y = 1660

# The three contours from frontend/src/components/AuthInkBackdrop.tsx, in that
# component's own fractional coordinates. Opacities there are tuned for the
# app's light surface; on this dark plate the same values are invisible, so
# each is carried up while the relative ordering between the three is kept.
WAVE_CONTOURS = [
    ((-0.16, 0.24), (0.12, 0.13), (0.31, 0.35), (0.57, 0.25), (0.98, 0.13), (1.16, 0.30), CORAL, 4.4, 0.38),
    ((-0.18, 0.53), (0.12, 0.42), (0.34, 0.63), (0.62, 0.50), (1.02, 0.38), (1.18, 0.57), CREAM, 3.8, 0.24),
    ((-0.14, 0.79), (0.17, 0.67), (0.39, 0.88), (0.67, 0.74), (1.01, 0.66), (1.14, 0.84), CREAM, 3.4, 0.17),
]
WAVE_BAND_TOP = 1434  # the lower half


def _tracked_width(draw, text, font, tracking):
    return sum(draw.textlength(ch, font=font) for ch in text) + tracking * (len(text) - 1)


def _draw_tracked(draw, origin, text, font, fill, tracking):
    x, y = origin
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking


def _draw_wordmark(draw: ImageDraw.ImageDraw) -> None:
    font = ImageFont.truetype(str(WORDMARK_FONT), WORDMARK_SIZE)
    tracking = WORDMARK_SIZE * WORDMARK_TRACKING_RATIO
    io_tracking = WORDMARK_SIZE * WORDMARK_IO_TRACKING_RATIO

    journal_width = _tracked_width(draw, "journal", font, tracking)
    io_width = _tracked_width(draw, ".io", font, io_tracking)
    x = (PANEL_WIDTH - (journal_width + tracking + io_width)) / 2

    _draw_tracked(draw, (x, WORDMARK_TOP), "journal", font, CREAM + (255,), tracking)
    # The component sets the same negative tracking as the gap before ".io", so
    # the two halves read as one mark rather than two words with a space.
    _draw_tracked(draw, (x + journal_width + tracking, WORDMARK_TOP), ".io", font, CORAL + (255,), io_tracking)


def _bezier(points, steps=140):
    """Flatten a cubic Bezier to a polyline for ImageDraw.line."""
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = points
    out = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        out.append((
            u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
            u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ))
    return out


def _draw_waves(canvas: Image.Image) -> None:
    """Redraw the auth screen's ink contours across the lower half.

    AuthInkBackdrop describes each contour as a C followed by an S. An S
    segment's first control point is the previous segment's second control
    point mirrored through the join, which is what the reflection below
    reconstructs — dropping that would flatten the second half of every curve.
    """
    band_height = PANEL_HEIGHT - WAVE_BAND_TOP
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    for start, c1, c2, mid, s2, end, colour, width, opacity in WAVE_CONTOURS:
        def place(point):
            return (point[0] * PANEL_WIDTH, WAVE_BAND_TOP + point[1] * band_height)

        p0, p1, p2, p3 = place(start), place(c1), place(c2), place(mid)
        reflected = (2 * p3[0] - p2[0], 2 * p3[1] - p2[1])
        points = _bezier((p0, p1, p2, p3)) + _bezier((p3, reflected, place(s2), place(end)))
        draw.line(points, fill=colour + (round(255 * opacity),), width=round(width), joint="curve")

    canvas.alpha_composite(layer)


def _draw_badge(overlay: Image.Image) -> None:
    """Composite the Product Hunt badge into the middle of the panel."""
    with Image.open(BADGE_PATH) as handle:
        badge = handle.convert("RGBA")

    if badge.width < BADGE_WIDTH:
        raise SystemExit(
            f"badge art is {badge.width}px wide and would be upscaled to {BADGE_WIDTH}px; supply larger artwork"
        )

    height = round(badge.height * BADGE_WIDTH / badge.width)
    badge = badge.resize((BADGE_WIDTH, height), Image.LANCZOS)
    overlay.alpha_composite(
        badge, ((PANEL_WIDTH - BADGE_WIDTH) // 2, BADGE_CENTRE_Y - height // 2)
    )


def compose(canvas: Image.Image) -> Image.Image:
    canvas = canvas.convert("RGBA")
    _draw_waves(canvas)

    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    _draw_wordmark(draw)
    _draw_badge(overlay)

    return Image.alpha_composite(canvas, overlay).convert("RGB")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plate", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--reference", type=Path, default=PANEL_DIR / "panel-1.png")
    args = parser.parse_args()

    canvas = compose(build_base(args.plate, args.reference))
    if canvas.size != (PANEL_WIDTH, PANEL_HEIGHT):
        raise SystemExit(f"refusing to write {canvas.size}; App Store Connect requires {PANEL_WIDTH}x{PANEL_HEIGHT}")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.out)
    print(f"wrote {args.out} at {canvas.size[0]}x{canvas.size[1]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
