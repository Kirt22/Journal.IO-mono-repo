import {
  entryInsightModel,
  type EntryInsightThemeRecord,
} from "../../schema/entryInsight.schema";
import {
  REFLECTION_REGION_DETAILS,
  normalizeReflectionMapText,
  type EntryInsightTheme,
  type ReflectionRegionId,
} from "../../helpers/reflectionMap.helpers";
import { toThemeId } from "../../helpers/patternGraph.helpers";
import { getUserMemory } from "./userMemory.service";
import { buildPatternGraphMemoryBlock } from "./patternGraph.service";
import type { UserMemory } from "../../types/userMemory.types";
import {
  decryptFieldValue,
  encryptFieldValue,
} from "../../helpers/fieldEncryption.helpers";
import { decryptLeanFields } from "../../helpers/fieldEncryption.schema.helpers";

const THEME_LABEL_MAX = 64;
const THEME_RATIONALE_MAX = 220;
const THEME_EVIDENCE_MAX = 180;
const MEMORY_RECENT_SUMMARIES = 6;
const MEMORY_RECURRING_THEMES = 5;

// Lives in patternGraph.helpers alongside its fuzzy counterpart toPatternKey,
// and is re-exported here because entry insights are where theme ids originate.
export { toThemeId };

export const normalizeEntryThemes = (
  themes: EntryInsightTheme[]
): EntryInsightThemeRecord[] => {
  const seen = new Set<string>();
  const records: EntryInsightThemeRecord[] = [];

  for (const theme of themes) {
    const label = normalizeReflectionMapText(theme.label, THEME_LABEL_MAX);
    const id = toThemeId(label);

    if (!label || seen.has(id)) {
      continue;
    }
    seen.add(id);

    records.push({
      id,
      label,
      rationale: normalizeReflectionMapText(theme.rationale, THEME_RATIONALE_MAX),
      evidenceQuote: normalizeReflectionMapText(
        theme.evidenceQuote,
        THEME_EVIDENCE_MAX
      ),
      confidence:
        Number.isFinite(theme.confidence) && theme.confidence > 0
          ? Math.min(1, Math.max(0, Number(theme.confidence.toFixed(2))))
          : 0.5,
    });

    if (records.length >= 4) {
      break;
    }
  }

  return records;
};

type PersistEntryInsightInput = {
  userId: string;
  journalId: string;
  entryType: "open_ended" | "guided";
  contextSummary: string;
  emotionalTone: string;
  themes: EntryInsightThemeRecord[];
  dominantRegionId: ReflectionRegionId;
  clear: boolean;
  source: "ai" | "heuristic";
  scorerVersion: string;
  aiModel: string | null;
  entryCreatedAt: Date;
};

export const persistEntryInsight = async (
  input: PersistEntryInsightInput
): Promise<void> => {
  await entryInsightModel.updateOne(
    { journalId: input.journalId },
    {
      $set: {
        userId: input.userId,
        journalId: input.journalId,
        entryType: input.entryType,
        contextSummary: encryptFieldValue(
          normalizeReflectionMapText(input.contextSummary, 400),
          { path: "contextSummary" }
        ),
        emotionalTone: encryptFieldValue(
          normalizeReflectionMapText(input.emotionalTone, 80),
          { path: "emotionalTone" }
        ),
        themes: encryptFieldValue(input.themes, { path: "themes" }),
        dominantRegionId: input.dominantRegionId,
        clear: input.clear,
        source: input.source,
        scorerVersion: input.scorerVersion,
        aiModel: input.aiModel,
        entryCreatedAt: input.entryCreatedAt,
        computedAt: new Date(),
      },
    },
    { upsert: true }
  );
};

/**
 * Background AI upgrade of an existing entry insight row. Only patches the
 * AI-derived fields, leaving ownership/timestamps from the heuristic write in
 * place. Returns true when a row was matched and updated.
 */
export const updateEntryInsightAi = async ({
  journalId,
  contextSummary,
  emotionalTone,
  themes,
  dominantRegionId,
  clear,
  scorerVersion,
  aiModel,
  embedding,
  embeddingModel,
}: {
  journalId: string;
  contextSummary: string;
  emotionalTone: string;
  themes: EntryInsightThemeRecord[];
  dominantRegionId: ReflectionRegionId;
  clear: boolean;
  scorerVersion: string;
  aiModel: string | null;
  embedding?: number[] | null;
  embeddingModel?: string | null;
}): Promise<boolean> => {
  const result = await entryInsightModel.updateOne(
    { journalId },
    {
      $set: {
        contextSummary: encryptFieldValue(
          normalizeReflectionMapText(contextSummary, 400),
          { path: "contextSummary" }
        ),
        emotionalTone: encryptFieldValue(
          normalizeReflectionMapText(emotionalTone, 80),
          { path: "emotionalTone" }
        ),
        themes: encryptFieldValue(themes, { path: "themes" }),
        dominantRegionId,
        clear,
        source: "ai",
        scorerVersion,
        aiModel,
        computedAt: new Date(),
        // Only overwrite the embedding when a fresh one was computed, so a
        // failed embedding call never wipes a previously stored vector.
        ...(embedding && embedding.length
          ? {
              embeddingCiphertext: encryptFieldValue(embedding, {
                path: "embeddingCiphertext",
              }),
              hasEmbedding: true,
              embeddingModel: embeddingModel ?? null,
            }
          : {
              hasEmbedding: false,
            }
        ),
      },
    }
  );

  return result.matchedCount > 0;
};

export const deleteEntryInsight = async (journalId: string): Promise<void> => {
  await entryInsightModel.deleteOne({ journalId }).exec();
};

export type LoadedEntryInsight = {
  journalId: string;
  entryType: "open_ended" | "guided";
  contextSummary: string;
  emotionalTone: string;
  themes: EntryInsightThemeRecord[];
  dominantRegionId: ReflectionRegionId;
  entryCreatedAt: Date;
};

export const loadEntryInsights = async ({
  userId,
  startDate,
  endDate,
  limit,
}: {
  userId: string;
  startDate?: Date | null;
  endDate?: Date | null;
  limit?: number;
}): Promise<LoadedEntryInsight[]> => {
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

  const cursor = entryInsightModel
    .find(query)
    .sort({ entryCreatedAt: -1 })
    .select("journalId entryType contextSummary emotionalTone themes dominantRegionId entryCreatedAt");

  if (limit && limit > 0) {
    cursor.limit(limit);
  }

  const rows = await cursor.lean().exec();

  return rows.map(rawRow => {
    const row = decryptLeanFields(rawRow, [
      { encryptedPath: "contextSummary" },
      { encryptedPath: "emotionalTone" },
      { encryptedPath: "themes" },
    ]) as unknown as Record<string, unknown>;

    return {
      journalId: String(row.journalId),
      entryType: row.entryType === "guided" ? "guided" : "open_ended",
      contextSummary:
        typeof row.contextSummary === "string" ? row.contextSummary : "",
      emotionalTone:
        typeof row.emotionalTone === "string" ? row.emotionalTone : "",
      themes: Array.isArray(row.themes) ? (row.themes as EntryInsightThemeRecord[]) : [],
      dominantRegionId: (row.dominantRegionId ||
        "self_reflection_identity") as ReflectionRegionId,
      entryCreatedAt: new Date(row.entryCreatedAt as string | number | Date),
    };
  });
};

const cosineSimilarity = (a: number[], b: number[]): number => {
  const length = Math.min(a.length, b.length);
  if (!length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const readStoredEmbedding = (row: Record<string, unknown>): number[] => {
  const encryptedEmbedding = decryptFieldValue<number[]>(
    row.embeddingCiphertext,
    { path: "embeddingCiphertext" }
  );

  if (Array.isArray(encryptedEmbedding) && encryptedEmbedding.length > 0) {
    return encryptedEmbedding;
  }

  return Array.isArray(row.embedding)
    ? row.embedding.filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value)
      )
    : [];
};

/**
 * Semantic long-term-memory recall: rank a user's stored entry insights by how
 * closely their embedding matches the current session's embedding, returning the
 * most relevant ones. In-memory cosine over the user's own vectors — per-user
 * counts are small; Atlas Vector Search is the future scale path. Best-effort:
 * returns [] on error or when nothing has an embedding yet.
 */
export const loadRelevantEntryInsights = async ({
  userId,
  queryEmbedding,
  limit = 6,
  minScore = 0.2,
}: {
  userId: string;
  queryEmbedding: number[];
  limit?: number;
  minScore?: number;
}): Promise<(LoadedEntryInsight & { similarity: number })[]> => {
  if (!queryEmbedding.length) {
    return [];
  }

  try {
    const rows = await entryInsightModel
      .find({ userId, clear: true, hasEmbedding: true })
      .sort({ entryCreatedAt: -1 })
      // Bound how many vectors we score in memory for prolific users.
      .limit(400)
      .select(
        "journalId entryType contextSummary emotionalTone themes dominantRegionId entryCreatedAt embeddingCiphertext embedding"
      )
      .lean()
      .exec();

    return rows
      .map(rawRow => {
        const row = decryptLeanFields(rawRow, [
          { encryptedPath: "contextSummary" },
          { encryptedPath: "emotionalTone" },
          { encryptedPath: "themes" },
        ]) as unknown as Record<string, unknown>;
        const embedding = readStoredEmbedding(
          rawRow as unknown as Record<string, unknown>
        );

        return {
        journalId: String(row.journalId),
        entryType: (row.entryType === "guided" ? "guided" : "open_ended") as
          | "guided"
          | "open_ended",
        contextSummary:
          typeof row.contextSummary === "string" ? row.contextSummary : "",
        emotionalTone:
          typeof row.emotionalTone === "string" ? row.emotionalTone : "",
        themes: Array.isArray(row.themes) ? (row.themes as EntryInsightThemeRecord[]) : [],
        dominantRegionId: (row.dominantRegionId ||
          "self_reflection_identity") as ReflectionRegionId,
        entryCreatedAt: new Date(row.entryCreatedAt as string | number | Date),
        similarity: cosineSimilarity(queryEmbedding, embedding || []),
        };
      })
      .filter(row => row.similarity >= minScore)
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, limit);
  } catch (error) {
    console.error("Failed to load relevant entry insights:", error);
    return [];
  }
};

export type RecurringPattern = {
  id: string;
  label: string;
  rationale: string;
  evidenceQuote: string;
  occurrences: number;
  confidence: number;
};

/**
 * Aggregate persisted themes into recurring patterns ranked by how often they
 * show up, keeping the most representative rationale + evidence quote (the
 * user's own sentence) for each. Powers the Mind Map "most recurring patterns".
 */
export const aggregateRecurringPatterns = (
  insights: LoadedEntryInsight[],
  limit = 5
): RecurringPattern[] => {
  const byId = new Map<
    string,
    { pattern: RecurringPattern; bestConfidence: number }
  >();

  for (const insight of insights) {
    for (const theme of insight.themes) {
      const existing = byId.get(theme.id);

      if (!existing) {
        byId.set(theme.id, {
          bestConfidence: theme.confidence,
          pattern: {
            id: theme.id,
            label: theme.label,
            rationale: theme.rationale,
            evidenceQuote: theme.evidenceQuote,
            occurrences: 1,
            confidence: theme.confidence,
          },
        });
        continue;
      }

      existing.pattern.occurrences += 1;
      existing.pattern.confidence = Math.min(
        1,
        Number(((existing.pattern.confidence + theme.confidence) / 2).toFixed(2))
      );

      // Keep the highest-confidence rationale + evidence as representative.
      if (theme.confidence > existing.bestConfidence) {
        existing.bestConfidence = theme.confidence;
        existing.pattern.rationale = theme.rationale;
        existing.pattern.evidenceQuote = theme.evidenceQuote;
        existing.pattern.label = theme.label;
      }
    }
  }

  return [...byId.values()]
    .map(entry => entry.pattern)
    .sort((left, right) => {
      if (right.occurrences !== left.occurrences) {
        return right.occurrences - left.occurrences;
      }
      return right.confidence - left.confidence;
    })
    .slice(0, limit);
};

/**
 * Compact, token-bounded long-term memory injected into guided reflection
 * prompts so the assistant can carry forward what the user has been working
 * through across ALL of their entries. Composes three layers:
 *   1. Rolling narrative — an AI-maintained whole-history summary (user_memories).
 *   2. Semantic recall — the past entries most relevant to today's session,
 *      when a queryEmbedding for the current session is provided.
 *   3. Recurring themes — patterns that keep showing up, seen >= 2x.
 * Uses only the user's own distilled insights — never raw journal dumps. Returns
 * an empty string when there is nothing meaningful yet. Fully best-effort: must
 * never break the core reflection flow.
 */
export const buildUserReflectionMemory = async (
  userId: string,
  options: { queryEmbedding?: number[] | null } = {}
): Promise<string> => {
  let insights: LoadedEntryInsight[] = [];
  try {
    // Widened well beyond the old 24 so recurring-theme aggregation reflects the
    // user's real history, not just the last few weeks.
    insights = await loadEntryInsights({ userId, limit: 200 });
  } catch (error) {
    console.error("Failed to load reflection memory:", error);
    insights = [];
  }

  // Rolling whole-history narrative (premium; empty when unavailable).
  let rollingMemory: UserMemory = {
    narrative: "",
    structured: {
      ongoingThreads: [],
      keyRelationships: [],
      sensitiveTopics: [],
    },
    entriesCoveredThrough: null,
    entriesCoveredCount: 0,
    version: "",
    aiModel: null,
    updatedAt: null,
  };
  try {
    rollingMemory = await getUserMemory(userId);
  } catch (error) {
    console.error("Failed to load rolling user memory:", error);
  }

  // Semantic recall of the most relevant past entries for today's session.
  let relevant: (LoadedEntryInsight & { similarity: number })[] = [];
  if (options.queryEmbedding && options.queryEmbedding.length) {
    relevant = await loadRelevantEntryInsights({
      userId,
      queryEmbedding: options.queryEmbedding,
      limit: 5,
    });
  }

  const recentSummaries = insights
    .slice(0, MEMORY_RECENT_SUMMARIES)
    .map(insight => insight.contextSummary)
    .filter(Boolean);

  // The pattern graph supersedes flat recurring themes when it has enough to
  // say: themes are a graph with no edges, so this swaps in the same patterns
  // *plus* how they appear to connect, rather than stacking a second block on
  // top of a shared character budget.
  let graphMemory = { block: "", hasGraph: false };
  try {
    graphMemory = await buildPatternGraphMemoryBlock(userId);
  } catch (error) {
    console.error("Failed to load pattern graph memory:", error);
  }

  const recurring = graphMemory.hasGraph
    ? []
    : aggregateRecurringPatterns(insights, MEMORY_RECURRING_THEMES).filter(
        pattern => pattern.occurrences >= 2
      );

  const hasContent =
    Boolean(rollingMemory.narrative) ||
    Boolean(rollingMemory.structured.ongoingThreads.length) ||
    relevant.length > 0 ||
    recentSummaries.length > 0 ||
    recurring.length > 0 ||
    Boolean(graphMemory.block);

  if (!hasContent) {
    return "";
  }

  const parts: string[] = [];

  if (rollingMemory.narrative) {
    parts.push(`The bigger picture of what they've been navigating:\n${rollingMemory.narrative}`);
  }

  if (rollingMemory.structured.ongoingThreads.length) {
    parts.push(
      "Ongoing threads:\n" +
        rollingMemory.structured.ongoingThreads
          .map(thread =>
            thread.status
              ? `- ${thread.label} — ${thread.status}`
              : `- ${thread.label}`
          )
          .join("\n")
    );
  }

  if (rollingMemory.structured.sensitiveTopics.length) {
    parts.push(
      "Sensitive topics they've raised (acknowledge with care, never diagnose):\n" +
        rollingMemory.structured.sensitiveTopics
          .map(topic => `- ${topic}`)
          .join("\n")
    );
  }

  if (relevant.length) {
    parts.push(
      "Past entries most related to today:\n" +
        relevant
          .map(item => `- ${item.contextSummary}`)
          .filter(Boolean)
          .join("\n")
    );
  }

  if (graphMemory.block) {
    parts.push(graphMemory.block);
  }

  if (recurring.length) {
    parts.push(
      "Recurring themes across their entries:\n" +
        recurring
          .map(
            pattern =>
              `- ${pattern.label} (seen ${pattern.occurrences}×): ${pattern.rationale}`
          )
          .join("\n")
    );
  }

  if (recentSummaries.length) {
    parts.push(
      "What they've been reflecting on recently:\n" +
        recentSummaries.map(summary => `- ${summary}`).join("\n")
    );
  }

  return normalizeReflectionMapText(parts.join("\n\n"), 2200);
};

export const productLabelForRegion = (id: ReflectionRegionId): string =>
  REFLECTION_REGION_DETAILS[id]?.productName ?? "Reflection";
