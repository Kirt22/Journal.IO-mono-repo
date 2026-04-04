import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { journalModel } from "../../schema/journal.schema";
import { moodCheckInModel } from "../../schema/mood.schema";
import { insightsModel } from "../../schema/insights.schema";
import { streaksModel } from "../../schema/streak.schema";
import { statsModel } from "../../schema/stat.schema";
import { userModel } from "../../schema/user.schema";
import {
  deletePrivacyAccount,
  exportPrivacyData,
  updatePrivacyAiOptOut,
} from "./privacy.service";

type QueryResult<T> = {
  exec: () => Promise<T>;
};

const userTarget = userModel as unknown as {
  findById: (userId: string) => QueryResult<unknown> | Promise<unknown>;
  updateOne: (...args: unknown[]) => Promise<unknown>;
  deleteOne: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
};

const journalTarget = journalModel as unknown as {
  find: (...args: unknown[]) => {
    sort: () => QueryResult<unknown[]>;
  };
  deleteMany: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
};

const moodTarget = moodCheckInModel as unknown as {
  find: (...args: unknown[]) => {
    sort: () => QueryResult<unknown[]>;
  };
  deleteMany: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
};

const insightsTarget = insightsModel as unknown as {
  findOne: (...args: unknown[]) => QueryResult<unknown>;
  deleteMany: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
};

const streakTarget = streaksModel as unknown as {
  findOne: (...args: unknown[]) => QueryResult<unknown>;
  deleteMany: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
};

const statsTarget = statsModel as unknown as {
  findOne: (...args: unknown[]) => QueryResult<unknown>;
  deleteMany: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
};

const originalFindById = userTarget.findById;
const originalUpdateOne = userTarget.updateOne;
const originalDeleteOne = userTarget.deleteOne;
const originalJournalFind = journalTarget.find;
const originalJournalDeleteMany = journalTarget.deleteMany;
const originalMoodFind = moodTarget.find;
const originalMoodDeleteMany = moodTarget.deleteMany;
const originalInsightsFindOne = insightsTarget.findOne;
const originalInsightsDeleteMany = insightsTarget.deleteMany;
const originalStreakFindOne = streakTarget.findOne;
const originalStreakDeleteMany = streakTarget.deleteMany;
const originalStatsFindOne = statsTarget.findOne;
const originalStatsDeleteMany = statsTarget.deleteMany;

afterEach(() => {
  userTarget.findById = originalFindById;
  userTarget.updateOne = originalUpdateOne;
  userTarget.deleteOne = originalDeleteOne;
  journalTarget.find = originalJournalFind;
  journalTarget.deleteMany = originalJournalDeleteMany;
  moodTarget.find = originalMoodFind;
  moodTarget.deleteMany = originalMoodDeleteMany;
  insightsTarget.findOne = originalInsightsFindOne;
  insightsTarget.deleteMany = originalInsightsDeleteMany;
  streakTarget.findOne = originalStreakFindOne;
  streakTarget.deleteMany = originalStreakDeleteMany;
  statsTarget.findOne = originalStatsFindOne;
  statsTarget.deleteMany = originalStatsDeleteMany;
});

test("exportPrivacyData returns the authenticated user's data export", async () => {
  userTarget.findById = () => ({
    exec: async () => ({
      toObject: () => ({
        _id: "user-123",
        name: "Alex",
        phoneNumber: null,
        email: "alex@example.com",
        emailVerified: true,
        emailVerifiedAt: new Date("2026-04-01T10:00:00.000Z"),
        authProviders: ["email"],
        journalingGoals: ["Daily Reflection"],
        onboardingContext: {
          ageRange: "25-34",
          journalingExperience: "Occasional",
          goals: ["Daily Reflection"],
          supportFocus: ["Stress"],
          reminderPreference: "Evening",
          aiOptIn: true,
          privacyConsentAccepted: true,
        },
        avatarColor: "#8E4636",
        profileSetupCompleted: true,
        onboardingCompleted: true,
        profilePic: null,
        lastLoginAt: new Date("2026-04-02T12:00:00.000Z"),
        createdAt: new Date("2026-03-01T09:00:00.000Z"),
        updatedAt: new Date("2026-04-02T12:30:00.000Z"),
      }),
    }),
  });
  journalTarget.find = () => ({
    sort: () => ({
      exec: async () => [
        {
          toObject: () => ({
            _id: "journal-1",
            title: "Morning entry",
            content: "Today felt steady.",
            type: "journal",
            aiPrompt: null,
            tags: ["calm"],
            images: [],
            isFavorite: false,
            createdAt: new Date("2026-04-02T08:00:00.000Z"),
            updatedAt: new Date("2026-04-02T08:15:00.000Z"),
          }),
        },
      ],
    }),
  });
  moodTarget.find = () => ({
    sort: () => ({
      exec: async () => [
        {
          toObject: () => ({
            _id: "mood-1",
            mood: "good",
            moodDateKey: "2026-04-02",
            createdAt: new Date("2026-04-02T07:30:00.000Z"),
            updatedAt: new Date("2026-04-02T07:30:00.000Z"),
          }),
        },
      ],
    }),
  });
  insightsTarget.findOne = () => ({
    exec: async () => ({
      toObject: () => ({
        totalEntries: 3,
        totalWords: 120,
        totalFavorites: 1,
        dailyJournalCounts: new Map([["2026-04-02", 1]]),
        tagCounts: new Map([["calm", 2]]),
        moodCounts: new Map([["good", 1]]),
        lastJournalDateKey: "2026-04-02",
        lastCalculatedAt: new Date("2026-04-02T09:00:00.000Z"),
        aiAnalysis: null,
        aiAnalysisStale: false,
        aiAnalysisComputedAt: new Date("2026-04-02T09:00:00.000Z"),
        aiAnalysisWindowEndDateKey: "2026-04-02",
        createdAt: new Date("2026-04-01T09:00:00.000Z"),
        updatedAt: new Date("2026-04-02T09:00:00.000Z"),
      }),
    }),
  });
  streakTarget.findOne = () => ({
    exec: async () => ({
      toObject: () => ({
        streak: 4,
        streakStartDate: new Date("2026-03-30T00:00:00.000Z"),
        streakEndDate: null,
        createdAt: new Date("2026-03-30T00:00:00.000Z"),
        updatedAt: new Date("2026-04-02T09:00:00.000Z"),
      }),
    }),
  });
  statsTarget.findOne = () => ({
    exec: async () => ({
      toObject: () => ({
        journalsWritten: 3,
        totalWordsWritten: 120,
        createdAt: new Date("2026-03-30T00:00:00.000Z"),
        updatedAt: new Date("2026-04-02T09:00:00.000Z"),
      }),
    }),
  });

  const result = await exportPrivacyData("user-123");

  assert.ok(result);
  assert.equal(result?.account.userId, "user-123");
  assert.equal(result?.journalEntries.length, 1);
  assert.equal(result?.moodCheckIns.length, 1);
  assert.equal(result?.insights?.totalEntries, 3);
  assert.equal(result?.streak?.streak, 4);
  assert.equal(result?.stats?.journalsWritten, 3);
});

test("deletePrivacyAccount removes all user-owned records", async () => {
  userTarget.updateOne = async () => ({ acknowledged: true });
  userTarget.deleteOne = () => ({
    exec: async () => ({ deletedCount: 1 }),
  });
  journalTarget.deleteMany = () => ({
    exec: async () => ({ deletedCount: 2 }),
  });
  moodTarget.deleteMany = () => ({
    exec: async () => ({ deletedCount: 2 }),
  });
  insightsTarget.deleteMany = () => ({
    exec: async () => ({ deletedCount: 1 }),
  });
  streakTarget.deleteMany = () => ({
    exec: async () => ({ deletedCount: 1 }),
  });
  statsTarget.deleteMany = () => ({
    exec: async () => ({ deletedCount: 1 }),
  });

  const result = await deletePrivacyAccount("user-123");

  assert.equal(result.deletedAccount, true);
  assert.equal(result.deletedJournals, 2);
  assert.equal(result.deletedMoodCheckIns, 2);
  assert.equal(result.deletedInsights, 1);
  assert.equal(result.deletedStreaks, 1);
  assert.equal(result.deletedStats, 1);
});

test("updatePrivacyAiOptOut updates the stored AI preference", async () => {
  userTarget.updateOne = async () => ({ matchedCount: 1 });

  const result = await updatePrivacyAiOptOut("user-123", true);

  assert.ok(result);
  assert.equal(result?.aiOptIn, false);
});
