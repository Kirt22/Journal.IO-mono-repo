import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { insightsModel } from "../../schema/insights.schema";
import { journalModel } from "../../schema/journal.schema";
import { moodCheckInModel } from "../../schema/mood.schema";
import { userModel } from "../../schema/user.schema";
import {
  AiAnalysisDisabledError,
  getInsightsAiAnalysis,
  getInsightsMindMap,
  mergeAiAnalysisEnhancement,
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

const originalFindById = userTarget.findById;
const originalFindOne = insightsTarget.findOne;
const originalJournalFind = journalTarget.find;
const originalMoodFind = moodTarget.find;
const originalNodeEnv = process.env.NODE_ENV;
const originalAiInsightsDevEarlyReady =
  process.env.AI_INSIGHTS_DEV_ALLOW_EARLY_READY;
const originalAiInsightsExperimentalEarlyReady =
  process.env.AI_INSIGHTS_EXPERIMENTAL_EARLY_READY;
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
  if (typeof originalNodeEnv === "string") {
    process.env.NODE_ENV = originalNodeEnv;
  } else {
    delete process.env.NODE_ENV;
  }
  if (typeof originalAiInsightsDevEarlyReady === "string") {
    process.env.AI_INSIGHTS_DEV_ALLOW_EARLY_READY =
      originalAiInsightsDevEarlyReady;
  } else {
    delete process.env.AI_INSIGHTS_DEV_ALLOW_EARLY_READY;
  }
  if (typeof originalAiInsightsExperimentalEarlyReady === "string") {
    process.env.AI_INSIGHTS_EXPERIMENTAL_EARLY_READY =
      originalAiInsightsExperimentalEarlyReady;
  } else {
    delete process.env.AI_INSIGHTS_EXPERIMENTAL_EARLY_READY;
  }
});

test("getInsightsAiAnalysis blocks opted-out users before loading AI analysis", async () => {
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          ...VERIFIED_PREMIUM_ACCESS,
          onboardingContext: {
            aiOptIn: false,
          },
        }),
      }),
    }),
  });

  await assert.rejects(
    () => getInsightsAiAnalysis("user-123"),
    (error: unknown) => {
      assert.ok(error instanceof AiAnalysisDisabledError);
      assert.equal(
        (error as Error).message,
        "AI analysis is turned off for your account."
      );
      return true;
    }
  );
});

test("getInsightsAiAnalysis blocks non-premium users before loading AI analysis", async () => {
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: false,
          onboardingContext: {
            aiOptIn: true,
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
            aiOptIn: true,
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

test("getInsightsAiAnalysis can return a dev-preview ready payload before 4 active days", async () => {
  process.env.NODE_ENV = "development";
  process.env.AI_INSIGHTS_EXPERIMENTAL_EARLY_READY = "true";

  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          ...VERIFIED_PREMIUM_ACCESS,
          onboardingContext: {
            aiOptIn: true,
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

  assert.equal(analysis.status, "ready");

  if (analysis.status !== "ready") {
    throw new Error("Expected ready AI analysis payload.");
  }

  assert.equal(analysis.window.startDate, "2026-04-11");
  assert.equal(analysis.window.activeDays, 2);
  assert.equal(analysis.freshness.confidence, "low");
  assert.equal(analysis.freshness.confidenceLabel, "Dev preview");
  assert.match(analysis.freshness.note, /Development override/i);
});

test("getInsightsAiAnalysis ignores the old dev-preview flag in release-safe mode", async () => {
  process.env.NODE_ENV = "development";
  process.env.AI_INSIGHTS_DEV_ALLOW_EARLY_READY = "true";
  delete process.env.AI_INSIGHTS_EXPERIMENTAL_EARLY_READY;

  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          ...VERIFIED_PREMIUM_ACCESS,
          onboardingContext: {
            aiOptIn: true,
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
  delete process.env.AI_INSIGHTS_EXPERIMENTAL_EARLY_READY;

  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          ...VERIFIED_PREMIUM_ACCESS,
          onboardingContext: {
            aiOptIn: true,
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
  process.env.AI_INSIGHTS_EXPERIMENTAL_EARLY_READY = "true";

  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          ...VERIFIED_PREMIUM_ACCESS,
          onboardingContext: {
            aiOptIn: true,
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
            aiOptIn: true,
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
  assert.match(analysis.summary.highlight, /988/i);
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
            aiOptIn: true,
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
            aiOptIn: true,
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
            aiOptIn: true,
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
  assert.equal(map.period.entryCount, 4);
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
            aiOptIn: true,
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
      mindMapAllTimeCacheKey: "all_time:Asia/Kolkata:v1:ready",
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
      highlight: "Base highlight",
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
    bigFive: [
      {
        trait: "conscientiousness" as const,
        label: "Conscientiousness",
        score: 72,
        band: "pronounced" as const,
        description: "Base description",
        evidenceTags: ["Routine"],
      },
    ],
    darkTriad: [
      {
        trait: "narcissism" as const,
        label: "Narcissism",
        supportiveLabel: "Self-focus signal",
        score: 18,
        band: "low" as const,
        description: "Base watchpoint",
        supportTip: "Base support tip",
      },
    ],
    actionPlan: {
      headline: "Base action headline",
      steps: [
        { title: "Step 1", description: "Desc 1", focus: "Focus 1" },
        { title: "Step 2", description: "Desc 2", focus: "Focus 2" },
        { title: "Step 3", description: "Desc 3", focus: "Focus 3" },
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
      highlight: "AI highlight",
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
        { title: "AI Step 3", description: "AI Desc 3", focus: "AI Focus 3" },
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
  });

  assert.equal(merged.summary.headline, "AI headline");
  assert.equal(merged.patternTags[0]?.label, "Stress Load");
  assert.equal(merged.actionPlan.headline, "AI action headline");
  assert.equal(merged.bigFive[0]?.score, 72);
  assert.equal(merged.darkTriad[0]?.supportiveLabel, "Self-focus signal");
});
