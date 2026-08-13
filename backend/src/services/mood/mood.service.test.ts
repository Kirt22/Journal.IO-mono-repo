import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { moodCheckInModel } from "../../schema/mood.schema";
import type { MoodValue } from "../../types/mood.types";
import * as insightsService from "../insights/insights.service";
import * as streaksService from "../streaks/streaks.service";
import {
  MOOD_DATE_KEY_VERSION,
  getMoodDayContext,
  getTodayMoodCheckIn,
  logMoodCheckIn,
  logMoodCheckInWithStatus,
  normalizeMoodTimeZone,
} from "./mood.service";

type MoodQuery = Record<string, unknown>;
type MoodDocument = {
  mood: MoodValue;
  toObject: () => {
    _id: { toString: () => string };
    mood: MoodValue;
    moodDateKey: string;
    createdAt: Date;
    updatedAt: Date;
  };
};

type MoodQueryResult = {
  exec: () => Promise<MoodDocument | null>;
  sort: () => { exec: () => Promise<MoodDocument | null> };
};

const moodTarget = moodCheckInModel as unknown as {
  findOne: (query: MoodQuery) => MoodQueryResult;
  create: (...args: unknown[]) => Promise<MoodDocument>;
};

const originalFindOne = moodTarget.findOne;
const originalCreate = moodTarget.create;
const insightsServiceTarget = insightsService as unknown as {
  syncMoodLoggedInsights: (input: {
    userId: string;
    mood: MoodValue;
  }) => Promise<void>;
};
const streaksServiceTarget = streaksService as unknown as {
  getCurrentStreakValue: (userId: string) => Promise<number>;
};
const originalSyncMoodLoggedInsights = insightsServiceTarget.syncMoodLoggedInsights;
const originalGetCurrentStreakValue = streaksServiceTarget.getCurrentStreakValue;

const buildMoodDocument = ({
  id = "mood-123",
  mood = "good",
  moodDateKey = "2026-07-23",
  createdAt = new Date("2026-07-22T18:40:00.000Z"),
}: {
  id?: string;
  mood?: MoodValue;
  moodDateKey?: string;
  createdAt?: Date;
} = {}): MoodDocument => ({
  mood,
  toObject: () => ({
    _id: { toString: () => id },
    mood,
    moodDateKey,
    createdAt,
    updatedAt: createdAt,
  }),
});

const buildQueryResult = (
  resolve: () => MoodDocument | null | Promise<MoodDocument | null>
): MoodQueryResult => ({
  exec: async () => resolve(),
  sort: () => ({ exec: async () => resolve() }),
});

afterEach(() => {
  moodTarget.findOne = originalFindOne;
  moodTarget.create = originalCreate;
  insightsServiceTarget.syncMoodLoggedInsights = originalSyncMoodLoggedInsights;
  streaksServiceTarget.getCurrentStreakValue = originalGetCurrentStreakValue;
});

test("getMoodDayContext uses the user's local date and UTC day bounds", () => {
  const context = getMoodDayContext({
    now: new Date("2026-07-22T18:45:00.000Z"),
    timeZone: "Asia/Kolkata",
  });

  assert.equal(context.moodDateKey, "2026-07-23");
  assert.equal(context.dayStartUtc.toISOString(), "2026-07-22T18:30:00.000Z");
  assert.equal(context.dayEndUtc.toISOString(), "2026-07-23T18:30:00.000Z");
});

test("getMoodDayContext respects daylight-saving day length", () => {
  const context = getMoodDayContext({
    now: new Date("2026-03-08T12:00:00.000Z"),
    timeZone: "America/New_York",
  });

  assert.equal(context.moodDateKey, "2026-03-08");
  assert.equal(context.dayStartUtc.toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(context.dayEndUtc.toISOString(), "2026-03-09T04:00:00.000Z");
});

test("invalid or missing timezones fall back to UTC", () => {
  assert.equal(normalizeMoodTimeZone("Mars/Olympus"), "UTC");
  assert.equal(normalizeMoodTimeZone(undefined), "UTC");

  const context = getMoodDayContext({
    now: new Date("2026-07-22T23:30:00.000Z"),
    timeZone: "Mars/Olympus",
  });
  assert.equal(context.moodDateKey, "2026-07-22");
});

test("logMoodCheckIn returns the existing local-day record idempotently", async () => {
  const existingMood = buildMoodDocument({ mood: "okay" });
  let createCount = 0;
  moodTarget.findOne = query =>
    buildQueryResult(() =>
      query.moodDateKey === "2026-07-23" ? existingMood : null
    );
  moodTarget.create = async () => {
    createCount += 1;
    return buildMoodDocument();
  };

  const result = await logMoodCheckIn({
    userId: "user-123",
    mood: "amazing",
    timeZone: "Asia/Kolkata",
    now: new Date("2026-07-22T18:45:00.000Z"),
  });

  assert.equal(result.mood, "okay");
  assert.equal(createCount, 0);
});

test("getTodayMoodCheckIn reads the timezone-specific day and keeps streak data", async () => {
  const existingMood = buildMoodDocument();
  const queries: MoodQuery[] = [];
  moodTarget.findOne = query => {
    queries.push(query);
    return buildQueryResult(() => existingMood);
  };
  streaksServiceTarget.getCurrentStreakValue = async () => 4;

  const result = await getTodayMoodCheckIn("user-123", {
    timeZone: "Asia/Kolkata",
    now: new Date("2026-07-22T18:45:00.000Z"),
  });

  assert.equal(result.currentStreak, 4);
  assert.equal(result.moodCheckIn?.moodDateKey, "2026-07-23");
  assert.deepEqual(queries[0], {
    userId: "user-123",
    moodDateKey: "2026-07-23",
  });
});

test("logMoodCheckIn persists the timezone-specific date key", async () => {
  const createPayloads: unknown[][] = [];
  const insightInputs: unknown[] = [];
  moodTarget.findOne = () => buildQueryResult(() => null);
  moodTarget.create = async (...args) => {
    createPayloads.push(args);
    return buildMoodDocument();
  };
  insightsServiceTarget.syncMoodLoggedInsights = async input => {
    insightInputs.push(input);
  };

  const result = await logMoodCheckInWithStatus({
    userId: "user-123",
    mood: "good",
    timeZone: "Asia/Kolkata",
    now: new Date("2026-07-22T18:45:00.000Z"),
  });

  assert.equal(result.moodCheckIn.moodDateKey, "2026-07-23");
  assert.equal(result.alreadyCheckedIn, false);
  assert.deepEqual(createPayloads, [
    [
      {
        userId: "user-123",
        mood: "good",
        moodDateKey: "2026-07-23",
        moodDateKeyVersion: MOOD_DATE_KEY_VERSION,
      },
    ],
  ]);
  assert.deepEqual(insightInputs, [{ userId: "user-123", mood: "good" }]);
});

test("logMoodCheckIn recognizes a legacy UTC-keyed record in the local day", async () => {
  const legacyMood = buildMoodDocument({
    moodDateKey: "2026-07-22",
    createdAt: new Date("2026-07-22T18:40:00.000Z"),
  });
  const queries: MoodQuery[] = [];
  moodTarget.findOne = query => {
    queries.push(query);
    return buildQueryResult(() =>
      Object.prototype.hasOwnProperty.call(query, "createdAt") ? legacyMood : null
    );
  };
  moodTarget.create = async () => {
    throw new Error("A legacy record should prevent a duplicate create.");
  };

  const result = await logMoodCheckIn({
    userId: "user-123",
    mood: "amazing",
    timeZone: "Asia/Kolkata",
    now: new Date("2026-07-22T18:45:00.000Z"),
  });

  assert.equal(result.moodDateKey, "2026-07-23");
  const legacyQuery = queries[1] as {
    $or: Array<Record<string, unknown>>;
    createdAt: { $gte: Date; $lt: Date };
  };
  assert.deepEqual(legacyQuery.$or, [
    { moodDateKeyVersion: { $exists: false } },
    { moodDateKeyVersion: null },
  ]);
  assert.equal(legacyQuery.createdAt.$gte.toISOString(), "2026-07-22T18:30:00.000Z");
  assert.equal(legacyQuery.createdAt.$lt.toISOString(), "2026-07-23T18:30:00.000Z");
});

test("getTodayMoodCheckIn exposes the effective local key for a legacy record", async () => {
  const legacyMood = buildMoodDocument({
    moodDateKey: "2026-07-22",
    createdAt: new Date("2026-07-22T18:40:00.000Z"),
  });
  moodTarget.findOne = query =>
    buildQueryResult(() =>
      Object.prototype.hasOwnProperty.call(query, "createdAt")
        ? legacyMood
        : null
    );
  streaksServiceTarget.getCurrentStreakValue = async () => 0;

  const result = await getTodayMoodCheckIn("user-123", {
    timeZone: "Asia/Kolkata",
    now: new Date("2026-07-22T18:45:00.000Z"),
  });

  assert.equal(result.moodCheckIn?.moodDateKey, "2026-07-23");
});

test("timezone-aware rows are not treated as legacy after timezone travel", async () => {
  const timezoneAwareOtherKey = buildMoodDocument({
    moodDateKey: "2026-07-22",
    createdAt: new Date("2026-07-22T19:00:00.000Z"),
  });
  let createCount = 0;
  moodTarget.findOne = query => {
    const isLegacyLookup = Object.prototype.hasOwnProperty.call(
      query,
      "createdAt"
    );
    const excludesVersionedRows = Array.isArray(query.$or);

    return buildQueryResult(() =>
      isLegacyLookup && !excludesVersionedRows
        ? timezoneAwareOtherKey
        : null
    );
  };
  moodTarget.create = async () => {
    createCount += 1;
    return buildMoodDocument({ moodDateKey: "2026-07-23" });
  };
  insightsServiceTarget.syncMoodLoggedInsights = async () => undefined;

  const result = await logMoodCheckInWithStatus({
    userId: "user-123",
    mood: "good",
    timeZone: "Asia/Kolkata",
    now: new Date("2026-07-22T19:15:00.000Z"),
  });

  assert.equal(createCount, 1);
  assert.equal(result.alreadyCheckedIn, false);
  assert.equal(result.moodCheckIn.moodDateKey, "2026-07-23");
});

test("logMoodCheckIn recovers from concurrent duplicate creation", async () => {
  const savedMood = buildMoodDocument();
  let exactLookupCount = 0;
  moodTarget.findOne = query => {
    const isLegacyLookup = Object.prototype.hasOwnProperty.call(query, "createdAt");
    return buildQueryResult(() => {
      if (isLegacyLookup) {
        return null;
      }

      exactLookupCount += 1;
      return exactLookupCount > 1 ? savedMood : null;
    });
  };
  moodTarget.create = async () => {
    throw { code: 11000 };
  };

  const result = await logMoodCheckIn({
    userId: "user-123",
    mood: "good",
    now: new Date("2026-07-23T12:00:00.000Z"),
  });

  assert.equal(result._id, "mood-123");
  assert.equal(exactLookupCount, 2);
});
