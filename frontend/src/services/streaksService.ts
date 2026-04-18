import { request } from "../utils/apiClient";

type StreakAchievementKey =
  | "first-entry"
  | "7-day-streak"
  | "30-day-streak"
  | "50-entries"
  | "100-entries";

type StreakAchievement = {
  key: StreakAchievementKey;
  title: string;
  description: string;
  unlocked: boolean;
};

type StreakCurrentSummary = {
  currentStreak: number;
  bestStreak: number;
  thisMonthEntries: number;
  totalEntries: number;
  achievements: StreakAchievement[];
};

type StreakHistoryDay = {
  dateKey: string;
  count: number;
  hasEntry: boolean;
  isToday: boolean;
};

type StreakHistory = {
  days: StreakHistoryDay[];
};

const getCurrentStreakSummary = async () => {
  const response = await request<StreakCurrentSummary>("/streaks/current", {
    method: "GET",
  });

  return response.data;
};

const getStreakHistory = async (days = 30) => {
  const response = await request<StreakHistory>(
    `/streaks/history?days=${encodeURIComponent(String(days))}`,
    {
      method: "GET",
    },
  );

  return response.data;
};

export { getCurrentStreakSummary, getStreakHistory };
export type {
  StreakAchievement,
  StreakAchievementKey,
  StreakCurrentSummary,
  StreakHistory,
  StreakHistoryDay,
};
