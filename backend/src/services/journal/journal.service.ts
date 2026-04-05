import { journalModel, type IJournal } from "../../schema/journal.schema";
import { z } from "zod";
import {
  canUseOpenAiForUser,
  getUserAiAccessState,
  requestStructuredOpenAi,
} from "../../helpers/openai.helpers";
import {
  syncJournalCreatedInsights,
  syncJournalDeletedInsights,
  syncJournalUpdatedInsights,
} from "../insights/insights.service";
import type {
  CreateJournalInput,
  JournalTagSuggestionsResponse,
  JournalEntryResponse,
  JournalLookupInput,
  SuggestJournalTagsInput,
  ToggleJournalFavoriteInput,
  UpdateJournalInput,
} from "../../types/journal.types";

const journalTagKeywords: Record<string, string[]> = {
  gratitude: ["grateful", "thankful", "appreciate", "blessed", "thanks"],
  anxiety: ["anxious", "worried", "nervous", "stress", "panic", "overwhelm"],
  happiness: ["happy", "joy", "excited", "wonderful", "amazing", "great"],
  sadness: ["sad", "cry", "lonely", "grief", "down", "upset"],
  reflection: ["think", "reflect", "realize", "learn", "insight", "looking back"],
  goals: ["goal", "plan", "achieve", "dream", "hope to", "aim"],
  mindfulness: ["mindful", "present", "breathe", "meditate", "calm", "peace"],
  "self-care": [
    "self-care",
    "rest",
    "relax",
    "recharge",
    "sleep",
    "boundary",
    "tired",
    "exhausted",
    "drained",
    "burned out",
    "burnt out",
    "not feeling well",
    "unwell",
    "sick",
  ],
  relationships: ["friend", "family", "partner", "relationship", "connection"],
  work: ["work", "job", "career", "meeting", "project", "deadline"],
  growth: ["grow", "improve", "better", "progress", "change", "overcome"],
  morning: ["morning", "woke up", "sunrise", "breakfast", "early"],
  evening: ["evening", "night", "sunset", "dinner", "bedtime", "tonight"],
  anger: ["angry", "furious", "frustrated", "annoyed", "irritated", "mad"],
};
const allowedJournalTags = Object.keys(journalTagKeywords).sort();
const aiJournalTagResponseSchema = z.object({
  tags: z.array(z.string().trim().min(1)).max(5),
});
const aiJournalTagJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tags"],
  properties: {
    tags: {
      type: "array",
      maxItems: 5,
      items: {
        type: "string",
        enum: allowedJournalTags,
      },
    },
  },
} satisfies Record<string, unknown>;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const positiveMoodTags = new Set(["gratitude", "happiness", "mindfulness", "growth"]);
const negativeCueExpressions = [
  /\bnot\s+(?:that\s+)?(grateful|thankful|happy|excited|calm|good|great|well)\b/gi,
  /\b(?:no|never)\s+(gratitude|joy|energy|motivation|hope)\b/gi,
  /\btoo\s+(tired|drained|exhausted)\b/gi,
  /\b(?:don't|do not|didn't|did not|can't|cannot|couldn't|could not)\s+feel\s+(good|well|calm|happy)\b/gi,
];
const moodBoosts: Record<NonNullable<SuggestJournalTagsInput["mood"]>, string[]> = {
  amazing: [],
  good: [],
  okay: [],
  bad: ["sadness", "self-care"],
  terrible: ["sadness", "anxiety", "self-care"],
};

const scoreKeywordMatches = (content: string, keyword: string) => {
  const expression = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "gi");
  const matches = [...content.matchAll(expression)];
  let positiveMatches = 0;
  let negatedMatches = 0;

  for (const match of matches) {
    const startIndex = match.index ?? 0;
    const contextWindow = content.slice(Math.max(0, startIndex - 18), startIndex);
    const negatedContext =
      /\b(?:not|no|never|hardly|barely)\s+$/.test(contextWindow) ||
      /\bnot\s+that\s+$/.test(contextWindow);

    if (negatedContext) {
      negatedMatches += 1;
      continue;
    }

    positiveMatches += 1;
  }

  return { positiveMatches, negatedMatches };
};

const countNegativeCues = (content: string) =>
  negativeCueExpressions.reduce((total, expression) => {
    const matches = content.match(expression);
    return total + (matches?.length || 0);
  }, 0);

const sanitizeAiTags = (tags: string[], existingTagSet: Set<string>) => {
  const nextTags: string[] = [];
  const seenTags = new Set<string>();

  for (const tag of tags) {
    const normalizedTag = tag.trim().toLowerCase();

    if (
      !normalizedTag ||
      existingTagSet.has(normalizedTag) ||
      seenTags.has(normalizedTag) ||
      !allowedJournalTags.includes(normalizedTag)
    ) {
      continue;
    }

    seenTags.add(normalizedTag);
    nextTags.push(normalizedTag);
  }

  return nextTags.slice(0, 5);
};

const buildHeuristicJournalTagSuggestions = ({
  content,
  selectedTags = [],
  mood,
}: Omit<SuggestJournalTagsInput, "userId">): JournalTagSuggestionsResponse => {
  const normalizedContent = content.trim().toLowerCase();
  const existingTagSet = new Set(selectedTags.map(tag => tag.trim().toLowerCase()).filter(Boolean));
  const negativeCueCount = countNegativeCues(normalizedContent);

  const scoredTags = Object.entries(journalTagKeywords)
    .map(([tag, keywords]) => {
      const score = keywords.reduce((total, keyword) => {
        const { positiveMatches, negatedMatches } = scoreKeywordMatches(normalizedContent, keyword);

        return total + positiveMatches - negatedMatches;
      }, 0);

      return { tag, score };
    })
    .map(item => {
      let nextScore = item.score;

      if (positiveMoodTags.has(item.tag) && negativeCueCount > 0) {
        nextScore -= negativeCueCount;
      }

      if (mood && moodBoosts[mood].includes(item.tag)) {
        nextScore += 1;
      }

      return {
        tag: item.tag,
        score: nextScore,
      };
    })
    .filter(item => item.score > 0 && !existingTagSet.has(item.tag))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.tag.localeCompare(right.tag);
    })
    .slice(0, 5)
    .map(item => item.tag);

  if (scoredTags.length > 0) {
    return { tags: scoredTags };
  }

  if (normalizedContent.length >= 40 && !existingTagSet.has("reflection")) {
    return { tags: ["reflection"] };
  }

  return { tags: [] };
};

const generateOpenAiJournalTags = async ({
  userId,
  content,
  selectedTags = [],
  mood,
}: SuggestJournalTagsInput): Promise<string[] | null> => {
  if (!(await canUseOpenAiForUser(userId)) || content.trim().length < 12) {
    return null;
  }

  const existingTagSet = new Set(selectedTags.map(tag => tag.trim().toLowerCase()).filter(Boolean));
  const aiResponse = await requestStructuredOpenAi({
    feature: "journal tag suggestions",
    schemaName: "journal_tag_suggestions",
    schema: aiJournalTagJsonSchema,
    parser: aiJournalTagResponseSchema,
    maxOutputTokens: 220,
    messages: [
      {
        role: "system",
        content:
          "You select Journal.IO tags for a draft journal entry. Use only the allowed tags provided. Base tags on what the user actually describes, not on prompt words they may be answering. If positive words appear in a negated or distressed sentence, do not choose the positive tag. Prefer emotional accuracy, specificity, and calm behavioral framing.",
      },
      {
        role: "user",
        content: JSON.stringify({
          mood: mood || null,
          allowedTags: allowedJournalTags,
          selectedTags: Array.from(existingTagSet),
          entry: content.trim(),
        }),
      },
    ],
  });

  if (!aiResponse) {
    return null;
  }

  const sanitizedTags = sanitizeAiTags(aiResponse.tags, existingTagSet);
  return sanitizedTags.length > 0 ? sanitizedTags : null;
};

class PremiumTagSuggestionsRequiredError extends Error {
  constructor() {
    super("Premium membership is required for AI tag suggestions.");
    this.name = "PremiumTagSuggestionsRequiredError";
  }
}

const serializeJournal = (journal: IJournal): JournalEntryResponse => {
  const journalObject = journal.toObject();

  return {
    _id: journalObject._id.toString(),
    title: journalObject.title,
    content: journalObject.content,
    type: journalObject.type,
    aiPrompt: typeof journalObject.aiPrompt === "string" ? journalObject.aiPrompt : null,
    tags: Array.isArray(journalObject.tags) ? journalObject.tags : [],
    images: Array.isArray(journalObject.images) ? journalObject.images : [],
    isFavorite: Boolean(journalObject.isFavorite),
    createdAt: new Date(journalObject.createdAt).toISOString(),
    updatedAt: new Date(journalObject.updatedAt).toISOString(),
  };
};

const getJournals = async (userId: string): Promise<JournalEntryResponse[]> => {
  const journals = await journalModel
    .find({ userId })
    .sort({ createdAt: -1 })
    .exec();

  return journals.map(serializeJournal);
};

const createJournal = async (
  input: CreateJournalInput
): Promise<JournalEntryResponse> => {
  const journal = await journalModel.create({
    userId: input.userId,
    title: input.title.trim(),
    content: input.content.trim(),
    type: input.type?.trim() || "journal",
    aiPrompt: input.aiPrompt?.trim() || null,
    tags: input.tags || [],
    images: input.images || [],
    isFavorite: false,
  });

  try {
    await syncJournalCreatedInsights({
      userId: input.userId,
      content: journal.content,
      tags: journal.tags || [],
      isFavorite: Boolean(journal.isFavorite),
      createdAt: journal.createdAt,
    });
  } catch (error) {
    console.error("Failed to sync insights cache after journal creation:", error);
  }

  return serializeJournal(journal);
};

const getJournalDetails = async ({
  userId,
  journalId,
}: JournalLookupInput): Promise<JournalEntryResponse | null> => {
  const journal = await journalModel.findOne({ _id: journalId, userId }).exec();

  if (!journal) {
    return null;
  }

  return serializeJournal(journal);
};

const updateJournal = async (
  input: UpdateJournalInput
): Promise<JournalEntryResponse | null> => {
  const journal = await journalModel
    .findOne({ _id: input.journalId, userId: input.userId })
    .exec();

  if (!journal) {
    return null;
  }

  const previousJournalSnapshot = {
    userId: input.userId,
    content: journal.content,
    tags: journal.tags || [],
    isFavorite: Boolean(journal.isFavorite),
    createdAt: journal.createdAt,
  };

  journal.title = input.title.trim();
  journal.content = input.content.trim();
  journal.type = input.type?.trim() || "journal";

  if (typeof input.aiPrompt === "string") {
    journal.aiPrompt = input.aiPrompt.trim() || null;
  }

  if (input.tags) {
    journal.tags = input.tags;
  }

  if (input.images) {
    journal.images = input.images;
  }

  if (typeof input.isFavorite === "boolean") {
    journal.isFavorite = input.isFavorite;
  }

  await journal.save();

  try {
    await syncJournalUpdatedInsights({
      previousJournal: previousJournalSnapshot,
      nextJournal: {
        userId: input.userId,
        content: journal.content,
        tags: journal.tags || [],
        isFavorite: Boolean(journal.isFavorite),
        createdAt: journal.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to sync insights cache after journal update:", error);
  }

  return serializeJournal(journal);
};

const toggleJournalFavorite = async (
  input: ToggleJournalFavoriteInput
): Promise<JournalEntryResponse | null> => {
  const journal = await journalModel
    .findOne({ _id: input.journalId, userId: input.userId })
    .exec();

  if (!journal) {
    return null;
  }

  const previousJournalSnapshot = {
    userId: input.userId,
    content: journal.content,
    tags: journal.tags || [],
    isFavorite: Boolean(journal.isFavorite),
    createdAt: journal.createdAt,
  };

  journal.isFavorite = input.isFavorite;
  await journal.save();

  try {
    await syncJournalUpdatedInsights({
      previousJournal: previousJournalSnapshot,
      nextJournal: {
        userId: input.userId,
        content: journal.content,
        tags: journal.tags || [],
        isFavorite: Boolean(journal.isFavorite),
        createdAt: journal.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "Failed to sync insights cache after favorite toggle:",
      error
    );
  }

  return serializeJournal(journal);
};

const deleteJournal = async ({
  userId,
  journalId,
}: JournalLookupInput): Promise<boolean> => {
  const journal = await journalModel
    .findOneAndDelete({
      _id: journalId,
      userId,
    })
    .exec();

  if (!journal) {
    return false;
  }

  try {
    await syncJournalDeletedInsights({
      userId,
      content: journal.content,
      tags: journal.tags || [],
      isFavorite: Boolean(journal.isFavorite),
      createdAt: journal.createdAt,
    });
  } catch (error) {
    console.error("Failed to sync insights cache after journal deletion:", error);
  }

  return true;
};

const suggestJournalTags = async ({
  userId,
  content,
  selectedTags = [],
  mood,
}: SuggestJournalTagsInput): Promise<JournalTagSuggestionsResponse> => {
  const accessState = await getUserAiAccessState(userId);

  if (!accessState.isPremium) {
    throw new PremiumTagSuggestionsRequiredError();
  }

  const suggestionInput = {
    userId,
    content,
    selectedTags,
    ...(mood ? { mood } : {}),
  };
  const heuristicSuggestions = buildHeuristicJournalTagSuggestions(
    suggestionInput
  );
  const mergedTags = [
    ...(await generateOpenAiJournalTags(suggestionInput)) || [],
    ...heuristicSuggestions.tags,
  ].filter((tag, index, allTags) => allTags.indexOf(tag) === index);

  return {
    tags: mergedTags.slice(0, 5),
  };
};

export type {
  CreateJournalInput,
  JournalTagSuggestionsResponse,
  JournalEntryResponse,
  JournalLookupInput,
  SuggestJournalTagsInput,
  ToggleJournalFavoriteInput,
  UpdateJournalInput,
};
export {
  createJournal,
  deleteJournal,
  getJournalDetails,
  getJournals,
  PremiumTagSuggestionsRequiredError,
  serializeJournal,
  suggestJournalTags,
  toggleJournalFavorite,
  updateJournal,
};
