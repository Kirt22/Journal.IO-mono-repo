import type { AppTheme } from '../theme/theme';

export type GoalAccentKey = 'primary' | 'info' | 'success' | 'warning';

const GOAL_ACCENT_KEYS: readonly GoalAccentKey[] = [
  'primary',
  'info',
  'success',
  'warning',
];

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

export const getGoalAccentKey = (
  goalId: string,
  paletteIndex?: number,
): GoalAccentKey => {
  if (paletteIndex !== undefined) {
    const normalizedIndex =
      ((paletteIndex % GOAL_ACCENT_KEYS.length) + GOAL_ACCENT_KEYS.length) %
      GOAL_ACCENT_KEYS.length;

    return GOAL_ACCENT_KEYS[normalizedIndex];
  }

  let hash = 0;

  for (const character of goalId) {
    hash = (hash * 31 + character.charCodeAt(0)) % 2_147_483_647;
  }

  return GOAL_ACCENT_KEYS[hash % GOAL_ACCENT_KEYS.length];
};

export const getGoalPresentationColors = (
  theme: AppTheme,
  goalId: string,
  paletteIndex?: number,
) => {
  const accentKey = getGoalAccentKey(goalId, paletteIndex);
  const accentColor = theme.colors[accentKey];
  const isDark = theme.mode === 'dark';

  return {
    accentColor,
    borderColor: hexToRgba(accentColor, isDark ? 0.34 : 0.26),
    iconBackgroundColor: hexToRgba(accentColor, isDark ? 0.22 : 0.18),
    tintColor: hexToRgba(accentColor, isDark ? 0.12 : 0.1),
  };
};
