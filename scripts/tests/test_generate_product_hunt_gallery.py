from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

from scripts.generate_product_hunt_gallery import (
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    ConfigError,
    generate_gallery,
)


class ProductHuntGalleryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.assets = self.root / "assets"
        self.screenshots = self.root / "screenshots"
        self.assets.mkdir()
        self.screenshots.mkdir()

        self.frame_path = self.assets / "device-frame.png"
        frame = Image.new("RGBA", (600, 1200), (0, 0, 0, 0))
        frame_draw = ImageDraw.Draw(frame)
        frame_draw.rounded_rectangle(
            (18, 8, 582, 1192),
            radius=72,
            fill=(24, 23, 22, 255),
        )
        frame_draw.rounded_rectangle(
            (50, 60, 550, 1140),
            radius=48,
            fill=(0, 0, 0, 0),
        )
        frame.save(self.frame_path)

        self.screenshot_path = self.screenshots / "home.png"
        screenshot = Image.new("RGB", (800, 1728), (238, 126, 102))
        screenshot_draw = ImageDraw.Draw(screenshot)
        screenshot_draw.rectangle((0, 864, 800, 1728), fill=(248, 244, 239))
        screenshot.save(self.screenshot_path)

        self.config = {
            "device": {
                "frame": "assets/device-frame.png",
                "screenBounds": {"x": 50, "y": 60, "width": 500, "height": 1080},
                "placement": {"x": 860, "y": -70, "height": 900},
            },
            "slides": [
                {
                    "headline": "Notice what returns.",
                    "subhead": "See a calmer picture of your week.",
                    "screenshot": "screenshots/home.png",
                    "background": "solid",
                    "footerLabels": ["Private", "No ads"],
                },
                {
                    "headline": "Patterns, made visible.",
                    "subhead": "Supportive context from the words you write.",
                    "screenshot": "screenshots/home.png",
                    "background": "warm",
                },
            ],
        }
        self.config_path = self.root / "gallery.json"

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def write_config(self, config: dict | None = None) -> None:
        self.config_path.write_text(
            json.dumps(self.config if config is None else config),
            encoding="utf-8",
        )

    def test_generates_numbered_slides_with_both_backgrounds(self) -> None:
        self.write_config()
        output_dir = self.root / "output"

        outputs = generate_gallery(self.config_path, output_dir)

        self.assertEqual([path.name for path in outputs], ["01.png", "02.png"])
        with Image.open(outputs[0]) as solid, Image.open(outputs[1]) as warm:
            self.assertEqual(solid.size, (CANVAS_WIDTH, CANVAS_HEIGHT))
            self.assertEqual(warm.size, (CANVAS_WIDTH, CANVAS_HEIGHT))
            self.assertEqual(solid.mode, "RGB")
            self.assertEqual(warm.mode, "RGB")
            self.assertEqual(solid.getpixel((10, 10)), (10, 10, 10))
            self.assertNotEqual(warm.getpixel((1100, 90)), (10, 10, 10))
            self.assertGreater(solid.getpixel((1080, 360))[0], 180)

    def test_rejects_screenshot_below_two_x_without_writing_outputs(self) -> None:
        Image.new("RGB", (700, 1500), (255, 255, 255)).save(self.screenshot_path)
        self.write_config({**self.config, "slides": [self.config["slides"][0]]})
        output_dir = self.root / "output"

        with self.assertRaisesRegex(ConfigError, "preserve 2x density"):
            generate_gallery(self.config_path, output_dir)

        self.assertFalse(output_dir.exists())

    def test_rejects_invalid_bounds_and_non_bleeding_placement(self) -> None:
        invalid_bounds = copy.deepcopy(self.config)
        invalid_bounds["device"]["screenBounds"]["width"] = 1000
        self.write_config(invalid_bounds)
        with self.assertRaisesRegex(ConfigError, "must fit inside"):
            generate_gallery(self.config_path, self.root / "bounds-output")

        # 600x1200 frame at height 600 renders 300 wide, so this sits entirely
        # inside the 1270x760 canvas on every edge.
        no_bleed = copy.deepcopy(self.config)
        no_bleed["device"]["placement"] = {"x": 700, "y": 50, "height": 600}
        self.write_config(no_bleed)
        with self.assertRaisesRegex(ConfigError, "bleed past at least one edge"):
            generate_gallery(self.config_path, self.root / "placement-output")

    def test_accepts_a_device_that_bleeds_off_only_the_bottom_edge(self) -> None:
        # A device standing tall on the right, top rail fully visible, cropped
        # by the bottom of the canvas. Nothing crosses the left, right or top.
        # Taller placement means a larger screen opening, so the shared 800x1728
        # fixture no longer clears the 2x density bar. Give this one its own.
        Image.new("RGB", (900, 1940), (238, 126, 102)).save(self.screenshot_path)
        bottom_bleed = copy.deepcopy(self.config)
        bottom_bleed["slides"] = [bottom_bleed["slides"][0]]
        bottom_bleed["device"]["placement"] = {"x": 760, "y": 120, "height": 980}
        self.write_config(bottom_bleed)
        output_dir = self.root / "bottom-bleed-output"

        outputs = generate_gallery(self.config_path, output_dir)

        self.assertEqual([path.name for path in outputs], ["01.png"])
        with Image.open(outputs[0]) as slide:
            self.assertEqual(slide.size, (CANVAS_WIDTH, CANVAS_HEIGHT))

    def test_rejects_unknown_background_and_copy_over_two_lines(self) -> None:
        invalid_background = copy.deepcopy(self.config)
        invalid_background["slides"][0]["background"] = "purple"
        self.write_config(invalid_background)
        with self.assertRaisesRegex(ConfigError, "background must be one of"):
            generate_gallery(self.config_path, self.root / "background-output")

        long_copy = copy.deepcopy(self.config)
        long_copy["slides"] = [long_copy["slides"][0]]
        long_copy["slides"][0]["headline"] = (
            "A very long headline that cannot possibly fit inside only two carefully measured lines"
        )
        self.write_config(long_copy)
        with self.assertRaisesRegex(ConfigError, "maximum is 2"):
            generate_gallery(self.config_path, self.root / "copy-output")

    def test_rejects_malformed_config_and_missing_screenshot(self) -> None:
        self.config_path.write_text("{", encoding="utf-8")
        with self.assertRaisesRegex(ConfigError, "invalid JSON"):
            generate_gallery(self.config_path, self.root / "json-output")

        missing_screenshot = copy.deepcopy(self.config)
        missing_screenshot["slides"] = [missing_screenshot["slides"][0]]
        missing_screenshot["slides"][0]["screenshot"] = "screenshots/missing.png"
        self.write_config(missing_screenshot)
        with self.assertRaisesRegex(ConfigError, "screenshot not found"):
            generate_gallery(self.config_path, self.root / "missing-output")

    def test_rejects_footer_that_cannot_fit_one_row(self) -> None:
        long_footer = copy.deepcopy(self.config)
        long_footer["slides"] = [long_footer["slides"][0]]
        long_footer["slides"][0]["footerLabels"] = [
            "Private by design everywhere",
            "No advertisements or tracking",
            "Export whenever you choose",
        ]
        self.write_config(long_footer)

        with self.assertRaisesRegex(ConfigError, "single footer row"):
            generate_gallery(self.config_path, self.root / "footer-output")


class PrerenderedDeviceTests(unittest.TestCase):
    """device.mode "prerendered": each slide screenshot is already a framed device."""

    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.devices = self.root / "devices"
        self.devices.mkdir()

        self.first_path = self.devices / "home.png"
        self.second_path = self.devices / "mindmap.png"
        self.write_device(self.first_path, (633, 1309), (250, 247, 245))
        self.write_device(self.second_path, (633, 1309), (232, 116, 95))

        self.config = {
            "device": {
                "mode": "prerendered",
                "placement": {"x": 712, "y": 72, "height": 990},
            },
            "slides": [
                {
                    "headline": "Notice what returns.",
                    "subhead": "See a calmer picture of your week.",
                    "screenshot": "devices/home.png",
                    "background": "warm",
                    "footerLabels": ["No ads"],
                },
                {
                    "headline": "Your entries, mapped.",
                    "subhead": "Supportive context from the words you write.",
                    "screenshot": "devices/mindmap.png",
                    "background": "solid",
                },
            ],
        }
        self.config_path = self.root / "gallery.json"

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def write_device(
        self,
        path: Path,
        size: tuple[int, int],
        screen: tuple[int, int, int],
        *,
        opaque_corners: bool = False,
    ) -> None:
        """A rounded device silhouette cut out on transparency, like the real mockups."""
        image = Image.new(
            "RGBA",
            size,
            (12, 12, 12, 255) if opaque_corners else (0, 0, 0, 0),
        )
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle(
            (0, 0, size[0] - 1, size[1] - 1),
            radius=76,
            fill=(28, 27, 26, 255),
        )
        draw.rounded_rectangle(
            (14, 14, size[0] - 15, size[1] - 15),
            radius=62,
            fill=screen + (255,),
        )
        image.save(path)

    def write_config(self, config: dict | None = None) -> None:
        self.config_path.write_text(
            json.dumps(self.config if config is None else config),
            encoding="utf-8",
        )

    def test_renders_without_a_frame_or_screen_bounds(self) -> None:
        self.write_config()
        output_dir = self.root / "output"

        outputs = generate_gallery(self.config_path, output_dir)

        self.assertEqual([path.name for path in outputs], ["01.png", "02.png"])
        with Image.open(outputs[0]) as warm, Image.open(outputs[1]) as solid:
            self.assertEqual(warm.size, (CANVAS_WIDTH, CANVAS_HEIGHT))
            self.assertEqual(solid.mode, "RGB")
            # 633x1309 at height 990 renders 479 wide from x=712, so the screen
            # fill lands inside the device and the canvas stays clear at x=1250.
            self.assertEqual(solid.getpixel((950, 400)), (232, 116, 95))
            self.assertEqual(solid.getpixel((1250, 400)), (10, 10, 10))

    def test_rejects_frame_geometry_left_over_from_the_frame_mode(self) -> None:
        stale = copy.deepcopy(self.config)
        stale["device"]["screenBounds"] = {"x": 30, "y": 28, "width": 573, "height": 1245}
        self.write_config(stale)

        with self.assertRaisesRegex(ConfigError, "device.screenBounds is not used"):
            generate_gallery(self.config_path, self.root / "stale-output")

    def test_rejects_sources_that_do_not_share_one_size(self) -> None:
        self.write_device(self.second_path, (640, 1400), (232, 116, 95))
        self.write_config()

        with self.assertRaisesRegex(ConfigError, "must share one size"):
            generate_gallery(self.config_path, self.root / "size-output")

    def test_rejects_a_source_with_opaque_corners(self) -> None:
        self.write_device(
            self.first_path,
            (633, 1309),
            (250, 247, 245),
            opaque_corners=True,
        )
        self.write_config()

        with self.assertRaisesRegex(ConfigError, "opaque corners"):
            generate_gallery(self.config_path, self.root / "corner-output")

    def test_rejects_upscaling_the_device_without_writing_outputs(self) -> None:
        upscaled = copy.deepcopy(self.config)
        upscaled["device"]["placement"] = {"x": 712, "y": -700, "height": 1400}
        self.write_config(upscaled)
        output_dir = self.root / "upscale-output"

        with self.assertRaisesRegex(ConfigError, "may not exceed the source height"):
            generate_gallery(self.config_path, output_dir)

        self.assertFalse(output_dir.exists())

    def test_rejects_an_unknown_device_mode(self) -> None:
        unknown = copy.deepcopy(self.config)
        unknown["device"]["mode"] = "composited"
        self.write_config(unknown)

        with self.assertRaisesRegex(ConfigError, "device.mode must be one of"):
            generate_gallery(self.config_path, self.root / "mode-output")


class SummaryLayoutTests(unittest.TestCase):
    """layout "summary": a centred headline over feature columns, no device."""

    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.devices = self.root / "devices"
        self.devices.mkdir()

        self.device_path = self.devices / "home.png"
        device = Image.new("RGBA", (633, 1309), (0, 0, 0, 0))
        draw = ImageDraw.Draw(device)
        draw.rounded_rectangle((0, 0, 632, 1308), radius=76, fill=(28, 27, 26, 255))
        device.save(self.device_path)

        self.summary_slide = {
            "layout": "summary",
            "headline": "Everything you need to notice what keeps coming back.",
            "background": "solid",
            "columns": [
                {"title": "ask jade", "body": "a private AI that has read your journal"},
                {"title": "the mind map", "body": "see how your themes connect"},
                {"title": "guided reflection", "body": "one question at a time"},
            ],
        }
        self.config = {
            "device": {
                "mode": "prerendered",
                "placement": {"x": 712, "y": 72, "height": 990},
            },
            "slides": [
                {
                    "headline": "Notice what returns.",
                    "subhead": "See a calmer picture of your week.",
                    "screenshot": "devices/home.png",
                    "background": "warm",
                },
                copy.deepcopy(self.summary_slide),
            ],
        }
        self.config_path = self.root / "gallery.json"

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def write_config(self, config: dict | None = None) -> None:
        self.config_path.write_text(
            json.dumps(self.config if config is None else config),
            encoding="utf-8",
        )

    def test_renders_a_summary_slide_alongside_device_slides(self) -> None:
        self.write_config()
        output_dir = self.root / "output"

        outputs = generate_gallery(self.config_path, output_dir)

        self.assertEqual([path.name for path in outputs], ["01.png", "02.png"])
        with Image.open(outputs[1]) as summary:
            self.assertEqual(summary.size, (CANVAS_WIDTH, CANVAS_HEIGHT))
            # No device is drawn, so the right half stays background all the way
            # down to where the wave band begins.
            self.assertEqual(summary.getpixel((1100, 300)), (10, 10, 10))
            # The centred headline puts bright pixels on the vertical midline,
            # which the device layout never does.
            self.assertGreater(summary.getpixel((635, 130))[0], 180)

    def test_renders_a_gallery_of_only_summary_slides(self) -> None:
        # No slide uses the device layout, so no device art is needed at all.
        only_summary = {"slides": [copy.deepcopy(self.summary_slide)]}
        self.write_config(only_summary)

        outputs = generate_gallery(self.config_path, self.root / "summary-only")

        self.assertEqual([path.name for path in outputs], ["01.png"])

    def test_rejects_device_copy_left_on_a_summary_slide(self) -> None:
        stale = copy.deepcopy(self.config)
        stale["slides"][1]["subhead"] = "Left over from the device layout."
        self.write_config(stale)

        with self.assertRaisesRegex(ConfigError, "subhead is not used by the summary"):
            generate_gallery(self.config_path, self.root / "stale-output")

    def test_rejects_columns_on_a_device_slide(self) -> None:
        misplaced = copy.deepcopy(self.config)
        misplaced["slides"][0]["columns"] = self.summary_slide["columns"]
        self.write_config(misplaced)

        with self.assertRaisesRegex(ConfigError, "only used by the summary layout"):
            generate_gallery(self.config_path, self.root / "columns-output")

    def test_rejects_more_columns_than_the_canvas_fits(self) -> None:
        crowded = copy.deepcopy(self.config)
        crowded["slides"][1]["columns"] = [
            {"title": f"feature {index}", "body": "a short description"}
            for index in range(5)
        ]
        self.write_config(crowded)

        with self.assertRaisesRegex(ConfigError, "fits at most 4"):
            generate_gallery(self.config_path, self.root / "crowded-output")

    def test_rejects_a_column_title_that_cannot_fit_one_line(self) -> None:
        wide = copy.deepcopy(self.config)
        wide["slides"][1]["columns"][0]["title"] = (
            "a column title far too long to sit on a single line"
        )
        self.write_config(wide)

        with self.assertRaisesRegex(ConfigError, "title does not fit"):
            generate_gallery(self.config_path, self.root / "title-output")


if __name__ == "__main__":
    unittest.main()
