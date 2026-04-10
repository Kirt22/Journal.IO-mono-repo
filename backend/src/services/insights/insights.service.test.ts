import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { insightsModel } from "../../schema/insights.schema";
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

const originalFindById = userTarget.findById;
const originalFindOne = insightsTarget.findOne;

afterEach(() => {
  userTarget.findById = originalFindById;
  insightsTarget.findOne = originalFindOne;
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

test("getInsightsAiAnalysis returns a pending payload during the first week of premium usage", async () => {
  userTarget.findById = (_userId: string) => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          isPremium: true,
          onboardingContext: {
            aiOptIn: true,
          },
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
    }),
  });

  const analysis = await getInsightsAiAnalysis("user-123");

  assert.equal(analysis.status, "pending");

  if (analysis.status !== "pending") {
    throw new Error("Expected pending AI analysis payload.");
  }

  assert.equal(analysis.readiness.daysUntilReady, 4);
  assert.equal(analysis.readiness.totalEntries, 2);
  assert.equal(analysis.quickAnalysis.available, true);
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
