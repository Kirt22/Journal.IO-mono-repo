import { journalModel, type IJournal } from "../../schema/journal.schema";
import { z } from "zod";
import {
  canUseOpenAiForUser,
  getUserAiAccessState,
  requestStructuredOpenAi,
} from "../../helpers/openai.helpers";
import { analyzeJournalTextQuality } from "../../helpers/journalTextQuality.helpers";
import {
  syncJournalCreatedInsights,
  syncJournalDeletedInsights,
  syncJournalUpdatedInsights,
} from "../insights/insights.service";
import type {
  CreateJournalInput,
  JournalTagSuggestionsResponse,
  JournalQuickAnalysisInput,
  JournalQuickAnalysisResponse,
  JournalEntryResponse,
  JournalLookupInput,
  SuggestJournalTagsInput,
  ToggleJournalFavoriteInput,
  UpdateJournalInput,
} from "../../types/journal.types";
import type { InsightTone } from "../../types/insights.types";

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
});
const journalQuickAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "scorecard", "patternTags", "signals", "nextStep"],
  properties: {
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "narrative", "highlight"],
      properties: {
        headline: { type: "string" },
        narrative: { type: "string" },
        highlight: { type: "string" },
      },
    },
    scorecard: {
      type: "object",
      additionalProperties: false,
      required: ["vibeLabel", "vibeTone", "cards"],
      properties: {
        vibeLabel: { type: "string" },
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
              label: { type: "string" },
              value: { type: "string" },
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
          label: { type: "string" },
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
            title: { type: "string" },
            description: { type: "string" },
            evidence: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: { type: "string" },
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
            title: { type: "string" },
            description: { type: "string" },
            evidence: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: { type: "string" },
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
            title: { type: "string" },
            description: { type: "string" },
            evidence: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: { type: "string" },
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
        title: { type: "string" },
        description: { type: "string" },
        focus: { type: "string" },
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

const formatTagLabel = (tag: string) =>
  tag
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const getMoodTag = (tags: string[]) =>
  tags
    .map(tag => tag.trim().toLowerCase())
    .find(tag => tag.startsWith("mood:"))
    ?.slice("mood:".length) || null;

const getVisibleJournalTags = (tags: string[]) =>
  tags
    .map(tag => tag.trim().toLowerCase())
    .filter(tag => Boolean(tag) && !tag.startsWith("mood:"));

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

class PremiumQuickAnalysisRequiredError extends Error {
  constructor() {
    super("Premium membership is required for quick analysis.");
    this.name = "PremiumQuickAnalysisRequiredError";
  }
}

class QuickAnalysisDisabledError extends Error {
  constructor() {
    super("Quick analysis is turned off for this account.");
    this.name = "QuickAnalysisDisabledError";
  }
}

const ensureQuickAnalysisAccess = async (userId: string) => {
  const accessState = await getUserAiAccessState(userId);

  if (!accessState.isPremium) {
    throw new PremiumQuickAnalysisRequiredError();
  }

  if (accessState.aiOptIn === false) {
    throw new QuickAnalysisDisabledError();
  }
};

const buildHeuristicJournalQuickAnalysis = (journal: IJournal): JournalQuickAnalysisResponse => {
  const textQuality = analyzeJournalTextQuality({
    content: journal.content || "",
    aiPrompt: journal.aiPrompt,
  });
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
    .map(tag => ({
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
    summaryHighlight = "The emotional tone is already clear enough here to build a useful next step from it.";
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
  } else if (visibleTags.includes("self-care") || visibleTags.includes("anxiety")) {
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
          textQuality.promptEchoDetected ? "Prompt echo detected" : "Low-signal text",
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
            textQuality.promptEchoDetected ? "Prompt carryover" : "Low-signal note",
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
            textQuality.promptEchoDetected ? "Use your own wording" : "Add concrete detail",
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
          evidence: [
            depthLabel,
            primaryTag ? focusLabel : "Reflection",
          ],
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
          tone: textQuality.lowSignalDetected ? "slate" : wordCount >= 70 ? "sage" : "amber",
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
    textQuality.lowSignalDetected ||
    textQuality.analysisText.length < 24
  ) {
    return null;
  }

  return requestStructuredOpenAi({
    feature: "journal quick analysis",
    schemaName: "journal_quick_analysis",
    schema: journalQuickAnalysisJsonSchema,
    parser: journalQuickAnalysisSchema,
    maxOutputTokens: 260,
    messages: [
      {
        role: "system",
        content:
          "You write Journal.IO quick entry reflections. Keep them non-clinical, uncertainty-aware, emotionally safe, and grounded in the single entry only. Never diagnose or claim certainty. Keep the copy concise enough for a mobile card. Use a warm, sharp, soft Gen Z psychologist tone: modern and emotionally aware, but not slang-heavy. Prefer signals, friction points, and useful next steps over personality labels.",
      },
      {
        role: "user",
        content: JSON.stringify({
          title: journal.title,
          type: journal.type,
          moodTag: getMoodTag(journal.tags || []),
          tags: getVisibleJournalTags(journal.tags || []),
          entry: textQuality.analysisText.trim().slice(0, 1200),
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

  return {
    journalId: journal._id.toString(),
    summary: aiAnalysis.summary,
    scorecard: aiAnalysis.scorecard,
    patternTags: aiAnalysis.patternTags,
    signals: aiAnalysis.signals,
    nextStep: aiAnalysis.nextStep,
    generatedAt: new Date().toISOString(),
  };
};

export type {
  CreateJournalInput,
  JournalTagSuggestionsResponse,
  JournalQuickAnalysisInput,
  JournalQuickAnalysisResponse,
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
  getJournalQuickAnalysis,
  getJournals,
  PremiumTagSuggestionsRequiredError,
  PremiumQuickAnalysisRequiredError,
  QuickAnalysisDisabledError,
  serializeJournal,
  suggestJournalTags,
  toggleJournalFavorite,
  updateJournal,
};
