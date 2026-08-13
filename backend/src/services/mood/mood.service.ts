import { moodCheckInModel, type IMoodCheckIn } from "../../schema/mood.schema";
import { syncMoodLoggedInsights } from "../insights/insights.service";
import { getCurrentStreakValue } from "../streaks/streaks.service";
import type {
  MoodCheckInInput,
  MoodCheckInResponse,
  MoodHistoryResponse,
  MoodStatusResponse,
} from "../../types/mood.types";

const MOOD_HISTORY_DEFAULT_DAYS = 7;
const MOOD_HISTORY_MAX_DAYS = 31;

type MoodDayOptions = {
  timeZone?: string;
  now?: Date;
};

type MoodDayContext = {
  moodDateKey: string;
  dayStartUtc: Date;
  dayEndUtc: Date;
};

const MOOD_DATE_KEY_VERSION = 1;

const isValidTimeZone = (value?: string | null) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const normalizeMoodTimeZone = (value?: string | null) =>
  isValidTimeZone(value) ? value!.trim() : "UTC";

const getTimeZoneParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US-u-hc-h23", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const readPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === type)?.value || "0");

  return {
    year: readPart("year"),
    month: readPart("month"),
    day: readPart("day"),
    hour: readPart("hour"),
    minute: readPart("minute"),
    second: readPart("second"),
  };
};

const getMoodDateKey = (date = new Date(), timeZone = "UTC") => {
  const normalizedTimeZone = normalizeMoodTimeZone(timeZone);
  const parts = getTimeZoneParts(date, normalizedTimeZone);

  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

const addDateKeyDays = (dateKey: string, delta: number) => {
  const [year = 1970, month = 1, day = 1] = dateKey.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day));
  nextDate.setUTCDate(nextDate.getUTCDate() + delta);

  return nextDate.toISOString().slice(0, 10);
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = getTimeZoneParts(date, timeZone);
  const utcEquivalent = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return utcEquivalent - date.getTime();
};

const getUtcStartForDateKey = (dateKey: string, timeZone: string) => {
  const [year = 1970, month = 1, day = 1] = dateKey.split("-").map(Number);
  const localMidnightUtc = Date.UTC(year, month - 1, day);
  let utcTime = localMidnightUtc;

  // Recalculate to account for offset transitions close to local midnight.
  for (let index = 0; index < 3; index += 1) {
    const nextUtcTime =
      localMidnightUtc - getTimeZoneOffsetMs(new Date(utcTime), timeZone);

    if (nextUtcTime === utcTime) {
      break;
    }

    utcTime = nextUtcTime;
  }

  return new Date(utcTime);
};

const getMoodDayContext = ({
  timeZone,
  now = new Date(),
}: MoodDayOptions = {}): MoodDayContext => {
  const normalizedTimeZone = normalizeMoodTimeZone(timeZone);
  const moodDateKey = getMoodDateKey(now, normalizedTimeZone);

  return {
    moodDateKey,
    dayStartUtc: getUtcStartForDateKey(moodDateKey, normalizedTimeZone),
    dayEndUtc: getUtcStartForDateKey(
      addDateKeyDays(moodDateKey, 1),
      normalizedTimeZone
    ),
  };
};

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

const serializeMoodCheckInForDay = (
  moodCheckIn: IMoodCheckIn,
  moodDateKey: string
): MoodCheckInResponse => ({
  ...serializeMoodCheckIn(moodCheckIn),
  moodDateKey,
});

const getTodayMoodCheckIn = async (
  userId: string,
  options: MoodDayOptions = {}
): Promise<MoodStatusResponse> => {
  const dayContext = getMoodDayContext(options);
  const [moodCheckIn, currentStreak] = await Promise.all([
    findMoodCheckInForDay(userId, dayContext),
    getCurrentStreakValue(userId),
  ]);

  return {
    moodCheckIn: moodCheckIn
      ? serializeMoodCheckInForDay(moodCheckIn, dayContext.moodDateKey)
      : null,
    currentStreak,
  };
};

const getMoodHistory = async (
  userId: string,
  options: MoodDayOptions & { days?: number } = {}
): Promise<MoodHistoryResponse> => {
  const requestedDays = options.days ?? MOOD_HISTORY_DEFAULT_DAYS;
  const dayCount = Math.min(
    MOOD_HISTORY_MAX_DAYS,
    Math.max(1, Math.floor(requestedDays))
  );
  const { moodDateKey: todayKey } = getMoodDayContext(options);

  // Oldest -> newest, ending on today.
  const dateKeys: string[] = [];
  for (let index = dayCount - 1; index >= 0; index -= 1) {
    dateKeys.push(addDateKeyDays(todayKey, -index));
  }

  const moodCheckIns = await moodCheckInModel
    .find({ userId, moodDateKey: { $in: dateKeys } })
    .select({ mood: 1, moodDateKey: 1 })
    .exec();

  const moodByDateKey = new Map<string, IMoodCheckIn["mood"]>();
  for (const moodCheckIn of moodCheckIns) {
    moodByDateKey.set(moodCheckIn.moodDateKey, moodCheckIn.mood);
  }

  return {
    days: dateKeys.map(dateKey => ({
      moodDateKey: dateKey,
      mood: moodByDateKey.get(dateKey) ?? null,
      isToday: dateKey === todayKey,
    })),
  };
};

const logMoodCheckInWithStatus = async (
  input: MoodCheckInInput
): Promise<{
  moodCheckIn: MoodCheckInResponse;
  alreadyCheckedIn: boolean;
}> => {
  const dayContext = getMoodDayContext({
    ...(input.timeZone ? { timeZone: input.timeZone } : {}),
    ...(input.now ? { now: input.now } : {}),
  });
  const { moodDateKey } = dayContext;
  const existingMoodCheckIn = await findMoodCheckInForDay(
    input.userId,
    dayContext
  );

  if (existingMoodCheckIn) {
    return {
      moodCheckIn: serializeMoodCheckInForDay(
        existingMoodCheckIn,
        moodDateKey
      ),
      alreadyCheckedIn: true,
    };
  }

  try {
    const moodCheckIn = await moodCheckInModel.create({
      userId: input.userId,
      mood: input.mood,
      moodDateKey,
      moodDateKeyVersion: MOOD_DATE_KEY_VERSION,
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

    return {
      moodCheckIn: serializeMoodCheckInForDay(moodCheckIn, moodDateKey),
      alreadyCheckedIn: false,
    };
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
        return {
          moodCheckIn: serializeMoodCheckInForDay(
            latestMoodCheckIn,
            moodDateKey
          ),
          alreadyCheckedIn: true,
        };
      }
    }

    throw error;
  }
};

const logMoodCheckIn = async (
  input: MoodCheckInInput
): Promise<MoodCheckInResponse> =>
  (await logMoodCheckInWithStatus(input)).moodCheckIn;

async function findMoodCheckInForDay(
  userId: string,
  { moodDateKey, dayStartUtc, dayEndUtc }: MoodDayContext
) {
  const currentMoodCheckIn = await moodCheckInModel
    .findOne({ userId, moodDateKey })
    .exec();

  if (currentMoodCheckIn) {
    return currentMoodCheckIn;
  }

  return moodCheckInModel
    .findOne({
      userId,
      moodDateKey: { $ne: moodDateKey },
      $or: [
        { moodDateKeyVersion: { $exists: false } },
        { moodDateKeyVersion: null },
      ],
      createdAt: { $gte: dayStartUtc, $lt: dayEndUtc },
    })
    .sort({ createdAt: 1 })
    .exec();
}

export {
  MOOD_DATE_KEY_VERSION,
  getMoodDateKey,
  getMoodDayContext,
  getMoodHistory,
  getTodayMoodCheckIn,
  logMoodCheckIn,
  logMoodCheckInWithStatus,
  normalizeMoodTimeZone,
  serializeMoodCheckIn,
};
