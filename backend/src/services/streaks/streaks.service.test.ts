import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { journalModel } from "../../schema/journal.schema";
import {
  getCurrentStreakSummary,
  getCurrentStreakValue,
  getStreakHistory,
} from "./streaks.service";

type AggregateRow = {
  _id: string;
  count: number;
};

type AggregateMock = (pipeline?: unknown[]) => Promise<AggregateRow[]>;

const aggregateTarget = journalModel as unknown as {
  aggregate: AggregateMock;
};

const originalAggregate = aggregateTarget.aggregate;

const addUtcDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const getDateKey = (date: Date) => date.toISOString().slice(0, 10);

afterEach(() => {
  aggregateTarget.aggregate = originalAggregate;
});

test("getCurrentStreakSummary derives streak metrics and achievements from journal dates", async () => {
  const today = new Date();
  const currentMonthAnchor = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const isolatedOlderDate = addUtcDays(today, -40);

  const monthCounts = new Map<string, number>([
    [getDateKey(today), 1],
    [getDateKey(addUtcDays(today, -1)), 1],
    [getDateKey(addUtcDays(today, -2)), 1],
    [getDateKey(currentMonthAnchor), 2],
  ]);

  const rows: AggregateRow[] = [
    ...Array.from(monthCounts.entries()).map(([dateKey, count]) => ({
      _id: dateKey,
      count,
    })),
    {
      _id: getDateKey(isolatedOlderDate),
      count: 50,
    },
  ].sort((left, right) => left._id.localeCompare(right._id));
  const expectedThisMonthEntries = rows.reduce((sum, row) => {
    const date = new Date(`${row._id}T00:00:00.000Z`);

    if (
      date.getUTCFullYear() !== today.getUTCFullYear() ||
      date.getUTCMonth() !== today.getUTCMonth()
    ) {
      return sum;
    }

    return sum + row.count;
  }, 0);
  const expectedTotalEntries = rows.reduce((sum, row) => sum + row.count, 0);

  aggregateTarget.aggregate = async () => rows;

  const summary = await getCurrentStreakSummary("660aa8bcfe6b5b4d5f2af001");

  assert.equal(summary.currentStreak, 3);
  assert.equal(summary.bestStreak, 3);
  assert.equal(summary.thisMonthEntries, expectedThisMonthEntries);
  assert.equal(summary.totalEntries, expectedTotalEntries);
  assert.deepEqual(
    summary.achievements.map(achievement => [achievement.key, achievement.unlocked]),
    [
      ["first-entry", true],
      ["7-day-streak", false],
      ["30-day-streak", false],
      ["50-entries", true],
      ["100-entries", false],
    ],
  );
});

test("getStreakHistory returns a full window with today last and entry flags populated", async () => {
  const today = new Date();
  const fiveDaysAgo = addUtcDays(today, -4);
  const twoDaysAgo = addUtcDays(today, -1);

  aggregateTarget.aggregate = async () => [
    {
      _id: getDateKey(fiveDaysAgo),
      count: 2,
    },
    {
      _id: getDateKey(twoDaysAgo),
      count: 1,
    },
  ];

  const history = await getStreakHistory("660aa8bcfe6b5b4d5f2af001", 5);

  assert.equal(history.days.length, 5);
  assert.equal(history.days[history.days.length - 1]?.isToday, true);
  assert.equal(history.days[0]?.dateKey, getDateKey(fiveDaysAgo));
  assert.equal(history.days[0]?.hasEntry, true);
  assert.equal(history.days[0]?.count, 2);
  assert.equal(history.days[1]?.hasEntry, false);
  assert.equal(history.days[3]?.dateKey, getDateKey(twoDaysAgo));
  assert.equal(history.days[3]?.hasEntry, true);
  assert.equal(history.days[3]?.count, 1);
});

test("getCurrentStreakValue returns only the lightweight current streak number", async () => {
  const today = new Date();

  aggregateTarget.aggregate = async () => [
    {
      _id: getDateKey(addUtcDays(today, -2)),
      count: 1,
    },
    {
      _id: getDateKey(addUtcDays(today, -1)),
      count: 1,
    },
  ];

  const currentStreak = await getCurrentStreakValue("660aa8bcfe6b5b4d5f2af001");

  assert.equal(currentStreak, 2);
});
