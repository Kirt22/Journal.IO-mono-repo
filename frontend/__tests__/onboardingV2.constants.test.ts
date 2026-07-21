import {
  getOnboardingThemeDefault,
  READY_FEATURE_CARDS,
} from '../src/screens/onboarding/onboardingV2.constants';

describe('getOnboardingThemeDefault', () => {
  it('selects Midnight for the active dark app theme', () => {
    expect(getOnboardingThemeDefault('dark')).toBe('midnight_calm');
  });

  it('selects Cream for the active light app theme', () => {
    expect(getOnboardingThemeDefault('light')).toBe('warm_cream');
  });

  it('keeps the ready card copy brief and clear', () => {
    expect(READY_FEATURE_CARDS.map(card => card.text)).toEqual([
      'Thoughtful questions shaped by your setup.',
      'Your writing stays private and protected.',
      'Your entries become insights over time.',
    ]);
  });
});
