#!/usr/bin/env python3
"""
Composes the 1200x630 Open Graph card for the marketing site.

Same art direction as the App Store panels and the website hero: one continuous
charcoal -> espresso -> ember gradient, a single soft coral glow, fine film grain,
and the real Home screenshot in its device frame bleeding off the bottom right.

Called by scripts/build-site-assets.sh. Requires Pillow.
"""

import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FONTS = os.path.join(REPO, "frontend", "src", "assets", "fonts")
FRAME = os.path.join(
    REPO,
    "frontend",
    "iphone ss with frame",
    "iPhone 16 Pro Black Titanium - Home_thumb.png",
)
OUT = os.path.join(REPO, "backend", "public", "site", "img", "og.jpg")

W, H = 1200, 630

INK = (20, 18, 16)
ESPRESSO = (42, 33, 28)
EMBER = (92, 46, 34)
CORAL = (232, 116, 95)
CREAM = (251, 247, 244)
MUTED = (176, 164, 156)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient():
    """Vertical charcoal -> espresso -> ember, with the ember weighted low."""
    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        if t < 0.45:
            color = lerp(INK, ESPRESSO, t / 0.45)
        else:
            # ease-in so the ember only really arrives in the bottom third
            k = (t - 0.45) / 0.55
            color = lerp(ESPRESSO, EMBER, k * k)
        draw.line([(0, y), (W, y)], fill=color)
    return img


def radial_glow(img, cx, cy, radius, color, peak):
    """One soft radial glow, screened over the background."""
    res = 220
    mask_small = Image.new("L", (res, res))
    px = mask_small.load()
    half = res / 2
    for y in range(res):
        for x in range(res):
            d = math.hypot(x - half, y - half) / half
            if d >= 1:
                continue
            # smootherstep falloff -- no visible edge
            v = 1 - d
            px[x, y] = int(255 * peak * v * v * (3 - 2 * v))
    mask = mask_small.resize((radius * 2, radius * 2), Image.LANCZOS)

    full = Image.new("L", (W, H), 0)
    full.paste(mask, (cx - radius, cy - radius))
    full = full.filter(ImageFilter.GaussianBlur(24))

    layer = Image.new("RGB", (W, H), color)
    return Image.composite(layer, img, full)


def add_grain(img, sigma=7, opacity=0.05):
    """Fine even film grain -- the 'matte coated paper' texture."""
    random.seed(7)
    noise = Image.effect_noise((W, H), sigma).convert("L")
    grain = Image.merge("RGB", (noise, noise, noise))
    return Image.blend(img, grain, opacity)


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def main():
    img = gradient()

    # the big ambient ember glow, low and centred-left like the store panels
    img = radial_glow(img, cx=430, cy=560, radius=620, color=CORAL, peak=0.16)
    # a tighter warm glow behind where the device sits
    img = radial_glow(img, cx=950, cy=430, radius=380, color=CORAL, peak=0.20)

    # ---- device frame, bleeding off the bottom-right --------------------
    if os.path.exists(FRAME):
        phone = Image.open(FRAME).convert("RGBA")
        target_h = 720
        target_w = round(phone.width * target_h / phone.height)
        phone = phone.resize((target_w, target_h), Image.LANCZOS)
        px, py = 812, 128
        img = img.convert("RGBA")
        img.alpha_composite(phone, (px, py))
        img = img.convert("RGB")
    else:
        print(f"warning: missing device frame {FRAME}", file=sys.stderr)

    draw = ImageDraw.Draw(img)

    # ---- wordmark -------------------------------------------------------
    x = 78
    wm = font("BricolageGrotesque-Bold.ttf", 34)
    draw.text((x, 74), "journal", font=wm, fill=CREAM)
    wm_w = draw.textlength("journal", font=wm)
    draw.text((x + wm_w, 74), ".io", font=wm, fill=CORAL)

    # ---- headline -------------------------------------------------------
    head = font("BricolageGrotesque-Bold.ttf", 68)
    lines = ["Notice what", "keeps coming back."]
    y = 214
    for line in lines:
        draw.text((x, y), line, font=head, fill=CREAM)
        y += 80

    # ---- supporting line ------------------------------------------------
    sub = font("SchibstedGrotesk-Regular.ttf", 25)
    draw.text(
        (x, y + 26),
        "Journaling that turns what you write\ninto patterns you can actually see.",
        font=sub,
        fill=MUTED,
        spacing=10,
    )

    img = add_grain(img)
    img.save(OUT, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"    og.jpg                 {os.path.getsize(OUT) // 1024}K ({W}x{H})")


if __name__ == "__main__":
    main()
