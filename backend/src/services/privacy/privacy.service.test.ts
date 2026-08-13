import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { journalModel } from "../../schema/journal.schema";
import { moodCheckInModel } from "../../schema/mood.schema";
import { insightsModel } from "../../schema/insights.schema";
import { mindMapEntryScoreModel } from "../../schema/mindMapEntryScore.schema";
import { entryInsightModel } from "../../schema/entryInsight.schema";
import { userMemoryModel } from "../../schema/userMemory.schema";
import { patternNodeModel } from "../../schema/patternNode.schema";
import { patternEdgeModel } from "../../schema/patternEdge.schema";
import { jadeSessionModel } from "../../schema/jadeSession.schema";
import { jadeMessageModel } from "../../schema/jadeMessage.schema";
import { reminderModel } from "../../schema/reminder.schema";
import { streaksModel } from "../../schema/streak.schema";
import { statsModel } from "../../schema/stat.schema";
import { userModel } from "../../schema/user.schema";
import { widgetSessionModel } from "../../schema/widget_session.schema";
import {
  deletePrivacyAccount,
  exportPrivacyData,
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

const reminderTarget = reminderModel as unknown as {
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

const widgetSessionTarget = widgetSessionModel as unknown as {
  deleteMany: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
};
const mindMapEntryScoreTarget = mindMapEntryScoreModel as unknown as {
  find: (...args: unknown[]) => {
    sort: (...args: unknown[]) => QueryResult<unknown[]>;
  };
  deleteMany: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
};
// Defaults so the unconnected per-entry Mind Map collection is never hit.
const defaultMindMapFind = () => ({
  sort: () => ({ exec: async () => [] as unknown[] }),
});
const defaultMindMapDeleteMany = () => ({
  exec: async () => ({ deletedCount: 0 }),
});
mindMapEntryScoreTarget.find = defaultMindMapFind;
mindMapEntryScoreTarget.deleteMany = defaultMindMapDeleteMany;

const entryInsightTarget = entryInsightModel as unknown as {
  deleteMany: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
};
// Default so the unconnected per-entry insight collection is never hit.
const defaultEntryInsightDeleteMany = () => ({
  exec: async () => ({ deletedCount: 0 }),
});
entryInsightTarget.deleteMany = defaultEntryInsightDeleteMany;

const userMemoryTarget = userMemoryModel as unknown as {
  deleteMany: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
};
// Default so the unconnected long-term memory collection is never hit.
const defaultUserMemoryDeleteMany = () => ({
  exec: async () => ({ deletedCount: 0 }),
});
userMemoryTarget.deleteMany = defaultUserMemoryDeleteMany;

const patternNodeTarget = patternNodeModel as unknown as {
  find: (...args: unknown[]) => { sort: (...args: unknown[]) => QueryResult<unknown[]> };
  deleteMany: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
};
const patternEdgeTarget = patternEdgeModel as unknown as {
  find: (...args: unknown[]) => { sort: (...args: unknown[]) => QueryResult<unknown[]> };
  deleteMany: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
};
// Defaults so the unconnected pattern graph collections are never hit.
const defaultGraphFind = () => ({
  sort: () => ({ exec: async () => [] as unknown[] }),
});
const defaultGraphDeleteMany = () => ({
  exec: async () => ({ deletedCount: 0 }),
});
patternNodeTarget.find = defaultGraphFind;
patternNodeTarget.deleteMany = defaultGraphDeleteMany;
patternEdgeTarget.find = defaultGraphFind;
patternEdgeTarget.deleteMany = defaultGraphDeleteMany;

const jadeSessionTarget = jadeSessionModel as unknown as {
  find: (...args: unknown[]) => { sort: (...args: unknown[]) => QueryResult<unknown[]> };
  deleteMany: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
};
const jadeMessageTarget = jadeMessageModel as unknown as {
  find: (...args: unknown[]) => { sort: (...args: unknown[]) => QueryResult<unknown[]> };
  deleteMany: (...args: unknown[]) => QueryResult<{ deletedCount?: number }>;
};
// Defaults so the unconnected Ask Jade collections are never hit.
jadeSessionTarget.find = defaultGraphFind;
jadeSessionTarget.deleteMany = defaultGraphDeleteMany;
jadeMessageTarget.find = defaultGraphFind;
jadeMessageTarget.deleteMany = defaultGraphDeleteMany;

const originalFindById = userTarget.findById;
const originalUpdateOne = userTarget.updateOne;
const originalDeleteOne = userTarget.deleteOne;
const originalJournalFind = journalTarget.find;
const originalJournalDeleteMany = journalTarget.deleteMany;
const originalMoodFind = moodTarget.find;
const originalMoodDeleteMany = moodTarget.deleteMany;
const originalReminderFind = reminderTarget.find;
const originalReminderDeleteMany = reminderTarget.deleteMany;
const originalInsightsFindOne = insightsTarget.findOne;
const originalInsightsDeleteMany = insightsTarget.deleteMany;
const originalStreakFindOne = streakTarget.findOne;
const originalStreakDeleteMany = streakTarget.deleteMany;
const originalStatsFindOne = statsTarget.findOne;
const originalStatsDeleteMany = statsTarget.deleteMany;
const originalWidgetSessionDeleteMany = widgetSessionTarget.deleteMany;

afterEach(() => {
  userTarget.findById = originalFindById;
  userTarget.updateOne = originalUpdateOne;
  userTarget.deleteOne = originalDeleteOne;
  journalTarget.find = originalJournalFind;
  journalTarget.deleteMany = originalJournalDeleteMany;
  moodTarget.find = originalMoodFind;
  moodTarget.deleteMany = originalMoodDeleteMany;
  reminderTarget.find = originalReminderFind;
  reminderTarget.deleteMany = originalReminderDeleteMany;
  insightsTarget.findOne = originalInsightsFindOne;
  insightsTarget.deleteMany = originalInsightsDeleteMany;
  streakTarget.findOne = originalStreakFindOne;
  streakTarget.deleteMany = originalStreakDeleteMany;
  statsTarget.findOne = originalStatsFindOne;
  statsTarget.deleteMany = originalStatsDeleteMany;
  widgetSessionTarget.deleteMany = originalWidgetSessionDeleteMany;
  mindMapEntryScoreTarget.find = defaultMindMapFind;
  mindMapEntryScoreTarget.deleteMany = defaultMindMapDeleteMany;
  entryInsightTarget.deleteMany = defaultEntryInsightDeleteMany;
  userMemoryTarget.deleteMany = defaultUserMemoryDeleteMany;
  patternNodeTarget.find = defaultGraphFind;
  patternNodeTarget.deleteMany = defaultGraphDeleteMany;
  patternEdgeTarget.find = defaultGraphFind;
  patternEdgeTarget.deleteMany = defaultGraphDeleteMany;
  jadeSessionTarget.find = defaultGraphFind;
  jadeSessionTarget.deleteMany = defaultGraphDeleteMany;
  jadeMessageTarget.find = defaultGraphFind;
  jadeMessageTarget.deleteMany = defaultGraphDeleteMany;
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
            detectedTopics: ["calm", "focus"],
            detectedMood: "good",
            sessionAnalysisSnapshot: {
              analysis: { analysis: "A saved session read." },
              source: "open_ended",
              version: 1,
              generatedAt: new Date("2026-04-02T08:10:00.000Z"),
            },
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
  reminderTarget.find = () => ({
    sort: () => ({
      exec: async () => [
        {
          toObject: () => ({
            _id: "reminder-1",
            type: "daily_journal",
            enabled: true,
            time: "20:00",
            timezone: "Asia/Kolkata",
            skipIfCompletedToday: true,
            includeWeekends: false,
            streakWarnings: true,
            createdAt: new Date("2026-04-02T06:00:00.000Z"),
            updatedAt: new Date("2026-04-02T06:00:00.000Z"),
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

  patternNodeTarget.find = () => ({
    sort: () => ({
      exec: async () => [
        {
          toObject: () => ({
            key: "eats-while-watching-shows",
            kind: "pattern",
            label: "eats while watching shows",
            rationale: "Meals happen with a screen on.",
            evidenceQuote: "I put a show on and eat.",
            occurrences: 6,
            confidence: 0.8,
            sourceKinds: ["journal"],
            firstSeenAt: new Date("2026-03-30T00:00:00.000Z"),
            lastSeenAt: new Date("2026-04-02T00:00:00.000Z"),
          }),
        },
      ],
    }),
  });
  patternEdgeTarget.find = () => ({
    sort: () => ({
      exec: async () => [
        {
          toObject: () => ({
            fromKey: "eats-while-watching-shows",
            toKey: "eating-past-fullness",
            type: "reinforces",
            source: "ai_inferred",
            rationale: "Attention is on the screen, so fullness lands late.",
            observations: 4,
            confidence: 0.75,
            firstSeenAt: new Date("2026-03-30T00:00:00.000Z"),
            lastSeenAt: new Date("2026-04-02T00:00:00.000Z"),
          }),
        },
      ],
    }),
  });
  jadeSessionTarget.find = () => ({
    sort: () => ({
      exec: async () => [
        {
          _id: { toString: () => "jade-session-1" },
          title: "Mood view",
          messageCount: 1,
          lastMessageAt: new Date("2026-04-02T10:00:00.000Z"),
          createdAt: new Date("2026-04-02T10:00:00.000Z"),
        },
      ],
    }),
  });
  jadeMessageTarget.find = () => ({
    sort: () => ({
      exec: async () => [
        {
          sessionId: "jade-session-1",
          seq: 1,
          role: "assistant",
          text: "Here is your mood trend.",
          status: "ok",
          blocks: [
            { type: "text", text: "Here is your mood trend." },
            {
              type: "mood_trend",
              title: "Mood trend",
              dataState: "empty",
              updatedAt: null,
              rangeDays: 7,
              points: [],
            },
          ],
          createdAt: new Date("2026-04-02T10:00:00.000Z"),
        },
      ],
    }),
  });

  const result = await exportPrivacyData("user-123");

  assert.ok(result);
  assert.equal(result?.account.userId, "user-123");
  assert.equal(result?.journalEntries.length, 1);
  assert.equal(result?.journalEntries[0]?.entryKind, "journal");
  assert.deepEqual(result?.journalEntries[0]?.tags, ["calm"]);
  assert.deepEqual(result?.journalEntries[0]?.detectedTopics, ["calm", "focus"]);
  assert.equal(result?.journalEntries[0]?.detectedMood, "good");
  assert.equal(
    (result?.journalEntries[0]?.sessionAnalysisSnapshot?.analysis as {
      analysis?: string;
    })?.analysis,
    "A saved session read."
  );
  assert.equal(result?.moodCheckIns.length, 1);
  assert.equal(result?.reminders.length, 1);
  assert.equal(result?.insights?.totalEntries, 3);
  assert.equal(result?.streak?.streak, 4);
  assert.equal(result?.stats?.journalsWritten, 3);
  // A user is entitled to see the patterns the app concluded about them, and
  // the connections it drew between them.
  assert.equal(result?.patternGraph.nodes.length, 1);
  assert.equal(result?.patternGraph.nodes[0]?.label, "eats while watching shows");
  assert.equal(result?.patternGraph.edges.length, 1);
  assert.equal(result?.patternGraph.edges[0]?.type, "reinforces");
  assert.equal(result?.jadeConversations[0]?.messages[0]?.blocks[1]?.type, "mood_trend");
});

test("deletePrivacyAccount removes all user-owned records", async () => {
  const userUpdates: unknown[][] = [];
  userTarget.updateOne = async (...args) => {
    userUpdates.push(args);
    return { acknowledged: true };
  };
  userTarget.deleteOne = () => ({
    exec: async () => ({ deletedCount: 1 }),
  });
  journalTarget.deleteMany = () => ({
    exec: async () => ({ deletedCount: 2 }),
  });
  moodTarget.deleteMany = () => ({
    exec: async () => ({ deletedCount: 2 }),
  });
  reminderTarget.deleteMany = () => ({
    exec: async () => ({ deletedCount: 1 }),
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
  userMemoryTarget.deleteMany = () => ({
    exec: async () => ({ deletedCount: 1 }),
  });
  patternNodeTarget.deleteMany = () => ({
    exec: async () => ({ deletedCount: 7 }),
  });
  patternEdgeTarget.deleteMany = () => ({
    exec: async () => ({ deletedCount: 12 }),
  });
  jadeSessionTarget.deleteMany = () => ({
    exec: async () => ({ deletedCount: 3 }),
  });
  jadeMessageTarget.deleteMany = () => ({
    exec: async () => ({ deletedCount: 26 }),
  });
  const revokedWidgetQueries: unknown[] = [];
  widgetSessionTarget.deleteMany = query => ({
    exec: async () => {
      revokedWidgetQueries.push(query);
      return { deletedCount: 1 };
    },
  });

  const result = await deletePrivacyAccount("user-123");

  assert.equal(result.deletedAccount, true);
  assert.equal(result.deletedJournals, 2);
  assert.equal(result.deletedMoodCheckIns, 2);
  assert.equal(result.deletedReminders, 1);
  assert.equal(result.deletedInsights, 1);
  assert.equal(result.deletedStreaks, 1);
  assert.equal(result.deletedStats, 1);
  assert.equal(result.deletedUserMemories, 1);
  // The graph holds derived conclusions about the person, so deleting an
  // account has to take it with everything else.
  assert.equal(result.deletedPatternNodes, 7);
  assert.equal(result.deletedPatternEdges, 12);
  assert.equal(result.deletedJadeSessions, 3);
  assert.equal(result.deletedJadeMessages, 26);
  assert.deepEqual(revokedWidgetQueries, [{ userId: "user-123" }]);
  assert.deepEqual(userUpdates[0]?.[1], {
    $set: {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    },
    $inc: {
      widgetSessionVersion: 1,
    },
  });
});
