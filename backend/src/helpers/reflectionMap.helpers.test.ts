import assert from "node:assert/strict";
import test from "node:test";
import {
  getOverallReflectionTier,
  getReflectionRegionTier,
  getReflectionRegionTierLabel,
  REFLECTION_REGION_BASELINE,
  REFLECTION_REGION_IDS,
  type ReflectionRegionTier,
} from "./reflectionMap.helpers";

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
