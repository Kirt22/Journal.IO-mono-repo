/**
 * @format
 */

import {
  normalizeInsightsMindMap,
  normalizeMindMapEntry,
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
    patterns: [
      {
        id: "protects-morning-focus",
        label: "Protects morning focus",
        rationale: "You repeatedly plan to guard your mornings for deep work.",
        evidenceQuote: "I need to protect my morning better",
        occurrences: 3,
        confidence: 0.8,
      },
    ],
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
        actionStep: "Try noting one small next step before you close the app tonight.",
        evidenceSnippets: ["planned tomorrow carefully"],
        trend: "rising",
        trendLabel: "Planning & Self-Control has been showing up more in your recent writing.",
        tier: "very_high",
        tierLabel: "Very High",
      },
    ],
    focus: {
      headline: "What to focus on",
      body: "You often write toward what's next.",
      regionId: "planning_self_control",
    },
    overallTier: {
      tier: "deeply_reflective",
      label: "Deeply Reflective",
      blurb: "You go deeper than most journalers in a few areas.",
    },
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
  expect(result.regions[0]?.trend).toBe("rising");
  expect(result.regions[0]?.tier).toBe("very_high");
  expect(result.regions[0]?.tierLabel).toBe("Very High");
  expect(result.overallTier.label).toBe("Deeply Reflective");
  expect(result.focus?.regionId).toBe("planning_self_control");
  expect(result.patterns).toHaveLength(1);
  expect(result.patterns[0]?.label).toBe("Protects morning focus");
  expect(result.patterns[0]?.occurrences).toBe(3);
});

test("normalizeInsightsMindMap backfills a steady trend when missing", () => {
  const result = normalizeInsightsMindMap({
    status: "ready",
    period: {
      range: "all_time",
      label: "All reflections",
      startDate: "2026-04-01",
      endDate: "2026-04-20",
      entryCount: 6,
      activeDays: 5,
      clearEntryCount: 5,
      totalWords: 300,
      minimumActiveDays: 4,
      generatedAt: "2026-04-20T10:00:00.000Z",
    },
    summary: {
      headline: "Memory & Meaning carried the strongest reflection signal",
      narrative: "Your writing kept returning to memory patterns.",
      note: "Brightness reflects patterns in your writing.",
    },
    strongestRegionId: "memory_meaning",
    regions: [
      {
        id: "memory_meaning",
        productLabel: "Memory & Meaning",
        brainRegionSubtitle: "Hippocampus",
        signalScore: 0.9,
        confidence: 0.7,
        rank: 1,
        intensity: "high",
        shortInsight: "Memory patterns stood out.",
        evidenceSnippets: [],
      },
    ],
    disclaimer: {
      title: "Reflection signal, not a medical measure",
      body: "Brightness and pulse reflect patterns in your writing.",
    },
  });

  if (result.status !== "ready") {
    throw new Error("Expected ready mind map payload.");
  }
  expect(result.regions[0]?.trend).toBe("steady");
  expect(typeof result.regions[0]?.trendLabel).toBe("string");
  // Tier + overall-tier absent in the payload backfill to neutral defaults.
  expect(result.regions[0]?.tier).toBe("low");
  expect(result.regions[0]?.tierLabel).toBe("Low");
  expect(result.overallTier.tier).toBe("emerging");
  // Patterns absent in the payload backfill to an empty list.
  expect(result.patterns).toEqual([]);
});

test("normalizeInsightsMindMap accepts a monthly-range payload", () => {
  const result = normalizeInsightsMindMap({
    status: "ready",
    period: {
      range: "monthly",
      label: "The last 30 days",
      startDate: "2026-03-22",
      endDate: "2026-04-20",
      entryCount: 12,
      activeDays: 9,
      clearEntryCount: 10,
      totalWords: 640,
      minimumActiveDays: 4,
      generatedAt: "2026-04-20T10:00:00.000Z",
    },
    summary: {
      headline: "Self-Reflection & Identity carried the strongest reflection signal",
      narrative: "Across the last 30 days your writing returned to identity themes.",
      note: "Brightness reflects patterns in your writing.",
    },
    strongestRegionId: "self_reflection_identity",
    patterns: [
      {
        id: "uses-fitness-to-cope",
        label: "Uses fitness to cope",
        rationale: "You turn to workouts when stress rises.",
        evidenceQuote: "the gym is the only place I feel clear",
        occurrences: 4,
        confidence: 0.72,
      },
    ],
    regions: [
      {
        id: "self_reflection_identity",
        productLabel: "Self-Reflection & Identity",
        brainRegionSubtitle: "Default Mode Network",
        signalScore: 0.85,
        confidence: 0.7,
        rank: 1,
        intensity: "high",
        shortInsight: "Identity themes stood out.",
        evidenceSnippets: [],
        trend: "steady",
        trendLabel: "Self-Reflection & Identity has stayed steady in your recent writing.",
      },
    ],
    disclaimer: {
      title: "Reflection signal, not a medical measure",
      body: "Brightness and pulse reflect patterns in your writing.",
    },
  });

  if (result.status !== "ready") {
    throw new Error("Expected ready mind map payload.");
  }
  expect(result.period.range).toBe("monthly");
  expect(result.patterns[0]?.label).toBe("Uses fitness to cope");
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

test("normalizeMindMapEntry accepts a ready per-entry payload", () => {
  const entry = normalizeMindMapEntry({
    status: "ready",
    journalId: "journal-1",
    entryType: "open_ended",
    source: "heuristic",
    refining: true,
    strongestRegionId: "emotional_intensity",
    patterns: [
      {
        id: "overwhelm-under-deadlines",
        label: "Overwhelm under deadlines",
        rationale: "Pressure spikes when work stacks up.",
        evidenceQuote: "felt overwhelmed by everything due",
        confidence: 0.6,
      },
    ],
    regions: [
      {
        id: "emotional_intensity",
        productLabel: "Emotional Intensity",
        brainRegionSubtitle: "Amygdala",
        signalScore: 0.8,
        confidence: 0.6,
        rank: 1,
        intensity: "high",
        shortInsight: "This entry carried emotional charge.",
        evidenceSnippets: ["felt overwhelmed"],
      },
    ],
    summary: {
      headline: "Emotional Intensity carried the strongest signal in this entry",
      narrative: "This entry leaned into emotional intensity.",
      seedText: "This reflection has added its signal to your Mind Map.",
    },
    disclaimer: {
      title: "Reflection signal only",
      body: "This map reflects patterns in your writing.",
    },
  });

  expect(entry.status).toBe("ready");
  if (entry.status !== "ready") {
    throw new Error("Expected ready entry map.");
  }
  expect(entry.refining).toBe(true);
  expect(entry.strongestRegionId).toBe("emotional_intensity");
  expect(entry.patterns).toHaveLength(1);
  expect(entry.patterns[0]?.label).toBe("Overwhelm under deadlines");
  // Tier fields backfill to neutral defaults when the payload omits them.
  expect(entry.regions[0]?.tier).toBe("low");
  expect(entry.regions[0]?.tierLabel).toBe("Low");
  expect(entry.overallTier.tier).toBe("emerging");
});

test("normalizeMindMapEntry passes through a support-first per-entry payload", () => {
  const entry = normalizeMindMapEntry({
    status: "support_first",
    journalId: "journal-2",
    entryType: "guided",
    support: {
      headline: "This entry is handled support-first.",
      body: "Please reach out to local crisis support now.",
      note: "Support-first handling takes priority.",
    },
    disclaimer: {
      title: "Reflection signal only",
      body: "This map reflects patterns in your writing.",
    },
  });

  expect(entry.status).toBe("support_first");
});
