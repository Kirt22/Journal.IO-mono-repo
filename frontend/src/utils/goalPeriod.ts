/**
 * Mirror of `backend/src/helpers/goalPeriod.helpers.ts`.
 *
 * The server returns `isCompletedForPeriod` for the current view, but the goal
 * reminder scheduler has to ask "would this goal be done on date D" for *future*
 * dates, which a single boolean cannot answer. So the same period math lives on
 * both sides and both ship the same truth-table test — if they drift, CI fails
 * on both sides.
 */

export const GOAL_FREQUENCIES = ['daily', 'weekly', 'as_needed'] as const;

export type GoalFrequency = (typeof GOAL_FREQUENCIES)[number];

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDateKeyParts = (value: string): [number, number, number] => {
  const parts = value.split('-');

  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
};

export const isGoalFrequency = (value: unknown): value is GoalFrequency =>
  typeof value === 'string' &&
  (GOAL_FREQUENCIES as readonly string[]).includes(value);

export const isValidLocalDateKey = (value: unknown): value is string => {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = parseDateKeyParts(value);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

/** The device's current local date as a "YYYY-MM-DD" key. */
export const getLocalDateKey = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/** Sunday-start week, matching the Streaks screen's week. */
export const getWeekStartKey = (dateKey: string): string | null => {
  if (!isValidLocalDateKey(dateKey)) {
    return null;
  }

  const [year, month, day] = parseDateKeyParts(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day));

  date.setUTCDate(date.getUTCDate() - date.getUTCDay());

  return date.toISOString().slice(0, 10);
};

export const isGoalDoneForPeriod = (
  goal: {
    frequency?: GoalFrequency | null;
    lastCompletedLocalDate?: string | null;
  },
  todayKey: string,
): boolean => {
  const lastCompleted = goal.lastCompletedLocalDate;

  if (!lastCompleted) {
    return false;
  }

  const frequency = isGoalFrequency(goal.frequency)
    ? goal.frequency
    : 'as_needed';

  if (frequency === 'as_needed') {
    return true;
  }

  if (!isValidLocalDateKey(lastCompleted) || !isValidLocalDateKey(todayKey)) {
    return false;
  }

  if (frequency === 'daily') {
    return lastCompleted === todayKey;
  }

  const completedWeek = getWeekStartKey(lastCompleted);
  const currentWeek = getWeekStartKey(todayKey);

  return completedWeek !== null && completedWeek === currentWeek;
};

export const GOAL_FREQUENCY_LABELS: Record<GoalFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  as_needed: 'As needed',
};
