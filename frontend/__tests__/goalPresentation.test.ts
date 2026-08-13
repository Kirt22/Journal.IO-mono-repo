import {
  getGoalAccentKey,
  getGoalPresentationColors,
} from '../src/utils/goalPresentation';
import { getTheme } from '../src/theme/theme';

test('assigns stable variation across the four semantic goal accents', () => {
  const accents = ['a', 'b', 'c', 'd'].map(getGoalAccentKey);

  expect(new Set(accents)).toEqual(
    new Set(['primary', 'info', 'success', 'warning']),
  );
  expect(getGoalAccentKey('stable-goal')).toBe(getGoalAccentKey('stable-goal'));
});

test('uses list position to keep compact preview accents distinct', () => {
  expect([0, 1, 2, 3].map(index => getGoalAccentKey('same', index))).toEqual([
    'primary',
    'info',
    'success',
    'warning',
  ]);
});

test('uses stronger goal tinting in dark mode while retaining theme accents', () => {
  const lightTheme = getTheme('light');
  const darkTheme = getTheme('dark');
  const accentKey = getGoalAccentKey('goal-1');
  const lightColors = getGoalPresentationColors(lightTheme, 'goal-1');
  const darkColors = getGoalPresentationColors(darkTheme, 'goal-1');

  expect(lightColors.accentColor).toBe(lightTheme.colors[accentKey]);
  expect(darkColors.accentColor).toBe(darkTheme.colors[accentKey]);
  expect(lightColors.tintColor).toContain(', 0.1)');
  expect(darkColors.tintColor).toContain(', 0.12)');
});
