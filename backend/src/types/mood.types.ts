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
};

export type MoodStatusResponse = {
  moodCheckIn: MoodCheckInResponse | null;
  currentStreak: number;
};
