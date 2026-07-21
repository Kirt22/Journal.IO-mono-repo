/**
 * @format
 */

import {
  normalizeInsightsMindMap,
  type InsightsMindMap,
} from "../src/services/insightsService";

test("normalizeInsightsMindMap accepts a ready payload", () => {
  const payload: InsightsMindMap = {
    status: "ready",
    period: {
      range: "latest_week",
      label: "Apr 12 - Apr 18",
      startDate: "2026-04-12",
      endDate: "2026-04-18",
      entryCount: 4,
      activeDays: 4,
      clearEntryCount: 4,
      totalWords: 212,
      minimumActiveDays: 4,
      generatedAt: "2026-04-20T10:00:00.000Z",
    },
    summary: {
      headline: "Planning & Self-Control carried the strongest reflection signal",
      narrative: "The map found a steady planning pattern in your writing.",
      note: "Brightness reflects patterns in your writing.",
    },
    strongestRegionId: "planning_self_control",
    regions: [
      {
        id: "planning_self_control",
        productLabel: "Planning & Self-Control",
        brainRegionSubtitle: "Prefrontal Cortex",
        signalScore: 1,
        confidence: 0.82,
        rank: 1,
        intensity: "high",
        shortInsight: "Planning stood out most clearly.",
        evidenceSnippets: ["planned tomorrow carefully"],
      },
    ],
    disclaimer: {
      title: "Reflection signal, not a medical measure",
      body: "Brightness and pulse reflect patterns in your writing.",
    },
  };

  const result = normalizeInsightsMindMap(payload);

  expect(result.status).toBe("ready");
  if (result.status !== "ready") {
    throw new Error("Expected ready mind map payload.");
  }
  expect(result.strongestRegionId).toBe("planning_self_control");
});

test("normalizeInsightsMindMap accepts building and support-first payloads", () => {
  const building = normalizeInsightsMindMap({
    status: "building",
    period: {
      range: "all_time",
      label: "All reflections",
      startDate: "2026-04-12",
      endDate: "2026-04-20",
      entryCount: 2,
      activeDays: 2,
      clearEntryCount: 1,
      totalWords: 44,
      minimumActiveDays: 4,
      generatedAt: null,
    },
    summary: {
      headline: "Your Mind Map is still building",
      narrative: "Journal.IO needs more clear writing before it can rank regions.",
      note: "Keep adding honest entries.",
    },
    progress: {
      activeDays: 2,
      minimumActiveDays: 4,
      clearEntryCount: 1,
      entriesNeeded: 2,
      daysRemaining: null,
    },
    disclaimer: {
      title: "Reflection signal, not a medical measure",
      body: "Brightness and pulse reflect patterns in your writing.",
    },
  });

  const supportFirst = normalizeInsightsMindMap({
    status: "support_first",
    period: {
      range: "latest_week",
      label: "Apr 12 - Apr 18",
      startDate: "2026-04-12",
      endDate: "2026-04-18",
      entryCount: 4,
      activeDays: 4,
      clearEntryCount: 0,
      totalWords: 0,
      minimumActiveDays: 4,
      generatedAt: "2026-04-20T10:00:00.000Z",
    },
    summary: {
      headline: "This week needs a support-first read",
      narrative: "Journal.IO noticed elevated-risk language in the week.",
      note: "Support-first handling takes priority over region ranking.",
    },
    support: {
      headline: "A calmer next step matters more than a ranked map right now.",
      body: "Please reach out to local emergency or crisis support now.",
      note: "Journal.IO hides normal scoring for safety-sensitive writing.",
    },
    disclaimer: {
      title: "Reflection signal, not a medical measure",
      body: "Brightness and pulse reflect patterns in your writing.",
    },
  });

  expect(building.status).toBe("building");
  expect(supportFirst.status).toBe("support_first");
});
