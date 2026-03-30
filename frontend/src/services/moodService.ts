import { request } from "../utils/apiClient";

type MoodValue = "amazing" | "good" | "okay" | "bad" | "terrible";

type MoodCheckIn = {
  _id: string;
  mood: MoodValue;
  moodDateKey: string;
  createdAt: string;
  updatedAt: string;
};

type MoodStatusResponse = {
  moodCheckIn: MoodCheckIn | null;
};

type LogMoodResponse = {
  moodCheckIn: MoodCheckIn;
};

const getTodayMoodCheckIn = async (): Promise<MoodCheckIn | null> => {
  const response = await request<MoodStatusResponse>("/mood/today", {
    method: "GET",
  });

  return response.data.moodCheckIn;
};

const logMoodCheckIn = async (mood: MoodValue): Promise<MoodCheckIn> => {
  const response = await request<LogMoodResponse>("/mood/check_in", {
    method: "POST",
    body: JSON.stringify({ mood }),
  });

  return response.data.moodCheckIn;
};

export { getTodayMoodCheckIn, logMoodCheckIn };
export type { MoodCheckIn, MoodValue };
