import { selectHomeNudge, type HomeNudgeInput } from '../src/utils/homeNudge';

const ALL_CLEAR: HomeNudgeInput = {
  currentStreak: 5,
  hasCheckedInToday: true,
  hasWrittenToday: true,
  hadStreakBefore: false,
  pendingGoalCount: 0,
  hasSeenTodaysReflection: true,
  isPremium: true,
  isOfferAvailable: false,
  isHeroVisible: true,
};

const nudgeFor = (overrides: Partial<HomeNudgeInput> = {}) =>
  selectHomeNudge({ ...ALL_CLEAR, ...overrides });

test('falls back to the quick thought tag when nothing is pending', () => {
  const nudge = nudgeFor();

  expect(nudge.kind).toBe('all-clear');
  expect(nudge.label).toBe('Capture a quick thought');
  expect(nudge.target).toBe('quick-thought');
});

test('a reset streak outranks everything else', () => {
  const nudge = nudgeFor({
    currentStreak: 0,
    hadStreakBefore: true,
    hasCheckedInToday: false,
    pendingGoalCount: 3,
    hasSeenTodaysReflection: false,
  });

  expect(nudge.kind).toBe('streak-broken');
  expect(nudge.label).toBe('Start a new streak today');
  // The streak is carried by writing, so it opens the entry chooser.
  expect(nudge.target).toBe('new-entry');
});

test('a live streak is at risk when nothing has been written today', () => {
  const nudge = nudgeFor({ currentStreak: 5, hasWrittenToday: false });

  expect(nudge.kind).toBe('streak-at-risk');
  expect(nudge.label).toBe('Keep your 5-day streak');
  expect(nudge.target).toBe('new-entry');
});

test('a live streak with an entry already written falls through to the check-in', () => {
  // Checking in does not carry the streak, so a missing check-in must not be
  // dressed up as a streak warning.
  const nudge = nudgeFor({
    currentStreak: 5,
    hasWrittenToday: true,
    hasCheckedInToday: false,
  });

  expect(nudge.kind).toBe('mood');
});

test('the check-in nudge names the check-in rather than the streak', () => {
  const nudge = nudgeFor({
    currentStreak: 0,
    hadStreakBefore: false,
    hasCheckedInToday: false,
  });

  expect(nudge.kind).toBe('mood');
  expect(nudge.label).toBe('Complete your mood check-in');
  expect(nudge.icon).toBe('mood');
  expect(nudge.target).toBe('mood');
});

test('a free user with the offer enabled sees it once the ladder is clear', () => {
  const nudge = nudgeFor({ isPremium: false, isOfferAvailable: true });

  expect(nudge.kind).toBe('offer');
  expect(nudge.target).toBe('offer');
});

test('the offer waits until the hero is back on screen', () => {
  // Otherwise the swap and its celebration are spent while scrolled past.
  const nudge = nudgeFor({
    isPremium: false,
    isOfferAvailable: true,
    isHeroVisible: false,
  });

  expect(nudge.kind).toBe('all-clear');
});

test('premium users keep the quick thought default', () => {
  const nudge = nudgeFor({ isPremium: true, isOfferAvailable: true });

  expect(nudge.kind).toBe('all-clear');
});

test('a free user keeps the quick thought default when the offer is switched off', () => {
  const nudge = nudgeFor({ isPremium: false, isOfferAvailable: false });

  expect(nudge.kind).toBe('all-clear');
});

test('a fresh install with no stored streak stays quiet about a reset', () => {
  // `hadStreakBefore` is false when nothing was ever stored, so a zero streak
  // reads as "never started" rather than "just broken".
  const nudge = nudgeFor({
    currentStreak: 0,
    hadStreakBefore: false,
    hasCheckedInToday: true,
  });

  expect(nudge.kind).not.toBe('streak-broken');
});

test('goals come after the check-in and before the reflection', () => {
  const nudge = nudgeFor({
    pendingGoalCount: 2,
    hasSeenTodaysReflection: false,
  });

  expect(nudge.kind).toBe('goals');
  expect(nudge.label).toBe("2 left on today's goals");
  expect(nudge.target).toBe('goals');
});

test('a single pending goal reads in the singular', () => {
  expect(nudgeFor({ pendingGoalCount: 1 }).label).toBe("1 left on today's goals");
});

test('the reflection is the last nudge before the all-clear tag', () => {
  const nudge = nudgeFor({ hasSeenTodaysReflection: false });

  expect(nudge.kind).toBe('reflection');
  expect(nudge.target).toBe('reflection');
});

test('every nudge carries a label, an icon and a target', () => {
  const cases: Partial<HomeNudgeInput>[] = [
    {},
    { currentStreak: 0, hadStreakBefore: true },
    { currentStreak: 5, hasWrittenToday: false },
    { currentStreak: 0, hasCheckedInToday: false },
    { pendingGoalCount: 1 },
    { hasSeenTodaysReflection: false },
    { isPremium: false, isOfferAvailable: true },
  ];

  for (const override of cases) {
    const nudge = nudgeFor(override);

    expect(nudge.label.length).toBeGreaterThan(0);
    expect(nudge.icon.length).toBeGreaterThan(0);
    expect(nudge.target.length).toBeGreaterThan(0);
    // The tag is a pill; anything much longer than this stops fitting on a
    // compact width without wrapping to three lines.
    expect(nudge.label.length).toBeLessThanOrEqual(30);
  }
});
