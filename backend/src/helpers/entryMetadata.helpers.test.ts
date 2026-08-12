import assert from "node:assert/strict";
import test from "node:test";
import {
  detectEntryMetadataHeuristically,
  normalizeDetectedTopics,
} from "./entryMetadata.helpers";

test("detectEntryMetadataHeuristically finds genuine emotional and action topics", () => {
  const metadata = detectEntryMetadataHeuristically(
    "I felt anxious before my work deadline, but a good calm walk helped me focus on one goal."
  );

  assert.deepEqual(metadata.detectedTopics, [
    "work",
    "anxiety",
    "calm",
    "fitness",
    "focus",
  ]);
  assert.equal(metadata.detectedMood, "good");
});

test("detectEntryMetadataHeuristically does not classify keyword substrings as topics", () => {
  const metadata = detectEntryMetadataHeuristically(
    "I started the day with a great conversation."
  );

  assert.equal(metadata.detectedTopics.includes("creativity"), false);
  assert.equal(metadata.detectedTopics.includes("nutrition"), false);
});

test("normalizeDetectedTopics removes unknown and duplicate topics", () => {
  assert.deepEqual(
    normalizeDetectedTopics([
      "Focus",
      "unknown-topic",
      "focus",
      "Relationships",
      "Sleep",
      "Calm",
      "Work",
      "Joy",
    ]),
    ["focus", "relationships", "sleep", "calm", "work"]
  );
});
