import {
  mindMapEntryScoreModel,
  type MindMapEntryRegionScore,
} from "../../schema/mindMapEntryScore.schema";
import { journalModel } from "../../schema/journal.schema";
import {
  canUseOpenAiForUser,
  getOpenAiEmbeddingModel,
  getOpenAiModel,
  requestEmbedding,
  requestStructuredOpenAi,
} from "../../helpers/openai.helpers";
import { ensureAiAnalysisEnabled } from "../../helpers/aiAccess.helpers";
import { analyzeJournalTextQuality } from "../../helpers/journalTextQuality.helpers";
import {
  detectJournalSafetySignal,
  hasJournalSafetySignal,
  type JournalSafetySignal,
} from "../../helpers/journalSafety.helpers";
import { AI_EXTRACTION_BALANCE_GUIDANCE } from "../../helpers/aiReflectionBalance.helpers";
import {
  buildReflectionRegionScore,
  buildHeuristicEntryContextSummary,
  buildHeuristicEntryEmotionalTone,
  buildHeuristicEntryThemes,
  extractReflectionEvidenceSnippets,
  getOverallReflectionTier,
  getReflectionRegionKeywordScore,
  getReflectionRegionTier,
  getReflectionRegionTierLabel,
  getReflectionRegionTrend,
  getReflectionRegionTrendLabel,
  rankReflectionRegionScores,
  sanitizeReflectionEvidence,
  entryInsightExtractionJsonSchema,
  entryInsightExtractionSchema,
  REFLECTION_REGION_DETAILS,
  REFLECTION_REGION_FOCUS_TIPS,
  REFLECTION_REGION_IDS,
  type EntryInsightExtraction,
  type ReflectionRegionId,
  type ReflectionRegionScore,
  type ReflectionRegionTrend,
} from "../../helpers/reflectionMap.helpers";
import {
  normalizeEntryThemes,
  persistEntryInsight,
  updateEntryInsightAi,
  deleteEntryInsight,
  loadEntryInsights,
  aggregateRecurringPatterns,
} from "./entryInsight.service";
import { updateUserMemory } from "./userMemory.service";
import {
  removeJournalFromPatternGraph,
  updatePatternGraph,
} from "./patternGraph.service";
import { entryInsightModel } from "../../schema/entryInsight.schema";
import type {
  MindMapEntryPattern,
  MindMapEntryRegion,
  MindMapEntryResponse,
  MindMapEntrySupportFirstResponse,
} from "../../types/mindmap.types";

// Bump to invalidate every persisted score + the global Mind Map caches.
// v3: per-entry insight extraction (context summary + therapist-style themes).
// v4: reflection tier bands on aggregate + per-entry responses.
export const MIND_MAP_SCORER_VERSION = "4";

const MIN_AI_TEXT_LENGTH = 24;
const CLEAR_MIN_WORDS = 4;
const MIND_MAP_ENTRY_MODEL = () =>
  process.env.OPENAI_MINDMAP_ENTRY_MODEL?.trim() || getOpenAiModel();

const MIND_MAP_ENTRY_DISCLAIMER = {
  title: "Reflection signal only",
  body: "This map reflects patterns in your writing, not a medical or brain-activity measurement.",
};

const REGION_REFERENCE = REFLECTION_REGION_IDS.map(
  (id) =>
    `- ${id} — ${REFLECTION_REGION_DETAILS[id].productName} (${REFLECTION_REGION_DETAILS[id].brainRegion})`
).join("\n");

type EntryTextAnalysis = {
  sourceText: string;
  analysisText: string;
  analysisWordCount: number;
  lowSignalDetected: boolean;
  safetySignal: JournalSafetySignal;
  isSafe: boolean;
  isClear: boolean;
};

const analyzeEntryText = (
  content: string,
  aiPrompt?: string | null
): EntryTextAnalysis => {
  const quality = analyzeJournalTextQuality({
    content,
    aiPrompt: aiPrompt ?? null,
  });
  const sourceText = quality.strippedText.trim() || content.trim();
  const safetySignal = detectJournalSafetySignal(
    quality.analysisText || content || ""
  );
  const isSafe = !hasJournalSafetySignal(safetySignal);
  const isClear =
    !quality.lowSignalDetected &&
    isSafe &&
    quality.analysisWordCount >= CLEAR_MIN_WORDS &&
    Boolean(sourceText.trim());

  return {
    sourceText,
    analysisText: quality.analysisText,
    analysisWordCount: quality.analysisWordCount,
    lowSignalDetected: quality.lowSignalDetected,
    safetySignal,
    isSafe,
    isClear,
  };
};

const buildHeuristicRegionScores = (
  sourceText: string,
  tags: string[]
): ReflectionRegionScore[] => {
  const scoredText = `${sourceText} ${tags.join(" ")}`.trim();
  const rawById = new Map<ReflectionRegionId, number>();
  let highestRaw = 0;

  for (const id of REFLECTION_REGION_IDS) {
    const raw = getReflectionRegionKeywordScore(id, scoredText);
    rawById.set(id, raw);
    highestRaw = Math.max(highestRaw, raw);
  }

  const regions = REFLECTION_REGION_IDS.map((id, index) => {
    const raw = rawById.get(id) || 0;
    const normalizedScore =
      highestRaw > 0
        ? Math.min(1, Number((raw / highestRaw).toFixed(2)))
        : REFLECTION_REGION_DETAILS[id].lowSignalScore;
    const evidence = extractReflectionEvidenceSnippets(sourceText, id, 3);
    const confidence = Math.min(
      0.9,
      0.44 + normalizedScore * 0.3 + Math.min(0.16, evidence.length * 0.07)
    );

    return buildReflectionRegionScore({
      id,
      score: normalizedScore,
      confidence,
      rank: index + 1,
      evidence,
      userWriting: sourceText,
    });
  });

  return rankReflectionRegionScores(regions);
};

const buildAiRegionScores = (
  ai: EntryInsightExtraction,
  sourceText: string,
  tags: string[]
): ReflectionRegionScore[] => {
  const heuristicById = new Map(
    buildHeuristicRegionScores(sourceText, tags).map((region) => [
      region.id,
      region,
    ])
  );
  const aiById = new Map(ai.regions.map((region) => [region.id, region]));

  const regions = REFLECTION_REGION_IDS.map((id, index) => {
    const aiRegion = aiById.get(id);
    const fallback = heuristicById.get(id);
    const aiEvidence = aiRegion
      ? sanitizeReflectionEvidence(aiRegion.evidence, sourceText, 3)
      : [];
    const evidence = aiEvidence.length ? aiEvidence : fallback?.evidence ?? [];

    return buildReflectionRegionScore({
      id,
      score:
        aiRegion?.score ??
        fallback?.score ??
        REFLECTION_REGION_DETAILS[id].lowSignalScore,
      confidence: aiRegion?.confidence ?? fallback?.confidence ?? 0.5,
      rank: index + 1,
      evidence,
      userWriting: sourceText,
    });
  });

  return rankReflectionRegionScores(regions);
};

const requestEntryAiScores = async (userId: string, sourceText: string) => {
  if (!(await canUseOpenAiForUser(userId))) {
    return null;
  }

  return requestStructuredOpenAi<EntryInsightExtraction>({
    feature: "mind map entry insight",
    schemaName: "entry_insight_extraction",
    schema: entryInsightExtractionJsonSchema,
    parser: entryInsightExtractionSchema,
    model: MIND_MAP_ENTRY_MODEL(),
    maxOutputTokens: 900,
    messages: [
      {
        role: "system",
        content:
          "You read a single Journal.IO entry with the depth of a skilled therapist and return a structured insight. " +
          "Part 1 — score eight reflection regions: a 0-1 signal for how present each theme is, a 0-1 confidence, " +
          "and up to three short evidence phrases quoted only from the user's own words. " +
          "Part 2 — write a one-sentence contextSummary of what this entry is really about (for long-term memory), " +
          "a short emotionalTone, and 0-4 themes. A theme is a recurring behavioural or emotional dynamic a thoughtful " +
          "therapist would name directly. Whenever the entry shows it, frame a theme as a behaviour tied to its " +
          "trigger or the feeling it regulates — the behaviour AND what sets it off or what it soothes — because that " +
          "link is what the user most often cannot see themselves (e.g. 'reaches for distraction when anxiety rises', " +
          "'seeks reassurance after conflict', 'uses fitness to steady a low mood'). Name the trigger or function " +
          "explicitly in the rationale. " +
          "For each theme give a label, a one-line rationale for why you concluded it (naming the trigger/function), " +
          "the exact user sentence that supports it as evidenceQuote, and a 0-1 confidence. " +
          "Be direct and genuinely insightful, but stay non-clinical and non-judgemental: name the pattern and its " +
          "cost or function, never label a behaviour as good or bad, never shame, and never name or imply a " +
          "medical/psychiatric condition or diagnosis, and never treat a region signal as a brain-activity measurement. " +
          AI_EXTRACTION_BALANCE_GUIDANCE +
          " " +
          "Return all eight regions and the id of the dominant one. Regions:\n" +
          REGION_REFERENCE,
      },
      {
        role: "user",
        content: JSON.stringify({ entry: sourceText.slice(0, 1600) }),
      },
    ],
  });
};

const toStoredRegionScores = (
  regions: ReflectionRegionScore[]
): MindMapEntryRegionScore[] => {
  const byId = new Map(regions.map((region) => [region.id, region]));

  return REFLECTION_REGION_IDS.map((id) => {
    const region = byId.get(id);

    return {
      id,
      score: region?.score ?? REFLECTION_REGION_DETAILS[id].lowSignalScore,
      confidence: region?.confidence ?? 0.5,
    };
  });
};

const regionsFromStored = (
  stored: MindMapEntryRegionScore[],
  sourceText: string
): ReflectionRegionScore[] => {
  const byId = new Map(stored.map((region) => [region.id, region]));

  const regions = REFLECTION_REGION_IDS.map((id, index) => {
    const region = byId.get(id);
    const evidence = extractReflectionEvidenceSnippets(sourceText, id, 3);

    return buildReflectionRegionScore({
      id,
      score: region?.score ?? REFLECTION_REGION_DETAILS[id].lowSignalScore,
      confidence: region?.confidence ?? 0.5,
      rank: index + 1,
      evidence,
      userWriting: sourceText,
    });
  });

  return rankReflectionRegionScores(regions);
};

const toEntryRegion = (region: ReflectionRegionScore): MindMapEntryRegion => {
  const tier = getReflectionRegionTier(region.id, region.score);

  return {
    id: region.id,
    productLabel: region.productName,
    brainRegionSubtitle: region.brainRegion,
    signalScore: region.score,
    confidence: region.confidence,
    rank: region.rank,
    intensity: region.intensity,
    shortInsight: region.shortInsight,
    evidenceSnippets: region.evidence,
    tier,
    tierLabel: getReflectionRegionTierLabel(tier),
  };
};

const buildEntrySupportFirst = (
  journalId: string,
  entryType: "open_ended" | "guided"
): MindMapEntrySupportFirstResponse => ({
  status: "support_first",
  journalId,
  entryType,
  support: {
    headline: "This entry is handled support-first.",
    body: "If your writing reflects immediate risk or feeling unsafe, please reach out to local emergency or crisis support now.",
    note: "Support-first handling takes priority over mapping reflection regions for this entry.",
  },
  disclaimer: MIND_MAP_ENTRY_DISCLAIMER,
});

const buildEntryReadyResponse = ({
  journalId,
  entryType,
  ranked,
  source,
  patterns,
}: {
  journalId: string;
  entryType: "open_ended" | "guided";
  ranked: ReflectionRegionScore[];
  source: "ai" | "heuristic";
  patterns: MindMapEntryPattern[];
}): MindMapEntryResponse => {
  const strongest = ranked[0] as ReflectionRegionScore;
  const regions = ranked.map(toEntryRegion);
  const overallTier = getOverallReflectionTier(
    regions.map((region) => region.tier)
  );

  return {
    status: "ready",
    journalId,
    entryType,
    source,
    refining: source !== "ai",
    strongestRegionId: strongest.id,
    patterns,
    regions,
    overallTier,
    summary: {
      headline: `${strongest.productName} carried the strongest signal in this entry`,
      narrative: `This entry leaned most into ${strongest.productName.toLowerCase()} patterns. Every region still adds to your Mind Map as you keep writing.`,
      seedText: "This reflection has added its signal to your Mind Map.",
    },
    disclaimer: MIND_MAP_ENTRY_DISCLAIMER,
  };
};

type PersistEntryScoreInput = {
  userId: string;
  journalId: string;
  entryType: "open_ended" | "guided";
  content: string;
  aiPrompt?: string | null;
  tags: string[];
  isFavorite: boolean;
  entryCreatedAt: Date;
};

/**
 * Synchronous, deterministic heuristic score written at save time so a
 * per-entry Mind Map is instantly available. Never throws for AI reasons.
 */
export const persistEntryScore = async (
  input: PersistEntryScoreInput
): Promise<void> => {
  const analysis = analyzeEntryText(input.content, input.aiPrompt);
  const ranked = buildHeuristicRegionScores(analysis.sourceText, input.tags);
  const dominantRegionId = ranked[0]?.id ?? "self_reflection_identity";

  await mindMapEntryScoreModel.updateOne(
    { journalId: input.journalId },
    {
      $set: {
        userId: input.userId,
        journalId: input.journalId,
        entryType: input.entryType,
        regionScores: toStoredRegionScores(ranked),
        dominantRegionId,
        isFavorite: input.isFavorite,
        clear: analysis.isClear,
        source: "heuristic",
        scorerVersion: MIND_MAP_SCORER_VERSION,
        aiModel: null,
        entryCreatedAt: input.entryCreatedAt,
        computedAt: new Date(),
      },
    },
    { upsert: true }
  );

  await persistEntryInsight({
    userId: input.userId,
    journalId: input.journalId,
    entryType: input.entryType,
    contextSummary: buildHeuristicEntryContextSummary(ranked),
    emotionalTone: buildHeuristicEntryEmotionalTone(ranked),
    themes: normalizeEntryThemes(buildHeuristicEntryThemes(ranked)),
    dominantRegionId,
    clear: analysis.isClear,
    source: "heuristic",
    scorerVersion: MIND_MAP_SCORER_VERSION,
    aiModel: null,
    entryCreatedAt: input.entryCreatedAt,
  });
};

/**
 * Background AI upgrade. Returns true when the stored row was upgraded to an AI
 * score (so callers can mark the global Mind Map stale). Returns false on any
 * gate/safety/failure — the heuristic row already persisted stays as-is.
 */
export const runEntryAiScore = async ({
  userId,
  journalId,
  content,
  aiPrompt,
  tags,
}: {
  userId: string;
  journalId: string;
  content: string;
  aiPrompt?: string | null;
  tags: string[];
}): Promise<boolean> => {
  const analysis = analyzeEntryText(content, aiPrompt);

  if (
    !analysis.isSafe ||
    analysis.lowSignalDetected ||
    analysis.analysisText.length < MIN_AI_TEXT_LENGTH
  ) {
    return false;
  }

  const ai = await requestEntryAiScores(userId, analysis.sourceText);

  if (!ai) {
    return false;
  }

  const ranked = buildAiRegionScores(ai, analysis.sourceText, tags);
  const dominantRegionId = ranked[0]?.id ?? "self_reflection_identity";
  const result = await mindMapEntryScoreModel.updateOne(
    { journalId },
    {
      $set: {
        regionScores: toStoredRegionScores(ranked),
        dominantRegionId,
        clear: analysis.isClear,
        source: "ai",
        scorerVersion: MIND_MAP_SCORER_VERSION,
        aiModel: MIND_MAP_ENTRY_MODEL(),
        computedAt: new Date(),
      },
    }
  );

  // Upgrade the persisted key insight with the AI-extracted summary + themes.
  // Falls back to heuristic themes if the model returned none.
  const aiThemes = normalizeEntryThemes(
    ai.themes.map((theme) => ({
      label: theme.label,
      rationale: theme.rationale,
      evidenceQuote: theme.evidenceQuote,
      confidence: theme.confidence,
    }))
  );
  const resolvedContextSummary =
    ai.contextSummary || buildHeuristicEntryContextSummary(ranked);
  const resolvedEmotionalTone =
    ai.emotionalTone || buildHeuristicEntryEmotionalTone(ranked);
  const resolvedThemes = aiThemes.length
    ? aiThemes
    : normalizeEntryThemes(buildHeuristicEntryThemes(ranked));

  // Embed the distilled memory text (never raw journal content) so long-term
  // memory can recall this entry by relevance later. Best-effort: a null
  // embedding just means this entry won't surface via semantic recall.
  const memoryText = [
    resolvedContextSummary,
    resolvedEmotionalTone,
    resolvedThemes.map((theme) => theme.label).join(", "),
  ]
    .filter(Boolean)
    .join(". ");
  const embedding = await requestEmbedding(memoryText);

  await updateEntryInsightAi({
    journalId,
    contextSummary: resolvedContextSummary,
    emotionalTone: resolvedEmotionalTone,
    themes: resolvedThemes,
    dominantRegionId,
    clear: analysis.isClear,
    scorerVersion: MIND_MAP_SCORER_VERSION,
    aiModel: MIND_MAP_ENTRY_MODEL(),
    embedding,
    embeddingModel: embedding ? getOpenAiEmbeddingModel() : null,
  });

  // Refresh the user's rolling long-term memory now that a new AI insight
  // exists. Fire-and-forget + throttled inside updateUserMemory — never blocks.
  void updateUserMemory(userId);

  // Fold this entry's themes into the user's pattern graph, so the patterns can
  // be related to one another rather than just counted. Deterministic tiers run
  // inline; the AI refinement is throttled inside. Best-effort by contract.
  void updatePatternGraph({ userId, journalId }).catch(() => undefined);

  return result.matchedCount > 0;
};

export const deleteEntryScore = async (
  journalId: string,
  userId?: string
): Promise<void> => {
  await mindMapEntryScoreModel.deleteOne({ journalId }).exec();
  await deleteEntryInsight(journalId);

  // Strip evidence quoting the deleted entry and queue a graph replay, so the
  // graph never cites writing the user can no longer see.
  if (userId) {
    void removeJournalFromPatternGraph({ userId, journalId }).catch(
      () => undefined
    );
  }
};

export const setEntryScoreFavorite = async (
  journalId: string,
  isFavorite: boolean
): Promise<void> => {
  await mindMapEntryScoreModel
    .updateOne({ journalId }, { $set: { isFavorite } })
    .exec();
};

/**
 * Endpoint read: ownership-checked per-entry Mind Map. Computes + persists a
 * heuristic row on the fly when none exists yet. Returns null when the journal
 * is not found for this user (controller maps to 404). Throws the premium /
 * opt-in gate errors (controller maps to 403).
 */
export const getEntryMindMap = async (
  userId: string,
  journalId: string
): Promise<MindMapEntryResponse | null> => {
  await ensureAiAnalysisEnabled(userId);

  const journal = await journalModel
    .findOne({ _id: journalId, userId })
    .select("content aiPrompt tags type isFavorite createdAt")
    .lean()
    .exec();

  if (!journal) {
    return null;
  }

  const entryType = journal.type === "guided" ? "guided" : "open_ended";
  const analysis = analyzeEntryText(journal.content || "", journal.aiPrompt);

  if (!analysis.isSafe) {
    return buildEntrySupportFirst(journalId, entryType);
  }

  let row = await mindMapEntryScoreModel.findOne({ journalId }).lean().exec();

  if (!row) {
    await persistEntryScore({
      userId,
      journalId,
      entryType,
      content: journal.content || "",
      aiPrompt: journal.aiPrompt,
      tags: journal.tags || [],
      isFavorite: Boolean(journal.isFavorite),
      entryCreatedAt: new Date(journal.createdAt),
    });
    row = await mindMapEntryScoreModel.findOne({ journalId }).lean().exec();
  }

  const ranked = regionsFromStored(
    row?.regionScores ?? [],
    analysis.sourceText
  );

  const insightRow = await entryInsightModel
    .findOne({ journalId })
    .select("themes")
    .lean()
    .exec();
  const patterns: MindMapEntryPattern[] = (insightRow?.themes ?? []).map(
    (theme) => ({
      id: theme.id,
      label: theme.label,
      rationale: theme.rationale,
      evidenceQuote: theme.evidenceQuote,
      confidence: theme.confidence,
    })
  );

  return buildEntryReadyResponse({
    journalId,
    entryType,
    ranked,
    source: row?.source === "ai" ? "ai" : "heuristic",
    patterns,
  });
};

// --- Aggregation helpers consumed by the global Mind Map (insights.service) --

export type StoredEntryRegionScores = {
  regionScores: MindMapEntryRegionScore[];
  source: "ai" | "heuristic";
};

export const loadStoredEntryRegionScores = async (
  journalIds: string[]
): Promise<Map<string, StoredEntryRegionScores>> => {
  if (!journalIds.length) {
    return new Map();
  }

  const rows = await mindMapEntryScoreModel
    .find({ journalId: { $in: journalIds } })
    .select("journalId regionScores source")
    .lean()
    .exec();

  return new Map(
    rows.map((row) => [
      String(row.journalId),
      {
        regionScores: row.regionScores || [],
        source: row.source === "ai" ? "ai" : "heuristic",
      },
    ])
  );
};

export type RegionTrendInfo = {
  trend: ReflectionRegionTrend;
  trendLabel: string;
};

/**
 * Neutral emphasis trend per region across the clear, scored entries in a
 * window. Compares the recent half against the earlier half. Returns "steady"
 * for every region until there are enough scored entries to be meaningful.
 */
export const buildRegionTrendMap = async ({
  userId,
  startDate,
  endDate,
}: {
  userId: string;
  startDate?: Date | null;
  endDate?: Date | null;
}): Promise<Map<ReflectionRegionId, RegionTrendInfo>> => {
  const query: Record<string, unknown> = { userId, clear: true };

  if (startDate || endDate) {
    const range: Record<string, Date> = {};
    if (startDate) {
      range.$gte = startDate;
    }
    if (endDate) {
      range.$lte = endDate;
    }
    query.entryCreatedAt = range;
  }

  const rows = await mindMapEntryScoreModel
    .find(query)
    .sort({ entryCreatedAt: 1 })
    .select("regionScores entryCreatedAt")
    .lean()
    .exec();

  const steady = new Map<ReflectionRegionId, RegionTrendInfo>(
    REFLECTION_REGION_IDS.map((id) => [
      id,
      {
        trend: "steady",
        trendLabel: getReflectionRegionTrendLabel(id, "steady"),
      },
    ])
  );

  if (rows.length < 4) {
    return steady;
  }

  const midpoint = Math.floor(rows.length / 2);
  const earlier = rows.slice(0, midpoint);
  const recent = rows.slice(midpoint);

  const meanForRegion = (
    slice: typeof rows,
    id: ReflectionRegionId
  ): number => {
    if (!slice.length) {
      return 0;
    }
    const total = slice.reduce((sum, row) => {
      const region = (row.regionScores || []).find((item) => item.id === id);
      return sum + (region?.score ?? 0);
    }, 0);
    return total / slice.length;
  };

  return new Map<ReflectionRegionId, RegionTrendInfo>(
    REFLECTION_REGION_IDS.map((id) => {
      const trend = getReflectionRegionTrend(
        meanForRegion(recent, id),
        meanForRegion(earlier, id)
      );

      return [
        id,
        { trend, trendLabel: getReflectionRegionTrendLabel(id, trend) },
      ];
    })
  );
};

export type RegionSeriesBucket = "day" | "week" | "month";

export type RegionSeriesPoint = {
  // UTC-derived bucket start (YYYY-MM-DD).
  dateKey: string;
  // Averaged region signal for the bucket, 0-1.
  value: number;
};

// UTC start-of-week (Monday) key for a date.
const utcWeekKey = (date: Date) => {
  const start = new Date(date);
  const dayIndex = (start.getUTCDay() + 6) % 7; // 0 = Monday
  start.setUTCDate(start.getUTCDate() - dayIndex);
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString().slice(0, 10);
};

// UTC start-of-month key (YYYY-MM-01) for a date.
const utcMonthKey = (date: Date) => {
  const start = new Date(date);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString().slice(0, 10);
};

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

const bucketKeyForDate = (date: Date, bucket: RegionSeriesBucket) =>
  bucket === "month"
    ? utcMonthKey(date)
    : bucket === "week"
    ? utcWeekKey(date)
    : dayKey(date);

// Pick a readable granularity from the span the data actually covers, so a long
// history charts by month, a few weeks by week, and a short window by day —
// keeping the line detailed without cramming in dozens of points.
const resolveSeriesBucket = (spanDays: number): RegionSeriesBucket => {
  if (spanDays > 92) {
    return "month";
  }
  if (spanDays > 14) {
    return "week";
  }
  return "day";
};

/**
 * The development of a single region over a window: the averaged per-entry
 * signal for that region, bucketed by day or week from the persisted scores.
 * Powers the small graph in the region detail modal. Sparse windows just yield
 * a short series; the frontend renders a flat/placeholder line.
 */
export const buildRegionTimeSeries = async ({
  userId,
  regionId,
  startDate,
  endDate,
  bucket,
}: {
  userId: string;
  regionId: ReflectionRegionId;
  startDate?: Date | null;
  endDate?: Date | null;
  // "auto" resolves the bucket from the span the returned data actually covers.
  bucket: RegionSeriesBucket | "auto";
}): Promise<{ bucket: RegionSeriesBucket; points: RegionSeriesPoint[] }> => {
  const query: Record<string, unknown> = { userId, clear: true };

  if (startDate || endDate) {
    const range: Record<string, Date> = {};
    if (startDate) {
      range.$gte = startDate;
    }
    if (endDate) {
      range.$lte = endDate;
    }
    query.entryCreatedAt = range;
  }

  const rows = await mindMapEntryScoreModel
    .find(query)
    .sort({ entryCreatedAt: 1 })
    .select("regionScores entryCreatedAt")
    .lean()
    .exec();

  const dated = rows
    .map((row) => {
      const region = (row.regionScores || []).find(
        (item) => item.id === regionId
      );
      const created = row.entryCreatedAt ? new Date(row.entryCreatedAt) : null;
      if (!region || !created || Number.isNaN(created.getTime())) {
        return null;
      }
      return { created, score: region.score ?? 0 };
    })
    .filter((item): item is { created: Date; score: number } => item !== null);

  let resolvedBucket: RegionSeriesBucket;
  if (bucket === "auto") {
    const first = dated[0]?.created ?? null;
    const last = dated[dated.length - 1]?.created ?? null;
    const spanDays =
      first && last
        ? (last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000)
        : 0;
    resolvedBucket = resolveSeriesBucket(spanDays);
  } else {
    resolvedBucket = bucket;
  }

  const totals = new Map<string, { sum: number; count: number }>();

  for (const { created, score } of dated) {
    const key = bucketKeyForDate(created, resolvedBucket);
    const entry = totals.get(key) ?? { sum: 0, count: 0 };
    entry.sum += score;
    entry.count += 1;
    totals.set(key, entry);
  }

  const points = [...totals.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([dateKey, { sum, count }]) => ({
      dateKey,
      value: count > 0 ? Number((sum / count).toFixed(3)) : 0,
    }));

  return { bucket: resolvedBucket, points };
};

export const buildRegionFocus = (
  strongestRegionId: ReflectionRegionId,
  regions: {
    id: ReflectionRegionId;
    signalScore: number;
    trend: ReflectionRegionTrend;
  }[]
): { headline: string; body: string; regionId: ReflectionRegionId } => {
  const rising = regions
    .filter((region) => region.trend === "rising")
    .sort((left, right) => right.signalScore - left.signalScore)[0];
  const targetId = rising?.id ?? strongestRegionId;

  return {
    headline: "What to focus on",
    body: REFLECTION_REGION_FOCUS_TIPS[targetId],
    regionId: targetId,
  };
};
