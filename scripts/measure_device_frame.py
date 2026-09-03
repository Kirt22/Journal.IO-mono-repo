#!/usr/bin/env python3
"""Measure the transparent screen opening in a device-frame PNG.

The gallery generator composites each screenshot *under* the frame, through the
frame's transparent screen cutout, so `device.screenBounds` in the gallery
config has to match that cutout exactly. Measuring it by eye in a design tool
puts the screenshot a few pixels off and the error only shows up as a sliver of
background along one edge of the finished slide.

Usage:

    python3 scripts/measure_device_frame.py assets/device-frame.png
    python3 scripts/measure_device_frame.py assets/device-frame.png \\
        --write product-hunt-gallery.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageOps
except ModuleNotFoundError as exc:
    if exc.name == "PIL":
        raise SystemExit(
            "Pillow is required. Install it with: python3 -m pip install Pillow"
        ) from None
    raise


# iPhone 17 Pro is 1206x2622 px, so a correctly cut opening lands here. This is
# a sanity band, not a hard gate: a frame with slightly rounded corner tolerance
# measures a hair off, and a frame for a different device is legitimately
# different. Anything outside it is worth a second look before rendering.
EXPECTED_SCREEN_ASPECT = 1206 / 2622
ASPECT_TOLERANCE = 0.02


class MeasurementError(RuntimeError):
    """Raised when the frame has no usable transparent opening."""


def _interior_transparent_mask(image: Image.Image) -> Image.Image:
    """Mask of transparent pixels enclosed by the frame, i.e. the screen cutout.

    Taking the bounding box of every transparent pixel does not work on a real
    device frame: the phone has rounded outer corners, so the transparent
    background touches the cutout's own bounding box and the measurement
    silently returns the whole image. Flood-filling the exterior transparency
    away first leaves only the transparency the frame actually encloses.
    """
    transparent = image.getchannel("A").point(lambda alpha: 255 if alpha == 0 else 0)

    # A one-pixel transparent margin guarantees every exterior region is
    # connected to the seed, even for a frame cropped flush to the device.
    padded = Image.new("L", (transparent.width + 2, transparent.height + 2), 255)
    padded.paste(transparent, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128)

    return padded.crop((1, 1, padded.width - 1, padded.height - 1)).point(
        lambda value: 255 if value == 255 else 0
    )


def measure_screen_bounds(frame_path: Path) -> dict[str, object]:
    with Image.open(frame_path) as source:
        frame = ImageOps.exif_transpose(source).convert("RGBA")

    if frame.getchannel("A").getbbox() is None:
        raise MeasurementError(f"{frame_path} is fully transparent")

    interior = _interior_transparent_mask(frame)
    bbox = interior.getbbox()
    if bbox is None:
        raise MeasurementError(
            f"{frame_path} has no enclosed transparent region, so it has no "
            "screen opening. A flattened phone mockup cannot be used as the "
            "frame: the screenshot is composited through the cutout."
        )

    left, top, right, bottom = bbox
    width, height = right - left, bottom - top
    if width < 1 or height < 1:
        raise MeasurementError(f"{frame_path} screen opening measured {width}x{height}")

    # How much of the measured box is actually cut out. A clean rectangular
    # opening with rounded corners lands just under 1.0; a low ratio means the
    # box spans several separate holes (a camera cutout measured together with
    # the screen, say) and the numbers should not be trusted.
    cutout_pixels = interior.crop(bbox).histogram()[255]
    fill_ratio = cutout_pixels / (width * height)

    return {
        "frame": str(frame_path),
        "frameSize": [frame.width, frame.height],
        "screenBounds": {"x": left, "y": top, "width": width, "height": height},
        "aspect": width / height,
        "fillRatio": fill_ratio,
    }


def _write_config(config_path: Path, screen_bounds: dict[str, int]) -> None:
    config = json.loads(config_path.read_text(encoding="utf-8"))
    device = config.get("device")
    if not isinstance(device, dict):
        raise MeasurementError(f"{config_path} has no device object to update")
    device["screenBounds"] = screen_bounds
    config_path.write_text(
        json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("frame", type=Path, help="path to the transparent frame PNG")
    parser.add_argument(
        "--write",
        type=Path,
        default=None,
        metavar="CONFIG",
        help="write the measured screenBounds into this gallery config",
    )
    args = parser.parse_args(argv)

    try:
        measurement = measure_screen_bounds(args.frame)
    except MeasurementError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except OSError as exc:
        print(f"error: could not open frame: {exc}", file=sys.stderr)
        return 1

    bounds = measurement["screenBounds"]
    frame_width, frame_height = measurement["frameSize"]
    aspect = measurement["aspect"]
    fill_ratio = measurement["fillRatio"]

    print(f"frame          {args.frame} ({frame_width}x{frame_height})")
    print(
        "screenBounds   "
        f'x={bounds["x"]} y={bounds["y"]} '
        f'width={bounds["width"]} height={bounds["height"]}'
    )
    print(f"screen aspect  {aspect:.4f} (iPhone 17 Pro is {EXPECTED_SCREEN_ASPECT:.4f})")

    print(f"cutout fill    {fill_ratio:.3f} of the measured box is open")

    if fill_ratio < 0.95:
        print(
            "warning        the measured box is not mostly open, so it probably "
            "spans more than one cutout; inspect the frame before rendering",
            file=sys.stderr,
        )
    if abs(aspect - EXPECTED_SCREEN_ASPECT) > ASPECT_TOLERANCE:
        print(
            "warning        aspect is outside the expected band; confirm the frame "
            "is an iPhone 17 Pro cutout before rendering",
            file=sys.stderr,
        )

    if args.write is not None:
        try:
            _write_config(args.write, bounds)
        except (MeasurementError, OSError, json.JSONDecodeError) as exc:
            print(f"error: could not update {args.write}: {exc}", file=sys.stderr)
            return 1
        print(f"wrote          device.screenBounds into {args.write}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
