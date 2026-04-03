export type StreakAchievementKey =
  | "first-entry"
  | "7-day-streak"
  | "30-day-streak"
  | "50-entries"
  | "100-entries";

export type StreakAchievement = {
  key: StreakAchievementKey;
  title: string;
  description: string;
  unlocked: boolean;
};

export type StreakCurrentResponse = {
  currentStreak: number;
  bestStreak: number;
  thisMonthEntries: number;
  totalEntries: number;
  achievements: StreakAchievement[];
};

export type StreakHistoryDay = {
  dateKey: string;
  count: number;
  hasEntry: boolean;
  isToday: boolean;
};

export type StreakHistoryResponse = {
  days: StreakHistoryDay[];
};
