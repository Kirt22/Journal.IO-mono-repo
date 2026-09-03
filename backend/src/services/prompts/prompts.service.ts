import { z } from "zod";
import { journalModel } from "../../schema/journal.schema";
import {
  canUseOpenAiForUser,
  requestStructuredOpenAi,
} from "../../helpers/openai.helpers";
import { AI_REFLECTION_BALANCE_GUIDANCE } from "../../helpers/aiReflectionBalance.helpers";
import { buildUserPersonalization } from "../../helpers/userPersonalization.helpers";
import { getInsightsOverview } from "../insights/insights.service";
import type { InsightsOverviewResponse } from "../../types/insights.types";
import type {
  WritingPrompt,
  WritingPromptsResponse,
} from "../../types/prompts.types";

// The composer shows one prompt at a time behind a refresh control, so a single
// call has to carry a whole session of taps. Prompts are short by contract —
// long questions do not fit the single-line slot and read as instructions.
const WRITING_PROMPT_BATCH_MIN = 6;
const WRITING_PROMPT_BATCH_MAX = 8;

const aiWritingPromptsResponseSchema = z.object({
  prompts: z
    .array(
      z.object({
        topic: z.string().trim().min(1).max(18),
        text: z.string().trim().min(10).max(90),
      })
    )
    .min(WRITING_PROMPT_BATCH_MIN)
    .max(WRITING_PROMPT_BATCH_MAX),
});
const aiWritingPromptsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["prompts"],
  properties: {
    prompts: {
      type: "array",
      minItems: WRITING_PROMPT_BATCH_MIN,
      maxItems: WRITING_PROMPT_BATCH_MAX,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["topic", "text"],
        properties: {
          // Mirrors aiWritingPromptsResponseSchema; an unbounded prompt here
          // just gets the whole batch rejected by the parser.
          topic: { type: "string", maxLength: 18 },
          text: { type: "string", maxLength: 90 },
        },
      },
    },
  },
} satisfies Record<string, unknown>;

const hashDateSeed = (dateKey: string) =>
  Array.from(dateKey).reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  );

const sanitizePromptId = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "prompt";

const trimPrompt = (prompt: { topic: string; text: string }) => ({
  topic: prompt.topic.trim(),
  text: prompt.text.trim(),
});

const sanitizePromptCandidates = (
  prompts: { topic: string; text: string }[],
  fallbackPrompts: { topic: string; text: string }[]
) => {
  const nextPrompts: { topic: string; text: string }[] = [];
  const seenValues = new Set<string>();

  for (const prompt of prompts) {
    const sanitizedPrompt = trimPrompt(prompt);
    const dedupeKey = `${sanitizedPrompt.topic.toLowerCase()}::${sanitizedPrompt.text.toLowerCase()}`;

    if (
      !sanitizedPrompt.topic ||
      !sanitizedPrompt.text ||
      seenValues.has(dedupeKey)
    ) {
      continue;
    }

    seenValues.add(dedupeKey);
    nextPrompts.push(sanitizedPrompt);
  }

  return nextPrompts.length > 0
    ? nextPrompts.slice(0, WRITING_PROMPT_BATCH_MAX)
    : fallbackPrompts;
};

const loadRecentJournalSnippets = async (userId: string) => {
  const journals = await journalModel
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(6)
    .select("content createdAt")
    .lean()
    .exec();

  return journals.map((journal, index) => ({
    order: index + 1,
    createdAt: new Date(journal.createdAt).toISOString(),
    excerpt: (journal.content || "").trim().slice(0, 280),
  }));
};

const generateAiWritingPrompts = async (
  userId: string,
  overview: InsightsOverviewResponse
) => {
  if (
    overview.stats.totalEntries <= 0 ||
    !(await canUseOpenAiForUser(userId))
  ) {
    return null;
  }

  const recentEntries = await loadRecentJournalSnippets(userId);
  const personalization = await buildUserPersonalization(userId);
  const aiResponse = await requestStructuredOpenAi({
    feature: "writing prompts",
    schemaName: "writing_prompts",
    schema: aiWritingPromptsJsonSchema,
    parser: aiWritingPromptsResponseSchema,
    maxOutputTokens: 600,
    messages: [
      {
        role: "system",
        content: [
          "You create personalized Journal.IO writing prompts. Each prompt is one short question of at most 12 words, written in plain everyday language and addressed to the user as 'you'. Anchor every prompt in something concrete from the user's own recent entries or recurring topics, not in generic self-help themes. The topic label is one or two plain words. Do not give advice, do not stack two questions together, and avoid diagnosis language or therapy-speak.",
          personalization?.systemDirective,
          AI_REFLECTION_BALANCE_GUIDANCE,
        ]
          .filter(Boolean)
          .join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          userProfile: personalization?.promptProfile ?? null,
          summary: overview.analysis.summary,
          keyInsight: overview.analysis.keyInsight,
          growthPatterns: overview.analysis.growthPatterns,
          popularTopics: overview.popularTopics.slice(0, 3),
          moodDistribution: overview.moodDistribution
            .filter((item) => item.count > 0)
            .slice(0, 3),
          recentEntries,
        }),
      },
    ],
  });

  if (!aiResponse) {
    return null;
  }

  return sanitizePromptCandidates(
    aiResponse.prompts,
    overview.analysis.personalizedPrompts
  );
};

const buildWritingPromptsResponse = (
  overview: InsightsOverviewResponse,
  now = new Date(),
  promptCandidates = overview.analysis.personalizedPrompts,
  generatedAt = overview.updatedAt
): WritingPromptsResponse => {
  const prompts = promptCandidates.map((prompt, index) => ({
    id: `${sanitizePromptId(prompt.topic)}-${index + 1}`,
    topic: prompt.topic,
    text: prompt.text,
  }));

  const featuredIndex =
    prompts.length > 0
      ? hashDateSeed(now.toISOString().slice(0, 10)) % prompts.length
      : 0;
  const featuredPrompt = prompts[featuredIndex] || {
    id: "reflection-1",
    topic: "Reflection",
    text: "What felt most steady or grounding in your day?",
  };

  return {
    featuredPrompt,
    prompts: prompts.length > 0 ? prompts : [featuredPrompt],
    source: overview.stats.totalEntries > 0 ? "personalized" : "default",
    generatedAt,
  };
};

const getWritingPromptsForUser = async (
  userId: string,
  now = new Date()
): Promise<WritingPromptsResponse> => {
  const overview = await getInsightsOverview(userId);
  const aiPrompts = await generateAiWritingPrompts(userId, overview);

  return buildWritingPromptsResponse(
    overview,
    now,
    aiPrompts || overview.analysis.personalizedPrompts,
    aiPrompts ? now.toISOString() : overview.updatedAt
  );
};

export { buildWritingPromptsResponse, getWritingPromptsForUser };
export type { WritingPrompt, WritingPromptsResponse };
