import { MOOD_COLORS } from '../src/constants/moodPalette';

test.each(['light', 'dark'] as const)(
  'Amazing and Good have distinct %s mode colors',
  mode => {
    expect(MOOD_COLORS.amazing[mode]).not.toBe(MOOD_COLORS.good[mode]);
  },
);
