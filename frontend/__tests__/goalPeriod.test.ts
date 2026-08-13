/**
 * Mirror of `backend/src/helpers/goalPeriod.helpers.test.ts`.
 *
 * The two period modules are duplicated by necessity (the scheduler needs to
 * evaluate future dates, which the server's derived boolean cannot express), so
 * they share this truth table. If either side drifts, one of these fails.
 */
import {
  getLocalDateKey,
  getWeekStartKey,
  isGoalDoneForPeriod,
  isGoalFrequency,
  isValidLocalDateKey,
} from '../src/utils/goalPeriod';

test('isValidLocalDateKey accepts real date keys and rejects the rest', () => {
  expect(isValidLocalDateKey('2026-08-05')).toBe(true);
  expect(isValidLocalDateKey('2024-02-29')).toBe(true);

  expect(isValidLocalDateKey('2026-02-30')).toBe(false);
  expect(isValidLocalDateKey('2026-13-01')).toBe(false);
  expect(isValidLocalDateKey('2026-8-5')).toBe(false);
  expect(isValidLocalDateKey('not-a-date')).toBe(false);
  expect(isValidLocalDateKey('')).toBe(false);
  expect(isValidLocalDateKey(null)).toBe(false);
  expect(isValidLocalDateKey(20260805)).toBe(false);
});

test('isGoalFrequency guards the frequency union', () => {
  expect(isGoalFrequency('daily')).toBe(true);
  expect(isGoalFrequency('weekly')).toBe(true);
  expect(isGoalFrequency('as_needed')).toBe(true);
  expect(isGoalFrequency('monthly')).toBe(false);
  expect(isGoalFrequency(undefined)).toBe(false);
});

test('getWeekStartKey snaps to the containing Sunday', () => {
  expect(getWeekStartKey('2026-08-05')).toBe('2026-08-02');
  expect(getWeekStartKey('2026-08-02')).toBe('2026-08-02');
  expect(getWeekStartKey('2026-08-08')).toBe('2026-08-02');
  expect(getWeekStartKey('2026-08-09')).toBe('2026-08-09');
  expect(getWeekStartKey('2026-08-01')).toBe('2026-07-26');
  expect(getWeekStartKey('bad')).toBeNull();
});

test('getLocalDateKey formats the device date, not a UTC date', () => {
  // 23:30 local on the 5th must stay the 5th even where UTC has rolled over.
  const local = new Date(2026, 7, 5, 23, 30, 0);

  expect(getLocalDateKey(local)).toBe('2026-08-05');
  expect(getLocalDateKey(new Date(2026, 0, 1, 0, 5, 0))).toBe('2026-01-01');
});

test('as_needed goals stay done once completed, whatever the date', () => {
  expect(
    isGoalDoneForPeriod(
      { frequency: 'as_needed', lastCompletedLocalDate: '2019-01-01' },
      '2026-08-05',
    ),
  ).toBe(true);
  expect(
    isGoalDoneForPeriod(
      { frequency: 'as_needed', lastCompletedLocalDate: 'garbage' },
      '2026-08-05',
    ),
  ).toBe(true);
});

test('daily goals reset the next local day', () => {
  const goal = { frequency: 'daily' as const, lastCompletedLocalDate: '2026-08-05' };

  expect(isGoalDoneForPeriod(goal, '2026-08-05')).toBe(true);
  expect(isGoalDoneForPeriod(goal, '2026-08-06')).toBe(false);
  expect(isGoalDoneForPeriod(goal, '2026-08-04')).toBe(false);
});

test('weekly goals reset at the Sunday boundary', () => {
  const goal = { frequency: 'weekly' as const, lastCompletedLocalDate: '2026-08-05' };

  expect(isGoalDoneForPeriod(goal, '2026-08-05')).toBe(true);
  expect(isGoalDoneForPeriod(goal, '2026-08-08')).toBe(true);
  expect(isGoalDoneForPeriod(goal, '2026-08-09')).toBe(false);
  expect(isGoalDoneForPeriod(goal, '2026-08-01')).toBe(false);
});

test('a goal with no completion is never done', () => {
  for (const frequency of ['daily', 'weekly', 'as_needed'] as const) {
    expect(
      isGoalDoneForPeriod({ frequency, lastCompletedLocalDate: null }, '2026-08-05'),
    ).toBe(false);
    expect(isGoalDoneForPeriod({ frequency }, '2026-08-05')).toBe(false);
  }
});

test('an unparseable stored date is treated as not done for recurring goals', () => {
  expect(
    isGoalDoneForPeriod(
      { frequency: 'daily', lastCompletedLocalDate: '2026-02-30' },
      '2026-08-05',
    ),
  ).toBe(false);
  expect(
    isGoalDoneForPeriod(
      { frequency: 'weekly', lastCompletedLocalDate: 'nope' },
      '2026-08-05',
    ),
  ).toBe(false);
});

test('an unknown frequency falls back to as_needed semantics', () => {
  expect(
    isGoalDoneForPeriod(
      { frequency: 'monthly' as never, lastCompletedLocalDate: '2019-01-01' },
      '2026-08-05',
    ),
  ).toBe(true);
});
