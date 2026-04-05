import { z } from "zod";
import { journalModel } from "../../schema/journal.schema";
import { canUseOpenAiForUser, requestStructuredOpenAi } from "../../helpers/openai.helpers";
import { getInsightsOverview } from "../insights/insights.service";
import type { InsightsOverviewResponse } from "../../types/insights.types";
import type {
  WritingPrompt,
  WritingPromptsResponse,
} from "../../types/prompts.types";

const aiWritingPromptsResponseSchema = z.object({
  prompts: z.array(
    z.object({
      topic: z.string().trim().min(1).max(40),
      text: z.string().trim().min(12).max(180),
    })
  )
    .min(3)
    .max(4),
});
const aiWritingPromptsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["prompts"],
  properties: {
    prompts: {
      type: "array",
      minItems: 3,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["topic", "text"],
        properties: {
          topic: { type: "string" },
          text: { type: "string" },
        },
      },
    },
  },
} satisfies Record<string, unknown>;

const hashDateSeed = (dateKey: string) =>
  Array.from(dateKey).reduce((total, character) => total + character.charCodeAt(0), 0);

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

    if (!sanitizedPrompt.topic || !sanitizedPrompt.text || seenValues.has(dedupeKey)) {
      continue;
    }

    seenValues.add(dedupeKey);
    nextPrompts.push(sanitizedPrompt);
  }

  return nextPrompts.length > 0 ? nextPrompts.slice(0, 4) : fallbackPrompts;
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
  if (overview.stats.totalEntries <= 0 || !(await canUseOpenAiForUser(userId))) {
    return null;
  }

  const recentEntries = await loadRecentJournalSnippets(userId);
  const aiResponse = await requestStructuredOpenAi({
    feature: "writing prompts",
    schemaName: "writing_prompts",
    schema: aiWritingPromptsJsonSchema,
    parser: aiWritingPromptsResponseSchema,
    maxOutputTokens: 420,
    messages: [
      {
        role: "system",
        content:
          "You create personalized Journal.IO writing prompts. Keep them supportive, non-clinical, and grounded in recurring patterns from the user's own writing. Write one-sentence prompts only. Avoid diagnosis language, therapy-speak, or generic self-help filler.",
      },
      {
        role: "user",
        content: JSON.stringify({
          summary: overview.analysis.summary,
          keyInsight: overview.analysis.keyInsight,
          growthPatterns: overview.analysis.growthPatterns,
          popularTopics: overview.popularTopics.slice(0, 3),
          moodDistribution: overview.moodDistribution.filter(item => item.count > 0).slice(0, 3),
          recentEntries,
        }),
      },
    ],
  });

  if (!aiResponse) {
    return null;
  }

  return sanitizePromptCandidates(aiResponse.prompts, overview.analysis.personalizedPrompts);
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
    prompts.length > 0 ? hashDateSeed(now.toISOString().slice(0, 10)) % prompts.length : 0;
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
