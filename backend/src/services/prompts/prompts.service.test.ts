import assert from "node:assert/strict";
import test from "node:test";
import type { InsightsOverviewResponse } from "../../types/insights.types";
import { buildWritingPromptsResponse } from "./prompts.service";

const buildOverview = (
  personalizedPrompts: InsightsOverviewResponse["analysis"]["personalizedPrompts"],
  totalEntries = 4
): InsightsOverviewResponse => ({
  stats: {
    totalEntries,
    currentStreak: 3,
    averageWords: 120,
    totalFavorites: 1,
  },
  activity7d: [],
  moodDistribution: [],
  popularTopics: [],
  analysis: {
    summary: "summary",
    keyInsight: "insight",
    growthPatterns: [],
    personalizedPrompts,
  },
  updatedAt: "2026-04-06T10:00:00.000Z",
});

test("buildWritingPromptsResponse returns a stable featured prompt for the same day", () => {
  const response = buildWritingPromptsResponse(
    buildOverview([
      { topic: "Reflection", text: "Prompt A" },
      { topic: "Mood", text: "Prompt B" },
      { topic: "Next Step", text: "Prompt C" },
    ]),
    new Date("2026-04-06T09:00:00.000Z")
  );

  assert.equal(response.prompts.length, 3);
  assert.equal(response.featuredPrompt.text, "Prompt C");
  assert.equal(response.source, "personalized");
});

test("buildWritingPromptsResponse preserves a default fallback prompt", () => {
  const response = buildWritingPromptsResponse(
    buildOverview(
      [{ topic: "Reflection", text: "What felt most steady or grounding in your day?" }],
      0
    ),
    new Date("2026-04-06T09:00:00.000Z")
  );

  assert.equal(response.prompts.length, 1);
  assert.equal(response.source, "default");
  assert.equal(response.featuredPrompt.topic, "Reflection");
});

test("buildWritingPromptsResponse can surface AI-generated prompt candidates without changing the response shape", () => {
  const response = buildWritingPromptsResponse(
    buildOverview([{ topic: "Reflection", text: "Prompt A" }], 5),
    new Date("2026-04-06T09:00:00.000Z"),
    [
      { topic: "Energy", text: "Where did your energy drop, and what happened right before it?" },
      { topic: "Support", text: "What helped you feel even slightly more supported this week?" },
      { topic: "Next Step", text: "What is one gentle next step that feels realistic tomorrow?" },
    ],
    "2026-04-06T09:00:00.000Z"
  );

  assert.equal(response.prompts.length, 3);
  assert.equal(response.source, "personalized");
  assert.equal(response.generatedAt, "2026-04-06T09:00:00.000Z");
  assert.equal(response.featuredPrompt.topic, "Next Step");
});
