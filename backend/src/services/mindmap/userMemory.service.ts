import { z } from "zod";
import { userMemoryModel } from "../../schema/userMemory.schema";
import {
  canUseOpenAiForUser,
  getOpenAiModel,
  requestStructuredOpenAi,
} from "../../helpers/openai.helpers";
import { AI_EXTRACTION_BALANCE_GUIDANCE } from "../../helpers/aiReflectionBalance.helpers";
import {
  decryptLeanFields,
} from "../../helpers/fieldEncryption.schema.helpers";
import { encryptFieldValue } from "../../helpers/fieldEncryption.helpers";
import { normalizeReflectionMapText } from "../../helpers/reflectionMap.helpers";
import { loadEntryInsights } from "./entryInsight.service";
import type { UserMemory } from "../../types/userMemory.types";

export const USER_MEMORY_VERSION = "user-memory-v1";

// How many recent entry insights to feed the rolling summarizer. The narrative
// carries older history forward, so we only need a recent window of new detail.
const MEMORY_SOURCE_LIMIT = 40;
const NARRATIVE_MAX_CHARS = 1200;

const USER_MEMORY_MODEL = () =>
  process.env.OPENAI_USER_MEMORY_MODEL?.trim() || getOpenAiModel();

// Refresh the rolling memory once at least this many new entries exist since the
// last summary. Default 1 (refresh on every new entry); raise to batch cost.
const REFRESH_EVERY = () => {
  const raw = Number(process.env.USER_MEMORY_REFRESH_EVERY);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
};

const ongoingThreadJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: { type: "string" },
    status: { type: "string" },
  },
  required: ["label", "status"],
};

const userMemoryJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    narrative: { type: "string" },
    ongoingThreads: {
      type: "array",
      items: ongoingThreadJsonSchema,
    },
    keyRelationships: { type: "array", items: { type: "string" } },
    sensitiveTopics: { type: "array", items: { type: "string" } },
  },
  required: [
    "narrative",
    "ongoingThreads",
    "keyRelationships",
    "sensitiveTopics",
  ],
};

const userMemoryResponseSchema = z.object({
  narrative: z.string(),
  ongoingThreads: z
    .array(z.object({ label: z.string(), status: z.string() }))
    .max(8),
  keyRelationships: z.array(z.string()).max(12),
  sensitiveTopics: z.array(z.string()).max(8),
});

const SYSTEM_PROMPT = [
  "You maintain a private, long-term memory of one journaling user across all of their entries.",
  "You are updating a rolling summary a warm, perceptive therapist would keep between sessions: the ongoing situations, relationships, and heavier themes this person is working through, and where each currently stands.",
  "Merge the existing memory with the new entry insights. Carry forward what still matters, update the status of ongoing threads, and drop what is clearly resolved or stale.",
  AI_EXTRACTION_BALANCE_GUIDANCE,
  "Write the narrative as 3-6 flowing sentences in third person about the arc of what they have been navigating. Be specific and human, never a bland list.",
  "Only include things the user themselves raised. Never invent details, never diagnose, never name a medical or psychiatric condition. For sensitiveTopics, list only heavy themes the user actually named (e.g. grief, a loss, a past trauma they referenced), so future sessions can acknowledge them with care.",
  "Keep the whole thing compact and durable — this is a summary, not a transcript.",
].join(" ");

const clampNarrative = (value: string): string =>
  normalizeReflectionMapText(value, NARRATIVE_MAX_CHARS);

const emptyMemory = (): UserMemory => ({
  narrative: "",
  structured: {
    ongoingThreads: [],
    keyRelationships: [],
    sensitiveTopics: [],
  },
  entriesCoveredThrough: null,
  entriesCoveredCount: 0,
  version: USER_MEMORY_VERSION,
  aiModel: null,
  updatedAt: null,
});

/**
 * Read the persisted rolling memory for a user. Best-effort: returns an empty
 * memory when none exists or on any error, so callers can always inject
 * something safe. Never throws.
 */
export const getUserMemory = async (userId: string): Promise<UserMemory> => {
  try {
    const rawDoc = await userMemoryModel.findOne({ userId }).lean().exec();
    const doc = rawDoc
      ? decryptLeanFields(rawDoc, [
          { encryptedPath: "narrative" },
          { encryptedPath: "structured.keyRelationships", plaintextPath: "structured.keyRelationships" },
          { encryptedPath: "structured.sensitiveTopics", plaintextPath: "structured.sensitiveTopics" },
        ]) as unknown as Record<string, unknown>
      : null;
    if (!doc) {
      return emptyMemory();
    }

    const structured =
      doc.structured && typeof doc.structured === "object"
        ? (doc.structured as Record<string, unknown>)
        : {};
    const ongoingThreads = Array.isArray(structured.ongoingThreads)
      ? structured.ongoingThreads
      : [];
    const keyRelationships = Array.isArray(structured.keyRelationships)
      ? structured.keyRelationships
      : [];
    const sensitiveTopics = Array.isArray(structured.sensitiveTopics)
      ? structured.sensitiveTopics
      : [];

    return {
      narrative: typeof doc.narrative === "string" ? doc.narrative : "",
      structured: {
        ongoingThreads: ongoingThreads.map((thread) => {
          const item =
            thread && typeof thread === "object"
              ? (thread as Record<string, unknown>)
              : {};

          return {
          label:
            typeof item.label === "string"
              ? item.label
              : "",
          status:
            typeof item.status === "string"
              ? item.status
              : "",
          };
        }),
        keyRelationships: keyRelationships as string[],
        sensitiveTopics: sensitiveTopics as string[],
      },
      entriesCoveredThrough: doc.entriesCoveredThrough
        ? new Date(doc.entriesCoveredThrough as string | number | Date)
        : null,
      entriesCoveredCount:
        typeof doc.entriesCoveredCount === "number"
          ? doc.entriesCoveredCount
          : 0,
      version: typeof doc.version === "string" ? doc.version : USER_MEMORY_VERSION,
      aiModel: typeof doc.aiModel === "string" ? doc.aiModel : null,
      updatedAt: doc.updatedAt
        ? new Date(doc.updatedAt as string | number | Date)
        : null,
    };
  } catch (error) {
    console.error("Failed to read user memory:", error);
    return emptyMemory();
  }
};

/**
 * Refresh the user's rolling long-term memory from their recent entry insights.
 * Fire-and-forget from the entry pipeline: premium-gated, throttled, and fully
 * best-effort — it must never block or break saving an entry.
 */
export const updateUserMemory = async (userId: string): Promise<void> => {
  try {
    if (!(await canUseOpenAiForUser(userId))) {
      return;
    }

    const insights = await loadEntryInsights({
      userId,
      limit: MEMORY_SOURCE_LIMIT,
    });
    if (!insights.length) {
      return;
    }

    const existing = await userMemoryModel.findOne({ userId }).lean().exec();
    const newestEntryAt = insights[0]!.entryCreatedAt;
    const coveredThrough = existing?.entriesCoveredThrough
      ? new Date(existing.entriesCoveredThrough)
      : null;

    // Throttle: only re-summarize once enough new entries have accumulated.
    if (coveredThrough) {
      const freshCount = insights.filter(
        (insight) => insight.entryCreatedAt > coveredThrough
      ).length;
      if (freshCount < REFRESH_EVERY()) {
        return;
      }
    }

    const aiResponse = await requestStructuredOpenAi({
      feature: "user long-term memory",
      schemaName: "user_long_term_memory",
      schema: userMemoryJsonSchema,
      parser: userMemoryResponseSchema,
      model: USER_MEMORY_MODEL(),
      maxOutputTokens: 700,
      reasoningEffort: "low",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            existingMemory: existing
              ? {
                  narrative: existing.narrative || "",
                  ongoingThreads: existing.structured?.ongoingThreads || [],
                  keyRelationships: existing.structured?.keyRelationships || [],
                  sensitiveTopics: existing.structured?.sensitiveTopics || [],
                }
              : null,
            recentEntryInsights: insights.map((insight) => ({
              contextSummary: insight.contextSummary,
              emotionalTone: insight.emotionalTone,
              themes: insight.themes.map((theme) => theme.label),
              entryCreatedAt: insight.entryCreatedAt.toISOString(),
            })),
          }),
        },
      ],
    });

    if (!aiResponse) {
      return;
    }

    await userMemoryModel.updateOne(
      { userId },
      {
        $set: {
          userId,
          narrative: encryptFieldValue(clampNarrative(aiResponse.narrative), {
            path: "narrative",
          }),
          structured: {
            ongoingThreads: aiResponse.ongoingThreads
              .filter((thread) => thread.label.trim())
              .slice(0, 8)
              .map((thread) => ({
                label: encryptFieldValue(
                  normalizeReflectionMapText(thread.label, 80),
                  { path: "structured.ongoingThreads.label" }
                ),
                status: encryptFieldValue(
                  normalizeReflectionMapText(thread.status, 160),
                  { path: "structured.ongoingThreads.status" }
                ),
              })),
            keyRelationships: encryptFieldValue(
              aiResponse.keyRelationships
                .filter(Boolean)
                .slice(0, 12)
                .map((item) => normalizeReflectionMapText(item, 60)),
              { path: "structured.keyRelationships" }
            ),
            sensitiveTopics: encryptFieldValue(
              aiResponse.sensitiveTopics
                .filter(Boolean)
                .slice(0, 8)
                .map((item) => normalizeReflectionMapText(item, 80)),
              { path: "structured.sensitiveTopics" }
            ),
          },
          entriesCoveredThrough: newestEntryAt,
          entriesCoveredCount: insights.length,
          version: USER_MEMORY_VERSION,
          aiModel: USER_MEMORY_MODEL(),
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error("Failed to update user memory:", error);
  }
};
