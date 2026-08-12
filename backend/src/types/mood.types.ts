export type MoodValue = "amazing" | "good" | "okay" | "bad" | "terrible";

export type MoodCheckInResponse = {
  _id: string;
  mood: MoodValue;
  moodDateKey: string;
  createdAt: string;
  updatedAt: string;
};

export type MoodCheckInInput = {
  userId: string;
  mood: MoodValue;
  timeZone?: string;
  now?: Date;
};

export type MoodStatusResponse = {
  moodCheckIn: MoodCheckInResponse | null;
  currentStreak: number;
};

export type MoodHistoryDay = {
  moodDateKey: string;
  mood: MoodValue | null;
  isToday: boolean;
};

export type MoodHistoryResponse = {
  days: MoodHistoryDay[];
};
