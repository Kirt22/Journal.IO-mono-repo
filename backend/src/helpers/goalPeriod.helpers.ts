/**
 * Goal recurrence period math.
 *
 * Completion is recorded as the *client's* local date key ("YYYY-MM-DD") rather
 * than a timestamp, because the server has no reliable user timezone — the only
 * one stored (`reminder.timezone`) is scoped to the single daily_journal
 * reminder and may be absent or stale. Doing timezone math here would reset
 * goals at the wrong hour, which is the most damaging bug class in this feature.
 *
 * Every comparison below is therefore pure string/UTC arithmetic on date keys,
 * so it is deterministic and produces identical results to the frontend mirror
 * at `frontend/src/utils/goalPeriod.ts`. Keep the two in sync; both sides ship
 * the same truth-table test.
 */

export const GOAL_FREQUENCIES = ["daily", "weekly", "as_needed"] as const;

export type GoalFrequency = (typeof GOAL_FREQUENCIES)[number];

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Splits a "YYYY-MM-DD" key into numeric parts, defaulting each to 0. */
const parseDateKeyParts = (value: string): [number, number, number] => {
  const parts = value.split("-");

  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
};

export const isGoalFrequency = (value: unknown): value is GoalFrequency =>
  typeof value === "string" &&
  (GOAL_FREQUENCIES as readonly string[]).includes(value);

export const isValidLocalDateKey = (value: unknown): value is string => {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = parseDateKeyParts(value);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  // Rejects impossible calendar dates like 2026-02-30, which the regex allows.
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

/**
 * Start of the week containing `dateKey`, as a date key.
 *
 * Sunday-start, matching the streak card's week (`StreakWeekCard` builds its
 * week with `today.getDate() - today.getDay()`), so goals and streaks agree on
 * where a week begins. Deliberately not ISO/Monday weeks.
 */
export const getWeekStartKey = (dateKey: string): string | null => {
  if (!isValidLocalDateKey(dateKey)) {
    return null;
  }

  const [year, month, day] = parseDateKeyParts(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day));

  date.setUTCDate(date.getUTCDate() - date.getUTCDay());

  return date.toISOString().slice(0, 10);
};

/**
 * Whether a goal counts as done for the period that `todayKey` falls in.
 *
 * - `as_needed` completes permanently, so only the presence of a completion
 *   matters — the stored value is never compared. That is what makes migrating
 *   legacy `status: "completed"` goals lossless even when the date is guessed.
 * - `daily` resets every local day.
 * - `weekly` resets at the start of each Sunday-start week.
 */
export const isGoalDoneForPeriod = (
  goal: {
    frequency?: GoalFrequency | null;
    lastCompletedLocalDate?: string | null;
  },
  todayKey: string
): boolean => {
  const lastCompleted = goal.lastCompletedLocalDate;

  if (!lastCompleted) {
    return false;
  }

  const frequency = isGoalFrequency(goal.frequency)
    ? goal.frequency
    : "as_needed";

  if (frequency === "as_needed") {
    return true;
  }

  if (!isValidLocalDateKey(lastCompleted) || !isValidLocalDateKey(todayKey)) {
    return false;
  }

  if (frequency === "daily") {
    return lastCompleted === todayKey;
  }

  const completedWeek = getWeekStartKey(lastCompleted);
  const currentWeek = getWeekStartKey(todayKey);

  return completedWeek !== null && completedWeek === currentWeek;
};

/**
 * Fallback date key for requests that omit the client's local date. Best-effort
 * only — responses also carry the raw fields so the client can recompute.
 */
export const getServerFallbackDateKey = (now: Date = new Date()): string =>
  now.toISOString().slice(0, 10);
