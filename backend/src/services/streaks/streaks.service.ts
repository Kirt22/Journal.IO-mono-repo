import mongoose from "mongoose";
import { journalModel } from "../../schema/journal.schema";
import type {
  StreakAchievement,
  StreakCurrentResponse,
  StreakHistoryDay,
  StreakHistoryResponse,
} from "../../types/streaks.types";

type DailyJournalCount = {
  dateKey: string;
  count: number;
};

const addUtcDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
};

const getDateKey = (date: Date) => {
  return date.toISOString().slice(0, 10);
};

const buildDailyJournalCounts = async (userId: string): Promise<DailyJournalCount[]> => {
  const rows = await journalModel.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $project: {
        dateKey: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: "UTC",
          },
        },
      },
    },
    {
      $group: {
        _id: "$dateKey",
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        _id: 1,
      },
    },
  ]);

  return rows.map(entry => ({
    dateKey: entry._id,
    count: Number(entry.count || 0),
  }));
};

const toCountMap = (rows: DailyJournalCount[]) => {
  return new Map(rows.map(entry => [entry.dateKey, entry.count]));
};

const computeCurrentStreak = (dailyJournalCounts: Map<string, number>, today = new Date()) => {
  const todayKey = getDateKey(today);
  const yesterdayKey = getDateKey(addUtcDays(today, -1));
  const hasToday = Number(dailyJournalCounts.get(todayKey) || 0) > 0;
  const hasYesterday = Number(dailyJournalCounts.get(yesterdayKey) || 0) > 0;

  if (!hasToday && !hasYesterday) {
    return 0;
  }

  let cursor = hasToday ? today : addUtcDays(today, -1);
  let streak = 0;

  while (Number(dailyJournalCounts.get(getDateKey(cursor)) || 0) > 0) {
    streak += 1;
    cursor = addUtcDays(cursor, -1);
  }

  return streak;
};

const computeBestStreak = (rows: DailyJournalCount[]) => {
  if (rows.length === 0) {
    return 0;
  }

  let bestStreak = 0;
  let runningStreak = 0;
  let previousDateKey: string | null = null;

  for (const row of rows) {
    if (row.count <= 0) {
      continue;
    }

    if (!previousDateKey) {
      runningStreak = 1;
      previousDateKey = row.dateKey;
      bestStreak = 1;
      continue;
    }

    const previousDate = new Date(`${previousDateKey}T00:00:00.000Z`);
    const currentDate = new Date(`${row.dateKey}T00:00:00.000Z`);
    const diffDays = Math.round(
      (currentDate.getTime() - previousDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    runningStreak = diffDays === 1 ? runningStreak + 1 : 1;
    previousDateKey = row.dateKey;
    bestStreak = Math.max(bestStreak, runningStreak);
  }

  return bestStreak;
};

const computeThisMonthEntries = (rows: DailyJournalCount[], today = new Date()) => {
  const currentMonth = today.getUTCMonth();
  const currentYear = today.getUTCFullYear();

  return rows.reduce((sum, row) => {
    const date = new Date(`${row.dateKey}T00:00:00.000Z`);

    if (date.getUTCFullYear() !== currentYear || date.getUTCMonth() !== currentMonth) {
      return sum;
    }

    return sum + row.count;
  }, 0);
};

const buildAchievements = ({
  bestStreak,
  totalEntries,
}: {
  bestStreak: number;
  totalEntries: number;
}): StreakAchievement[] => [
  {
    key: "first-entry",
    title: "First Entry",
    description: "Started your journey",
    unlocked: totalEntries > 0,
  },
  {
    key: "7-day-streak",
    title: "7-Day Streak",
    description: "Wrote for a week",
    unlocked: bestStreak >= 7,
  },
  {
    key: "30-day-streak",
    title: "30-Day Streak",
    description: "A month of consistency",
    unlocked: bestStreak >= 30,
  },
  {
    key: "50-entries",
    title: "50 Entries",
    description: "Prolific writer",
    unlocked: totalEntries >= 50,
  },
  {
    key: "100-entries",
    title: "100 Entries",
    description: "Century club",
    unlocked: totalEntries >= 100,
  },
];

const getCurrentStreakSummary = async (userId: string): Promise<StreakCurrentResponse> => {
  const rows = await buildDailyJournalCounts(userId);
  const countMap = toCountMap(rows);
  const totalEntries = rows.reduce((sum, row) => sum + row.count, 0);
  const bestStreak = computeBestStreak(rows);

  return {
    currentStreak: computeCurrentStreak(countMap),
    bestStreak,
    thisMonthEntries: computeThisMonthEntries(rows),
    totalEntries,
    achievements: buildAchievements({
      bestStreak,
      totalEntries,
    }),
  };
};

const getCurrentStreakValue = async (userId: string): Promise<number> => {
  const rows = await buildDailyJournalCounts(userId);
  return computeCurrentStreak(toCountMap(rows));
};

const getStreakHistory = async (
  userId: string,
  days: number,
): Promise<StreakHistoryResponse> => {
  const rows = await journalModel.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: {
          $gte: new Date(`${getDateKey(addUtcDays(new Date(), -(days - 1)))}T00:00:00.000Z`),
        },
      },
    },
    {
      $project: {
        dateKey: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: "UTC",
          },
        },
      },
    },
    {
      $group: {
        _id: "$dateKey",
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        _id: 1,
      },
    },
  ]);

  const countMap = new Map(rows.map(entry => [entry._id, Number(entry.count || 0)]));
  const today = new Date();

  const historyDays: StreakHistoryDay[] = Array.from({ length: days }, (_, index) => {
    const date = addUtcDays(today, index - (days - 1));
    const dateKey = getDateKey(date);
    const count = Number(countMap.get(dateKey) || 0);

    return {
      dateKey,
      count,
      hasEntry: count > 0,
      isToday: index === days - 1,
    };
  });

  return { days: historyDays };
};

export { getCurrentStreakSummary, getCurrentStreakValue, getStreakHistory };
