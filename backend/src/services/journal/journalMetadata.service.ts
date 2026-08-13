import {
  normalizeDetectedTopics,
  type DetectedMood,
} from "../../helpers/entryMetadata.helpers";
import {
  journalModel,
  type JournalSessionAnalysisSource,
} from "../../schema/journal.schema";
import type { GuidedReflectionSessionAnalysisResponse } from "../guided-reflection/guided-reflection.service";
import { syncJournalUpdatedInsights } from "../insights/insights.service";

/**
 * Bumped from 1 when fallback snapshots became replaceable, so a stored
 * snapshot's provenance is readable without inspecting its analysis body.
 */
const SESSION_ANALYSIS_SNAPSHOT_VERSION = 2;

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

  return journal?.sessionAnalysisSnapshot?.analysis || null;
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
