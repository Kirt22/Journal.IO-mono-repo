#!/usr/bin/env bash
#
# Regenerates every binary asset used by the marketing site at backend/public/site/.
#
# The sources live in gitignored local-only folders (see .gitignore "LOCAL SCREENSHOT
# WORK"), so the *outputs* of this script are what gets committed. Re-run it whenever a
# screenshot is re-shot or a brand font changes.
#
#   ./scripts/build-site-assets.sh
#
# Requirements (macOS):
#   brew install webp        -> cwebp
#   pip3 install fonttools brotli  -> pyftsubset
#   sips ships with macOS

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRAMES_DIR="$REPO_ROOT/frontend/iphone ss with frame"
PANELS_DIR="$REPO_ROOT/frontend/journalio-panels"
FONTS_SRC="$REPO_ROOT/frontend/src/assets/fonts"
ICON_SRC="$REPO_ROOT/frontend/ios/JournalFrontend/Images.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png"

OUT="$REPO_ROOT/backend/public/site"
IMG_OUT="$OUT/img"
FONT_OUT="$OUT/fonts"

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing: $1 ($2)" >&2; exit 1; }
}
need cwebp "brew install webp"
need sips "ships with macOS"

PYFTSUBSET="$(command -v pyftsubset || true)"
if [ -z "$PYFTSUBSET" ]; then
  echo "missing: pyftsubset (pip3 install fonttools brotli)" >&2
  exit 1
fi

mkdir -p "$IMG_OUT" "$FONT_OUT"

# ---------------------------------------------------------------------------
# 1. Device-framed screenshots -> WebP (alpha preserved; the frames are cut out)
# ---------------------------------------------------------------------------
echo "==> device frames"
frame() {
  local src="$FRAMES_DIR/iPhone 16 Pro Black Titanium - $1_thumb.png"
  local dst="$IMG_OUT/$2.webp"
  if [ ! -f "$src" ]; then
    echo "    SKIP $2 (missing source: $src)"
    return
  fi
  cwebp -quiet -q 82 -alpha_q 100 -m 6 "$src" -o "$dst"
  printf '    %-22s %s\n' "$2.webp" "$(du -h "$dst" | cut -f1)"
}

frame "Home"               home
frame "ask jade"           ask-jade
frame "mind map"           mind-map
frame "guided reflection"  guided-reflection
frame "weekly ai analysis" weekly-analysis
frame "streak widget"      streak-widget
frame "Biometric"          biometric

# ---------------------------------------------------------------------------
# 2. Brand fonts -> subset WOFF2
#    Latin-1 + the punctuation the copy actually uses (en/em dash, curly quotes,
#    ellipsis, bullet, arrows). ~100KB TTF collapses to ~20KB per face.
# ---------------------------------------------------------------------------
echo "==> fonts"
UNICODES="U+0000-00FF,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026,U+2192,U+2193,U+00B7"

subset() {
  local src="$FONTS_SRC/$1.ttf"
  local dst="$FONT_OUT/$1.woff2"
  if [ ! -f "$src" ]; then
    echo "    SKIP $1 (missing source)"
    return
  fi
  "$PYFTSUBSET" "$src" \
    --output-file="$dst" \
    --flavor=woff2 \
    --layout-features='kern,liga,calt,tnum' \
    --unicodes="$UNICODES" \
    --no-hinting \
    --desubroutinize
  printf '    %-38s %s\n' "$1.woff2" "$(du -h "$dst" | cut -f1)"
}

subset BricolageGrotesque-Bold
subset BricolageGrotesque-SemiBold
subset SchibstedGrotesk-Regular
subset SchibstedGrotesk-Medium
subset SchibstedGrotesk-SemiBold
subset SchibstedGrotesk-Bold

# The SIL Open Font License requires the license text to ship with the fonts.
cp "$FONTS_SRC/OFL-BricolageGrotesque.txt" "$FONT_OUT/" 2>/dev/null || true
cp "$FONTS_SRC/OFL-SchibstedGrotesk.txt"  "$FONT_OUT/" 2>/dev/null || true

# ---------------------------------------------------------------------------
# 3. Favicons from the real app icon
# ---------------------------------------------------------------------------
echo "==> icons"
if [ -f "$ICON_SRC" ]; then
  for size in 32 180 512; do
    sips -s format png -Z "$size" "$ICON_SRC" --out "$IMG_OUT/icon-$size.png" >/dev/null
    printf '    %-22s %s\n' "icon-$size.png" "$(du -h "$IMG_OUT/icon-$size.png" | cut -f1)"
  done
else
  echo "    SKIP icons (missing $ICON_SRC)"
fi

# ---------------------------------------------------------------------------
# 4. Open Graph card — composed from scratch (gradient + glow + grain + the real
#    device frame) rather than cropped from a store panel, so the headline is
#    the site's own copy and the 1.91:1 crop is designed rather than accidental.
# ---------------------------------------------------------------------------
echo "==> og image"
OG_PY="$(dirname "$PYFTSUBSET")/python3"
[ -x "$OG_PY" ] || OG_PY="python3"
"$OG_PY" "$REPO_ROOT/scripts/build-og-card.py"

echo
echo "done -> $OUT"
du -sh "$OUT"
