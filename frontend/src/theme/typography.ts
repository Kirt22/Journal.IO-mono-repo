import type { TextStyle } from 'react-native';

/**
 * Journal.IO type system.
 *
 * Bricolage Grotesque carries display moments (greeting, wordmark, numerals);
 * Schibsted Grotesk carries everything else. Both ship as static cuts under
 * `src/assets/fonts` — one file per weight, each with its PostScript name equal
 * to its filename, because iOS resolves a custom font by PostScript name while
 * Android resolves it by asset filename. Addressing one family per weight
 * avoids the unreliable weight matching you get from a shared family name.
 */

export type FontRole = 'display' | 'ui';

/**
 * Type at or above this size is display type and switches to Bricolage
 * Grotesque; everything below it stays on Schibsted Grotesk.
 *
 * The threshold is applied centrally (see `infrastructure/reactNative.ts`) so
 * the two faces stay in their intended registers without ~70 call sites having
 * to name a family by hand. Reach for a `typography` preset — or set
 * `fontFamily` explicitly — when a specific piece of text needs to opt out.
 */
export const DISPLAY_SIZE_THRESHOLD = 22;

export function roleForSize(fontSize: number | undefined): FontRole {
  return fontSize !== undefined && fontSize >= DISPLAY_SIZE_THRESHOLD
    ? 'display'
    : 'ui';
}

export const fontFamilies = {
  display: {
    semibold: 'BricolageGrotesque-SemiBold',
    bold: 'BricolageGrotesque-Bold',
  },
  ui: {
    regular: 'SchibstedGrotesk-Regular',
    medium: 'SchibstedGrotesk-Medium',
    semibold: 'SchibstedGrotesk-SemiBold',
    bold: 'SchibstedGrotesk-Bold',
    italic: 'SchibstedGrotesk-Italic',
  },
} as const;

/**
 * Maps a React Native `fontWeight` onto a concrete font file.
 *
 * The cuts stop at 700, so 800 and 900 resolve to Bold rather than asking the
 * platform to synthesise a heavier face. That clamp is deliberate: it keeps the
 * app's remaining heavy declarations rendering as real type instead of a
 * smeared fake-bold, and it de-escalates the old weight inflation on contact.
 */
export function resolveFontFamily(
  weight: TextStyle['fontWeight'],
  role: FontRole = 'ui',
  italic = false,
): string {
  if (italic) {
    return fontFamilies.ui.italic;
  }

  const numeric = normalizeWeight(weight);

  if (role === 'display') {
    return numeric >= 700
      ? fontFamilies.display.bold
      : fontFamilies.display.semibold;
  }

  if (numeric >= 700) {
    return fontFamilies.ui.bold;
  }
  if (numeric >= 600) {
    return fontFamilies.ui.semibold;
  }
  if (numeric >= 500) {
    return fontFamilies.ui.medium;
  }

  return fontFamilies.ui.regular;
}

function normalizeWeight(weight: TextStyle['fontWeight']): number {
  if (weight === 'bold') {
    return 700;
  }
  if (weight === 'normal' || weight === undefined || weight === null) {
    return 400;
  }

  const parsed = typeof weight === 'number' ? weight : Number.parseInt(weight, 10);

  return Number.isFinite(parsed) ? parsed : 400;
}

/**
 * The type scale. Sizes stay close to what the app already used so this does
 * not reflow existing layouts; what changes is that every step now carries a
 * deliberate weight, line height, and tracking instead of an ad-hoc value.
 *
 * `letterSpacing` is in points, not em — negative on display sizes to tighten
 * large type, positive on captions to open up small type.
 */
export const typography = {
  /** Auth wordmark and celebration moments. */
  hero: {
    fontFamily: fontFamilies.display.bold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.9,
  },
  /** Home greeting, screen-defining headlines. */
  display: {
    fontFamily: fontFamilies.display.bold,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.7,
  },
  /** Section headers inside a screen. */
  title: {
    fontFamily: fontFamilies.ui.semibold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  /** Card titles, modal headers. */
  heading: {
    fontFamily: fontFamilies.ui.semibold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  /** Card titles at the smaller end, list-row titles. */
  subheading: {
    fontFamily: fontFamilies.ui.semibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  /** Default reading size — entry bodies, AI insight prose. */
  body: {
    fontFamily: fontFamilies.ui.regular,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0,
  },
  /** Supporting copy under a title, denser list content. */
  bodySm: {
    fontFamily: fontFamilies.ui.regular,
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0,
  },
  /** Field labels, tab labels, chips. */
  label: {
    fontFamily: fontFamilies.ui.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  /** Timestamps, counts, quiet metadata. */
  caption: {
    fontFamily: fontFamilies.ui.medium,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.3,
  },
  /** Small all-caps section markers. */
  overline: {
    fontFamily: fontFamilies.ui.semibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  /** Large standalone figures — streak counts, stat tiles. */
  numeral: {
    fontFamily: fontFamilies.display.bold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
