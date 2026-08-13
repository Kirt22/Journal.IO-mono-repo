import type { MoodValue } from '../services/moodService';

/**
 * The mood ramp is semantically fixed — "amazing" is green and "terrible" is
 * crimson regardless of which theme palette the user picked — so these are not
 * theme tokens. Each entry only carries a light/dark twin so the ramp keeps the
 * same perceived saturation on either background.
 *
 * Held at high, even saturation on purpose: the previous version reused
 * unrelated semantic tokens (primary / success / warning / mutedForeground /
 * destructive) and read as five washed-out, unrelated tints.
 */
export const MOOD_COLORS: Record<MoodValue, { light: string; dark: string }> = {
  amazing: { light: '#2F9E6B', dark: '#4FBF8A' }, // deep green
  good: { light: '#4C7FC0', dark: '#74A7E5' }, // calm blue
  okay: { light: '#E0A32E', dark: '#F2B94A' }, // amber
  bad: { light: '#DE7B3C', dark: '#EF9455' }, // orange
  terrible: { light: '#C8465A', dark: '#E86477' }, // crimson
};

/** Fill opacity for an unselected mood chip. */
export const MOOD_TINT_ALPHA = 0.14;

/** Fill opacity for the selected mood chip and the saved-state icon. */
export const MOOD_SELECTED_TINT_ALPHA = 0.2;

export const getMoodColor = (mood: MoodValue, mode: 'light' | 'dark') =>
  MOOD_COLORS[mood][mode];
