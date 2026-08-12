import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { journalModel } from "../../schema/journal.schema";
import type { GuidedReflectionSessionAnalysisResponse } from "../guided-reflection/guided-reflection.service";
import {
  isStaleSessionAnalysisSnapshot,
  persistJournalSessionAnalysisSnapshot,
} from "./journalMetadata.service";

type QueryResult<T> = {
  exec: () => Promise<T>;
};

const journalTarget = journalModel as unknown as {
  findOneAndUpdate: (...args: unknown[]) => QueryResult<unknown>;
  findOne: (...args: unknown[]) => {
    select: () => {
      lean: () => QueryResult<unknown>;
    };
  };
};

const originalFindOneAndUpdate = journalTarget.findOneAndUpdate;
const originalFindOne = journalTarget.findOne;

const buildAnalysis = (
  label: string
): GuidedReflectionSessionAnalysisResponse =>
  ({
    analysis: `${label} analysis`,
    majorInsight: `${label} insight`,
    observedTrends: [label],
    detectedTopics: ["reflection"],
    detectedMood: "okay",
    brainSessionMap: {
      dominantCenterId: "self_reflection_identity",
      dominantCenter: {},
      secondaryCenterIds: [],
      secondaryCenters: [],
      centers: [],
      neuroscienceSummary: `${label} map`,
      mostNoticedText: `${label} signal`,
      mindMapSeedText: `${label} seed`,
    },
    hasEnoughSignal: true,
  } as unknown as GuidedReflectionSessionAnalysisResponse);

afterEach(() => {
  journalTarget.findOneAndUpdate = originalFindOneAndUpdate;
  journalTarget.findOne = originalFindOne;
});

test("persistJournalSessionAnalysisSnapshot returns the stored winner when another request writes first", async () => {
  const candidateAnalysis = buildAnalysis("candidate");
  const storedAnalysis = buildAnalysis("stored");
  let updateArguments: unknown[] = [];

  journalTarget.findOneAndUpdate = (...args) => ({
    exec: async () => {
      updateArguments = args;
      return null;
    },
  });
  journalTarget.findOne = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          sessionAnalysisSnapshot: { analysis: storedAnalysis },
        }),
      }),
    }),
  });

  const result = await persistJournalSessionAnalysisSnapshot({
    userId: "user-1",
    journalId: "journal-1",
    analysis: candidateAnalysis,
    source: "legacy_backfill",
  });

  assert.equal(result, storedAnalysis);
  assert.deepEqual(updateArguments[0], {
    _id: "journal-1",
    userId: "user-1",
    entryKind: { $ne: "quick_thought" },
    $or: [
      { sessionAnalysisSnapshot: null },
      { sessionAnalysisSnapshot: { $exists: false } },
    ],
  });

  const update = updateArguments[1] as {
    $set: {
      sessionAnalysisSnapshot: {
        analysis: GuidedReflectionSessionAnalysisResponse;
        source: string;
        version: number;
        generatedAt: Date;
      };
    };
  };
  assert.equal(update.$set.sessionAnalysisSnapshot.analysis, candidateAnalysis);
  assert.equal(update.$set.sessionAnalysisSnapshot.source, "legacy_backfill");
  assert.equal(update.$set.sessionAnalysisSnapshot.version, 2);
  assert.ok(update.$set.sessionAnalysisSnapshot.generatedAt instanceof Date);
});

test("persistJournalSessionAnalysisSnapshot keeps the write-once guard by default", async () => {
  let updateArguments: unknown[] = [];

  journalTarget.findOneAndUpdate = (...args) => ({
    exec: async () => {
      updateArguments = args;
      return null;
    },
  });
  journalTarget.findOne = () => ({
    select: () => ({
      lean: () => ({ exec: async () => null }),
    }),
  });

  await persistJournalSessionAnalysisSnapshot({
    userId: "user-1",
    journalId: "journal-1",
    analysis: buildAnalysis("candidate"),
    source: "open_ended",
  });

  assert.deepEqual((updateArguments[0] as Record<string, unknown>).$or, [
    { sessionAnalysisSnapshot: null },
    { sessionAnalysisSnapshot: { $exists: false } },
  ]);
});

test("persistJournalSessionAnalysisSnapshot drops the guard when replacing a stale snapshot", async () => {
  let updateArguments: unknown[] = [];

  journalTarget.findOneAndUpdate = (...args) => ({
    exec: async () => {
      updateArguments = args;
      return null;
    },
  });
  journalTarget.findOne = () => ({
    select: () => ({
      lean: () => ({ exec: async () => null }),
    }),
  });

  await persistJournalSessionAnalysisSnapshot({
    userId: "user-1",
    journalId: "journal-1",
    analysis: buildAnalysis("candidate"),
    source: "open_ended",
    replaceExisting: true,
  });

  const filter = updateArguments[0] as Record<string, unknown>;

  assert.equal(filter.$or, undefined);
  assert.equal(filter._id, "journal-1");
  assert.deepEqual(filter.entryKind, { $ne: "quick_thought" });
});

test("isStaleSessionAnalysisSnapshot only regenerates fallbacks and the broken open-ended copy", () => {
  const fresh = buildAnalysis("fresh");
  const fallback = { ...buildAnalysis("fallback"), isFallback: true };
  const legacyBroken = {
    ...buildAnalysis("legacy"),
    analysis:
      "The clearest unresolved signal is one harder moment, and it deserves slightly more attention than the steadier moment.",
  } as GuidedReflectionSessionAnalysisResponse;

  delete (legacyBroken as { isFallback?: boolean }).isFallback;

  assert.equal(isStaleSessionAnalysisSnapshot(null), false);
  assert.equal(isStaleSessionAnalysisSnapshot({ analysis: fresh }), false);
  assert.equal(isStaleSessionAnalysisSnapshot({ analysis: fallback }), true);
  // Legacy snapshots predate `isFallback`, so a good one must be left alone
  // while the known-broken open-ended text is regenerated.
  assert.equal(isStaleSessionAnalysisSnapshot({ analysis: legacyBroken }), true);
});
