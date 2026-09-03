import {
  normalizeDetectedTopics,
  type DetectedMood,
} from "../../helpers/entryMetadata.helpers";
import { decryptLeanFields } from "../../helpers/fieldEncryption.schema.helpers";
import {
  journalModel,
  type JournalSessionAnalysisSource,
} from "../../schema/journal.schema";
import type { GuidedReflectionSessionAnalysisResponse } from "../guided-reflection/guided-reflection.service";
import { syncJournalUpdatedInsights } from "../insights/insights.service";
import { ingestSessionTriggersIntoGraph } from "../mindmap/patternGraph.service";

/**
 * Bumped from 1 when fallback snapshots became replaceable, and from 2 when the
 * analysis became a third-person report of triggers and patterns, so a stored
 * snapshot's provenance is readable without inspecting its analysis body.
 */
const SESSION_ANALYSIS_SNAPSHOT_VERSION = 3;

const persistJournalDetectedMetadata = async ({
  userId,
  journalId,
  detectedTopics,
  detectedMood,
}: {
  userId: string;
  journalId: string;
  detectedTopics: string[];
  detectedMood: DetectedMood;
}) => {
  const journal = await journalModel.findOne({ _id: journalId, userId }).exec();

  if (!journal) {
    return false;
  }

  const previousTags = [
    ...(journal.tags || []),
    ...(journal.detectedTopics || []),
  ];
  journal.detectedTopics = normalizeDetectedTopics(detectedTopics);
  journal.detectedMood = detectedMood;
  await journal.save();

  try {
    await syncJournalUpdatedInsights({
      previousJournal: {
        userId,
        content: journal.content,
        tags: previousTags,
        isFavorite: Boolean(journal.isFavorite),
        createdAt: journal.createdAt,
      },
      nextJournal: {
        userId,
        content: journal.content,
        tags: [...(journal.tags || []), ...journal.detectedTopics],
        isFavorite: Boolean(journal.isFavorite),
        createdAt: journal.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to sync detected topics into insights:", error);
  }

  return true;
};

const getJournalSessionAnalysisSnapshot = async ({
  userId,
  journalId,
}: {
  userId: string;
  journalId: string;
}) => {
  const journal = await journalModel
    .findOne({ _id: journalId, userId })
    .select("sessionAnalysisSnapshot")
    .lean()
    .exec();

  const snapshot = journal?.sessionAnalysisSnapshot;

  if (!snapshot) {
    return null;
  }

  // `.lean()` skips the schema getters, so the analysis blob is still
  // ciphertext here. It is encrypted on the subdocument schema, so `analysis`
  // is the path sealed into its AAD — decrypting it as
  // `sessionAnalysisSnapshot.analysis` would fail the auth-tag check.
  const decrypted = decryptLeanFields(snapshot as Record<string, unknown>, [
    { encryptedPath: "analysis" },
  ]);

  return (
    (decrypted.analysis as GuidedReflectionSessionAnalysisResponse | null) ||
    null
  );
};

/**
 * Opening of the guided fallback copy produced when none of the three guided
 * question ids resolve — the exact shape open-ended entries used to be given.
 * Legacy snapshots predate `isFallback`, so this is how they are recognised.
 */
const STALE_OPEN_ENDED_FALLBACK_PREFIX =
  "The clearest unresolved signal is one harder moment";

/**
 * True when a stored snapshot should be regenerated rather than replayed:
 * either it is explicitly marked as a fallback, or it is a legacy snapshot
 * carrying the known-broken open-ended fallback text. Good legacy analyses are
 * deliberately left alone so re-reading an old entry does not rewrite it.
 */
const isStaleSessionAnalysisSnapshot = (
  snapshot?: { analysis?: GuidedReflectionSessionAnalysisResponse } | null
) => {
  const analysis = snapshot?.analysis;

  if (!analysis) {
    return false;
  }

  if (analysis.isFallback === true) {
    return true;
  }

  // Pre-v3 snapshots were written in second person and reported no triggers.
  // The version number is not carried this far down (callers pass the analysis
  // body alone), but the absence of `triggersObserved` is itself the marker —
  // a v3 analysis always sets it, to `[]` when it genuinely found none.
  if (analysis.triggersObserved === undefined) {
    return true;
  }

  return (
    analysis.isFallback === undefined &&
    typeof analysis.analysis === "string" &&
    analysis.analysis.startsWith(STALE_OPEN_ENDED_FALLBACK_PREFIX)
  );
};

const persistJournalSessionAnalysisSnapshot = async ({
  userId,
  journalId,
  analysis,
  source,
  replaceExisting = false,
}: {
  userId: string;
  journalId: string;
  analysis: GuidedReflectionSessionAnalysisResponse;
  source: JournalSessionAnalysisSource;
  /**
   * Set by callers that already established the stored snapshot is stale.
   * Without it snapshots stay write-once, so concurrent first-time generations
   * still resolve to a single winner.
   */
  replaceExisting?: boolean;
}) => {
  const journal = await journalModel
    .findOneAndUpdate(
      {
        _id: journalId,
        userId,
        entryKind: { $ne: "quick_thought" },
        ...(replaceExisting
          ? {}
          : {
              $or: [
                { sessionAnalysisSnapshot: null },
                { sessionAnalysisSnapshot: { $exists: false } },
              ],
            }),
      },
      {
        $set: {
          detectedTopics: normalizeDetectedTopics(analysis.detectedTopics),
          detectedMood: analysis.detectedMood,
          sessionAnalysisSnapshot: {
            analysis,
            source,
            version: SESSION_ANALYSIS_SNAPSHOT_VERSION,
            generatedAt: new Date(),
          },
        },
      },
      { new: true }
    )
    .exec();

  if (journal?.sessionAnalysisSnapshot?.analysis) {
    await persistJournalDetectedMetadata({
      userId,
      journalId,
      detectedTopics: journal.sessionAnalysisSnapshot.analysis.detectedTopics,
      detectedMood: journal.sessionAnalysisSnapshot.analysis.detectedMood,
    });

    // Fire-and-forget, like every other graph write: this is what turns a
    // trigger observed once into one observed twice, but the user is waiting on
    // the analysis and must never wait on the graph.
    void ingestSessionTriggersIntoGraph({
      userId,
      journalId,
      triggers: journal.sessionAnalysisSnapshot.analysis.triggersObserved || [],
      observedAt: journal.createdAt || new Date(),
    });

    return journal.sessionAnalysisSnapshot.analysis;
  }

  return getJournalSessionAnalysisSnapshot({ userId, journalId });
};

export {
  getJournalSessionAnalysisSnapshot,
  isStaleSessionAnalysisSnapshot,
  persistJournalDetectedMetadata,
  persistJournalSessionAnalysisSnapshot,
};
