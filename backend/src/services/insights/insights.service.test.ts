import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { insightsModel } from "../../schema/insights.schema";
import { journalModel } from "../../schema/journal.schema";
import { moodCheckInModel } from "../../schema/mood.schema";
import { userModel } from "../../schema/user.schema";
import {
  AiAnalysisDisabledError,
  getInsightsAiAnalysis,
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
      limit: (count: number) => {
        select: (value: unknown) => {
          lean: () => {
            exec: () => Promise<unknown[]>;
          };
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
});

test("getInsightsAiAnalysis blocks opted-out users before loading AI analysis", async () => {
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: true,
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
        "AI analysis is turned off for this account."
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
        "Premium membership is required for this feature."
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
          isPremium: true,
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
  process.env.AI_INSIGHTS_DEV_ALLOW_EARLY_READY = "true";

  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: true,
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

test("getInsightsAiAnalysis down-weights prompt-led low-signal entries in weekly analysis", async () => {
  process.env.NODE_ENV = "development";
  process.env.AI_INSIGHTS_DEV_ALLOW_EARLY_READY = "true";

  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: true,
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
