#!/usr/bin/env python3
"""Build the v2 App Store hero panel: wordmark, headline, photo collage, badge.

The v1 panel leaned on an image-model plate for its whole surface, which meant
the headline was baked into raster art and could not be reset. v2 needs a serif
headline over a photo grid, so the background is synthesised here instead:

  * the vertical gradient is the one measured off the shipped panel-1, so this
    panel matches the rest of the set by construction rather than by eye;
  * the grain is lifted from the model plate's own clean lower band, because
    synthetic noise reads flatter than the film grain the other panels carry;
  * a single wide coral glow gives the upper half some depth behind the type.

No wave contours here — v1's ink lines are deliberately gone.

Usage: build_app_store_hero_v2.py --out frontend/journalio-panels/panel-0-hero-v2.png
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

from build_app_store_panel import reference_ramp

REPO_ROOT = Path(__file__).resolve().parents[1]
PANEL_DIR = REPO_ROOT / "frontend" / "journalio-panels"
PANEL_DIR_IPAD = REPO_ROOT / "frontend" / "journalio-panels-iPad"


def PANEL_DIR_FOR(device) -> Path:
    return PANEL_DIR_IPAD if device.name == "ipad" else PANEL_DIR
PHOTO_DIR = REPO_ROOT / "frontend" / "image goods"
FONT_DIR = REPO_ROOT / "frontend" / "src" / "assets" / "fonts"

WORDMARK_FONT = FONT_DIR / "BricolageGrotesque-Bold.ttf"
# The same face the other seven panels are set in. An editorial serif read well
# on its own, but a lead panel in a different typeface reads as a panel from a
# different app once the set is swiped through in order.
HEADLINE_FONT = FONT_DIR / "BricolageGrotesque-Bold.ttf"
SUBHEAD_FONT = FONT_DIR / "SchibstedGrotesk-Regular.ttf"

BADGE_PATH = REPO_ROOT / "assets" / "badges" / "product-hunt-featured.png"
GRAIN_PLATE = PANEL_DIR / "plates" / "plate-0-hero.png"

CREAM = (250, 247, 244)
CORAL = (232, 116, 95)
SUBHEAD_COLOUR = (250, 247, 244, 190)

# Peak alpha of the coral wash before it is blurred out; the blur radius scales
# with each device's glow radius so the falloff stays proportional.
GLOW_STRENGTH = 12

WORDMARK_TRACKING_RATIO = -0.04
WORDMARK_IO_TRACKING_RATIO = -0.035
CELL_RADIUS = 28

# Wording is deliberate: field encryption and AES-256 at rest are documented in
# docs/SECURITY_MODEL.md, the biometric lock and the export/delete flow both
# ship, and the same document (line 90) forbids ever claiming end-to-end
# encryption. This line stays on the right side of that.
SUBHEAD = "Encrypted at rest. Yours to export or delete."

# Column widths measured off the reference panel, as fractions of its 978px
# interior: top row 331/363/237, bottom row 251/363/316. The middle column is
# the same width in both rows and the outer two are not, and that mismatch is
# the whole reason the grid reads editorial rather than like a spreadsheet.
COLLAGE_ROW_WEIGHTS = (
    (331, 363, 237),
    (251, 363, 316),
)


@dataclass(frozen=True)
class Device:
    """Everything that differs between the two App Store canvases.

    The drawing code below is shared; only these numbers change. They are not
    a uniform scale of one another — the iPad is 0.75 aspect against the
    iPhone's 0.46, so the headline takes two lines instead of three and the
    vertical rhythm is retuned rather than stretched.
    """

    name: str
    width: int
    height: int
    reference: str
    margin: int

    wordmark_top: int
    wordmark_size: int

    headline_top: int
    headline_size: int
    headline_leading: int
    headline_lines: tuple[str, ...]

    subhead_top: int
    subhead_size: int
    subhead_leading: int

    collage_top: int
    collage_overhang: int
    collage_gap: int
    cell_height: int

    badge_top: int
    badge_width: int

    glow_centre_y: int
    glow_radius: int

    @property
    def content_width(self) -> int:
        return self.width - self.margin * 2


IPHONE = Device(
    name="iphone",
    width=1320,
    height=2868,
    reference="panel-1.png",
    margin=96,
    wordmark_top=170,
    wordmark_size=58,
    headline_top=330,
    headline_size=167,
    headline_leading=175,
    headline_lines=("Notice", "what keeps", "coming back"),
    subhead_top=940,
    subhead_size=52,
    subhead_leading=64,
    collage_top=1210,
    collage_overhang=30,
    collage_gap=34,
    cell_height=522,
    badge_top=2460,
    badge_width=460,
    glow_centre_y=720,
    glow_radius=940,
)

# The iPad panel is wider than it is tall by comparison, so a three-line
# headline would fill about half the measure and look stranded. Two lines at
# 190 fill ~86% of the column, matching how the iPhone break fills its own.
IPAD = Device(
    name="ipad",
    width=2064,
    height=2752,
    reference="ipad-1.png",
    margin=150,
    wordmark_top=130,
    wordmark_size=76,
    headline_top=265,
    headline_size=179,
    headline_leading=188,
    headline_lines=("Notice what keeps", "coming back"),
    subhead_top=720,
    subhead_size=58,
    subhead_leading=64,
    collage_top=940,
    collage_overhang=40,
    collage_gap=53,
    cell_height=600,
    badge_top=2340,
    badge_width=560,
    glow_centre_y=640,
    glow_radius=1180,
)

DEVICES = {device.name: device for device in (IPHONE, IPAD)}


# ----------------------------------------------------------------- background

def _gradient(device: Device) -> Image.Image:
    """A flat vertical ramp lifted from the matching shipped panel's margins."""
    ramp = reference_ramp(PANEL_DIR_FOR(device) / device.reference, (device.width, device.height))
    canvas = Image.new("RGB", (device.width, device.height))
    draw = ImageDraw.Draw(canvas)
    for y, colour in enumerate(ramp):
        draw.line([(0, y), (device.width, y)], fill=tuple(round(c) for c in colour))
    return canvas


def _add_glow(canvas: Image.Image, device: Device) -> None:
    mask = Image.new("L", (device.width, device.height), 0)
    cx, cy, r = device.width // 2, device.glow_centre_y, device.glow_radius
    ImageDraw.Draw(mask).ellipse((cx - r, cy - r, cx + r, cy + r), fill=GLOW_STRENGTH)
    # Blurred far wider than the shape itself, so what lands is a wash with no
    # detectable edge rather than a visible disc.
    mask = mask.filter(ImageFilter.GaussianBlur(round(r * 0.38)))
    canvas.paste(Image.new("RGB", canvas.size, CORAL), (0, 0), mask)


def _add_grain(canvas: Image.Image, device: Device) -> None:
    """Carry over the plate's film grain so the panel shares the set's surface."""
    with Image.open(GRAIN_PLATE) as handle:
        plate = handle.convert("RGB")

    # Scaled to the iPhone width regardless of target, then tiled. Stretching a
    # 1024px plate across the 2064px iPad would halve the grain frequency and
    # read as blotching rather than film.
    scaled_height = round(plate.height * IPHONE.width / plate.width)
    plate = plate.resize((IPHONE.width, scaled_height), Image.LANCZOS)

    # The plate's headline sits at y 621-864; sample well below it so only
    # background texture is picked up.
    tile = plate.crop((0, 1000, IPHONE.width, min(scaled_height, 1900)))
    grain = ImageChops.subtract(tile, tile.filter(ImageFilter.GaussianBlur(2.2)), scale=1, offset=128)

    field = Image.new("RGB", (device.width, device.height), (128, 128, 128))
    for y in range(0, device.height, grain.height):
        for x in range(0, device.width, grain.width):
            field.paste(grain, (x, y))
    canvas.paste(ImageChops.add(canvas, field, scale=1, offset=-128), (0, 0))


# ----------------------------------------------------------------- foreground

def _tracked_width(draw, text, font, tracking):
    return sum(draw.textlength(ch, font=font) for ch in text) + tracking * (len(text) - 1)


def _draw_tracked(draw, origin, text, font, fill, tracking):
    x, y = origin
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking


def _draw_wordmark(draw: ImageDraw.ImageDraw, device: Device) -> None:
    """journal.io, left-aligned on the shared margin.

    Tracking follows the ratios in frontend/src/components/JournalWordmark.tsx
    rather than a pixel value, since a figure tuned at one size over-tightens
    at another — which is exactly what would happen across two canvases.
    """
    font = ImageFont.truetype(str(WORDMARK_FONT), device.wordmark_size)
    tracking = device.wordmark_size * WORDMARK_TRACKING_RATIO
    io_tracking = device.wordmark_size * WORDMARK_IO_TRACKING_RATIO

    _draw_tracked(draw, (device.margin, device.wordmark_top), "journal", font, CREAM, tracking)
    width = _tracked_width(draw, "journal", font, tracking)
    _draw_tracked(
        draw, (device.margin + width + tracking, device.wordmark_top), ".io", font, CORAL, io_tracking
    )


def _draw_headline(draw: ImageDraw.ImageDraw, device: Device) -> None:
    font = ImageFont.truetype(str(HEADLINE_FONT), device.headline_size)

    widest = max(draw.textlength(line, font=font) for line in device.headline_lines)
    if widest > device.content_width:
        raise SystemExit(
            f"{device.name}: headline overruns the margin — widest line is "
            f"{widest:.0f}px against {device.content_width}px"
        )

    for index, line in enumerate(device.headline_lines):
        draw.text(
            (device.margin, device.headline_top + index * device.headline_leading),
            line,
            font=font,
            fill=CREAM,
        )


def _draw_subhead(draw: ImageDraw.ImageDraw, device: Device) -> None:
    """A quiet supporting line under the headline, on the same left margin."""
    font = ImageFont.truetype(str(SUBHEAD_FONT), device.subhead_size)

    lines: list[str] = []
    current = ""
    for word in SUBHEAD.split():
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=font) <= device.content_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)

    # Report rather than shrink: a subhead quietly reflowing to another line
    # would push into the collage instead of failing where it can be seen.
    if len(lines) > 2:
        raise SystemExit(f"{device.name}: subhead wraps to {len(lines)} lines, expected at most 2")

    for index, line in enumerate(lines):
        draw.text(
            (device.margin, device.subhead_top + index * device.subhead_leading),
            line,
            font=font,
            fill=SUBHEAD_COLOUR,
        )


def _cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Crop to the target aspect from the centre, then scale. Never distort."""
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    crop_w, crop_h = target_w / scale, target_h / scale
    left = (image.width - crop_w) / 2
    top = (image.height - crop_h) / 2
    return image.resize(size, Image.LANCZOS, box=(left, top, left + crop_w, top + crop_h))


def _rounded(image: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, image.width - 1, image.height - 1), radius=radius, fill=255
    )
    out = image.convert("RGBA")
    out.putalpha(mask)
    return out


def _collage_bottom(device: Device) -> int:
    rows = len(COLLAGE_ROW_WEIGHTS)
    return device.collage_top + device.cell_height * rows + device.collage_gap * (rows - 1)


def _draw_collage(canvas: Image.Image, device: Device) -> None:
    photos = sorted(PHOTO_DIR.glob("ChatGPT Image*.png"))
    expected = sum(len(row) for row in COLLAGE_ROW_WEIGHTS)
    if len(photos) != expected:
        raise SystemExit(f"expected {expected} collage photographs, found {len(photos)}")

    span = device.width + device.collage_overhang * 2
    index = 0
    for row_number, weights in enumerate(COLLAGE_ROW_WEIGHTS):
        gaps = device.collage_gap * (len(weights) - 1)
        unit = (span - gaps) / sum(weights)

        x = float(-device.collage_overhang)
        y = device.collage_top + row_number * (device.cell_height + device.collage_gap)
        for weight in weights:
            width = round(weight * unit)
            with Image.open(photos[index]) as handle:
                photo = handle.convert("RGB")
            canvas.alpha_composite(
                _rounded(_cover(photo, (width, device.cell_height)), CELL_RADIUS), (round(x), y)
            )
            x += width + device.collage_gap
            index += 1


def _draw_badge(canvas: Image.Image, device: Device) -> None:
    bottom_of_collage = _collage_bottom(device)
    if device.badge_top < bottom_of_collage + 80:
        raise SystemExit(
            f"{device.name}: badge at y={device.badge_top} crowds the collage, "
            f"which ends at y={bottom_of_collage}"
        )

    with Image.open(BADGE_PATH) as handle:
        badge = handle.convert("RGBA")
    if badge.width < device.badge_width:
        raise SystemExit(f"badge art is only {badge.width}px wide; it would be upscaled")

    height = round(badge.height * device.badge_width / badge.width)
    badge = badge.resize((device.badge_width, height), Image.LANCZOS)
    canvas.alpha_composite(badge, ((device.width - device.badge_width) // 2, device.badge_top))

    if device.badge_top + height > device.height - 120:
        raise SystemExit(
            f"{device.name}: badge ends at y={device.badge_top + height}, inside the bottom safe area"
        )


def build(device: Device) -> Image.Image:
    background = _gradient(device)
    _add_glow(background, device)
    _add_grain(background, device)

    canvas = background.convert("RGBA")
    _draw_collage(canvas, device)
    _draw_badge(canvas, device)

    draw = ImageDraw.Draw(canvas)
    _draw_wordmark(draw, device)
    _draw_headline(draw, device)
    _draw_subhead(draw, device)
    return canvas.convert("RGB")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device", choices=sorted(DEVICES), default="iphone")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()

    device = DEVICES[args.device]
    out = args.out or PANEL_DIR_FOR(device) / f"panel-0-hero-v2-{device.name}.png"

    panel = build(device)
    if panel.size != (device.width, device.height):
        raise SystemExit(
            f"refusing to write {panel.size}; App Store Connect requires {device.width}x{device.height}"
        )
    out.parent.mkdir(parents=True, exist_ok=True)
    panel.save(out)
    print(f"wrote {out} at {panel.size[0]}x{panel.size[1]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
