import { moodCheckInModel, type IMoodCheckIn } from "../../schema/mood.schema";
import { syncMoodLoggedInsights } from "../insights/insights.service";
import { getCurrentStreakValue } from "../streaks/streaks.service";
import type {
  MoodCheckInInput,
  MoodCheckInResponse,
  MoodStatusResponse,
} from "../../types/mood.types";

const getMoodDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

const serializeMoodCheckIn = (
  moodCheckIn: IMoodCheckIn
): MoodCheckInResponse => {
  const moodObject = moodCheckIn.toObject();

  return {
    _id: moodObject._id.toString(),
    mood: moodObject.mood,
    moodDateKey: moodObject.moodDateKey,
    createdAt: new Date(moodObject.createdAt).toISOString(),
    updatedAt: new Date(moodObject.updatedAt).toISOString(),
  };
};

const getTodayMoodCheckIn = async (
  userId: string
): Promise<MoodStatusResponse> => {
  const moodDateKey = getMoodDateKey();
  const [moodCheckIn, currentStreak] = await Promise.all([
    moodCheckInModel.findOne({ userId, moodDateKey }).exec(),
    getCurrentStreakValue(userId),
  ]);

  return {
    moodCheckIn: moodCheckIn ? serializeMoodCheckIn(moodCheckIn) : null,
    currentStreak,
  };
};

const logMoodCheckIn = async (
  input: MoodCheckInInput
): Promise<MoodCheckInResponse> => {
  const moodDateKey = getMoodDateKey();
  const existingMoodCheckIn = await moodCheckInModel
    .findOne({ userId: input.userId, moodDateKey })
    .exec();

  if (existingMoodCheckIn) {
    return serializeMoodCheckIn(existingMoodCheckIn);
  }

  try {
    const moodCheckIn = await moodCheckInModel.create({
      userId: input.userId,
      mood: input.mood,
      moodDateKey,
    });

    try {
      await syncMoodLoggedInsights({
        userId: input.userId,
        mood: moodCheckIn.mood,
      });
    } catch (insightsError) {
      console.error(
        "Failed to sync insights cache after mood check-in:",
        insightsError
      );
    }

    return serializeMoodCheckIn(moodCheckIn);
  } catch (error) {
    const isDuplicateKeyError =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000;

    if (isDuplicateKeyError) {
      const latestMoodCheckIn = await moodCheckInModel
        .findOne({ userId: input.userId, moodDateKey })
        .exec();

      if (latestMoodCheckIn) {
        return serializeMoodCheckIn(latestMoodCheckIn);
      }
    }

    throw error;
  }
};

export { getMoodDateKey, getTodayMoodCheckIn, logMoodCheckIn, serializeMoodCheckIn };
