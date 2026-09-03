import mongoose from "mongoose";
import { journalModel, type IJournal } from "../../schema/journal.schema";
import { z } from "zod";
import {
  canUseOpenAiForUser,
  getUserAiAccessState,
  requestEmbedding,
  requestStructuredOpenAi,
} from "../../helpers/openai.helpers";
import { analyzeJournalTextQuality } from "../../helpers/journalTextQuality.helpers";
import { extractJournalAuthorship } from "../../helpers/journalAuthorship.helpers";
import { normalizeJournalEntryKind } from "../../helpers/journalEntryKind.helpers";
import { filterReservedJournalTags } from "../../helpers/journalTags.helpers";
import {
  detectJournalSafetySignal,
  hasJournalSafetySignal,
  type JournalSafetySignal,
} from "../../helpers/journalSafety.helpers";
import {
  AI_EXTRACTION_BALANCE_GUIDANCE,
  AI_REFLECTION_BALANCE_GUIDANCE,
} from "../../helpers/aiReflectionBalance.helpers";
import { buildUserPersonalization } from "../../helpers/userPersonalization.helpers";
import {
  detectEntryMetadataHeuristically,
  normalizeDetectedTopics,
} from "../../helpers/entryMetadata.helpers";
import {
  createGuidedReflectionSessionAnalysis,
  type GuidedReflectionSessionAnalysisResponse,
} from "../guided-reflection/guided-reflection.service";
import {
  markUserMindMapStale,
  syncJournalCreatedInsights,
  syncJournalDeletedInsights,
  syncJournalUpdatedInsights,
} from "../insights/insights.service";
import {
  deleteEntryScore,
  persistEntryScore,
  runEntryAiScore,
  setEntryScoreFavorite,
} from "../mindmap/mindmap.service";
import { buildUserReflectionMemory } from "../mindmap/entryInsight.service";
import type {
  CreateJournalInput,
  JournalTagSuggestionsResponse,
  JournalQuickAnalysisInput,
  JournalQuickAnalysisResponse,
  JournalSessionAnalysisInput,
  JournalEntryResponse,
  JournalListInput,
  JournalListResponse,
  JournalLookupInput,
  JournalEntryMode,
  SuggestJournalTagsInput,
  ToggleJournalFavoriteInput,
  UpdateJournalInput,
} from "../../types/journal.types";
import type { InsightTone } from "../../types/insights.types";
import {
  isStaleSessionAnalysisSnapshot,
  persistJournalSessionAnalysisSnapshot,
} from "./journalMetadata.service";

const journalTagKeywords: Record<string, string[]> = {
  gratitude: ["grateful", "thankful", "appreciate", "blessed", "thanks"],
  anxiety: ["anxious", "worried", "nervous", "stress", "panic", "overwhelm"],
  happiness: ["happy", "joy", "excited", "wonderful", "amazing", "great"],
  sadness: ["sad", "cry", "lonely", "grief", "down", "upset"],
  reflection: [
    "think",
    "reflect",
    "realize",
    "learn",
    "insight",
    "looking back",
  ],
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
const journalQuickAnalysisSchema = z.object({
  summary: z.object({
    headline: z.string().trim().min(1).max(90),
    narrative: z.string().trim().min(1).max(220),
    highlight: z.string().trim().min(1).max(180),
  }),
  scorecard: z.object({
    vibeLabel: z.string().trim().min(1).max(40),
    vibeTone: z.enum(["coral", "blue", "sage", "amber", "slate"]),
    cards: z
      .array(
        z.object({
          key: z.enum(["words", "mood", "focus", "depth"]),
          label: z.string().trim().min(1).max(20),
          value: z.string().trim().min(1).max(28),
          tone: z.enum(["coral", "blue", "sage", "amber", "slate"]),
        })
      )
      .length(4),
  }),
  patternTags: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(32),
        tone: z.enum(["coral", "blue", "sage", "amber", "slate"]),
      })
    )
    .min(1)
    .max(3),
  signals: z.object({
    whatStoodOut: z.object({
      title: z.string().trim().min(1).max(60),
      description: z.string().trim().min(1).max(180),
      evidence: z.array(z.string().trim().min(1).max(40)).min(1).max(3),
      tone: z.enum(["coral", "blue", "sage", "amber", "slate"]),
    }),
    whatNeedsCare: z.object({
      title: z.string().trim().min(1).max(60),
      description: z.string().trim().min(1).max(180),
      evidence: z.array(z.string().trim().min(1).max(40)).min(1).max(3),
      tone: z.enum(["coral", "blue", "sage", "amber", "slate"]),
    }),
    whatToCarryForward: z.object({
      title: z.string().trim().min(1).max(60),
      description: z.string().trim().min(1).max(180),
      evidence: z.array(z.string().trim().min(1).max(40)).min(1).max(3),
      tone: z.enum(["coral", "blue", "sage", "amber", "slate"]),
    }),
  }),
  nextStep: z.object({
    title: z.string().trim().min(1).max(60),
    description: z.string().trim().min(1).max(180),
    focus: z.string().trim().min(1).max(36),
  }),
  connection: z.string().trim().max(200).nullable(),
});
// Every maxLength here mirrors a .max() in journalQuickAnalysisSchema above.
// The two must stay in step: the parser rejects an over-long field, but the
// model only knows a limit exists if the JSON schema states it. When these
// drifted apart, the model wrote a naturally-sized narrative, Zod threw it out,
// and the entry paid for a second model call to produce a reflection that had
// already been written once.
const journalQuickAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "scorecard",
    "patternTags",
    "signals",
    "nextStep",
    "connection",
  ],
  properties: {
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "narrative", "highlight"],
      properties: {
        headline: { type: "string", maxLength: 90 },
        narrative: { type: "string", maxLength: 220 },
        highlight: { type: "string", maxLength: 180 },
      },
    },
    scorecard: {
      type: "object",
      additionalProperties: false,
      required: ["vibeLabel", "vibeTone", "cards"],
      properties: {
        vibeLabel: { type: "string", maxLength: 40 },
        vibeTone: {
          type: "string",
          enum: ["coral", "blue", "sage", "amber", "slate"],
        },
        cards: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "label", "value", "tone"],
            properties: {
              key: {
                type: "string",
                enum: ["words", "mood", "focus", "depth"],
              },
              label: { type: "string", maxLength: 20 },
              value: { type: "string", maxLength: 28 },
              tone: {
                type: "string",
                enum: ["coral", "blue", "sage", "amber", "slate"],
              },
            },
          },
        },
      },
    },
    patternTags: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "tone"],
        properties: {
          label: { type: "string", maxLength: 32 },
          tone: {
            type: "string",
            enum: ["coral", "blue", "sage", "amber", "slate"],
          },
        },
      },
    },
    signals: {
      type: "object",
      additionalProperties: false,
      required: ["whatStoodOut", "whatNeedsCare", "whatToCarryForward"],
      properties: {
        whatStoodOut: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description", "evidence", "tone"],
          properties: {
            title: { type: "string", maxLength: 60 },
            description: { type: "string", maxLength: 180 },
            evidence: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: { type: "string", maxLength: 40 },
            },
            tone: {
              type: "string",
              enum: ["coral", "blue", "sage", "amber", "slate"],
            },
          },
        },
        whatNeedsCare: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description", "evidence", "tone"],
          properties: {
            title: { type: "string", maxLength: 60 },
            description: { type: "string", maxLength: 180 },
            evidence: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: { type: "string", maxLength: 40 },
            },
            tone: {
              type: "string",
              enum: ["coral", "blue", "sage", "amber", "slate"],
            },
          },
        },
        whatToCarryForward: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description", "evidence", "tone"],
          properties: {
            title: { type: "string", maxLength: 60 },
            description: { type: "string", maxLength: 180 },
            evidence: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: { type: "string", maxLength: 40 },
            },
            tone: {
              type: "string",
              enum: ["coral", "blue", "sage", "amber", "slate"],
            },
          },
        },
      },
    },
    nextStep: {
      type: "object",
      additionalProperties: false,
      required: ["title", "description", "focus"],
      properties: {
        title: { type: "string", maxLength: 60 },
        description: { type: "string", maxLength: 180 },
        focus: { type: "string", maxLength: 36 },
      },
    },
    connection: { type: ["string", "null"], maxLength: 200 },
  },
} satisfies Record<string, unknown>;

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const positiveMoodTags = new Set([
  "gratitude",
  "happiness",
  "mindfulness",
  "growth",
]);
const negativeCueExpressions = [
  /\bnot\s+(?:that\s+)?(grateful|thankful|happy|excited|calm|good|great|well)\b/gi,
  /\b(?:no|never)\s+(gratitude|joy|energy|motivation|hope)\b/gi,
  /\btoo\s+(tired|drained|exhausted)\b/gi,
  /\b(?:don't|do not|didn't|did not|can't|cannot|couldn't|could not)\s+feel\s+(good|well|calm|happy)\b/gi,
];
const moodBoosts: Record<
  NonNullable<SuggestJournalTagsInput["mood"]>,
  string[]
> = {
  amazing: [],
  good: [],
  okay: [],
  bad: ["sadness", "self-care"],
  terrible: ["sadness", "anxiety", "self-care"],
};
const quickAnalysisToneByTag: Record<string, InsightTone> = {
  gratitude: "sage",
  happiness: "coral",
  sadness: "slate",
  anxiety: "slate",
  reflection: "blue",
  goals: "amber",
  mindfulness: "blue",
  "self-care": "sage",
  relationships: "coral",
  work: "amber",
  growth: "sage",
  morning: "amber",
  evening: "slate",
  anger: "slate",
};

const normalizeJournalEntryMode = (value?: string | null): JournalEntryMode =>
  value === "guided" ? "guided" : "open_ended";

const getJournalAnalysisTags = (
  journal: Pick<IJournal, "tags" | "detectedTopics">
) =>
  filterReservedJournalTags([
    ...(journal.tags || []),
    ...(journal.detectedTopics || []),
  ]).filter(
    (tag, index, allTags) => Boolean(tag) && allTags.indexOf(tag) === index
  );

const scoreKeywordMatches = (content: string, keyword: string) => {
  const expression = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "gi");
  const matches = [...content.matchAll(expression)];
  let positiveMatches = 0;
  let negatedMatches = 0;

  for (const match of matches) {
    const startIndex = match.index ?? 0;
    const contextWindow = content.slice(
      Math.max(0, startIndex - 18),
      startIndex
    );
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

const formatTagLabel = (tag: string) =>
  tag
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const getMoodTag = (tags: string[]) =>
  tags
    .map((tag) => tag.trim().toLowerCase())
    .find((tag) => tag.startsWith("mood:"))
    ?.slice("mood:".length) || null;

const getVisibleJournalTags = (tags: string[]) =>
  filterReservedJournalTags(tags)
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => Boolean(tag) && !tag.startsWith("mood:"));

const getQuickAnalysisTone = (tag: string): InsightTone =>
  quickAnalysisToneByTag[tag] || "blue";

const getQuickAnalysisMoodLabel = (moodTag: string | null) =>
  moodTag ? formatTagLabel(moodTag) : "Mixed";

const getQuickAnalysisMoodTone = (moodTag: string | null): InsightTone => {
  if (moodTag === "amazing" || moodTag === "good") {
    return "sage";
  }

  if (moodTag === "bad" || moodTag === "terrible") {
    return "slate";
  }

  return "blue";
};

const getQuickAnalysisDepthLabel = (wordCount: number) => {
  if (wordCount >= 140) {
    return "Deep unpack";
  }

  if (wordCount >= 70) {
    return "Solid detail";
  }

  return "Quick note";
};

const getQuickAnalysisFirstSentence = (text: string) => {
  const normalized = text.trim();

  if (!normalized) {
    return "";
  }

  const match = normalized.match(/^[^.?!]+[.?!]?/);
  return (match?.[0] || normalized).trim();
};

const buildHeuristicJournalTagSuggestions = ({
  content,
  selectedTags = [],
  mood,
}: Omit<SuggestJournalTagsInput, "userId">): JournalTagSuggestionsResponse => {
  const normalizedContent = content.trim().toLowerCase();
  const existingTagSet = new Set(
    selectedTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)
  );
  const negativeCueCount = countNegativeCues(normalizedContent);

  const scoredTags = Object.entries(journalTagKeywords)
    .map(([tag, keywords]) => {
      const score = keywords.reduce((total, keyword) => {
        const { positiveMatches, negatedMatches } = scoreKeywordMatches(
          normalizedContent,
          keyword
        );

        return total + positiveMatches - negatedMatches;
      }, 0);

      return { tag, score };
    })
    .map((item) => {
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
    .filter((item) => item.score > 0 && !existingTagSet.has(item.tag))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.tag.localeCompare(right.tag);
    })
    .slice(0, 5)
    .map((item) => item.tag);

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

  const existingTagSet = new Set(
    selectedTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)
  );
  const aiResponse = await requestStructuredOpenAi({
    feature: "journal tag suggestions",
    schemaName: "journal_tag_suggestions",
    schema: aiJournalTagJsonSchema,
    parser: aiJournalTagResponseSchema,
    maxOutputTokens: 220,
    messages: [
      {
        role: "system",
        content: [
          "You select Journal.IO tags for a draft journal entry. Use only the allowed tags provided. Base tags on what the user actually describes, not on prompt words they may be answering. If positive words appear in a negated or distressed sentence, do not choose the positive tag. Prefer emotional accuracy, specificity, and calm behavioral framing.",
          AI_EXTRACTION_BALANCE_GUIDANCE,
        ].join(" "),
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
    super("AI tag suggestions are available with Premium.");
    this.name = "PremiumTagSuggestionsRequiredError";
  }
}

class PremiumQuickAnalysisRequiredError extends Error {
  constructor() {
    super("Quick analysis is available with Premium.");
    this.name = "PremiumQuickAnalysisRequiredError";
  }
}

const ensureQuickAnalysisAccess = async (userId: string) => {
  const accessState = await getUserAiAccessState(userId);

  if (!accessState.isPremium) {
    throw new PremiumQuickAnalysisRequiredError();
  }

};

const buildHeuristicJournalQuickAnalysis = (
  journal: IJournal
): JournalQuickAnalysisResponse => {
  const textQuality = analyzeJournalTextQuality({
    content: journal.content || "",
    aiPrompt: journal.aiPrompt,
  });
  const safetySignal = detectJournalSafetySignal(
    textQuality.analysisText || journal.content || ""
  );

  if (hasJournalSafetySignal(safetySignal)) {
    return buildSafetyJournalQuickAnalysis({
      journal,
      safetySignal,
      wordCount: textQuality.analysisWordCount,
    });
  }

  const analysisText = textQuality.analysisText || textQuality.strippedText;
  const visibleTags = textQuality.lowSignalDetected
    ? []
    : getVisibleJournalTags(journal.tags || []);
  const moodTag = getMoodTag(journal.tags || []);
  const inferredTags = buildHeuristicJournalTagSuggestions({
    content: analysisText,
    selectedTags: visibleTags,
  }).tags;
  const patternTagKeys = textQuality.lowSignalDetected
    ? []
    : [...visibleTags, ...inferredTags].filter(
        (tag, index, allTags) => Boolean(tag) && allTags.indexOf(tag) === index
      );
  const primaryTag = patternTagKeys[0] || null;
  const secondaryTag = patternTagKeys[1] || null;
  const primaryMoodLabel = moodTag ? formatTagLabel(moodTag) : null;
  const wordCount = textQuality.analysisWordCount;
  const patternTags = (
    textQuality.lowSignalDetected
      ? [
          textQuality.promptEchoDetected ? "prompt carryover" : "low signal",
          ...(primaryMoodLabel ? [primaryMoodLabel.toLowerCase()] : []),
        ]
      : patternTagKeys.length
      ? patternTagKeys
      : primaryMoodLabel
      ? [primaryMoodLabel.toLowerCase()]
      : ["reflection"]
  )
    .slice(0, 3)
    .map((tag) => ({
      label: formatTagLabel(tag),
      tone:
        tag === "prompt carryover" || tag === "low signal"
          ? "slate"
          : getQuickAnalysisTone(tag),
    }));

  const focusLabel = textQuality.lowSignalDetected
    ? textQuality.promptEchoDetected
      ? "Prompt carryover"
      : "Low signal"
    : primaryTag
    ? formatTagLabel(primaryTag)
    : "Reflection";
  const moodLabel = getQuickAnalysisMoodLabel(moodTag);
  const moodTone = getQuickAnalysisMoodTone(moodTag);
  const depthLabel = textQuality.lowSignalDetected
    ? "Hard to read"
    : getQuickAnalysisDepthLabel(wordCount);
  const vibeLabel = textQuality.lowSignalDetected
    ? textQuality.promptEchoDetected
      ? "Prompt-led note"
      : "Unclear note"
    : moodTag === "bad" || moodTag === "terrible"
    ? "Heavy moment"
    : moodTag === "amazing" || moodTag === "good"
    ? "Steadier moment"
    : wordCount >= 90
    ? "Thoughtful unpack"
    : "Quiet check-in";

  let summaryHeadline = "A clear emotional thread showed up here";
  let summaryNarrative =
    "This entry reads like an honest check-in. The language may indicate you were trying to get closer to what felt most true in the moment.";
  let summaryHighlight =
    "The strongest signal here is the part of the entry you kept circling back to, not just the surface event itself.";

  if (textQuality.lowSignalDetected) {
    summaryHeadline = textQuality.promptEchoDetected
      ? "This entry is still mostly prompt carryover"
      : "This entry is still too unclear to read deeply";
    summaryNarrative = textQuality.promptEchoDetected
      ? "The saved text appears to lean more on the selected prompt or placeholder wording than on your own usable reflection, so this read stays intentionally light."
      : "The saved text is too short or too noisy to support a deeper read yet, so Journal.IO is treating it as a low-signal note instead of forcing a bigger meaning onto it.";
    summaryHighlight =
      "A little more plain, specific language in your own words will make the next quick read much sharper.";
  } else if (primaryTag && primaryMoodLabel) {
    summaryHeadline = `${focusLabel} carried this ${primaryMoodLabel.toLowerCase()} moment`;
    summaryNarrative = `This entry may indicate ${focusLabel.toLowerCase()} was closely tied to how the moment felt. You were not just logging the day, you were trying to make sense of it while it was still live.`;
    summaryHighlight = `${focusLabel} looks like the clearest thread to keep tracking if this feeling or situation comes back.`;
  } else if (primaryTag) {
    summaryHeadline = `${focusLabel} kept pulling your attention`;
    summaryNarrative = `This entry may indicate ${focusLabel.toLowerCase()} carried most of the emotional weight here. The writing suggests that was the part your mind kept returning to.`;
    summaryHighlight = `${focusLabel} is probably the sharpest lens for understanding what this entry was really about.`;
  } else if (primaryMoodLabel) {
    summaryHeadline = `${primaryMoodLabel} energy came through clearly here`;
    summaryNarrative = `This entry reads like a ${primaryMoodLabel.toLowerCase()} check-in. The language may indicate you were naming the moment honestly, even if the bigger pattern is still unfolding.`;
    summaryHighlight =
      "The emotional tone is already clear enough here to build a useful next step from it.";
  }

  let nextStepTitle = "Name the need underneath it";
  let nextStepDescription =
    "In your next entry, name what felt heavy, what helped even a little, and what you needed more of.";
  let nextStepFocus = "Clarity";

  if (textQuality.lowSignalDetected) {
    nextStepTitle = "Answer the prompt in one clean line";
    nextStepDescription = textQuality.promptEchoDetected
      ? "Keep the prompt if it helps, but add one direct sentence in your own words about what actually happened and how it landed."
      : "Next time, add one clear sentence about what happened, one about how it felt, and one about what you needed right after.";
    nextStepFocus = "Specificity";
  } else if (
    visibleTags.includes("self-care") ||
    visibleTags.includes("anxiety")
  ) {
    nextStepTitle = "Track what steadied you";
    nextStepDescription =
      "Next time, note one small thing that helped you feel safer, steadier, or more supported so the pattern is easier to reuse.";
    nextStepFocus = "Support";
  } else if (visibleTags.includes("work") || visibleTags.includes("goals")) {
    nextStepTitle = "Separate pressure from control";
    nextStepDescription =
      "In your next entry, split what felt in your control today from what can wait. That usually lowers the mental pile-up fast.";
    nextStepFocus = "Work Stress";
  } else if (visibleTags.includes("relationships")) {
    nextStepTitle = "Map the interaction more clearly";
    nextStepDescription =
      "In your next entry, name one interaction that felt nourishing and one that felt draining so the social pattern gets easier to read.";
    nextStepFocus = "Relationships";
  } else if (wordCount < 35) {
    nextStepTitle = "Add one layer more detail";
    nextStepDescription =
      "Next time, add one extra line about what happened, how it landed in you, and what you needed right after.";
    nextStepFocus = "Specificity";
  }

  const whatStoodOut = textQuality.lowSignalDetected
    ? {
        title: textQuality.promptEchoDetected
          ? "The prompt is louder than the reflection"
          : "There is not enough clean language yet",
        description: textQuality.promptEchoDetected
          ? "Most of the usable text still looks shaped by the prompt itself, so the strongest signal here is that the entry needs more of your own wording."
          : "The entry does not hold enough grounded detail yet for Journal.IO to treat it like a strong emotional or topic signal.",
        evidence: [
          textQuality.promptEchoDetected
            ? "Prompt echo detected"
            : "Low-signal text",
          `${wordCount} usable words`,
        ],
        tone: "slate" as const,
      }
    : {
        title: primaryTag
          ? `${focusLabel} was the clearest signal`
          : "The emotional tone was the clearest signal",
        description: primaryTag
          ? `This entry may indicate ${focusLabel.toLowerCase()} carried most of the meaning in the moment, not just the background context around it.`
          : "Even without a single dominant theme, the entry still gives a readable emotional signal to work with.",
        evidence: [
          focusLabel,
          secondaryTag ? formatTagLabel(secondaryTag) : moodLabel,
        ].filter(Boolean),
        tone: primaryTag ? getQuickAnalysisTone(primaryTag) : moodTone,
      };

  const whatNeedsCare = (
    textQuality.lowSignalDetected
      ? {
          title: "This one needs a clearer pass",
          description: textQuality.promptEchoDetected
            ? "Prompt carryover or filler text is making the entry hard to read, so any deeper interpretation would risk overreaching."
            : "The wording is too thin or too noisy right now, so the useful next move is clarity rather than a bigger interpretation.",
          evidence: [
            textQuality.promptEchoDetected
              ? "Prompt carryover"
              : "Low-signal note",
            depthLabel,
          ],
          tone: "slate" as const,
        }
      : {
          title:
            moodTag === "bad" || moodTag === "terrible"
              ? "This moment deserves a softer read"
              : visibleTags.includes("work")
              ? "Pressure looked close to the surface"
              : "There may be a subtle friction point here",
          description:
            moodTag === "bad" || moodTag === "terrible"
              ? "The entry carries enough strain that it makes sense to treat this as a real stress moment, not something to brush past."
              : visibleTags.includes("work") || visibleTags.includes("goals")
              ? "The writing suggests responsibility or pressure may have been crowding the page a bit."
              : "Nothing looks extreme here, but there is still a useful tension point to notice before it turns repetitive.",
          evidence: [
            moodLabel,
            visibleTags.includes("work")
              ? "Work"
              : visibleTags.includes("self-care")
              ? "Self Care"
              : depthLabel,
          ],
          tone:
            moodTag === "bad" || moodTag === "terrible"
              ? "slate"
              : visibleTags.includes("work") || visibleTags.includes("goals")
              ? "amber"
              : "blue",
        }
  ) satisfies JournalQuickAnalysisResponse["signals"]["whatNeedsCare"];

  const whatToCarryForward = (
    textQuality.lowSignalDetected
      ? {
          title: "A clearer note will unlock more here",
          description:
            "The useful move is not a deeper label right now. It is one cleaner pass in your own words so the next reflection has something solid to work with.",
          evidence: [
            textQuality.promptEchoDetected
              ? "Use your own wording"
              : "Add concrete detail",
            "Specificity",
          ],
          tone: "coral" as const,
        }
      : {
          title:
            visibleTags.includes("gratitude") || visibleTags.includes("growth")
              ? "There is something useful to keep"
              : "The honesty itself is worth carrying forward",
          description:
            visibleTags.includes("gratitude") || visibleTags.includes("growth")
              ? "The entry does not just flag friction. It also shows a thread that could help you build the next reflection with a little more steadiness."
              : "You already named this moment clearly enough to work with. That kind of directness is what makes the next entry more useful, too.",
          evidence: [depthLabel, primaryTag ? focusLabel : "Reflection"],
          tone:
            visibleTags.includes("gratitude") || visibleTags.includes("growth")
              ? "sage"
              : "coral",
        }
  ) satisfies JournalQuickAnalysisResponse["signals"]["whatToCarryForward"];

  return {
    journalId: journal._id.toString(),
    summary: {
      headline: summaryHeadline,
      narrative: summaryNarrative,
      highlight: summaryHighlight,
    },
    scorecard: {
      vibeLabel,
      vibeTone:
        moodTag === "bad" || moodTag === "terrible"
          ? "slate"
          : moodTag === "amazing" || moodTag === "good"
          ? "sage"
          : "blue",
      cards: [
        {
          key: "words",
          label: "Words",
          value: `${wordCount}`,
          tone: "blue",
        },
        {
          key: "mood",
          label: "Mood",
          value: moodLabel,
          tone: moodTone,
        },
        {
          key: "focus",
          label: "Focus",
          value: focusLabel,
          tone: textQuality.lowSignalDetected
            ? "slate"
            : primaryTag
            ? getQuickAnalysisTone(primaryTag)
            : "coral",
        },
        {
          key: "depth",
          label: "Depth",
          value: depthLabel,
          tone: textQuality.lowSignalDetected
            ? "slate"
            : wordCount >= 70
            ? "sage"
            : "amber",
        },
      ],
    },
    patternTags,
    signals: {
      whatStoodOut,
      whatNeedsCare,
      whatToCarryForward,
    },
    nextStep: {
      title: nextStepTitle,
      description: nextStepDescription,
      focus: nextStepFocus,
    },
    connection: null,
    generatedAt: new Date().toISOString(),
  };
};

const buildSafetyJournalQuickAnalysis = ({
  journal,
  safetySignal,
  wordCount,
}: {
  journal: IJournal;
  safetySignal: JournalSafetySignal;
  wordCount: number;
}): JournalQuickAnalysisResponse => {
  const isSelfHarm = safetySignal.category === "self_harm";
  const headline = isSelfHarm
    ? "This entry needs real-world support"
    : "This entry needs a safety-first response";
  const narrative = isSelfHarm
    ? "This entry may involve self-harm or suicide risk. Journal.IO will not turn this into a personality read or normal pattern analysis."
    : "This entry may involve risk of harm to another person. Journal.IO will not turn this into a personality read or normal pattern analysis.";
  const highlight = isSelfHarm
    ? "If you might act on this or feel unable to stay safe, contact emergency services now. In the U.S. or Canada, call or text 988."
    : "If someone could be hurt, create distance from the situation and contact local emergency services or a trusted person now.";
  const supportTitle = isSelfHarm
    ? "Get support now"
    : "Pause and create distance";
  const supportDescription = isSelfHarm
    ? "Reach out to a trusted person or crisis support before continuing to analyze this entry. The priority is immediate safety, not a deeper interpretation."
    : "Step away from the situation if possible and involve a trusted person or emergency support. The priority is preventing harm, not interpreting the entry.";

  return {
    journalId: journal._id.toString(),
    summary: {
      headline,
      narrative,
      highlight,
    },
    scorecard: {
      vibeLabel:
        safetySignal.level === "urgent" ? "Urgent support" : "Support first",
      vibeTone: "slate",
      cards: [
        {
          key: "words",
          label: "Words",
          value: `${wordCount}`,
          tone: "blue",
        },
        {
          key: "mood",
          label: "Mood",
          value: "Needs care",
          tone: "slate",
        },
        {
          key: "focus",
          label: "Focus",
          value: "Safety",
          tone: "slate",
        },
        {
          key: "depth",
          label: "Depth",
          value: "Do not analyze",
          tone: "slate",
        },
      ],
    },
    patternTags: [
      {
        label: "Safety",
        tone: "slate",
      },
      {
        label: "Support First",
        tone: "coral",
      },
    ],
    signals: {
      whatStoodOut: {
        title: "Safety matters more than interpretation",
        description:
          "The wording may point to immediate risk, so this reflection stays focused on support instead of drawing a behavioral conclusion.",
        evidence: [
          "Safety signal",
          safetySignal.level === "urgent"
            ? "Urgent wording"
            : "Support wording",
        ],
        tone: "slate",
      },
      whatNeedsCare: {
        title: "This should not stay private-only",
        description:
          "A journal can hold the words, but this kind of entry should also be shared with a trusted person or crisis/emergency support if there is any chance of harm.",
        evidence: ["Reach out", "Do not wait"],
        tone: "coral",
      },
      whatToCarryForward: {
        title: "Use the app after safety is handled",
        description:
          "Come back to reflection once immediate safety is steadier. For now, keep the next step simple and real-world.",
        evidence: ["Support first", "Reflect later"],
        tone: "blue",
      },
    },
    nextStep: {
      title: supportTitle,
      description: supportDescription,
      focus: "Safety",
    },
    connection: null,
    generatedAt: new Date().toISOString(),
  };
};

const generateOpenAiJournalQuickAnalysis = async ({
  userId,
  journal,
  baseline,
}: {
  userId: string;
  journal: IJournal;
  baseline: JournalQuickAnalysisResponse;
}) => {
  const textQuality = analyzeJournalTextQuality({
    content: journal.content,
    aiPrompt: journal.aiPrompt,
  });

  if (
    !(await canUseOpenAiForUser(userId)) ||
    hasJournalSafetySignal(
      detectJournalSafetySignal(textQuality.analysisText || journal.content)
    ) ||
    textQuality.lowSignalDetected ||
    textQuality.analysisText.length < 24
  ) {
    return null;
  }

  // Long-term memory (best-effort): lets a single-entry card connect today to a
  // recurring thread from the user's history, the way a therapist who remembers
  // past sessions would. Never blocks or fails the analysis.
  let longTermMemory = "";
  try {
    const queryEmbedding = await requestEmbedding(
      textQuality.analysisText.trim().slice(0, 1600)
    );
    longTermMemory = await buildUserReflectionMemory(userId, { queryEmbedding });
  } catch (error) {
    console.error("Failed to build quick-analysis memory:", error);
    longTermMemory = "";
  }

  const personalization = await buildUserPersonalization(userId);

  return requestStructuredOpenAi({
    feature: "journal quick analysis",
    schemaName: "journal_quick_analysis",
    schema: journalQuickAnalysisJsonSchema,
    parser: journalQuickAnalysisSchema,
    maxOutputTokens: 800,
    messages: [
      {
        role: "system",
        content: [
          "You write Journal.IO quick entry reflections. Keep them grounded in this entry and state what it actually shows rather than hedging toward it. You may name a recognised psychological pattern the entry supports; do not assert a formal disorder as established medical fact. Keep the copy concise enough for a mobile card. Use a sharp, modern, emotionally aware tone, not slang-heavy. Lead with the signal, the friction point, or the useful next step.",
          "When the entry names a behaviour, coping habit, or avoidance, notice its likely trigger or the feeling it regulates rather than judging it — name the pattern and its cost, never call the behaviour good or bad, never shame.",
          "longTermMemory is a private, best-effort recollection of this user's past entries. Use the optional connection field ONLY when today genuinely echoes a specific past thread in that memory: write one short, warm sentence naming the concrete link (e.g. 'This is the third time work deadlines have shown up right before you feel this way.'). If there is no real connection, or memory is empty, set connection to null. Never invent history.",
          personalization?.systemDirective,
          "Write every field in English. Hard character limits, and a field that runs over is cut off mid-word: summary.headline 90 characters, summary.narrative 220, summary.highlight 180, scorecard.vibeLabel 40, each card label 20 and value 28, each patternTag label 32, each signal title 60 and description 180, each evidence phrase 40, nextStep title 60 and description 180 and focus 36, connection 200. Aim for roughly 80% of each limit so the last sentence lands inside it — summary.narrative should be about 175 characters, not 220. Never abbreviate to fit; rewrite shorter.",
          AI_REFLECTION_BALANCE_GUIDANCE,
        ]
          .filter(Boolean)
          .join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          title: journal.title,
          type: normalizeJournalEntryMode(journal.type),
          moodTag: getMoodTag(journal.tags || []),
          tags: getVisibleJournalTags(journal.tags || []),
          entry: textQuality.analysisText.trim().slice(0, 1200),
          longTermMemory: longTermMemory || "No prior entries yet.",
          userProfile: personalization?.promptProfile ?? null,
          baseline,
        }),
      },
    ],
  });
};

const serializeJournal = (journal: IJournal): JournalEntryResponse => {
  const journalObject = journal.toObject();

  return {
    _id: journalObject._id.toString(),
    title: journalObject.title,
    content: journalObject.content,
    type: normalizeJournalEntryMode(journalObject.type),
    entryKind: normalizeJournalEntryKind(
      journalObject.entryKind,
      journalObject.title
    ),
    aiPrompt:
      typeof journalObject.aiPrompt === "string"
        ? journalObject.aiPrompt
        : null,
    tags: Array.isArray(journalObject.tags)
      ? filterReservedJournalTags(journalObject.tags)
      : [],
    detectedTopics: Array.isArray(journalObject.detectedTopics)
      ? normalizeDetectedTopics(journalObject.detectedTopics)
      : [],
    detectedMood: journalObject.detectedMood || null,
    images: Array.isArray(journalObject.images) ? journalObject.images : [],
    isFavorite: Boolean(journalObject.isFavorite),
    createdAt: new Date(journalObject.createdAt).toISOString(),
    updatedAt: new Date(journalObject.updatedAt).toISOString(),
  };
};

class InvalidJournalCursorError extends Error {
  constructor() {
    super("The journal cursor is invalid or expired.");
    this.name = "InvalidJournalCursorError";
  }
}

type JournalCursor = {
  createdAt: string;
  id: string;
};

const encodeJournalCursor = (journal: IJournal) =>
  Buffer.from(
    JSON.stringify({
      createdAt: new Date(journal.createdAt).toISOString(),
      id: journal._id.toString(),
    } satisfies JournalCursor)
  ).toString("base64url");

const decodeJournalCursor = (value: string): JournalCursor => {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as Partial<JournalCursor>;
    const createdAt = new Date(parsed.createdAt || "");

    if (
      !parsed.id ||
      !mongoose.isValidObjectId(parsed.id) ||
      Number.isNaN(createdAt.getTime())
    ) {
      throw new InvalidJournalCursorError();
    }

    return {
      createdAt: createdAt.toISOString(),
      id: parsed.id,
    };
  } catch (error) {
    if (error instanceof InvalidJournalCursorError) {
      throw error;
    }
    throw new InvalidJournalCursorError();
  }
};

const getJournals = async ({
  userId,
  limit,
  cursor,
  from,
  to,
}: JournalListInput): Promise<JournalListResponse> => {
  const dateFilter: Record<string, Date> = {};
  if (from) {
    dateFilter.$gte = new Date(from);
  }
  if (to) {
    dateFilter.$lt = new Date(to);
  }

  const baseFilter: Record<string, unknown> = {
    userId,
    ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
  };
  const pageFilter: Record<string, unknown> = { ...baseFilter };

  if (cursor) {
    const decodedCursor = decodeJournalCursor(cursor);
    const cursorDate = new Date(decodedCursor.createdAt);
    pageFilter.$or = [
      { createdAt: { ...dateFilter, $lt: cursorDate } },
      {
        createdAt: cursorDate,
        _id: { $lt: decodedCursor.id },
      },
    ];
    delete pageFilter.createdAt;
  }

  const [journalRows, matchingCount, totalEntries, favoriteEntries] =
    await Promise.all([
      journalModel
        .find(pageFilter)
        .select("-sessionAnalysisSnapshot")
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .exec(),
      journalModel.countDocuments(baseFilter).exec(),
      journalModel.countDocuments({ userId }).exec(),
      journalModel.countDocuments({ userId, isFavorite: true }).exec(),
    ]);

  const hasMore = journalRows.length > limit;
  const pageRows = hasMore ? journalRows.slice(0, limit) : journalRows;
  const lastJournal = pageRows[pageRows.length - 1];

  return {
    entries: pageRows.map(serializeJournal),
    pagination: {
      nextCursor:
        hasMore && lastJournal ? encodeJournalCursor(lastJournal) : null,
      hasMore,
      matchingCount,
    },
    summary: {
      totalEntries,
      favoriteEntries,
    },
  };
};

// Persist the deterministic per-entry Mind Map score synchronously (so the
// per-entry map is instantly available) and kick off a non-blocking AI upgrade.
// Never throws for AI reasons — a journal entry must save even if scoring fails.
const syncEntryMindMapScore = async ({
  userId,
  journalId,
  entryType,
  content,
  aiPrompt,
  appAuthoredSegments,
  tags,
  isFavorite,
  entryCreatedAt,
}: {
  userId: string;
  journalId: string;
  entryType: "open_ended" | "guided";
  content: string;
  aiPrompt: string | null;
  appAuthoredSegments: string[];
  tags: string[];
  isFavorite: boolean;
  entryCreatedAt: Date;
}) => {
  await persistEntryScore({
    userId,
    journalId,
    entryType,
    content,
    aiPrompt,
    appAuthoredSegments,
    tags,
    isFavorite,
    entryCreatedAt,
  });

  void runEntryAiScore({
    userId,
    journalId,
    content,
    aiPrompt,
    entryType,
    appAuthoredSegments,
    tags,
  })
    .then((upgraded) => (upgraded ? markUserMindMapStale(userId) : undefined))
    .catch((error) => {
      console.error("Failed to run entry Mind Map AI scoring:", error);
    });
};

const createJournal = async (
  input: CreateJournalInput
): Promise<JournalEntryResponse> => {
  const metadata = detectEntryMetadataHeuristically(input.content);
  const journal = await journalModel.create({
    userId: input.userId,
    title: input.title.trim(),
    content: input.content.trim(),
    type: normalizeJournalEntryMode(input.type),
    entryKind: normalizeJournalEntryKind(input.entryKind, input.title),
    aiPrompt: input.aiPrompt?.trim() || null,
    appAuthoredSegments: (input.appAuthoredSegments || [])
      .map((segment) => segment.trim())
      .filter(Boolean),
    tags: filterReservedJournalTags(input.tags || []),
    detectedTopics: metadata.detectedTopics,
    detectedMood: metadata.detectedMood,
    images: input.images || [],
    isFavorite: false,
  });

  try {
    await syncJournalCreatedInsights({
      userId: input.userId,
      content: journal.content,
      tags: getJournalAnalysisTags(journal),
      isFavorite: Boolean(journal.isFavorite),
      createdAt: journal.createdAt,
    });
  } catch (error) {
    console.error(
      "Failed to sync insights cache after journal creation:",
      error
    );
  }

  try {
    await syncEntryMindMapScore({
      userId: input.userId,
      journalId: journal._id.toString(),
      entryType: journal.type === "guided" ? "guided" : "open_ended",
      content: journal.content,
      aiPrompt: journal.aiPrompt,
      appAuthoredSegments: journal.appAuthoredSegments || [],
      tags: journal.tags || [],
      isFavorite: Boolean(journal.isFavorite),
      entryCreatedAt: journal.createdAt,
    });
  } catch (error) {
    console.error(
      "Failed to persist entry Mind Map score after creation:",
      error
    );
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
    tags: getJournalAnalysisTags(journal),
    isFavorite: Boolean(journal.isFavorite),
    createdAt: journal.createdAt,
  };

  journal.title = input.title.trim();
  journal.content = input.content.trim();
  journal.type = normalizeJournalEntryMode(input.type);
  const metadata = detectEntryMetadataHeuristically(journal.content);
  journal.detectedTopics = metadata.detectedTopics;
  journal.detectedMood = metadata.detectedMood;

  if (typeof input.aiPrompt === "string") {
    journal.aiPrompt = input.aiPrompt.trim() || null;
  }

  if (input.tags) {
    journal.tags = filterReservedJournalTags(input.tags);
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
        tags: getJournalAnalysisTags(journal),
        isFavorite: Boolean(journal.isFavorite),
        createdAt: journal.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to sync insights cache after journal update:", error);
  }

  try {
    await syncEntryMindMapScore({
      userId: input.userId,
      journalId: journal._id.toString(),
      entryType: journal.type === "guided" ? "guided" : "open_ended",
      content: journal.content,
      aiPrompt: journal.aiPrompt,
      appAuthoredSegments: journal.appAuthoredSegments || [],
      tags: journal.tags || [],
      isFavorite: Boolean(journal.isFavorite),
      entryCreatedAt: journal.createdAt,
    });
  } catch (error) {
    console.error(
      "Failed to persist entry Mind Map score after update:",
      error
    );
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
    tags: getJournalAnalysisTags(journal),
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
        tags: getJournalAnalysisTags(journal),
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

  try {
    await setEntryScoreFavorite(
      journal._id.toString(),
      Boolean(journal.isFavorite)
    );
  } catch (error) {
    console.error("Failed to update entry Mind Map favorite weight:", error);
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
      tags: getJournalAnalysisTags(journal),
      isFavorite: Boolean(journal.isFavorite),
      createdAt: journal.createdAt,
    });
  } catch (error) {
    console.error(
      "Failed to sync insights cache after journal deletion:",
      error
    );
  }

  try {
    await deleteEntryScore(journalId, userId);
  } catch (error) {
    console.error(
      "Failed to delete entry Mind Map score after deletion:",
      error
    );
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
  const heuristicSuggestions =
    buildHeuristicJournalTagSuggestions(suggestionInput);
  const mergedTags = [
    ...((await generateOpenAiJournalTags(suggestionInput)) || []),
    ...heuristicSuggestions.tags,
  ].filter((tag, index, allTags) => allTags.indexOf(tag) === index);

  return {
    tags: mergedTags.slice(0, 5),
  };
};

const getJournalQuickAnalysis = async ({
  userId,
  journalId,
}: JournalQuickAnalysisInput): Promise<JournalQuickAnalysisResponse | null> => {
  await ensureQuickAnalysisAccess(userId);

  const journal = await journalModel.findOne({ _id: journalId, userId }).exec();

  if (!journal) {
    return null;
  }

  const baseline = buildHeuristicJournalQuickAnalysis(journal);
  const aiAnalysis = await generateOpenAiJournalQuickAnalysis({
    userId,
    journal,
    baseline,
  });

  if (!aiAnalysis) {
    return baseline;
  }

  const connection =
    typeof aiAnalysis.connection === "string" &&
    aiAnalysis.connection.trim().length > 0
      ? aiAnalysis.connection.trim()
      : null;

  return {
    journalId: journal._id.toString(),
    summary: aiAnalysis.summary,
    scorecard: aiAnalysis.scorecard,
    patternTags: aiAnalysis.patternTags,
    signals: aiAnalysis.signals,
    nextStep: aiAnalysis.nextStep,
    connection,
    generatedAt: new Date().toISOString(),
  };
};

class PremiumSessionAnalysisRequiredError extends Error {
  constructor() {
    super("Session analysis is available with Premium.");
    this.name = "PremiumSessionAnalysisRequiredError";
  }
}

class SessionAnalysisUnavailableError extends Error {
  constructor() {
    super("Session insights are not available for Quick Notes.");
    this.name = "SessionAnalysisUnavailableError";
  }
}

const ensureSessionAnalysisAccess = async (userId: string) => {
  const accessState = await getUserAiAccessState(userId);

  if (!accessState.isPremium) {
    throw new PremiumSessionAnalysisRequiredError();
  }

};

const getJournalSessionAnalysis = async ({
  userId,
  journalId,
}: JournalSessionAnalysisInput): Promise<GuidedReflectionSessionAnalysisResponse | null> => {
  await ensureSessionAnalysisAccess(userId);

  const journal = await journalModel.findOne({ _id: journalId, userId }).exec();
  if (!journal) {
    return null;
  }

  if (
    normalizeJournalEntryKind(journal.entryKind, journal.title) ===
    "quick_thought"
  ) {
    throw new SessionAnalysisUnavailableError();
  }

  const storedAnalysis = journal.sessionAnalysisSnapshot?.analysis;
  // A stale snapshot is regenerated on the next read, so entries analysed
  // during an AI outage — or before the open-ended fallback was fixed — repair
  // themselves instead of keeping generic copy permanently.
  const isStale = isStaleSessionAnalysisSnapshot(journal.sessionAnalysisSnapshot);

  if (storedAnalysis && !isStale) {
    return storedAnalysis;
  }

  // Split the entry before analysing it. A guided entry is one blob holding the
  // app's section labels, its own reflection and every question it asked,
  // interleaved with what the person typed; an open-ended entry can hold any
  // writing prompts they tapped to insert. Passing `journal.content` whole is
  // how Journal.IO's own sentences end up quoted back as the user's evidence.
  const authorship = extractJournalAuthorship({
    content: journal.content,
    type: journal.type,
    aiPrompt: journal.aiPrompt,
    appAuthoredSegments: journal.appAuthoredSegments,
  });

  const analysis = await createGuidedReflectionSessionAnalysis({
    userId,
    journalId,
    promptAnswers: [
      {
        questionId: "open_ended_entry",
        question: journal.aiPrompt || "What felt most important today?",
        answer: authorship.userText,
      },
    ],
    ...(authorship.appText
      ? { appAuthoredContext: authorship.appText }
      : {}),
  });

  return persistJournalSessionAnalysisSnapshot({
    userId,
    journalId,
    analysis,
    source: journal.type === "guided" ? "legacy_backfill" : "open_ended",
    replaceExisting: isStale,
  });
};

export type {
  CreateJournalInput,
  JournalTagSuggestionsResponse,
  JournalQuickAnalysisInput,
  JournalQuickAnalysisResponse,
  JournalSessionAnalysisInput,
  JournalEntryResponse,
  JournalListInput,
  JournalListResponse,
  JournalLookupInput,
  SuggestJournalTagsInput,
  ToggleJournalFavoriteInput,
  UpdateJournalInput,
};
export {
  createJournal,
  deleteJournal,
  getJournalDetails,
  getJournalQuickAnalysis,
  getJournalSessionAnalysis,
  getJournals,
  InvalidJournalCursorError,
  PremiumTagSuggestionsRequiredError,
  PremiumQuickAnalysisRequiredError,
  PremiumSessionAnalysisRequiredError,
  SessionAnalysisUnavailableError,
  serializeJournal,
  suggestJournalTags,
  toggleJournalFavorite,
  updateJournal,
};
