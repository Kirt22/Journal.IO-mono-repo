# Product Hunt gallery slides

The Product Hunt gallery generator creates numbered `1270x760` PNG slides from
app screenshots, using the same Bricolage Grotesque and Schibsted Grotesk faces as
the Journal.IO marketing site.

It takes device art in one of two shapes, chosen with `device.mode`:

- **`"frame"`** (the default) — raw screen captures composited under one shared
  transparent device-frame overlay.
- **`"prerendered"`** — screenshots that are *already* framed device mockups, cut
  out on transparency. This is what `frontend/iphone ss with frame/` holds, and
  what the checked-in `product-hunt-gallery.json` uses.

Pick `"prerendered"` whenever the mockups came out of a design tool with the phone
already drawn around the screen. A flattened mockup cannot be used as a `"frame"`
source — the frame path needs a real hole to composite into.

## Requirements

- Python 3.10 or newer
- Pillow
- Device art, per `device.mode`:
  - `"prerendered"`: framed mockup PNGs with a transparent surround
  - `"frame"`: a transparent device-frame PNG plus raw screenshots

System Python on this machine does not carry Pillow, and installing into it is
not worth doing for one script. Use a local virtualenv, which `.gitignore`
already excludes:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install Pillow
.venv/bin/python -m unittest scripts.tests.test_generate_product_hunt_gallery
```

The frame must have a transparent screen opening. Screenshots are composited
under the frame, so a flattened phone mockup cannot be used as the frame source.

## Configure the gallery

Start with [`product-hunt-gallery.example.json`](../product-hunt-gallery.example.json).
Relative paths are resolved from the config file's directory.

The shared `device` object contains:

- `mode`: `"frame"` (default) or `"prerendered"`.
- `shadow`: optional, defaults to `true`. Draws a soft shadow shaped by the
  device's own alpha. Leave it on — a Black Titanium frame is barely lighter than
  the near-black canvas, and without it the top and side rails merge into the
  background and the device loses its silhouette.
- `frame`: path to the transparent frame PNG. **`"frame"` mode only** — supplying
  it under `"prerendered"` is an error rather than a silent no-op, so a
  half-migrated config fails loudly instead of rendering something almost right.
- `screenBounds`: the screen opening's `x`, `y`, `width`, and `height`, measured
  in pixels on the original frame file. **`"frame"` mode only**, same rule.
- `placement`: final-slide `x`, `y`, and device `height` in pixels. Width is
  derived from the frame aspect ratio. The placement must bleed past at least
  one edge of the `1270x760` canvas — which edge is a layout choice. Anchoring
  the device to the right bleeds off the right; standing it tall on the right
  with its top rail fully visible bleeds off the bottom. A device sitting
  entirely inside the canvas is rejected, because it reads as a thumbnail
  pasted onto a slide rather than as a product shot.

## Slide layouts

Every slide takes `background` (`solid` or `warm`), `headline`, an optional
`footerLabels` row of small feature labels, and an optional `wordmark` flag. The
rest depends on `layout`:

`wordmark: true` draws the journal.io lockup at the top of the copy column, on
the same left margin as the headline. It is set from
`frontend/src/components/JournalWordmark.tsx` — Bricolage Grotesque Bold, with
`journal` in cream and `.io` in the brand coral, and that component's tracking
**ratios** rather than baked-in pixel values. If the lockup changes there, change
the ratios here to match.

### `"device"` (the default)

Copy down the left, device on the right. Requires `subhead` and `screenshot`.

### `"summary"`

A centred headline over feature columns with no device at all — the panel that
sells the whole product rather than one screen. Requires `columns`, an array of
2–4 `{ "title", "body" }` objects, and takes neither `subhead` nor `screenshot`
(supplying either is an error, so a layout switch cannot leave orphaned copy
behind). A soft two-tone wave band is drawn across the foot of the slide.

Column titles must fit their column on **one line**. They are not wrapped: a
wrapped title would push its own body copy out of step with the columns beside
it, so the generator errors and asks for a shorter title instead.

A gallery made only of summary slides needs no `device` block at all. The block
becomes required as soon as one slide uses the `"device"` layout.

### Copy limits

Headlines, subheads, and column bodies are measured with the real fonts.
Headlines and subheads may occupy at most two lines, column bodies at most
three. The generator reports an error instead of silently shrinking copy.

## Generate slides

```bash
python3 scripts/generate_product_hunt_gallery.py product-hunt-gallery.json \
  --output-dir product-hunt-gallery
```

Outputs are named `01.png`, `02.png`, and so on. Existing files with those names
are overwritten; unrelated files in the output directory are left alone.

## Image quality

The composition is rendered internally at 2x and downsampled once with Lanczos.
Both modes fail the entire run before the output directory is created, reporting
the offending source — but they check different things, because they are scaling
different things.

**`"frame"` mode** enlarges a screen capture to fill the frame's opening, so the
capture needs headroom: it must be large enough to fill twice the final screen
opening in both dimensions after aspect-ratio cropping.

**`"prerendered"` mode** is not enlarging anything inside a frame — the device
arrives at its final detail. The only thing that costs sharpness is scaling the
device up past its own pixels, so the rule is simply that
`device.placement.height` may not exceed the source height. The
`633x1309` mockups in `frontend/iphone ss with frame/` at a placement height of
`990` are a net downscale, and stay crisp.

`"prerendered"` mode adds two structural checks:

- **Every slide's source must be the same pixel size.** Device width is derived
  from the source aspect ratio, so mismatched sources would move and resize the
  phone from slide to slide.
- **Corners must be transparent.** A flattened mockup on an opaque background is
  the one failure that still looks deliberate — it renders as a rectangle pasted
  onto the slide. It is rejected up front instead.

## Measure the screen opening

**`"frame"` mode only.** `"prerendered"` sources have no opening to measure, and
`scripts/measure_device_frame.py` has nothing to do with them.

The example screen bounds match a typical `633x1309` iPhone frame and are only a
starting point. Measure the actual opening in the chosen frame rather than
reading it off a design tool by eye — a few pixels out shows up as a sliver of
background along one edge of the finished slide:

```bash
.venv/bin/python scripts/measure_device_frame.py assets/device-frame.png \
  --write product-hunt-gallery.json
```

It reports the measured bounds, the screen aspect (an iPhone 17 Pro opening is
`0.4600`), and how much of the measured box is actually open, then writes
`device.screenBounds` into the config.

Note that the obvious approach — bounding-box the frame's transparent pixels —
does not work on a real frame. The phone has rounded outer corners, so the
transparent background is contiguous with the cutout as far as a bounding box is
concerned and the measurement comes back as the whole image. The script instead
flood-fills the exterior transparency away first and measures only the
transparency the frame encloses, which also handles frames exported with
transparent outer margins.
