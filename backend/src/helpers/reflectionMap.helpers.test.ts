import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReflectionRegionScore,
  extractReflectionEvidenceSnippets,
  getOverallReflectionTier,
  getReflectionRegionTier,
  getReflectionRegionTierLabel,
  mindMapActionStepsSchema,
  REFLECTION_REGION_BASELINE,
  REFLECTION_REGION_PLAIN_MEANING,
  REFLECTION_REGION_IDS,
  type ReflectionRegionTier,
} from "./reflectionMap.helpers";
import { extractJournalAuthorship } from "./journalAuthorship.helpers";

test("getReflectionRegionTier bands a region against its baseline thresholds", () => {
  const id = "emotional_intensity";
  const baseline = REFLECTION_REGION_BASELINE[id];

  assert.equal(getReflectionRegionTier(id, baseline.balanced - 0.01), "low");
  assert.equal(getReflectionRegionTier(id, baseline.balanced), "balanced");
  assert.equal(getReflectionRegionTier(id, baseline.high), "high");
  assert.equal(getReflectionRegionTier(id, baseline.veryHigh), "very_high");
  assert.equal(getReflectionRegionTier(id, 1), "very_high");
});

test("getReflectionRegionTier treats non-finite signals as low", () => {
  assert.equal(getReflectionRegionTier("memory_meaning", Number.NaN), "low");
});

test("getReflectionRegionTierLabel returns readable band labels", () => {
  assert.equal(getReflectionRegionTierLabel("low"), "Low");
  assert.equal(getReflectionRegionTierLabel("balanced"), "Balanced");
  assert.equal(getReflectionRegionTierLabel("high"), "High");
  assert.equal(getReflectionRegionTierLabel("very_high"), "Very High");
});

const tiers = (...values: ReflectionRegionTier[]): ReflectionRegionTier[] => {
  const filled = [...values];
  while (filled.length < REFLECTION_REGION_IDS.length) {
    filled.push("low");
  }
  return filled;
};

test("getOverallReflectionTier returns emerging when nothing is engaged", () => {
  assert.equal(getOverallReflectionTier(tiers()).tier, "emerging");
});

test("getOverallReflectionTier returns balanced with a few engaged regions", () => {
  assert.equal(
    getOverallReflectionTier(tiers("balanced", "balanced", "balanced")).tier,
    "balanced"
  );
});

test("getOverallReflectionTier returns deeply_reflective with two strong regions", () => {
  assert.equal(
    getOverallReflectionTier(tiers("high", "high")).tier,
    "deeply_reflective"
  );
});

test("getOverallReflectionTier returns highly_attuned when broad and deep", () => {
  assert.equal(
    getOverallReflectionTier(
      tiers("very_high", "high", "high", "balanced", "balanced", "balanced")
    ).tier,
    "highly_attuned"
  );
});


// --- Personalised region copy ------------------------------------------------

test("mindMapActionSteps accepts personalised noticed copy and rejects overlong", () => {
  const ok = mindMapActionStepsSchema.safeParse({
    steps: [
      {
        regionId: "relationships_perspective",
        noticed:
          "You cancelled on her four times in three weeks and logged it as her being upset rather than something to fix. That withdrawal is what keeps this signal at the top.",
        actionStep: "Send one specific plan today with a time and a place.",
      },
    ],
  });
  assert.equal(ok.success, true);

  const tooLong = mindMapActionStepsSchema.safeParse({
    steps: [
      {
        regionId: "relationships_perspective",
        noticed: "x".repeat(261),
        actionStep: "Send one message today.",
      },
    ],
  });
  assert.equal(tooLong.success, false);

  // `noticed` is required: a response missing it must fail the parse rather
  // than silently shipping the generic template as if it were personalised.
  const missing = mindMapActionStepsSchema.safeParse({
    steps: [
      {
        regionId: "relationships_perspective",
        actionStep: "Send one message today.",
      },
    ],
  });
  assert.equal(missing.success, false);
});

test("buildReflectionRegionScore prefers supplied copy and falls back when blank", () => {
  const base = {
    id: "relationships_perspective" as const,
    score: 0.9,
    confidence: 0.8,
    rank: 1,
    evidence: ["cancelled on her again"],
    userWriting: "cancelled on her again, she was fine about it",
  };

  const personalised = buildReflectionRegionScore({
    ...base,
    shortInsight: "You went quiet on her for most of that fortnight.",
  });
  assert.equal(
    personalised.shortInsight,
    "You went quiet on her for most of that fortnight."
  );

  // Blank and absent both have to reach the deterministic sentence — free users
  // and failed AI calls still need a valid sheet.
  for (const value of ["", "   ", undefined]) {
    const fallback = buildReflectionRegionScore({ ...base, shortInsight: value });
    assert.match(fallback.shortInsight, /This region stood out through/);
  }
});

test("Mind Map evidence is drawn from the user's words, not the app's questions", () => {
  // The exact shape a guided entry is stored in. Both the section headers and
  // the "Journal.IO reflection:" body are app-authored, and reading them as the
  // user's writing is what produced evidence chips like "One good or".
  const content = [
    "One good or exciting thing from today:",
    "shipped the feature early",
    "",
    "One hurdle or stressful moment:",
    "cancelled on her again, she was fine about it",
    "",
    "What I want to carry into tomorrow:",
    "making it up to her this weekend",
    "",
    "Journal.IO reflection:",
    "Shipping the feature early shows real follow-through, yet the relationship plan may be getting squeezed.",
  ].join("\n");

  const { userText } = extractJournalAuthorship({
    content,
    type: "guided",
    aiPrompt: null,
    appAuthoredSegments: [],
  });

  assert.doesNotMatch(userText, /One good or exciting thing from today/);
  assert.doesNotMatch(userText, /Journal\.IO reflection/);
  assert.doesNotMatch(userText, /shows real follow-through/);
  assert.match(userText, /cancelled on her again/);

  for (const regionId of REFLECTION_REGION_IDS) {
    for (const snippet of extractReflectionEvidenceSnippets(userText, regionId, 3)) {
      assert.doesNotMatch(
        snippet,
        /One good or|What I want to carry|Journal\.IO/,
        `evidence must never quote app-authored text, got "${snippet}"`
      );
    }
  }
});


test("every region has a plain-words meaning the Mind Map copy can explain", () => {
  // The prompt uses this to say WHY an area lit up. A region without one leaves
  // the model nothing but the formal label to paraphrase, which is the generic
  // sentence this copy exists to replace — so a new region must not ship
  // without a line here.
  for (const id of REFLECTION_REGION_IDS) {
    const meaning = REFLECTION_REGION_PLAIN_MEANING[id];
    assert.ok(meaning && meaning.trim().length > 20, `${id} needs a plain meaning`);
    // Plain words only: this string is read out to the user's own vocabulary.
    assert.doesNotMatch(
      meaning,
      /cortex|amygdala|hippocampus|insula|striatum|junction|default mode/i,
      `${id} plain meaning must not contain anatomy`
    );
  }

  assert.equal(
    Object.keys(REFLECTION_REGION_PLAIN_MEANING).length,
    REFLECTION_REGION_IDS.length
  );
});
