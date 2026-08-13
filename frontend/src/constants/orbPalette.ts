import type { ThemeMode } from '../theme/theme';

/**
 * The Home hero orb takes its rim colour from `theme.colors.primary`, so it
 * follows whichever of the seven palettes the user picked. These two accents are
 * the exception: the shader blends a secondary highlight and a deep inner shade
 * that have no equivalent semantic token, and picking the nearest ones (info /
 * muted) made the ring read as a flat two-tone band instead of lit energy.
 *
 * Like `moodPalette.ts`, each entry carries a light/dark twin so the accents keep
 * the same perceived weight on either background. They are deliberately low
 * chroma next to the primary — they support the rim rather than compete with it.
 */
type OrbAccents = {
  /** Highlight the rim cycles toward as the hotspot travels around it. */
  secondary: string;
  /** Inner shade behind the rim; never rendered opaque over the background. */
  deep: string;
};

const ORB_ACCENTS: Record<ThemeMode, OrbAccents> = {
  light: {
    secondary: '#A99BD6',
    deep: '#4A2E52',
  },
  dark: {
    secondary: '#8B6FE8',
    deep: '#171A5C',
  },
};

export function getOrbAccents(mode: ThemeMode): OrbAccents {
  return ORB_ACCENTS[mode] ?? ORB_ACCENTS.light;
}

/**
 * Opacity of the oversized orb sitting behind the root paywall. It has to read
 * as atmosphere rather than a hero — the headline and feature rows sit directly
 * on top of it — so it runs well below the Home orb's full strength, and a touch
 * hotter on dark where the same glow reads dimmer.
 */
const AMBIENT_ORB_OPACITY: Record<ThemeMode, number> = {
  light: 0.35,
  dark: 0.45,
};

export function getAmbientOrbOpacity(mode: ThemeMode): number {
  return AMBIENT_ORB_OPACITY[mode] ?? AMBIENT_ORB_OPACITY.light;
}

export type { OrbAccents };
