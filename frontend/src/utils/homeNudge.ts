/**
 * Picks the single most useful next step to show in the tag under the Home
 * greeting.
 *
 * The greeting itself is permanent — only this tag changes — so everything here
 * has to read as one pill-sized line. Only one nudge shows at a time; stacking
 * them would turn the calmest part of the screen into a to-do list. The ladder
 * is ordered by how time-bound each item is: a streak can only be saved today, a
 * check-in is the cheapest action, goals run to a period, and the reflection is
 * always there if you want it.
 *
 * Copy stays supportive and non-gamified per docs/UI_IMPLEMENTATION_STANDARDS.md
 * — it offers the next step without loss-aversion pressure ("don't lose your
 * streak!") or achievement language.
 *
 * Pure on purpose: no React, no RN imports, so the priority rules can be tested
 * directly.
 */

export type HomeNudgeKind =
  | 'streak-broken'
  | 'streak-at-risk'
  | 'mood'
  | 'goals'
  | 'reflection'
  | 'offer'
  | 'all-clear';

/** Resolved to a real icon by the component; keeps this module RN-free. */
export type HomeNudgeIcon =
  | 'flame'
  | 'mood'
  | 'goals'
  | 'reflection'
  | 'offer'
  | 'quick-thought';

/** Where tapping the tag should take the user. */
export type HomeNudgeTarget =
  | 'mood'
  | 'goals'
  | 'reflection'
  | 'new-entry'
  | 'offer'
  | 'quick-thought';

export type HomeNudge = {
  kind: HomeNudgeKind;
  label: string;
  icon: HomeNudgeIcon;
  target: HomeNudgeTarget;
};

export type HomeNudgeInput = {
  currentStreak: number;
  hasCheckedInToday: boolean;
  /** A journal entry — open-ended or guided — was written today. */
  hasWrittenToday: boolean;
  /** Last streak we saw locally was above zero and the current one is not. */
  hadStreakBefore: boolean;
  pendingGoalCount: number;
  hasSeenTodaysReflection: boolean;
  isPremium: boolean;
  /** The special offer is switched on server-side. */
  isOfferAvailable: boolean;
  /**
   * The hero is on screen. The offer is held back until it is, so the swap and
   * its celebration are not spent while the user is scrolled past them.
   */
  isHeroVisible: boolean;
};

export function selectHomeNudge(input: HomeNudgeInput): HomeNudge {
  const {
    currentStreak,
    hasCheckedInToday,
    hasWrittenToday,
    hadStreakBefore,
    pendingGoalCount,
    hasSeenTodaysReflection,
    isPremium,
    isOfferAvailable,
    isHeroVisible,
  } = input;

  // The streak is carried by writing, so both streak nudges open the entry
  // chooser rather than pointing at the mood row.
  if (currentStreak === 0 && hadStreakBefore) {
    return {
      kind: 'streak-broken',
      label: 'Start a new streak today',
      icon: 'flame',
      target: 'new-entry',
    };
  }

  if (currentStreak > 0 && !hasWrittenToday) {
    return {
      kind: 'streak-at-risk',
      label: `Keep your ${currentStreak}-day streak`,
      icon: 'flame',
      target: 'new-entry',
    };
  }

  if (!hasCheckedInToday) {
    return {
      kind: 'mood',
      label: 'Complete your mood check-in',
      icon: 'mood',
      target: 'mood',
    };
  }

  if (pendingGoalCount > 0) {
    return {
      kind: 'goals',
      label:
        pendingGoalCount === 1
          ? "1 left on today's goals"
          : `${pendingGoalCount} left on today's goals`,
      icon: 'goals',
      target: 'goals',
    };
  }

  if (!hasSeenTodaysReflection) {
    return {
      kind: 'reflection',
      label: "Today's reflection is new",
      icon: 'reflection',
      target: 'reflection',
    };
  }

  if (!isPremium && isOfferAvailable && isHeroVisible) {
    return {
      kind: 'offer',
      label: 'Your special offer is here',
      icon: 'offer',
      target: 'offer',
    };
  }

  return {
    kind: 'all-clear',
    label: 'Capture a quick thought',
    icon: 'quick-thought',
    target: 'quick-thought',
  };
}
