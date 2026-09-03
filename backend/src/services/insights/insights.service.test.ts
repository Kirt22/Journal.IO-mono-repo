import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { insightsModel } from "../../schema/insights.schema";
import { journalModel } from "../../schema/journal.schema";
import { mindMapEntryScoreModel } from "../../schema/mindMapEntryScore.schema";
import { moodCheckInModel } from "../../schema/mood.schema";
import { userModel } from "../../schema/user.schema";
import {
  aiAnalysisEnhancementSchema,
  getInsightsOverview,
  getInsightsAiAnalysis,
  getInsightsMindMap,
  buildWindowTriggers,
  mergeAiAnalysisEnhancement,
  MIND_MAP_REGION_COPY_DIRECTIVES,
  PremiumFeatureRequiredError,
} from "./insights.service";

type FindByIdQueryResult<T> = {
  select: () => {
    lean: () => {
      exec: () => Promise<T>;
    };
  };
};

const userTarget = userModel as unknown as {
  findById: (userId: string) => FindByIdQueryResult<unknown>;
};
const insightsTarget = insightsModel as unknown as {
  findOne: (query: unknown) => {
    exec: () => Promise<unknown>;
  };
};
const journalTarget = journalModel as unknown as {
  find: (query: unknown) => {
    sort: (value: unknown) => {
      limit?: (count: number) => {
        select: (value: unknown) => {
          lean: () => {
            exec: () => Promise<unknown[]>;
          };
        };
      };
      select?: (value: unknown) => {
        lean: () => {
          exec: () => Promise<unknown[]>;
        };
      };
    };
  };
};
const moodTarget = moodCheckInModel as unknown as {
  find: (query: unknown) => {
    sort: (value: unknown) => {
      select: (value: unknown) => {
        lean: () => {
          exec: () => Promise<unknown[]>;
        };
      };
    };
  };
};

// The per-entry Mind Map scores collection is not connected in unit tests.
// Default it to "no stored rows" so global-map aggregation falls back to the
// deterministic keyword scorer that these tests assert against.
const emptyMindMapChain = {
  sort: () => ({
    select: () => ({ lean: () => ({ exec: async () => [] as unknown[] }) }),
  }),
  select: () => ({ lean: () => ({ exec: async () => [] as unknown[] }) }),
};
const mindMapEntryScoreTarget = mindMapEntryScoreModel as unknown as {
  find: (query: unknown) => typeof emptyMindMapChain;
};
const emptyMindMapFind = () => emptyMindMapChain;
mindMapEntryScoreTarget.find = emptyMindMapFind;

const originalFindById = userTarget.findById;
const originalFindOne = insightsTarget.findOne;
const originalJournalFind = journalTarget.find;
const originalMoodFind = moodTarget.find;
const originalNodeEnv = process.env.NODE_ENV;
const VERIFIED_PREMIUM_ACCESS = {
  isPremium: true,
  premiumPlanKey: "yearly",
  premiumExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
  premiumSource: "revenuecat_verified",
};

afterEach(() => {
  userTarget.findById = originalFindById;
  insightsTarget.findOne = originalFindOne;
  journalTarget.find = originalJournalFind;
  moodTarget.find = originalMoodFind;
  mindMapEntryScoreTarget.find = emptyMindMapFind;
  if (typeof originalNodeEnv === "string") {
    process.env.NODE_ENV = originalNodeEnv;
  } else {
    delete process.env.NODE_ENV;
  }
});

test("getInsightsOverview hides legacy onboarding tags from cached popular topics", async () => {
  insightsTarget.findOne = () => ({
    exec: async () => ({
      totalEntries: 2,
      totalWords: 80,
      totalFavorites: 0,
      dailyJournalCounts: new Map(),
      tagCounts: new Map([
        ["onboarding:first-reflection", 4],
        ["anxiety", 2],
        ["loneliness", 1],
      ]),
      moodCounts: new Map(),
      updatedAt: new Date("2026-08-03T10:00:00.000Z"),
    }),
  });

  const result = await getInsightsOverview("user-123");

  assert.deepEqual(
    result.popularTopics.map(topic => topic.label),
    ["Anxiety", "Loneliness"]
  );
});

test("getInsightsAiAnalysis blocks non-premium users before loading AI analysis", async () => {
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: false,
          onboardingContext: {
          },
        }),
      }),
    }),
  });

  await assert.rejects(
    () => getInsightsAiAnalysis("user-123"),
    (error: unknown) => {
      assert.ok(error instanceof PremiumFeatureRequiredError);
      assert.equal(
        (error as Error).message,
        "This feature is available with Premium."
      );
      return true;
    }
  );
});

test("getInsightsAiAnalysis returns a collecting payload during the first premium week", async () => {
  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          ...VERIFIED_PREMIUM_ACCESS,
          onboardingContext: {
          },
          premiumActivatedAt: new Date("2026-04-11T05:00:00.000Z"),
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
        }),
      }),
    }),
  });

  insightsTarget.findOne = () => ({
    exec: async () => ({
      totalEntries: 2,
      totalWords: 180,
      totalFavorites: 0,
      dailyJournalCounts: new Map([
        ["2026-04-05", 1],
        ["2026-04-06", 1],
      ]),
      tagCounts: new Map(),
      moodCounts: new Map(),
      aiAnalysis: null,
      aiAnalysisStale: true,
      aiAnalysisWindowEndDateKey: null,
      aiAnalysisCacheKey: null,
    }),
  });
  journalTarget.find = () => ({
    sort: () => ({
      limit: () => ({
        select: () => ({
          lean: () => ({
            exec: async () => [
              {
                content: "Work felt intense but I got a little breathing room at night.",
                tags: ["work", "stress"],
                isFavorite: false,
                createdAt: new Date("2026-04-12T12:00:00.000Z"),
              },
              {
                content: "I felt calmer after walking and resting.",
                tags: ["rest", "self-care"],
                isFavorite: false,
                createdAt: new Date("2026-04-13T12:00:00.000Z"),
              },
            ],
          }),
        }),
      }),
    }),
  });
  moodTarget.find = () => ({
    sort: () => ({
      select: () => ({
        lean: () => ({
          exec: async () => [],
        }),
      }),
    }),
  });

  const analysis = await getInsightsAiAnalysis("user-123", {
    timeZone: "Asia/Kolkata",
    today: new Date("2026-04-14T10:00:00.000Z"),
  });

  assert.equal(analysis.status, "collecting");

  if (analysis.status !== "collecting") {
    throw new Error("Expected collecting AI analysis payload.");
  }

  assert.equal(analysis.window.startDate, "2026-04-11");
  assert.equal(analysis.window.endDate, "2026-04-17");
  assert.equal(analysis.progress.activeDays, 2);
  assert.equal(analysis.progress.entriesNeeded, 2);
  assert.equal(analysis.quickAnalysis.available, true);
});

test("getInsightsAiAnalysis keeps the current week collecting before 4 active days in development", async () => {
  process.env.NODE_ENV = "development";

  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          ...VERIFIED_PREMIUM_ACCESS,
          onboardingContext: {
          },
          premiumActivatedAt: new Date("2026-04-11T05:00:00.000Z"),
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
        }),
      }),
    }),
  });

  insightsTarget.findOne = () => ({
    exec: async () => ({
      totalEntries: 2,
      totalWords: 180,
      totalFavorites: 0,
      dailyJournalCounts: new Map([
        ["2026-04-12", 1],
        ["2026-04-13", 1],
      ]),
      tagCounts: new Map(),
      moodCounts: new Map(),
      aiAnalysis: null,
      aiAnalysisStale: true,
      aiAnalysisWindowEndDateKey: null,
      aiAnalysisCacheKey: null,
      aiAnalysisComputedAt: null,
      save: async function save() {
        return this;
      },
    }),
  });
  journalTarget.find = () => ({
    sort: () => ({
      limit: () => ({
        select: () => ({
          lean: () => ({
            exec: async () => [
              {
                content: "Work felt intense but I got a little breathing room at night.",
                tags: ["work", "stress"],
                isFavorite: false,
                createdAt: new Date("2026-04-12T12:00:00.000Z"),
              },
              {
                content: "I felt calmer after walking and resting.",
                tags: ["rest", "self-care"],
                isFavorite: false,
                createdAt: new Date("2026-04-13T12:00:00.000Z"),
              },
            ],
          }),
        }),
      }),
    }),
  });
  moodTarget.find = () => ({
    sort: () => ({
      select: () => ({
        lean: () => ({
          exec: async () => [],
        }),
      }),
    }),
  });

  const analysis = await getInsightsAiAnalysis("user-123", {
    timeZone: "Asia/Kolkata",
    today: new Date("2026-04-14T10:00:00.000Z"),
  });

  assert.equal(analysis.status, "collecting");

  if (analysis.status !== "collecting") {
    throw new Error("Expected collecting AI analysis payload.");
  }

  assert.equal(analysis.window.startDate, "2026-04-11");
  assert.equal(analysis.progress.activeDays, 2);
  assert.equal(analysis.progress.entriesNeeded, 2);
});

test("getInsightsAiAnalysis keeps normal readiness rules without an override", async () => {
  process.env.NODE_ENV = "development";

  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          ...VERIFIED_PREMIUM_ACCESS,
          onboardingContext: {
          },
          premiumActivatedAt: new Date("2026-04-11T05:00:00.000Z"),
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
        }),
      }),
    }),
  });

  insightsTarget.findOne = () => ({
    exec: async () => ({
      totalEntries: 2,
      totalWords: 180,
      totalFavorites: 0,
      dailyJournalCounts: new Map([
        ["2026-04-12", 1],
        ["2026-04-13", 1],
      ]),
      tagCounts: new Map(),
      moodCounts: new Map(),
      aiAnalysis: null,
      aiAnalysisStale: true,
      aiAnalysisWindowEndDateKey: null,
      aiAnalysisCacheKey: null,
      aiAnalysisComputedAt: null,
      save: async function save() {
        return this;
      },
    }),
  });
  journalTarget.find = () => ({
    sort: () => ({
      limit: () => ({
        select: () => ({
          lean: () => ({
            exec: async () => [
              {
                content: "Work felt intense but I got a little breathing room at night.",
                tags: ["work", "stress"],
                isFavorite: false,
                createdAt: new Date("2026-04-12T12:00:00.000Z"),
              },
              {
                content: "I felt calmer after walking and resting.",
                tags: ["rest", "self-care"],
                isFavorite: false,
                createdAt: new Date("2026-04-13T12:00:00.000Z"),
              },
            ],
          }),
        }),
      }),
    }),
  });
  moodTarget.find = () => ({
    sort: () => ({
      select: () => ({
        lean: () => ({
          exec: async () => [],
        }),
      }),
    }),
  });

  const analysis = await getInsightsAiAnalysis("user-123", {
    timeZone: "Asia/Kolkata",
    today: new Date("2026-04-14T10:00:00.000Z"),
  });

  assert.equal(analysis.status, "collecting");
});

test("getInsightsAiAnalysis recomputes cached dev-preview reports in release mode", async () => {
  process.env.NODE_ENV = "development";

  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          ...VERIFIED_PREMIUM_ACCESS,
          onboardingContext: {
          },
          premiumActivatedAt: new Date("2026-04-11T05:00:00.000Z"),
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
        }),
      }),
    }),
  });

  insightsTarget.findOne = () => ({
    exec: async () => ({
      totalEntries: 2,
      totalWords: 180,
      totalFavorites: 0,
      dailyJournalCounts: new Map([
        ["2026-04-12", 1],
        ["2026-04-13", 1],
      ]),
      tagCounts: new Map(),
      moodCounts: new Map(),
      aiAnalysis: {
        status: "ready",
        window: {
          startDate: "2026-04-11",
          endDate: "2026-04-17",
          label: "Apr 11 - Apr 17",
          entryCount: 2,
          activeDays: 2,
          totalWords: 180,
          minimumActiveDays: 4,
        },
        freshness: {
          generatedAt: "2026-04-14T10:00:00.000Z",
          confidence: "low",
          confidenceLabel: "Dev preview",
          note: "Development override is showing this AI analysis early.",
        },
      },
      aiAnalysisStale: false,
      aiAnalysisWindowEndDateKey: "2026-04-17",
      aiAnalysisCacheKey: "2026-04-11:2026-04-17:Asia/Kolkata:ready",
      aiAnalysisComputedAt: new Date("2026-04-14T10:00:00.000Z"),
      save: async function save() {
        return this;
      },
    }),
  });
  journalTarget.find = () => ({
    sort: () => ({
      limit: () => ({
        select: () => ({
          lean: () => ({
            exec: async () => [
              {
                content: "Work felt intense but I got a little breathing room at night.",
                tags: ["work", "stress"],
                isFavorite: false,
                createdAt: new Date("2026-04-12T12:00:00.000Z"),
              },
              {
                content: "I felt calmer after walking and resting.",
                tags: ["rest", "self-care"],
                isFavorite: false,
                createdAt: new Date("2026-04-13T12:00:00.000Z"),
              },
            ],
          }),
        }),
      }),
    }),
  });
  moodTarget.find = () => ({
    sort: () => ({
      select: () => ({
        lean: () => ({
          exec: async () => [],
        }),
      }),
    }),
  });

  const analysis = await getInsightsAiAnalysis("user-123", {
    timeZone: "Asia/Kolkata",
    today: new Date("2026-04-20T10:00:00.000Z"),
  });

  assert.equal(analysis.status, "insufficient");
});

test("getInsightsAiAnalysis down-weights prompt-led low-signal entries in weekly analysis", async () => {
  process.env.NODE_ENV = "development";

  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          ...VERIFIED_PREMIUM_ACCESS,
          onboardingContext: {
          },
          premiumActivatedAt: new Date("2026-04-11T05:00:00.000Z"),
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
        }),
      }),
    }),
  });

  insightsTarget.findOne = () => ({
    exec: async () => ({
      totalEntries: 4,
      totalWords: 280,
      totalFavorites: 0,
      dailyJournalCounts: new Map([
        ["2026-04-12", 1],
        ["2026-04-13", 1],
        ["2026-04-14", 1],
        ["2026-04-11", 1],
      ]),
      tagCounts: new Map(),
      moodCounts: new Map(),
      aiAnalysis: null,
      aiAnalysisStale: true,
      aiAnalysisWindowEndDateKey: null,
      aiAnalysisCacheKey: null,
      aiAnalysisComputedAt: null,
      save: async function save() {
        return this;
      },
    }),
  });
  journalTarget.find = () => ({
    sort: () => ({
      limit: () => ({
        select: () => ({
          lean: () => ({
            exec: async () => [
              {
                content: "What felt most steady or grounding in your day?\n\nasdf qwer",
                aiPrompt: "What felt most steady or grounding in your day?",
                tags: ["work", "stress"],
                isFavorite: false,
                createdAt: new Date("2026-04-12T12:00:00.000Z"),
              },
              {
                content: "I felt calmer after walking and resting in the evening.",
                aiPrompt: null,
                tags: ["rest", "self-care"],
                isFavorite: false,
                createdAt: new Date("2026-04-13T12:00:00.000Z"),
              },
              {
                content: "I made room for a quiet lunch and returned to work with more focus.",
                aiPrompt: null,
                tags: ["rest", "work"],
                isFavorite: false,
                createdAt: new Date("2026-04-14T12:00:00.000Z"),
              },
              {
                content: "A short evening walk helped me leave the unfinished tasks for tomorrow.",
                aiPrompt: null,
                tags: ["rest", "boundaries"],
                isFavorite: false,
                createdAt: new Date("2026-04-11T12:00:00.000Z"),
              },
            ],
          }),
        }),
      }),
    }),
  });
  moodTarget.find = () => ({
    sort: () => ({
      select: () => ({
        lean: () => ({
          exec: async () => [],
        }),
      }),
    }),
  });

  const analysis = await getInsightsAiAnalysis("user-123", {
    timeZone: "Asia/Kolkata",
    today: new Date("2026-04-18T10:00:00.000Z"),
  });

  assert.equal(analysis.status, "ready");

  if (analysis.status !== "ready") {
    throw new Error("Expected ready AI analysis payload.");
  }

  assert.match(analysis.summary.narrative, /prompt carryover/i);
  assert.match(analysis.freshness.note, /clearer writing/i);
  assert.match(analysis.signals.whatDrained[0]?.title || "", /prompt carryover/i);
  assert.notEqual(analysis.themeBreakdown.items[0]?.label, "Work");
});

test("getInsightsAiAnalysis uses support-first weekly copy for safety-sensitive entries", async () => {
  process.env.NODE_ENV = "production";

  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          ...VERIFIED_PREMIUM_ACCESS,
          onboardingContext: {
          },
          premiumActivatedAt: new Date("2026-04-11T05:00:00.000Z"),
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
        }),
      }),
    }),
  });

  insightsTarget.findOne = () => ({
    exec: async () => ({
      totalEntries: 4,
      totalWords: 360,
      totalFavorites: 0,
      dailyJournalCounts: new Map([
        ["2026-04-12", 1],
        ["2026-04-13", 1],
        ["2026-04-14", 1],
        ["2026-04-15", 1],
      ]),
      tagCounts: new Map(),
      moodCounts: new Map(),
      aiAnalysis: null,
      aiAnalysisStale: true,
      aiAnalysisWindowEndDateKey: null,
      aiAnalysisCacheKey: null,
      aiAnalysisComputedAt: null,
      save: async function save() {
        return this;
      },
    }),
  });
  journalTarget.find = () => ({
    sort: () => ({
      limit: () => ({
        select: () => ({
          lean: () => ({
            exec: async () => [
              {
                content:
                  "I keep thinking I might kill myself and I do not feel safe tonight.",
                aiPrompt: null,
                tags: ["mood:terrible"],
                isFavorite: false,
                createdAt: new Date("2026-04-12T12:00:00.000Z"),
              },
              {
                content: "Work was hard, but I took a walk and felt a little more grounded.",
                aiPrompt: null,
                tags: ["work", "self-care"],
                isFavorite: false,
                createdAt: new Date("2026-04-13T12:00:00.000Z"),
              },
              {
                content: "I wrote down what helped me calm down after dinner.",
                aiPrompt: null,
                tags: ["reflection", "self-care"],
                isFavorite: false,
                createdAt: new Date("2026-04-14T12:00:00.000Z"),
              },
              {
                content: "Today I asked for support instead of keeping everything alone.",
                aiPrompt: null,
                tags: ["relationships", "growth"],
                isFavorite: false,
                createdAt: new Date("2026-04-15T12:00:00.000Z"),
              },
            ],
          }),
        }),
      }),
    }),
  });
  moodTarget.find = () => ({
    sort: () => ({
      select: () => ({
        lean: () => ({
          exec: async () => [],
        }),
      }),
    }),
  });

  const analysis = await getInsightsAiAnalysis("user-123", {
    timeZone: "Asia/Kolkata",
    today: new Date("2026-04-20T10:00:00.000Z"),
  });

  assert.equal(analysis.status, "ready");

  if (analysis.status !== "ready") {
    throw new Error("Expected ready AI analysis payload.");
  }

  assert.equal(analysis.freshness.confidenceLabel, "Support-first");
  assert.match(analysis.summary.headline, /support/i);
  assert.match(analysis.summary.narrative, /988/i);
  assert.equal(analysis.patternTags[0]?.label, "Safety");
  assert.equal(analysis.actionPlan.steps[0]?.focus, "Safety");
  assert.match(analysis.appSupport.headline, /not a crisis-response service/i);
});

test("getInsightsMindMap returns a ready latest-week map with exactly 8 ranked regions", async () => {
  process.env.NODE_ENV = "production";

  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          ...VERIFIED_PREMIUM_ACCESS,
          onboardingContext: {
          },
          premiumActivatedAt: new Date("2026-04-11T05:00:00.000Z"),
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
        }),
      }),
    }),
  });

  insightsTarget.findOne = () => ({
    exec: async () => ({
      totalEntries: 5,
      totalWords: 620,
      totalFavorites: 1,
      dailyJournalCounts: new Map([
        ["2026-04-12", 1],
        ["2026-04-13", 1],
        ["2026-04-14", 1],
        ["2026-04-15", 1],
      ]),
      tagCounts: new Map(),
      moodCounts: new Map(),
      aiAnalysis: null,
      aiAnalysisStale: true,
      aiAnalysisWindowEndDateKey: null,
      aiAnalysisCacheKey: null,
      mindMapLatestWeek: null,
      mindMapLatestWeekStale: true,
      mindMapLatestWeekComputedAt: null,
      mindMapLatestWeekCacheKey: null,
      mindMapAllTime: null,
      mindMapAllTimeStale: true,
      mindMapAllTimeComputedAt: null,
      mindMapAllTimeCacheKey: null,
      save: async function save() {
        return this;
      },
    }),
  });
  journalTarget.find = () => ({
    sort: () => ({
      limit: () => ({
        select: () => ({
          lean: () => ({
            exec: async () => [
              {
                content:
                  "I planned tomorrow carefully, protected my morning focus, and felt proud of the progress.",
                aiPrompt: null,
                tags: ["focus", "progress"],
                isFavorite: true,
                createdAt: new Date("2026-04-12T12:00:00.000Z"),
              },
              {
                content:
                  "Work stress felt heavy, but writing out a clear next step helped me settle.",
                aiPrompt: null,
                tags: ["work", "stress"],
                isFavorite: false,
                createdAt: new Date("2026-04-13T12:00:00.000Z"),
              },
              {
                content:
                  "I want to carry this routine forward because the structure makes tomorrow feel lighter.",
                aiPrompt: null,
                tags: ["routine"],
                isFavorite: false,
                createdAt: new Date("2026-04-14T12:00:00.000Z"),
              },
              {
                content:
                  "I noticed how much better I do when I decide the next action before bed.",
                aiPrompt: null,
                tags: ["planning"],
                isFavorite: false,
                createdAt: new Date("2026-04-15T12:00:00.000Z"),
              },
            ],
          }),
        }),
      }),
      select: () => ({
        lean: () => ({
          exec: async () => [],
        }),
      }),
    }),
  });
  moodTarget.find = () => ({
    sort: () => ({
      select: () => ({
        lean: () => ({
          exec: async () => [],
        }),
      }),
    }),
  });

  const map = await getInsightsMindMap("user-123", {
    range: "latest_week",
    timeZone: "Asia/Kolkata",
    today: new Date("2026-04-20T10:00:00.000Z"),
  });

  assert.equal(map.status, "ready");

  if (map.status !== "ready") {
    throw new Error("Expected ready Mind Map payload.");
  }

  assert.equal(map.period.range, "latest_week");
  assert.equal(map.regions.length, 8);
  assert.equal(map.strongestRegionId, "planning_self_control");
  assert.equal(map.regions[0]?.id, "planning_self_control");
  assert.equal(map.regions[0]?.rank, 1);
  assert.equal(map.regions[7]?.rank, 8);
  assert.match(map.disclaimer.body, /not a brain scan/i);
});

test("getInsightsMindMap returns support-first for safety-sensitive latest-week writing", async () => {
  process.env.NODE_ENV = "production";

  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          ...VERIFIED_PREMIUM_ACCESS,
          onboardingContext: {
          },
          premiumActivatedAt: new Date("2026-04-11T05:00:00.000Z"),
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
        }),
      }),
    }),
  });

  insightsTarget.findOne = () => ({
    exec: async () => ({
      totalEntries: 4,
      totalWords: 280,
      totalFavorites: 0,
      dailyJournalCounts: new Map(),
      tagCounts: new Map(),
      moodCounts: new Map(),
      mindMapLatestWeek: null,
      mindMapLatestWeekStale: true,
      mindMapLatestWeekComputedAt: null,
      mindMapLatestWeekCacheKey: null,
      mindMapAllTime: null,
      mindMapAllTimeStale: true,
      mindMapAllTimeComputedAt: null,
      mindMapAllTimeCacheKey: null,
      save: async function save() {
        return this;
      },
    }),
  });
  journalTarget.find = () => ({
    sort: () => ({
      limit: () => ({
        select: () => ({
          lean: () => ({
            exec: async () => [
              {
                content: "I want to kill myself and do not feel safe tonight.",
                aiPrompt: null,
                tags: ["mood:terrible"],
                isFavorite: false,
                createdAt: new Date("2026-04-12T12:00:00.000Z"),
              },
              {
                content: "I took a walk and tried to slow things down.",
                aiPrompt: null,
                tags: ["self-care"],
                isFavorite: false,
                createdAt: new Date("2026-04-13T12:00:00.000Z"),
              },
              {
                content: "I wrote to a friend instead of holding it alone.",
                aiPrompt: null,
                tags: ["relationships"],
                isFavorite: false,
                createdAt: new Date("2026-04-14T12:00:00.000Z"),
              },
              {
                content: "I am trying to stay grounded this evening.",
                aiPrompt: null,
                tags: ["grounding"],
                isFavorite: false,
                createdAt: new Date("2026-04-15T12:00:00.000Z"),
              },
            ],
          }),
        }),
      }),
      select: () => ({
        lean: () => ({
          exec: async () => [],
        }),
      }),
    }),
  });
  moodTarget.find = () => ({
    sort: () => ({
      select: () => ({
        lean: () => ({
          exec: async () => [],
        }),
      }),
    }),
  });

  const map = await getInsightsMindMap("user-123", {
    range: "latest_week",
    timeZone: "Asia/Kolkata",
    today: new Date("2026-04-20T10:00:00.000Z"),
  });

  assert.equal(map.status, "support_first");

  if (map.status !== "support_first") {
    throw new Error("Expected support-first Mind Map payload.");
  }

  assert.match(map.summary.headline, /support-first/i);
  assert.match(map.support.body, /local emergency or crisis support/i);
});

test("getInsightsMindMap excludes safety-sensitive entries from all-time aggregation", async () => {
  process.env.NODE_ENV = "production";

  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          ...VERIFIED_PREMIUM_ACCESS,
          onboardingContext: {
          },
          premiumActivatedAt: new Date("2026-04-11T05:00:00.000Z"),
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
        }),
      }),
    }),
  });

  insightsTarget.findOne = () => ({
    exec: async () => ({
      totalEntries: 6,
      totalWords: 740,
      totalFavorites: 1,
      dailyJournalCounts: new Map(),
      tagCounts: new Map(),
      moodCounts: new Map(),
      mindMapLatestWeek: null,
      mindMapLatestWeekStale: true,
      mindMapLatestWeekComputedAt: null,
      mindMapLatestWeekCacheKey: null,
      mindMapAllTime: null,
      mindMapAllTimeStale: true,
      mindMapAllTimeComputedAt: null,
      mindMapAllTimeCacheKey: null,
      save: async function save() {
        return this;
      },
    }),
  });
  journalTarget.find = () => ({
    sort: () => ({
      select: () => ({
        lean: () => ({
          exec: async () => [
            {
              content: "I planned tomorrow, set one clear goal, and protected my focus.",
              aiPrompt: null,
              tags: ["planning", "focus"],
              isFavorite: false,
              createdAt: new Date("2026-04-16T12:00:00.000Z"),
            },
            {
              content: "I was proud of the steady progress and the routine is starting to stick.",
              aiPrompt: null,
              tags: ["progress", "routine"],
              isFavorite: true,
              createdAt: new Date("2026-04-15T12:00:00.000Z"),
            },
            {
              content: "I feel tired and my body is asking for rest and sleep.",
              aiPrompt: null,
              tags: ["rest", "sleep"],
              isFavorite: false,
              createdAt: new Date("2026-04-14T12:00:00.000Z"),
            },
            {
              content: "I wrote to a friend because the relationship tension felt heavy.",
              aiPrompt: null,
              tags: ["relationships"],
              isFavorite: false,
              createdAt: new Date("2026-04-13T12:00:00.000Z"),
            },
            {
              content: "I reflected on my values and who I am becoming lately.",
              aiPrompt: null,
              tags: ["identity", "values"],
              isFavorite: false,
              createdAt: new Date("2026-04-17T12:00:00.000Z"),
            },
            {
              content: "I want to kill myself tonight.",
              aiPrompt: null,
              tags: ["mood:terrible"],
              isFavorite: false,
              createdAt: new Date("2026-04-12T12:00:00.000Z"),
            },
          ],
        }),
      }),
      limit: () => ({
        select: () => ({
          lean: () => ({
            exec: async () => [],
          }),
        }),
      }),
    }),
  });
  moodTarget.find = () => ({
    sort: () => ({
      select: () => ({
        lean: () => ({
          exec: async () => [],
        }),
      }),
    }),
  });

  const map = await getInsightsMindMap("user-123", {
    range: "all_time",
    timeZone: "Asia/Kolkata",
    today: new Date("2026-04-20T10:00:00.000Z"),
  });

  assert.equal(map.status, "ready");

  if (map.status !== "ready") {
    throw new Error("Expected ready Mind Map payload.");
  }

  assert.equal(map.period.range, "all_time");
  assert.equal(map.period.entryCount, 5);
  assert.equal(map.regions.length, 8);
  assert.ok(
    map.regions.every(region =>
      region.evidenceSnippets.every(snippet => !/kill myself/i.test(snippet))
    )
  );
});

test("getInsightsMindMap reuses a cached all-time map when the cache key matches", async () => {
  process.env.NODE_ENV = "production";

  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          ...VERIFIED_PREMIUM_ACCESS,
          onboardingContext: {
          },
          premiumActivatedAt: new Date("2026-04-11T05:00:00.000Z"),
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
        }),
      }),
    }),
  });

  insightsTarget.findOne = () => ({
    exec: async () => ({
      mindMapAllTime: {
        status: "ready",
        period: {
          range: "all_time",
          label: "All reflections",
          startDate: "2026-04-10",
          endDate: "2026-04-16",
          entryCount: 4,
          activeDays: 4,
          clearEntryCount: 4,
          totalWords: 240,
          minimumActiveDays: 4,
          generatedAt: "2026-04-20T10:00:00.000Z",
        },
        summary: {
          headline: "Planning & Self-Control carried the strongest reflection signal",
          narrative: "Cached narrative",
          note: "Cached note",
        },
        strongestRegionId: "planning_self_control",
        regions: Array.from({ length: 8 }, (_, index) => ({
          id:
            index === 0
              ? "planning_self_control"
              : index === 1
                ? "motivation_reward"
                : index === 2
                  ? "body_inner_signals"
                  : index === 3
                    ? "relationships_perspective"
                    : index === 4
                      ? "emotional_intensity"
                      : index === 5
                        ? "conflict_attention"
                        : index === 6
                          ? "memory_meaning"
                          : "self_reflection_identity",
          productLabel: "Cached Region",
          brainRegionSubtitle: "Cached Brain Region",
          signalScore: 1 - index * 0.08,
          confidence: 0.7,
          rank: index + 1,
          intensity: index < 2 ? "high" : "moderate",
          shortInsight: "Cached short insight",
          evidenceSnippets: [],
        })),
        disclaimer: {
          title: "Reflection signal, not a medical measure",
          body:
            "Brightness and pulse reflect patterns in your writing. This map is not a brain scan, diagnosis, or medical measure.",
        },
      },
      mindMapAllTimeStale: false,
      mindMapAllTimeCacheKey: "all_time:Asia/Kolkata:v4:ready",
    }),
  });
  journalTarget.find = () => ({
    sort: () => ({
      select: () => ({
        lean: () => ({
          exec: async () => {
            throw new Error("Should not read journals when cached all-time map is valid.");
          },
        }),
      }),
      limit: () => ({
        select: () => ({
          lean: () => ({
            exec: async () => {
              throw new Error("Should not read limited journals when cached all-time map is valid.");
            },
          }),
        }),
      }),
    }),
  });
  moodTarget.find = () => ({
    sort: () => ({
      select: () => ({
        lean: () => ({
          exec: async () => [],
        }),
      }),
    }),
  });

  const map = await getInsightsMindMap("user-123", {
    range: "all_time",
    timeZone: "Asia/Kolkata",
  });

  assert.equal(map.status, "ready");

  if (map.status !== "ready") {
    throw new Error("Expected ready cached Mind Map payload.");
  }

  assert.equal(map.summary.narrative, "Cached narrative");
});

test("mergeAiAnalysisEnhancement only replaces the user-facing narrative sections", () => {
  const baseAnalysis = {
    status: "ready" as const,
    window: {
      startDate: "2026-03-31",
      endDate: "2026-04-06",
      label: "Mar 31 - Apr 6",
      entryCount: 5,
      activeDays: 4,
      totalWords: 720,
      minimumActiveDays: 4,
    },
    freshness: {
      generatedAt: "2026-04-06T10:00:00.000Z",
      confidence: "high" as const,
      confidenceLabel: "Clear weekly signal",
      note: "Base note",
    },
    summary: {
      headline: "Base headline",
      narrative: "Base narrative",
    },
    patternTags: [{ label: "Routine Seeking", tone: "amber" as const }],
    scoreboard: {
      vibeLabel: "Steadier week",
      vibeTone: "sage" as const,
      cards: [
        { key: "activeDays" as const, label: "Active days", value: "4/7", tone: "sage" as const },
        { key: "entries" as const, label: "Entries", value: "5", tone: "blue" as const },
        { key: "words" as const, label: "Words", value: "720", tone: "amber" as const },
        { key: "mood" as const, label: "Mood signal", value: "Good", tone: "blue" as const },
      ],
    },
    emotionTrend: {
      headline: "Emotional pace across the week",
      days: [
        {
          dateKey: "2026-03-31",
          label: "Tue",
          moodLabel: "Good",
          moodScore: 4,
          entryCount: 1,
          tone: "blue" as const,
        },
      ],
    },
    themeBreakdown: {
      headline: "Themes that kept resurfacing",
      items: [
        {
          label: "Routine",
          count: 3,
          percentage: 60,
          tone: "coral" as const,
        },
      ],
    },
    signals: {
      whatHelped: [
        {
          title: "Consistency gave the week more shape",
          description: "Base helped description",
          evidence: ["4/7 active days"],
          tone: "sage" as const,
        },
      ],
      whatDrained: [
        {
          title: "Stress stayed close to the surface",
          description: "Base drained description",
          evidence: ["Stress"],
          tone: "slate" as const,
        },
      ],
      whatKeptShowingUp: [
        {
          title: "Routine",
          description: "Base repeating description",
          evidence: ["3 mentions"],
          tone: "coral" as const,
        },
      ],
    },
    patterns: [
      {
        label: "Base pattern",
        insight: "Base pattern insight",
        evidence: ["Base evidence"],
        nudge: "Base nudge",
        trigger: "",
        status: "emerging" as const,
        tone: "coral" as const,
      },
    ],
    actionPlan: {
      headline: "Base action headline",
      steps: [
        { title: "Step 1", description: "Desc 1", focus: "Focus 1" },
        { title: "Step 2", description: "Desc 2", focus: "Focus 2" },
      ],
    },
    appSupport: {
      headline: "Base support headline",
      items: [
        { title: "Item 1", description: "Item 1 desc" },
        { title: "Item 2", description: "Item 2 desc" },
        { title: "Item 3", description: "Item 3 desc" },
      ],
    },
  };

  const merged = mergeAiAnalysisEnhancement(baseAnalysis, {
    summary: {
      headline: "AI headline",
      narrative: "AI narrative",
    },
    patternTags: [
      { label: "Stress Load", tone: "slate" },
      { label: "Weekly Check-ins", tone: "blue" },
    ],
    actionPlan: {
      headline: "AI action headline",
      steps: [
        { title: "AI Step 1", description: "AI Desc 1", focus: "AI Focus 1" },
        { title: "AI Step 2", description: "AI Desc 2", focus: "AI Focus 2" },
      ],
    },
    appSupport: {
      headline: "AI support headline",
      items: [
        { title: "AI Item 1", description: "AI Item 1 desc" },
        { title: "AI Item 2", description: "AI Item 2 desc" },
        { title: "AI Item 3", description: "AI Item 3 desc" },
      ],
    },
    patterns: [
      {
        label: "AI pattern",
        insight: "AI pattern insight",
        trigger: "a moved deadline",
        status: "emerging" as const,
        evidence: ["AI evidence"],
        nudge: "AI nudge",
        tone: "blue" as const,
      },
    ],
  });

  assert.equal(merged.summary.headline, "AI headline");
  assert.equal(merged.patternTags[0]?.label, "Stress Load");
  assert.equal(merged.actionPlan.headline, "AI action headline");
  assert.equal(merged.patterns[0]?.label, "AI pattern");
  assert.equal(merged.patterns[0]?.insight, "AI pattern insight");
});

// --- Weekly analysis grounded in triggers ---------------------------------

const makeTriggerEntry = (
  trigger: string,
  emotionalResponse: string,
  occurrences = 1
) => ({
  content: "",
  tags: [],
  detectedTopics: [],
  appAuthoredSegments: [],
  isFavorite: false,
  createdAt: new Date("2026-08-10T00:00:00.000Z"),
  triggersObserved: [
    {
      trigger,
      emotionalResponse,
      evidenceQuote: "",
      confidence: 0.7,
      status: "emerging" as const,
      occurrences,
    },
  ],
});

test("buildWindowTriggers counts one trigger written two ways as one", () => {
  const triggers = buildWindowTriggers([
    makeTriggerEntry("my manager messaging me", "goes quiet"),
    makeTriggerEntry("messages from the manager", "going quiet"),
  ]);

  assert.equal(triggers.length, 1, "re-wordings must not split the week's count");
  assert.equal(triggers[0]?.entriesThisWeek, 2);
});

test("buildWindowTriggers keeps genuinely different triggers apart", () => {
  const triggers = buildWindowTriggers([
    makeTriggerEntry("criticism at work", "goes quiet"),
    makeTriggerEntry("a late night scroll", "loses sleep"),
  ]);

  assert.equal(triggers.length, 2);
});

test("buildWindowTriggers reports lifetime counts without summing them", () => {
  // Lifetime occurrences come from the graph. Adding them per entry would
  // inflate "seen 3 times" into "seen 6 times" the moment a trigger appeared
  // twice in one week — a count the user would act on.
  const triggers = buildWindowTriggers([
    makeTriggerEntry("criticism at work", "goes quiet", 3),
    makeTriggerEntry("criticism at work", "goes quiet", 3),
  ]);

  assert.equal(triggers[0]?.entriesThisWeek, 2);
  assert.equal(triggers[0]?.timesSeenOverall, 3);
});

test("buildWindowTriggers ignores entries with no session analysis", () => {
  const triggers = buildWindowTriggers([
    {
      content: "A plain entry with no analysis snapshot yet.",
      tags: [],
      detectedTopics: [],
      appAuthoredSegments: [],
      isFavorite: false,
      createdAt: new Date("2026-08-10T00:00:00.000Z"),
      triggersObserved: [],
    },
  ]);

  assert.deepEqual(triggers, []);
});

test("a 'confirmed' status the graph does not back is demoted to recurring", () => {
  const base = {
    status: "ready" as const,
    window: {
      startDate: "2026-08-03",
      endDate: "2026-08-09",
      label: "Aug 3-9",
      entryCount: 5,
      activeDays: 5,
      totalWords: 400,
      minimumActiveDays: 4,
    },
    freshness: {
      generatedAt: new Date().toISOString(),
      confidence: "high" as const,
      confidenceLabel: "High",
      note: "",
    },
    summary: { headline: "H", narrative: "N" },
    patternTags: [{ label: "T", tone: "blue" as const }],
    scoreboard: { vibeLabel: "V", vibeTone: "blue" as const, cards: [] },
    emotionTrend: { headline: "E", days: [] },
    themeBreakdown: { headline: "T", items: [] },
    signals: { whatHelped: [], whatDrained: [], whatKeptShowingUp: [] },
    patterns: [],
    actionPlan: { headline: "A", steps: [] },
    appSupport: { headline: "S", items: [] },
  } as unknown as Parameters<typeof mergeAiAnalysisEnhancement>[0];

  const enhancement = {
    summary: { headline: "H", narrative: "N" },
    patternTags: [{ label: "T", tone: "blue" as const }],
    actionPlan: {
      headline: "A",
      steps: [
        { title: "1", description: "d", focus: "f" },
        { title: "2", description: "d", focus: "f" },
      ],
    },
    appSupport: {
      headline: "S",
      items: [
        { title: "1", description: "d" },
        { title: "2", description: "d" },
        { title: "3", description: "d" },
      ],
    },
    patterns: [
      {
        label: "goes quiet after criticism",
        insight: "i",
        trigger: "criticism",
        status: "confirmed" as const,
        evidence: ["e"],
        nudge: "n",
        tone: "blue" as const,
      },
      {
        label: "scrolls before bed",
        insight: "i",
        trigger: "a late message",
        status: "confirmed" as const,
        evidence: ["e"],
        nudge: "n",
        tone: "sage" as const,
      },
    ],
  } as Parameters<typeof mergeAiAnalysisEnhancement>[1];

  const merged = mergeAiAnalysisEnhancement(
    base,
    enhancement,
    new Set(["goes quiet after criticism"])
  );

  assert.equal(merged.patterns[0]?.status, "confirmed", "the graph backs this one");
  assert.equal(
    merged.patterns[1]?.status,
    "recurring",
    "an unbacked 'confirmed' must never reach the user as established"
  );
  assert.equal(merged.patterns[0]?.trigger, "criticism");
});


test("Mind Map region copy is instructed to be personal, not templated", () => {
  const prompt = MIND_MAP_REGION_COPY_DIRECTIVES.join(" ");

  // The whole point of the field: it replaced a per-region sentence that read
  // identically for every user. Pin the rules that stop it drifting back.
  assert.match(prompt, /Never write the generic version/i);
  assert.match(prompt, /paste your sentence into a stranger's Mind Map/i);
  assert.match(prompt, /explain the link, and the link is the whole point/i);

  // Bluntness only stays honest while invention stays banned.
  assert.match(prompt, /Never invent an event, a person, or a failing/i);
  assert.match(prompt, /do not label them with a condition or assert a formal diagnosis as fact/i);

  // The app prints the trend sentence itself; the model must not duplicate it.
  assert.match(prompt, /never restate the trend on its own/i);

  // The length ceiling is a layout constraint on the Mind Map screen.
  assert.match(prompt, /at most 260 characters/i);
});

test("Mind Map region copy is instructed in plain language, not clinician voice", () => {
  const prompt = MIND_MAP_REGION_COPY_DIRECTIVES.join(" ");

  // This screen deliberately does NOT share the reflection-companion register
  // that Jade and guided reflection use. It explains a person's own data back
  // to them, so it reads like a friend rather than a report.
  assert.match(prompt, /Talk like a friend/i);
  assert.match(prompt, /Not a therapist, not a report, not a coach/i);
  assert.match(prompt, /Everyday words, second person, contractions/i);

  // The jargon ban is the load-bearing half — assert the actual banned terms so
  // a future edit cannot soften it back into clinical vocabulary.
  for (const term of [
    "recurring pattern",
    "emotional regulation",
    "avoidance behaviour",
    "attachment",
    "markers",
  ]) {
    assert.ok(
      prompt.includes(term),
      `the banned-jargon list must still name "${term}"`
    );
  }
  assert.match(prompt, /No jargon/i);

  // Brain-region names are allowed only when explained in the same breath.
  assert.match(prompt, /only if you explain it in the same breath/i);

  // Warm, but explicitly not cushioned — the register change must not undo the
  // directness won in the earlier rounds.
  assert.match(prompt, /warm but do not cushion/i);
  assert.match(prompt, /no lecture, no shame, no cheerleading/i);
});

test("the tone steer cannot re-soften the Mind Map register", () => {
  // A `gentle` onboarding tone injects "soften confrontation". When that sat
  // after these directives it silently undid the plain register for exactly the
  // users who chose it, so ordering is the fix and ordering is invisible at a
  // glance — pin it.
  // Read the TS source, not the compiled output: tests run from dist/, and the
  // ordering being asserted is a property of the source we maintain.
  const source = readFileSync(
    join(process.cwd(), "src/services/insights/insights.service.ts"),
    "utf8"
  );
  const directiveIndex = source.lastIndexOf("...MIND_MAP_REGION_COPY_DIRECTIVES,");
  const personalizationIndex = source.lastIndexOf(
    "personalization?.systemDirective,",
    directiveIndex
  );

  assert.ok(directiveIndex > 0, "the directive spread must still be present");
  assert.ok(
    personalizationIndex > 0 && personalizationIndex < directiveIndex,
    "personalization?.systemDirective must come BEFORE the Mind Map directives"
  );
});

// The Patterns card renders `label` as the row title verbatim. A hard
// `maxLength` at the display bound made the decoder stop mid-word, so the row
// shipped reading "what he won't say outl".
test("an overlong pattern label is trimmed at a word boundary, not severed", () => {
  const buildEnhancement = (label: string) => ({
    summary: { headline: "A steady week", narrative: "You kept writing." },
    patternTags: [{ label: "Work pacing", tone: "amber" }],
    actionPlan: {
      headline: "Two things this week",
      steps: [
        { title: "Name the trigger", description: "Write it down.", focus: "Trigger" },
        { title: "Pause once", description: "Wait five minutes.", focus: "Pause" },
      ],
    },
    appSupport: {
      headline: "How the app helps",
      items: [
        { title: "Write daily", description: "Short entries are enough." },
        { title: "Check the map", description: "See where entries land." },
        { title: "Ask Jade", description: "Question your own writing." },
      ],
    },
    patterns: [
      {
        label,
        insight: "You move to the gym instead of staying with the feeling.",
        trigger: "Feeling off",
        status: "emerging",
        evidence: ["went to the gym"],
        nudge: "Name the feeling before you change the activity.",
        tone: "coral",
      },
    ],
  });

  const overlong =
    "You use the gym to regulate what you will not say out loud to anyone";
  const parsed = aiAnalysisEnhancementSchema.parse(buildEnhancement(overlong));
  const label = parsed.patterns[0]?.label ?? "";

  assert.ok(label.length <= 48, `label was ${label.length} characters`);
  assert.ok(label.endsWith("\u2026"), "an actually-trimmed label marks the trim");
  // The kept portion must be whole words from the original, never a word cut
  // in half: every word before the ellipsis has to appear in the source.
  const kept = label.slice(0, -1).trimEnd();
  assert.ok(overlong.startsWith(kept), `"${kept}" is not a whole-word prefix`);
  assert.ok(/\s/.test(kept) && !kept.endsWith(" "), "trimmed at a word boundary");

  // A label that already fits is passed through untouched — no stray ellipsis.
  const short = "You check for connection, then pull back";
  assert.equal(
    aiAnalysisEnhancementSchema.parse(buildEnhancement(short)).patterns[0]?.label,
    short,
  );
});

test("weekly analysis is instructed to address the user in the second person", () => {
  const source = readFileSync(
    join(process.cwd(), "src/services/insights/insights.service.ts"),
    "utf8",
  );

  assert.match(source, /Address the user directly, in the second person/);
  assert.match(
    source,
    /Third-person pronouns are only ever for other people the user wrote about/,
  );
  // The old instruction told the model its output would be cut mid-word. It no
  // longer is, and leaving that in teaches the model to expect the wrong thing.
  assert.doesNotMatch(source, /a field that runs over is cut off mid-word/);
});
