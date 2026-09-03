#!/usr/bin/env python3
"""Generate 1270x760 Product Hunt gallery slides from a JSON config."""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
except ModuleNotFoundError as exc:
    if exc.name == "PIL":
        raise SystemExit(
            "Pillow is required. Install it with: python3 -m pip install Pillow"
        ) from None
    raise


CANVAS_WIDTH = 1270
CANVAS_HEIGHT = 760
RENDER_SCALE = 2

LEFT_PADDING = 80
LEFT_TEXT_WIDTH = round(CANVAS_WIDTH * 0.45)
CONTENT_TOP = 80
FOOTER_BASELINE = CANVAS_HEIGHT - 80
# The copy block is centred in this same band on every slide, footer labels or
# not. Letting the band grow when a slide has no footer dropped the headline
# ~26px, which reads as drift once the gallery is clicked through in order.
COPY_BAND_BOTTOM = FOOTER_BASELINE - 52

HEADLINE_SIZE = 56
HEADLINE_LINE_HEIGHT = 60
SUBHEAD_SIZE = 24
SUBHEAD_LINE_HEIGHT = 32
COPY_GAP = 28
FOOTER_SIZE = 14

CREAM = (250, 247, 245, 255)
MUTED_CREAM = (250, 247, 245, 178)
FOOTER_CREAM = (250, 247, 245, 153)
CORAL = (232, 116, 95, 220)
WORDMARK_CORAL = (232, 116, 95, 255)
SOLID_BACKGROUND = (10, 10, 10, 255)

REPO_ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = REPO_ROOT / "frontend" / "src" / "assets" / "fonts"
HEADLINE_FONT = FONT_DIR / "BricolageGrotesque-Bold.ttf"
SUBHEAD_FONT = FONT_DIR / "SchibstedGrotesk-Regular.ttf"
SUMMARY_TITLE_FONT = FONT_DIR / "BricolageGrotesque-SemiBold.ttf"
FOOTER_FONT = FONT_DIR / "SchibstedGrotesk-SemiBold.ttf"

BACKGROUND_VARIANTS = {"solid", "warm"}
DEVICE_MODES = {"frame", "prerendered"}
SLIDE_LAYOUTS = {"device", "summary"}

# The journal.io lockup, set to match frontend/src/components/JournalWordmark.tsx:
# Bricolage Grotesque Bold, "journal" in the foreground colour and ".io" in the
# brand coral. The tracking there is defined as a ratio of the mark's size rather
# than a point value, because a value tuned for one size over-tightens at another
# — so the ratios are carried across verbatim instead of a baked-in pixel figure.
WORDMARK_SIZE = 32
WORDMARK_TOP = 76
WORDMARK_TRACKING_RATIO = -0.04
WORDMARK_IO_TRACKING_RATIO = -0.035

# The copy-only summary slide: a centred headline over feature columns, with
# no device at all. Its measurements are deliberately independent of the
# device layout's left column, because nothing is sharing the canvas with it.
SUMMARY_HEADLINE_SIZE = 52
SUMMARY_HEADLINE_LINE_HEIGHT = 64
SUMMARY_HEADLINE_TOP = 96
SUMMARY_HEADLINE_WIDTH = 940
SUMMARY_COLUMNS_TOP = 366
SUMMARY_TITLE_SIZE = 30
SUMMARY_TITLE_GAP = 26
SUMMARY_BODY_SIZE = 17
SUMMARY_BODY_LINE_HEIGHT = 25
SUMMARY_COLUMN_GUTTER = 40
SUMMARY_CONTENT_WIDTH = CANVAS_WIDTH - LEFT_PADDING * 2
SUMMARY_RULE = (250, 247, 245, 46)
MAX_SUMMARY_COLUMNS = 4

# A calm horizon band across the foot of the summary slide, standing in for
# the illustration band the reference uses. The band is anchored low enough
# that its troughs run off the bottom edge: floating it clear of the edge left
# a dead strip under it and the composition read as unfinished.
WAVE_BASELINE = 688
WAVE_PERIOD = 660

# A Black Titanium frame is barely lighter than the near-black canvas it sits
# on. Without a shadow its top and side rails merge into the background and the
# device loses its silhouette entirely.
SHADOW_OFFSET_Y = 18
SHADOW_BLUR = 26
SHADOW_OPACITY = 140


class ConfigError(ValueError):
    """Raised when gallery configuration or source assets are invalid."""


@dataclass(frozen=True)
class Bounds:
    x: int
    y: int
    width: int
    height: int


@dataclass(frozen=True)
class Placement:
    x: int
    y: int
    height: int


@dataclass(frozen=True)
class DeviceSpec:
    mode: str
    placement: Placement
    shadow: bool
    # Both are None in "prerendered" mode, where each slide screenshot is
    # already a finished device and there is nothing to composite into.
    frame_path: Path | None
    screen_bounds: Bounds | None


@dataclass(frozen=True)
class Column:
    title: str
    body: str


@dataclass(frozen=True)
class SlideSpec:
    layout: str
    headline: str
    background: str
    wordmark: bool
    # Set on "device" slides only.
    subhead: str | None
    screenshot_path: Path | None
    footer_labels: tuple[str, ...]
    # Set on "summary" slides only.
    columns: tuple[Column, ...]


@dataclass(frozen=True)
class GalleryConfig:
    device: DeviceSpec | None
    slides: tuple[SlideSpec, ...]


@dataclass(frozen=True)
class PreparedSlide:
    spec: SlideSpec
    headline_lines: tuple[str, ...]
    subhead_lines: tuple[str, ...]
    column_body_lines: tuple[tuple[str, ...], ...]


def _expect_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ConfigError(f"{label} must be a JSON object")
    return value


def _expect_nonempty_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ConfigError(f"{label} must be a non-empty string")
    return value.strip()


def _expect_integer(value: Any, label: str, *, minimum: int | None = None) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ConfigError(f"{label} must be an integer")
    if minimum is not None and value < minimum:
        raise ConfigError(f"{label} must be at least {minimum}")
    return value


def _required(mapping: dict[str, Any], key: str, label: str) -> Any:
    if key not in mapping:
        raise ConfigError(f"{label} is required")
    return mapping[key]


def _resolve_source_path(config_dir: Path, value: Any, label: str) -> Path:
    raw_path = _expect_nonempty_string(value, label)
    path = Path(raw_path).expanduser()
    if not path.is_absolute():
        path = config_dir / path
    return path.resolve()


def _parse_bounds(value: Any) -> Bounds:
    data = _expect_object(value, "device.screenBounds")
    return Bounds(
        x=_expect_integer(
            _required(data, "x", "device.screenBounds.x"),
            "device.screenBounds.x",
            minimum=0,
        ),
        y=_expect_integer(
            _required(data, "y", "device.screenBounds.y"),
            "device.screenBounds.y",
            minimum=0,
        ),
        width=_expect_integer(
            _required(data, "width", "device.screenBounds.width"),
            "device.screenBounds.width",
            minimum=1,
        ),
        height=_expect_integer(
            _required(data, "height", "device.screenBounds.height"),
            "device.screenBounds.height",
            minimum=1,
        ),
    )


def _parse_placement(value: Any) -> Placement:
    data = _expect_object(value, "device.placement")
    return Placement(
        x=_expect_integer(_required(data, "x", "device.placement.x"), "device.placement.x"),
        y=_expect_integer(_required(data, "y", "device.placement.y"), "device.placement.y"),
        height=_expect_integer(
            _required(data, "height", "device.placement.height"),
            "device.placement.height",
            minimum=1,
        ),
    )


def _parse_device(device_data: dict[str, Any], config_dir: Path) -> DeviceSpec:
    mode = device_data.get("mode", "frame")
    if not isinstance(mode, str) or mode not in DEVICE_MODES:
        choices = ", ".join(sorted(DEVICE_MODES))
        raise ConfigError(f"device.mode must be one of: {choices}; got {mode!r}")

    shadow = device_data.get("shadow", True)
    if not isinstance(shadow, bool):
        raise ConfigError("device.shadow must be true or false")

    placement = _parse_placement(
        _required(device_data, "placement", "device.placement")
    )

    if mode == "prerendered":
        # Quietly ignoring frame geometry would hide a half-migrated config
        # behind output that looks almost right.
        for unused_key in ("frame", "screenBounds"):
            if unused_key in device_data:
                raise ConfigError(
                    f"device.{unused_key} is not used when device.mode is "
                    '"prerendered"; each slide screenshot is already a framed device'
                )
        return DeviceSpec(
            mode=mode,
            placement=placement,
            shadow=shadow,
            frame_path=None,
            screen_bounds=None,
        )

    return DeviceSpec(
        mode=mode,
        placement=placement,
        shadow=shadow,
        frame_path=_resolve_source_path(
            config_dir,
            _required(device_data, "frame", "device.frame"),
            "device.frame",
        ),
        screen_bounds=_parse_bounds(
            _required(device_data, "screenBounds", "device.screenBounds")
        ),
    )


def _parse_columns(value: Any, label: str) -> tuple[Column, ...]:
    if not isinstance(value, list) or not value:
        raise ConfigError(f"{label}.columns must be a non-empty JSON array")
    if len(value) > MAX_SUMMARY_COLUMNS:
        raise ConfigError(
            f"{label}.columns has {len(value)} entries; the summary layout fits at "
            f"most {MAX_SUMMARY_COLUMNS} across the canvas"
        )

    columns: list[Column] = []
    for index, raw_column in enumerate(value, start=1):
        column_label = f"{label}.columns[{index}]"
        data = _expect_object(raw_column, column_label)
        columns.append(
            Column(
                title=_expect_nonempty_string(
                    _required(data, "title", f"{column_label}.title"),
                    f"{column_label}.title",
                ),
                body=_expect_nonempty_string(
                    _required(data, "body", f"{column_label}.body"),
                    f"{column_label}.body",
                ),
            )
        )
    return tuple(columns)


def load_config(config_path: Path) -> GalleryConfig:
    config_path = config_path.expanduser().resolve()
    try:
        raw = json.loads(config_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ConfigError(f"config file not found: {config_path}") from exc
    except json.JSONDecodeError as exc:
        raise ConfigError(
            f"invalid JSON in {config_path}: line {exc.lineno}, column {exc.colno}"
        ) from exc

    root = _expect_object(raw, "config")
    config_dir = config_path.parent

    slides_data = _required(root, "slides", "slides")
    if not isinstance(slides_data, list) or not slides_data:
        raise ConfigError("slides must be a non-empty JSON array")

    slides: list[SlideSpec] = []
    for index, raw_slide in enumerate(slides_data, start=1):
        label = f"slide {index}"
        slide_data = _expect_object(raw_slide, label)
        background = _expect_nonempty_string(
            _required(slide_data, "background", f"{label}.background"),
            f"{label}.background",
        )
        if background not in BACKGROUND_VARIANTS:
            choices = ", ".join(sorted(BACKGROUND_VARIANTS))
            raise ConfigError(
                f"{label}.background must be one of: {choices}; got {background!r}"
            )

        wordmark = slide_data.get("wordmark", False)
        if not isinstance(wordmark, bool):
            raise ConfigError(f"{label}.wordmark must be true or false")

        layout = slide_data.get("layout", "device")
        if not isinstance(layout, str) or layout not in SLIDE_LAYOUTS:
            choices = ", ".join(sorted(SLIDE_LAYOUTS))
            raise ConfigError(
                f"{label}.layout must be one of: {choices}; got {layout!r}"
            )

        footer_data = slide_data.get("footerLabels", [])
        if not isinstance(footer_data, list):
            raise ConfigError(f"{label}.footerLabels must be an array of strings")
        footer_labels: list[str] = []
        for footer_index, footer_label in enumerate(footer_data, start=1):
            parsed_label = _expect_nonempty_string(
                footer_label,
                f"{label}.footerLabels[{footer_index}]",
            )
            if "\n" in parsed_label or "\r" in parsed_label:
                raise ConfigError(
                    f"{label}.footerLabels[{footer_index}] must fit on one line"
                )
            footer_labels.append(parsed_label)

        headline = _expect_nonempty_string(
            _required(slide_data, "headline", f"{label}.headline"),
            f"{label}.headline",
        )

        if layout == "summary":
            # A summary slide carries no device, so a screenshot or subhead here
            # means the layout was changed without the copy following it.
            for unused_key in ("screenshot", "subhead"):
                if unused_key in slide_data:
                    raise ConfigError(
                        f"{label}.{unused_key} is not used by the summary layout; "
                        "use columns instead"
                    )
            slides.append(
                SlideSpec(
                    layout=layout,
                    headline=headline,
                    background=background,
                    wordmark=wordmark,
                    subhead=None,
                    screenshot_path=None,
                    footer_labels=tuple(footer_labels),
                    columns=_parse_columns(
                        _required(slide_data, "columns", f"{label}.columns"),
                        label,
                    ),
                )
            )
            continue

        if "columns" in slide_data:
            raise ConfigError(f"{label}.columns is only used by the summary layout")
        slides.append(
            SlideSpec(
                layout=layout,
                headline=headline,
                background=background,
                wordmark=wordmark,
                subhead=_expect_nonempty_string(
                    _required(slide_data, "subhead", f"{label}.subhead"),
                    f"{label}.subhead",
                ),
                screenshot_path=_resolve_source_path(
                    config_dir,
                    _required(slide_data, "screenshot", f"{label}.screenshot"),
                    f"{label}.screenshot",
                ),
                footer_labels=tuple(footer_labels),
                columns=(),
            )
        )

    # A gallery of copy-only summary slides needs no device art at all, so the
    # device block is only required once a slide actually asks for a device.
    needs_device = any(slide.layout == "device" for slide in slides)
    raw_device = root.get("device")
    if raw_device is None:
        if needs_device:
            raise ConfigError(
                "device is required when a slide uses the \"device\" layout"
            )
        device = None
    else:
        device = _parse_device(_expect_object(raw_device, "device"), config_dir)

    return GalleryConfig(device=device, slides=tuple(slides))


def _load_font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    if not path.is_file():
        raise ConfigError(f"font file not found: {path}")
    try:
        return ImageFont.truetype(str(path), size * RENDER_SCALE)
    except OSError as exc:
        raise ConfigError(f"could not load font: {path}") from exc


def _text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> float:
    return draw.textlength(text, font=font)


def wrap_text(
    text: str,
    *,
    draw: ImageDraw.ImageDraw,
    font: ImageFont.FreeTypeFont,
    max_width: int,
    max_lines: int,
    label: str,
) -> tuple[str, ...]:
    lines: list[str] = []
    for paragraph in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        words = paragraph.split()
        if not words:
            raise ConfigError(f"{label} contains an empty line")

        current = ""
        for word in words:
            if _text_width(draw, word, font) > max_width:
                raise ConfigError(f"{label} contains a word that is too wide: {word!r}")
            candidate = word if not current else f"{current} {word}"
            if _text_width(draw, candidate, font) <= max_width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)

    if len(lines) > max_lines:
        raise ConfigError(
            f"{label} wraps to {len(lines)} lines; maximum is {max_lines}"
        )
    return tuple(lines)


def _tracked_text_width(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    tracking: float,
) -> float:
    if not text:
        return 0
    glyph_width = sum(_text_width(draw, character, font) for character in text)
    return glyph_width + tracking * (len(text) - 1)


def _draw_tracked_text(
    draw: ImageDraw.ImageDraw,
    position: tuple[float, float],
    text: str,
    *,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    tracking: float,
) -> None:
    x, y = position
    for character in text:
        draw.text((x, y), character, font=font, fill=fill)
        x += _text_width(draw, character, font) + tracking


def _smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def _lerp_color(
    start: tuple[int, int, int],
    end: tuple[int, int, int],
    amount: float,
) -> tuple[int, int, int]:
    return tuple(
        round(start[channel] + (end[channel] - start[channel]) * amount)
        for channel in range(3)
    )


def _warm_background() -> Image.Image:
    sample_width = math.ceil(CANVAS_WIDTH / 5)
    sample_height = math.ceil(CANVAS_HEIGHT / 5)
    image = Image.new("RGB", (sample_width, sample_height))
    pixels = image.load()

    near_black = (10, 10, 10)
    espresso = (42, 33, 28)
    ember = (92, 46, 34)
    light_x = sample_width * 0.86
    light_y = sample_height * 0.12

    for y in range(sample_height):
        for x in range(sample_width):
            dx = (x - light_x) / (sample_width * 0.90)
            dy = (y - light_y) / (sample_height * 1.05)
            glow = _smoothstep(1.0 - math.hypot(dx, dy))
            color = _lerp_color(near_black, espresso, glow)
            color = _lerp_color(color, ember, glow * glow * 0.58)
            pixels[x, y] = color

    return image.resize(
        (CANVAS_WIDTH * RENDER_SCALE, CANVAS_HEIGHT * RENDER_SCALE),
        Image.Resampling.LANCZOS,
    ).convert("RGBA")


def _solid_background() -> Image.Image:
    return Image.new(
        "RGBA",
        (CANVAS_WIDTH * RENDER_SCALE, CANVAS_HEIGHT * RENDER_SCALE),
        SOLID_BACKGROUND,
    )


def _device_output_size(
    source_size: tuple[int, int],
    placement: Placement,
) -> tuple[int, int]:
    """Final on-canvas device size, deriving width from the source aspect."""
    source_width, source_height = source_size
    output_height = placement.height
    output_width = round(source_width * output_height / source_height)
    return output_width, output_height


def _validate_placement(placement: Placement, output_size: tuple[int, int]) -> None:
    if placement.x >= CANVAS_WIDTH or placement.x + output_size[0] <= 0:
        raise ConfigError("device.placement does not intersect the output canvas horizontally")
    if placement.y >= CANVAS_HEIGHT or placement.y + output_size[1] <= 0:
        raise ConfigError("device.placement does not intersect the output canvas vertically")
    # The device has to run off the canvas somewhere. Which edge is a layout
    # decision: a device anchored to the right bleeds right, while one standing
    # tall on the right with its top rail fully visible bleeds off the bottom
    # instead. Requiring a specific edge ruled the second layout out entirely.
    # What must not happen is a device floating fully inside the canvas, which
    # reads as a thumbnail pasted onto a slide rather than as a product shot.
    bleeds_off_canvas = (
        placement.x < 0
        or placement.y < 0
        or placement.x + output_size[0] > CANVAS_WIDTH
        or placement.y + output_size[1] > CANVAS_HEIGHT
    )
    if not bleeds_off_canvas:
        raise ConfigError(
            "device.placement must bleed past at least one edge of the canvas; "
            f"a {output_size[0]}x{output_size[1]} device at "
            f"({placement.x}, {placement.y}) sits entirely inside it"
        )


def _open_device_source(path: Path, label: str) -> Image.Image:
    try:
        with Image.open(path) as source:
            return ImageOps.exif_transpose(source).convert("RGBA")
    except OSError as exc:
        raise ConfigError(f"could not open {label}: {path}") from exc


def _screen_output_bounds(
    frame_size: tuple[int, int],
    frame_output_size: tuple[int, int],
    bounds: Bounds,
) -> Bounds:
    scale_x = frame_output_size[0] / frame_size[0]
    scale_y = frame_output_size[1] / frame_size[1]
    return Bounds(
        x=round(bounds.x * scale_x),
        y=round(bounds.y * scale_y),
        width=round(bounds.width * scale_x),
        height=round(bounds.height * scale_y),
    )


def _validate_frame(config: GalleryConfig) -> tuple[tuple[int, int], tuple[int, int], Bounds]:
    frame_path = config.device.frame_path
    if frame_path is None or not frame_path.is_file():
        raise ConfigError(f"device frame not found: {frame_path}")

    frame = _open_device_source(frame_path, "device frame")

    frame_size = frame.size
    bounds = config.device.screen_bounds
    if bounds is None:
        raise ConfigError("device.screenBounds is required when device.mode is \"frame\"")
    if bounds.x + bounds.width > frame.width or bounds.y + bounds.height > frame.height:
        raise ConfigError(
            "device.screenBounds must fit inside the source frame "
            f"({frame.width}x{frame.height})"
        )

    center_alpha = frame.getchannel("A").getpixel(
        (bounds.x + bounds.width // 2, bounds.y + bounds.height // 2)
    )
    if center_alpha >= 250:
        raise ConfigError(
            "device frame must have a transparent screen opening at the center "
            "of device.screenBounds"
        )

    output_size = _device_output_size(frame_size, config.device.placement)
    _validate_placement(config.device.placement, output_size)

    screen_output = _screen_output_bounds(frame_size, output_size, bounds)
    if screen_output.width < 1 or screen_output.height < 1:
        raise ConfigError("device.screenBounds render smaller than one output pixel")
    return frame_size, output_size, screen_output


def _validate_prerendered_sources(config: GalleryConfig) -> tuple[int, int]:
    """Check every pre-framed device source and return the rendered device size."""
    placement = config.device.placement
    source_size: tuple[int, int] | None = None
    first_path: Path | None = None

    for slide_number, slide in enumerate(config.slides, start=1):
        if slide.layout != "device":
            continue
        path = slide.screenshot_path
        if path is None or not path.is_file():
            raise ConfigError(f"slide {slide_number} screenshot not found: {path}")
        image = _open_device_source(path, f"slide {slide_number} screenshot")

        # A flattened mockup on an opaque background renders as a rectangle
        # pasted onto the slide, which is the one failure mode that still looks
        # deliberate. Catch it here rather than in the finished PNG.
        alpha = image.getchannel("A")
        corners = (
            (0, 0),
            (image.width - 1, 0),
            (0, image.height - 1),
            (image.width - 1, image.height - 1),
        )
        if any(alpha.getpixel(corner) > 8 for corner in corners):
            raise ConfigError(
                f"slide {slide_number} screenshot has opaque corners: {path}; "
                'device.mode "prerendered" needs a device cut out on transparency'
            )

        if source_size is None or first_path is None:
            source_size = image.size
            first_path = path
        elif image.size != source_size:
            raise ConfigError(
                f"slide {slide_number} screenshot is {image.width}x{image.height} but "
                f"{first_path.name} is {source_size[0]}x{source_size[1]}; every "
                "pre-framed device must share one size so the device lands in the "
                "same place on every slide"
            )

        # The frame path enlarges a screen capture inside a frame, so it needs 2x
        # headroom. Here the device is already rendered at its final detail: the
        # only thing that costs sharpness is scaling it up past its own pixels.
        if placement.height > image.height:
            raise ConfigError(
                f"slide {slide_number} screenshot is {image.width}x{image.height}; "
                f"device.placement.height is {placement.height} and may not exceed "
                f"the source height of {image.height} without upscaling the device"
            )

    if source_size is None:
        raise ConfigError(
            "no slide uses the \"device\" layout, so device.placement has "
            "nothing to place"
        )

    output_size = _device_output_size(source_size, placement)
    _validate_placement(placement, output_size)
    return output_size


def _validate_screenshot_density(
    screenshot_path: Path,
    screen_output: Bounds,
    slide_number: int,
) -> None:
    if not screenshot_path.is_file():
        raise ConfigError(f"slide {slide_number} screenshot not found: {screenshot_path}")

    try:
        with Image.open(screenshot_path) as screenshot_source:
            screenshot = ImageOps.exif_transpose(screenshot_source)
            source_width, source_height = screenshot.size
    except OSError as exc:
        raise ConfigError(
            f"could not open slide {slide_number} screenshot: {screenshot_path}"
        ) from exc

    required_width = screen_output.width * RENDER_SCALE
    required_height = screen_output.height * RENDER_SCALE
    fill_scale = max(required_width / source_width, required_height / source_height)
    if fill_scale > 1.0:
        raise ConfigError(
            f"slide {slide_number} screenshot is {source_width}x{source_height}; "
            f"the rendered screen is {screen_output.width}x{screen_output.height} and "
            f"requires at least {required_width}x{required_height} before crop-to-fill "
            "to preserve 2x density"
        )


def _validate_footer(
    labels: Iterable[str],
    *,
    draw: ImageDraw.ImageDraw,
    font: ImageFont.FreeTypeFont,
    slide_number: int,
) -> None:
    normalized = [label.upper() for label in labels]
    if not normalized:
        return

    tracking = 1.2 * RENDER_SCALE
    label_gap = 16 * RENDER_SCALE
    dot_width = 5 * RENDER_SCALE
    total_width = sum(
        _tracked_text_width(draw, label, font, tracking) for label in normalized
    )
    total_width += (len(normalized) - 1) * (label_gap * 2 + dot_width)
    if total_width > LEFT_TEXT_WIDTH * RENDER_SCALE:
        raise ConfigError(
            f"slide {slide_number}.footerLabels do not fit in the single footer row"
        )


def _prepare_summary_slide(
    slide: SlideSpec,
    slide_number: int,
    *,
    draw: ImageDraw.ImageDraw,
    headline_font: ImageFont.FreeTypeFont,
    title_font: ImageFont.FreeTypeFont,
    body_font: ImageFont.FreeTypeFont,
) -> PreparedSlide:
    headline_lines = wrap_text(
        slide.headline,
        draw=draw,
        font=headline_font,
        max_width=SUMMARY_HEADLINE_WIDTH * RENDER_SCALE,
        max_lines=2,
        label=f"slide {slide_number}.headline",
    )

    column_width = _summary_column_width(len(slide.columns))
    column_body_lines: list[tuple[str, ...]] = []
    for index, column in enumerate(slide.columns, start=1):
        column_label = f"slide {slide_number}.columns[{index}]"
        # A title that wraps would drop that column's body out of step with its
        # neighbours, so titles are held to a single line rather than wrapped.
        if _text_width(draw, column.title, title_font) > column_width * RENDER_SCALE:
            raise ConfigError(
                f"{column_label}.title does not fit its {column_width}px column "
                "on one line"
            )
        column_body_lines.append(
            wrap_text(
                column.body,
                draw=draw,
                font=body_font,
                max_width=column_width * RENDER_SCALE,
                max_lines=3,
                label=f"{column_label}.body",
            )
        )

    return PreparedSlide(
        spec=slide,
        headline_lines=headline_lines,
        subhead_lines=(),
        column_body_lines=tuple(column_body_lines),
    )


def prepare_gallery(
    config: GalleryConfig,
) -> tuple[tuple[int, int], Bounds | None, tuple[PreparedSlide, ...]]:
    screen_output: Bounds | None
    device_output_size: tuple[int, int]
    if config.device is None:
        device_output_size = (0, 0)
        screen_output = None
    elif config.device.mode == "prerendered":
        device_output_size = _validate_prerendered_sources(config)
        screen_output = None
    else:
        _, device_output_size, screen_output = _validate_frame(config)

    headline_font = _load_font(HEADLINE_FONT, HEADLINE_SIZE)
    subhead_font = _load_font(SUBHEAD_FONT, SUBHEAD_SIZE)
    footer_font = _load_font(FOOTER_FONT, FOOTER_SIZE)
    measuring_image = Image.new("RGBA", (1, 1))
    draw = ImageDraw.Draw(measuring_image)

    summary_headline_font = _load_font(HEADLINE_FONT, SUMMARY_HEADLINE_SIZE)
    summary_title_font = _load_font(SUMMARY_TITLE_FONT, SUMMARY_TITLE_SIZE)
    summary_body_font = _load_font(SUBHEAD_FONT, SUMMARY_BODY_SIZE)

    prepared: list[PreparedSlide] = []
    for slide_number, slide in enumerate(config.slides, start=1):
        _validate_footer(
            slide.footer_labels,
            draw=draw,
            font=footer_font,
            slide_number=slide_number,
        )

        if slide.layout == "summary":
            prepared.append(
                _prepare_summary_slide(
                    slide,
                    slide_number,
                    draw=draw,
                    headline_font=summary_headline_font,
                    title_font=summary_title_font,
                    body_font=summary_body_font,
                )
            )
            continue

        if screen_output is not None:
            _validate_screenshot_density(
                slide.screenshot_path, screen_output, slide_number
            )
        headline_lines = wrap_text(
            slide.headline,
            draw=draw,
            font=headline_font,
            max_width=LEFT_TEXT_WIDTH * RENDER_SCALE,
            max_lines=2,
            label=f"slide {slide_number}.headline",
        )
        subhead_lines = wrap_text(
            slide.subhead or "",
            draw=draw,
            font=subhead_font,
            max_width=LEFT_TEXT_WIDTH * RENDER_SCALE,
            max_lines=2,
            label=f"slide {slide_number}.subhead",
        )
        prepared.append(
            PreparedSlide(
                spec=slide,
                headline_lines=headline_lines,
                subhead_lines=subhead_lines,
                column_body_lines=(),
            )
        )
    return device_output_size, screen_output, tuple(prepared)


def _alpha_composite_clipped(
    background: Image.Image,
    foreground: Image.Image,
    position: tuple[int, int],
) -> None:
    x, y = position
    left = max(0, x)
    top = max(0, y)
    right = min(background.width, x + foreground.width)
    bottom = min(background.height, y + foreground.height)
    if left >= right or top >= bottom:
        return

    source_box = (left - x, top - y, right - x, bottom - y)
    background.alpha_composite(foreground.crop(source_box), (left, top))


def _build_device_layer(
    config: GalleryConfig,
    slide: SlideSpec,
    device_output_size: tuple[int, int],
    screen_output: Bounds | None,
) -> Image.Image:
    internal_frame_size = (
        device_output_size[0] * RENDER_SCALE,
        device_output_size[1] * RENDER_SCALE,
    )
    if config.device is None:
        raise ConfigError("device is required to render a \"device\" slide")
    if config.device.mode == "prerendered" or screen_output is None:
        # The screenshot is the device. Nothing to composite into.
        device = _open_device_source(slide.screenshot_path, "slide screenshot")
        return device.resize(internal_frame_size, Image.Resampling.LANCZOS)

    frame = _open_device_source(config.device.frame_path, "device frame")
    frame = frame.resize(internal_frame_size, Image.Resampling.LANCZOS)

    internal_screen_size = (
        screen_output.width * RENDER_SCALE,
        screen_output.height * RENDER_SCALE,
    )
    with Image.open(slide.screenshot_path) as screenshot_source:
        screenshot = ImageOps.exif_transpose(screenshot_source).convert("RGBA")
        screenshot = ImageOps.fit(
            screenshot,
            internal_screen_size,
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )

    device = Image.new("RGBA", internal_frame_size, (0, 0, 0, 0))
    _alpha_composite_clipped(
        device,
        screenshot,
        (screen_output.x * RENDER_SCALE, screen_output.y * RENDER_SCALE),
    )
    device.alpha_composite(frame)
    return device


def _draw_wordmark(draw: ImageDraw.ImageDraw) -> None:
    """Draw the journal.io lockup at the top of the slide's copy column."""
    font = _load_font(HEADLINE_FONT, WORDMARK_SIZE)
    scale = RENDER_SCALE
    tracking = WORDMARK_SIZE * WORDMARK_TRACKING_RATIO * scale
    io_tracking = WORDMARK_SIZE * WORDMARK_IO_TRACKING_RATIO * scale

    x = LEFT_PADDING * scale
    y = WORDMARK_TOP * scale
    _draw_tracked_text(
        draw,
        (x, y),
        "journal",
        font=font,
        fill=CREAM,
        tracking=tracking,
    )
    # The component sets the same negative tracking as the gap before ".io", so
    # the two words read as one mark rather than two words with a space.
    x += _tracked_text_width(draw, "journal", font, tracking) + tracking
    _draw_tracked_text(
        draw,
        (x, y),
        ".io",
        font=font,
        fill=WORDMARK_CORAL,
        tracking=io_tracking,
    )


def _summary_column_width(count: int) -> int:
    """Column width once the inter-column gutters and rules are taken out."""
    gutters = (count - 1) * SUMMARY_COLUMN_GUTTER * 2
    return (SUMMARY_CONTENT_WIDTH - gutters) // count


def _summary_column_x(index: int, count: int) -> int:
    width = _summary_column_width(count)
    return LEFT_PADDING + index * (width + SUMMARY_COLUMN_GUTTER * 2)


def _draw_wave_band(canvas: Image.Image) -> None:
    """Two calm horizon curves across the foot of a summary slide."""
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    scale = RENDER_SCALE

    for phase, period, amplitude, colour, thickness in (
        (1.15, WAVE_PERIOD * 1.7, 104, (250, 247, 245, 34), 2),
        (0.0, WAVE_PERIOD, 72, (250, 247, 245, 88), 3),
        (2.1, WAVE_PERIOD * 1.32, 88, (232, 116, 95, 190), 3),
    ):
        points = [
            (
                x * scale,
                (WAVE_BASELINE + amplitude * math.sin(2 * math.pi * x / period + phase))
                * scale,
            )
            for x in range(0, CANVAS_WIDTH + 1, 4)
        ]
        draw.line(points, fill=colour, width=thickness * scale, joint="curve")

    canvas.alpha_composite(overlay)


def _draw_summary_copy(canvas: Image.Image, slide: PreparedSlide) -> None:
    headline_font = _load_font(HEADLINE_FONT, SUMMARY_HEADLINE_SIZE)
    title_font = _load_font(SUMMARY_TITLE_FONT, SUMMARY_TITLE_SIZE)
    body_font = _load_font(SUBHEAD_FONT, SUMMARY_BODY_SIZE)

    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    scale = RENDER_SCALE
    if slide.spec.wordmark:
        _draw_wordmark(draw)

    y = SUMMARY_HEADLINE_TOP
    for line in slide.headline_lines:
        width = _text_width(draw, line, headline_font) / scale
        draw.text(
            ((CANVAS_WIDTH - width) / 2 * scale, y * scale),
            line,
            font=headline_font,
            fill=CREAM,
        )
        y += SUMMARY_HEADLINE_LINE_HEIGHT

    columns = slide.spec.columns
    count = len(columns)
    column_width = _summary_column_width(count)

    # Every column's body starts on the same line, so a longer title never
    # pushes one column's copy out of step with its neighbours.
    body_top = SUMMARY_COLUMNS_TOP + SUMMARY_TITLE_SIZE + SUMMARY_TITLE_GAP
    tallest_body = max(len(lines) for lines in slide.column_body_lines)

    for index, (column, body_lines) in enumerate(zip(columns, slide.column_body_lines)):
        column_x = _summary_column_x(index, count)
        centre = column_x + column_width / 2

        title_width = _text_width(draw, column.title, title_font) / scale
        draw.text(
            ((centre - title_width / 2) * scale, SUMMARY_COLUMNS_TOP * scale),
            column.title,
            font=title_font,
            fill=CREAM,
        )

        body_y = body_top
        for line in body_lines:
            line_width = _text_width(draw, line, body_font) / scale
            draw.text(
                ((centre - line_width / 2) * scale, body_y * scale),
                line,
                font=body_font,
                fill=MUTED_CREAM,
            )
            body_y += SUMMARY_BODY_LINE_HEIGHT

        if index < count - 1:
            rule_x = column_x + column_width + SUMMARY_COLUMN_GUTTER
            rule_bottom = body_top + tallest_body * SUMMARY_BODY_LINE_HEIGHT
            draw.line(
                (
                    rule_x * scale,
                    SUMMARY_COLUMNS_TOP * scale,
                    rule_x * scale,
                    rule_bottom * scale,
                ),
                fill=SUMMARY_RULE,
                width=scale,
            )

    canvas.alpha_composite(overlay)


def _draw_copy(canvas: Image.Image, slide: PreparedSlide) -> None:
    headline_font = _load_font(HEADLINE_FONT, HEADLINE_SIZE)
    subhead_font = _load_font(SUBHEAD_FONT, SUBHEAD_SIZE)
    footer_font = _load_font(FOOTER_FONT, FOOTER_SIZE)

    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    scale = RENDER_SCALE
    if slide.spec.wordmark:
        _draw_wordmark(draw)

    headline_height = len(slide.headline_lines) * HEADLINE_LINE_HEIGHT
    subhead_height = len(slide.subhead_lines) * SUBHEAD_LINE_HEIGHT
    copy_height = headline_height + COPY_GAP + subhead_height
    y = round(CONTENT_TOP + (COPY_BAND_BOTTOM - CONTENT_TOP - copy_height) / 2)

    for line in slide.headline_lines:
        draw.text(
            (LEFT_PADDING * scale, y * scale),
            line,
            font=headline_font,
            fill=CREAM,
        )
        y += HEADLINE_LINE_HEIGHT

    y += COPY_GAP
    for line in slide.subhead_lines:
        draw.text(
            (LEFT_PADDING * scale, y * scale),
            line,
            font=subhead_font,
            fill=MUTED_CREAM,
        )
        y += SUBHEAD_LINE_HEIGHT

    if slide.spec.footer_labels:
        footer_y = (FOOTER_BASELINE - FOOTER_SIZE) * scale
        footer_x = LEFT_PADDING * scale
        tracking = 1.2 * scale
        gap = 16 * scale
        dot_diameter = 5 * scale
        for index, raw_label in enumerate(slide.spec.footer_labels):
            label = raw_label.upper()
            _draw_tracked_text(
                draw,
                (footer_x, footer_y),
                label,
                font=footer_font,
                fill=FOOTER_CREAM,
                tracking=tracking,
            )
            footer_x += _tracked_text_width(draw, label, footer_font, tracking)
            if index < len(slide.spec.footer_labels) - 1:
                footer_x += gap
                dot_top = footer_y + 8 * scale
                draw.ellipse(
                    (
                        footer_x,
                        dot_top,
                        footer_x + dot_diameter,
                        dot_top + dot_diameter,
                    ),
                    fill=CORAL,
                )
                footer_x += dot_diameter + gap

    canvas.alpha_composite(overlay)


def _shadow_padding() -> int:
    return round(SHADOW_BLUR * RENDER_SCALE * 3)


def _device_shadow(device: Image.Image) -> Image.Image:
    """A soft black shadow shaped by the device's own alpha."""
    padding = _shadow_padding()
    size = (device.width + padding * 2, device.height + padding * 2)
    mask = Image.new("L", size, 0)
    mask.paste(
        device.getchannel("A"),
        (padding, padding + SHADOW_OFFSET_Y * RENDER_SCALE),
    )
    mask = mask.filter(ImageFilter.GaussianBlur(SHADOW_BLUR * RENDER_SCALE))
    mask = mask.point(lambda value: value * SHADOW_OPACITY // 255)
    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    shadow.putalpha(mask)
    return shadow


def render_slide(
    config: GalleryConfig,
    slide: PreparedSlide,
    *,
    device_output_size: tuple[int, int],
    screen_output: Bounds | None,
    background: Image.Image,
) -> Image.Image:
    canvas = background.copy()
    if slide.spec.layout == "summary":
        _draw_wave_band(canvas)
        _draw_summary_copy(canvas, slide)
        return canvas.resize(
            (CANVAS_WIDTH, CANVAS_HEIGHT),
            Image.Resampling.LANCZOS,
        ).convert("RGB")

    if config.device is None:  # unreachable: load_config requires one
        raise ConfigError("device is required to render a \"device\" slide")
    device = _build_device_layer(
        config,
        slide.spec,
        device_output_size,
        screen_output,
    )
    placement = config.device.placement
    if config.device.shadow:
        padding = _shadow_padding()
        _alpha_composite_clipped(
            canvas,
            _device_shadow(device),
            (
                placement.x * RENDER_SCALE - padding,
                placement.y * RENDER_SCALE - padding,
            ),
        )
    _alpha_composite_clipped(
        canvas,
        device,
        (placement.x * RENDER_SCALE, placement.y * RENDER_SCALE),
    )
    _draw_copy(canvas, slide)
    return canvas.resize(
        (CANVAS_WIDTH, CANVAS_HEIGHT),
        Image.Resampling.LANCZOS,
    ).convert("RGB")


def generate_gallery(config_path: Path, output_dir: Path) -> list[Path]:
    config = load_config(config_path)
    device_output_size, screen_output, prepared_slides = prepare_gallery(config)

    backgrounds = {
        "solid": _solid_background(),
        "warm": _warm_background(),
    }
    rendered = [
        render_slide(
            config,
            slide,
            device_output_size=device_output_size,
            screen_output=screen_output,
            background=backgrounds[slide.spec.background],
        )
        for slide in prepared_slides
    ]

    output_dir = output_dir.expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    number_width = max(2, len(str(len(rendered))))
    output_paths: list[Path] = []
    for slide_number, image in enumerate(rendered, start=1):
        output_path = output_dir / f"{slide_number:0{number_width}d}.png"
        image.save(output_path, "PNG", optimize=True)
        output_paths.append(output_path)
    return output_paths


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate numbered 1270x760 Product Hunt gallery PNGs."
    )
    parser.add_argument("config", type=Path, help="path to the gallery JSON config")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("product-hunt-gallery"),
        help="output directory (default: ./product-hunt-gallery)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        output_paths = generate_gallery(args.config, args.output_dir)
    except ConfigError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except OSError as exc:
        print(f"error: could not write gallery output: {exc}", file=sys.stderr)
        return 1

    for output_path in output_paths:
        print(f"wrote {output_path} ({CANVAS_WIDTH}x{CANVAS_HEIGHT})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
