import { z } from "zod";
import {
  detectJournalSafetySignal,
  hasJournalSafetySignal,
} from "../../helpers/journalSafety.helpers";
import {
  canUseOpenAiForUser,
  isOpenAiConfigured,
  requestEmbedding,
  requestStructuredOpenAi,
} from "../../helpers/openai.helpers";
import {
  detectEntryMetadataHeuristically,
  DETECTED_MOODS,
  ENTRY_TOPIC_TAXONOMY,
  normalizeDetectedTopics,
  type DetectedMood,
} from "../../helpers/entryMetadata.helpers";
import { AI_ACTION_BALANCE_GUIDANCE } from "../../helpers/aiReflectionBalance.helpers";
import { buildReflectionVoicePrompt } from "../../helpers/reflectionVoice.helpers";
import {
  buildPersonalizationDirective,
  buildUserPersonalization,
  toOnboardingLabel,
  toOnboardingLabelList,
  type UserPromptProfile,
} from "../../helpers/userPersonalization.helpers";
import {
  GOAL_ICON_KEYS,
  type GoalIconKey,
} from "../../helpers/goalIcons.helpers";
import { buildUserReflectionMemory } from "../mindmap/entryInsight.service";
import {
  getSavedGoalSuggestionContext,
  prepareNovelGoalSuggestions,
} from "../goals/goals.service";

type GuidedReflectionPromptAnswer = {
  questionId: string;
  question: string;
  answer: string;
};

type GuidedReflectionOnboardingContext = {
  ageRange?: string;
  primaryContext?: string;
  reflectionTone?: string[];
  primarySupportFocus?: string;
  supportFocusAreas?: string[];
  preferredTheme?: string;
};

type GuidedSuggestionAction =
  | "gentle_prompt"
  | "go_deeper"
  | "another_perspective"
  | "small_next_step"
  | "summarize";

type GuidedThreadMessage = {
  role: "user" | "assistant";
  kind: string;
  text: string;
  actionType?: GuidedSuggestionAction;
  promptQuestion?: string;
};

type FirstReflectionSummaryInput = {
  userId: string;
  promptAnswers: GuidedReflectionPromptAnswer[];
  onboardingContext?: GuidedReflectionOnboardingContext;
};

type GuidedReflectionGoDeeperInput = FirstReflectionSummaryInput & {
  aiSummary?: string;
  previousDeeperReflections?: string[];
  threadMessages?: GuidedThreadMessage[];
  currentText: string;
  suggestionAction?: GuidedSuggestionAction;
};

type GuidedReflectionSessionAnalysisInput = FirstReflectionSummaryInput & {
  journalId?: string;
  aiSummary?: string;
  threadMessages?: GuidedThreadMessage[];
};

type BrainReflectionCenterId =
  | "emotional_intensity"
  | "planning_self_control"
  | "memory_meaning"
  | "body_inner_signals"
  | "conflict_attention"
  | "motivation_reward"
  | "relationships_perspective"
  | "self_reflection_identity";

type BrainCenterIntensity = "low" | "moderate" | "high";

type BrainCenterNuancedDetails = {
  emotionalTone?: string | undefined;
  cognitivePattern?: string | undefined;
  timeOrientation?: "past" | "present" | "future" | "mixed" | undefined;
  selfOtherFocus?: "self" | "others" | "mixed" | undefined;
  actionOrientation?:
    | "reflecting"
    | "planning"
    | "avoiding"
    | "processing"
    | "acting"
    | undefined;
  repeatedSignal?: string | undefined;
};

type BrainCenterScore = {
  id: BrainReflectionCenterId;
  productName: string;
  brainRegion: string;
  score: number;
  confidence: number;
  rank: number;
  intensity: BrainCenterIntensity;
  evidence: string[];
  shortInsight: string;
  nuancedDetails: BrainCenterNuancedDetails;
};

type BrainSessionMap = {
  dominantCenterId: BrainReflectionCenterId;
  dominantCenter: BrainCenterScore;
  secondaryCenterIds: BrainReflectionCenterId[];
  secondaryCenters: BrainCenterScore[];
  centers: BrainCenterScore[];
  neuroscienceSummary: string;
  mostNoticedText: string;
  mindMapSeedText: string;
};

type FirstReflectionGoalCategory =
  | "journaling_habit"
  | "stress"
  | "mood"
  | "relationships"
  | "self_awareness"
  | "sleep"
  | "focus"
  | "confidence"
  | "general";

type FirstReflectionGoalSuggestion = {
  title: string;
  description: string;
  frequency: "daily" | "weekly" | "as_needed";
  category: FirstReflectionGoalCategory;
  /** Curated key from `helpers/goalIcons.helpers`, chosen by the model. */
  icon: GoalIconKey;
};

type GuidedReflectionGoalSuggestionsInput =
  GuidedReflectionSessionAnalysisInput & {
    sessionAnalysis?: {
      analysis?: string;
      majorInsight?: string;
      observedTrends?: string[];
      hasEnoughSignal?: boolean;
    };
  };

type FirstReflectionSummaryResponse = {
  reflection: string;
  // A single focused follow-up question delivered with the opening
  // analysis, to draw the user deeper into the session (their incentive to keep
  // writing). Becomes the first question of the adaptive go-deeper thread.
  followUpQuestion: string;
  takeaway?: string;
};

type GuidedReflectionGoDeeperResponse = {
  reflection: string;
  // The next focused question, generated adaptively from the user's last
  // answer. The user decides whether to answer it or wrap up (user-paced).
  nextQuestion: string;
  // False when the session has reached a natural, resolved stopping point.
  canGoDeeper: boolean;
};

type GuidedReflectionSessionAnalysisResponse = {
  analysis: string;
  majorInsight: string;
  observedTrends: string[];
  topicsObserved?: string[];
  detectedTopics: string[];
  detectedMood: DetectedMood;
  brainSessionMap: BrainSessionMap;
  hasEnoughSignal: boolean;
  /**
   * True when the analysis came from the deterministic fallback rather than the
   * model. Persisted snapshots carrying this are allowed to be regenerated once
   * a real analysis becomes available, so a transient AI outage does not freeze
   * generic copy onto an entry forever.
   */
  isFallback?: boolean;
};

const SESSION_ANALYSIS_MODEL = () =>
  process.env.OPENAI_GUIDED_REFLECTION_SESSION_ANALYSIS_MODEL?.trim() ||
  "gpt-5.6-terra";
// The conversational guided steps (summary, deeper questions, goals) now run on
// the latest model tier too, not just the session analysis, so the guided
// style depth is consistent across the whole flow.
const GUIDED_REFLECTION_MODEL = () =>
  process.env.OPENAI_GUIDED_REFLECTION_MODEL?.trim() ||
  process.env.OPENAI_GUIDED_REFLECTION_SESSION_ANALYSIS_MODEL?.trim() ||
  "gpt-5.6-terra";
// Guided reflection is the reflective conversation, so its analysis
// and follow-up turns run at high reasoning effort by default for real depth.
// Env-tunable to trade depth against latency (the client awaits these calls).
type GuidedReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max";
const GUIDED_REFLECTION_REASONING_EFFORT = (): GuidedReasoningEffort => {
  const raw = process.env.OPENAI_GUIDED_REFLECTION_REASONING_EFFORT?.trim();
  const allowed: GuidedReasoningEffort[] = [
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
  ];
  return allowed.includes(raw as GuidedReasoningEffort)
    ? (raw as GuidedReasoningEffort)
    : "high";
};

const SESSION_ANALYSIS_MAX_LENGTH = 680;
const SESSION_ANALYSIS_MAJOR_INSIGHT_MAX_LENGTH = 180;
const BRAIN_CENTER_INSIGHT_MAX_LENGTH = 180;
const BRAIN_CENTER_EVIDENCE_MAX_LENGTH = 48;
const BRAIN_SESSION_SUMMARY_MAX_LENGTH = 240;
const BRAIN_SESSION_MOST_NOTICED_MAX_LENGTH = 220;

type GuidedReflectionGoalSuggestionsResponse = {
  goals: FirstReflectionGoalSuggestion[];
  hasEnoughSignal: boolean;
};

const getWordCount = (value: string) =>
  value.trim().split(/\s+/).filter(Boolean).length;
const capWords = (value: string, limit = 70) =>
  value.trim().split(/\s+/).filter(Boolean).slice(0, limit).join(" ");

const conciseReflectionSchema = z
  .string()
  .trim()
  .min(120)
  .max(520)
  .refine((value) => getWordCount(value) >= 45 && getWordCount(value) <= 70);
const conciseQuestionSchema = z
  .string()
  .trim()
  .min(8)
  .max(160)
  .refine((value) => {
    const wordCount = getWordCount(value);
    return wordCount >= 6 && wordCount <= 24;
  });

const reflectionSummarySchema = z.object({
  reflection: conciseReflectionSchema,
  followUpQuestion: conciseQuestionSchema,
  takeaway: z.string().trim().min(8).max(220).optional(),
});

const goDeeperResponseSchema = z.object({
  reflection: conciseReflectionSchema,
  nextQuestion: conciseQuestionSchema,
  canGoDeeper: z.boolean(),
});

const brainReflectionCenterIdSchema = z.enum([
  "emotional_intensity",
  "planning_self_control",
  "memory_meaning",
  "body_inner_signals",
  "conflict_attention",
  "motivation_reward",
  "relationships_perspective",
  "self_reflection_identity",
]);

const brainCenterNuancedDetailsSchema = z.object({
  emotionalTone: z.string().trim().max(140).optional(),
  cognitivePattern: z.string().trim().max(140).optional(),
  timeOrientation: z.enum(["past", "present", "future", "mixed"]).optional(),
  selfOtherFocus: z.enum(["self", "others", "mixed"]).optional(),
  actionOrientation: z
    .enum(["reflecting", "planning", "avoiding", "processing", "acting"])
    .optional(),
  repeatedSignal: z.string().trim().max(140).optional(),
});

const brainCenterScoreSchema = z.object({
  id: brainReflectionCenterIdSchema,
  productName: z.string().trim().min(2).max(80),
  brainRegion: z.string().trim().min(2).max(100),
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  rank: z.number().int().min(1).max(8),
  intensity: z.enum(["low", "moderate", "high"]),
  evidence: z
    .array(z.string().trim().min(1).max(BRAIN_CENTER_EVIDENCE_MAX_LENGTH))
    .max(3),
  shortInsight: z.string().trim().min(8).max(BRAIN_CENTER_INSIGHT_MAX_LENGTH),
  nuancedDetails: brainCenterNuancedDetailsSchema,
});

const brainSessionMapSchema = z.object({
  dominantCenterId: brainReflectionCenterIdSchema,
  dominantCenter: brainCenterScoreSchema,
  secondaryCenterIds: z.array(brainReflectionCenterIdSchema).min(1).max(3),
  secondaryCenters: z.array(brainCenterScoreSchema).min(1).max(3),
  centers: z.array(brainCenterScoreSchema).length(8),
  neuroscienceSummary: z
    .string()
    .trim()
    .min(40)
    .max(BRAIN_SESSION_SUMMARY_MAX_LENGTH),
  mostNoticedText: z
    .string()
    .trim()
    .min(30)
    .max(BRAIN_SESSION_MOST_NOTICED_MAX_LENGTH),
  mindMapSeedText: z.string().trim().min(20).max(220),
});

const sessionAnalysisResponseSchema = z.object({
  analysis: z.string().trim().min(120).max(SESSION_ANALYSIS_MAX_LENGTH),
  majorInsight: z
    .string()
    .trim()
    .min(20)
    .max(SESSION_ANALYSIS_MAJOR_INSIGHT_MAX_LENGTH),
  observedTrends: z.array(z.string().trim().min(3).max(32)).min(2).max(4),
  detectedTopics: z.array(z.enum(ENTRY_TOPIC_TAXONOMY)).max(5),
  detectedMood: z.enum(DETECTED_MOODS),
  brainSessionMap: brainSessionMapSchema,
  hasEnoughSignal: z.boolean(),
});

const goalCategorySchema = z.enum([
  "journaling_habit",
  "stress",
  "mood",
  "relationships",
  "self_awareness",
  "sleep",
  "focus",
  "confidence",
  "general",
]);

const goalSuggestionSchema = z.object({
  title: z.string().trim().min(3).max(30),
  description: z.string().trim().min(12).max(96),
  frequency: z.enum(["daily", "weekly", "as_needed"]),
  category: goalCategorySchema,
  // Shares GOAL_ICON_KEYS with the JSON schema below. If the two enums drift,
  // requestStructuredOpenAi's parser fails and returns null — losing every goal,
  // not just the icon.
  icon: z.enum(GOAL_ICON_KEYS),
});

const goalSuggestionsResponseSchema = z.object({
  goals: z.array(goalSuggestionSchema).min(1).max(4),
  hasEnoughSignal: z.boolean(),
});

const guidedReflectionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reflection: {
      type: "string",
      minLength: 120,
      maxLength: 520,
    },
    followUpQuestion: {
      type: "string",
      minLength: 8,
      maxLength: 160,
    },
    takeaway: {
      type: "string",
      minLength: 8,
      maxLength: 220,
    },
  },
  required: ["reflection", "followUpQuestion", "takeaway"],
};

const goDeeperJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reflection: {
      type: "string",
      minLength: 120,
      maxLength: 520,
    },
    nextQuestion: {
      type: "string",
      minLength: 8,
      maxLength: 160,
    },
    canGoDeeper: {
      type: "boolean",
    },
  },
  required: ["reflection", "nextQuestion", "canGoDeeper"],
};

const BRAIN_CENTER_IDS: BrainReflectionCenterId[] = [
  "emotional_intensity",
  "planning_self_control",
  "memory_meaning",
  "body_inner_signals",
  "conflict_attention",
  "motivation_reward",
  "relationships_perspective",
  "self_reflection_identity",
];

const brainCenterNuancedDetailsJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    emotionalTone: {
      type: "string",
      maxLength: 140,
    },
    cognitivePattern: {
      type: "string",
      maxLength: 140,
    },
    timeOrientation: {
      type: "string",
      enum: ["past", "present", "future", "mixed"],
    },
    selfOtherFocus: {
      type: "string",
      enum: ["self", "others", "mixed"],
    },
    actionOrientation: {
      type: "string",
      enum: ["reflecting", "planning", "avoiding", "processing", "acting"],
    },
    repeatedSignal: {
      type: "string",
      maxLength: 140,
    },
  },
  required: [
    "emotionalTone",
    "cognitivePattern",
    "timeOrientation",
    "selfOtherFocus",
    "actionOrientation",
    "repeatedSignal",
  ],
};

const brainCenterScoreJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: {
      type: "string",
      enum: BRAIN_CENTER_IDS,
    },
    productName: {
      type: "string",
      minLength: 2,
      maxLength: 80,
    },
    brainRegion: {
      type: "string",
      minLength: 2,
      maxLength: 100,
    },
    score: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    rank: {
      type: "integer",
      minimum: 1,
      maximum: 8,
    },
    intensity: {
      type: "string",
      enum: ["low", "moderate", "high"],
    },
    evidence: {
      type: "array",
      maxItems: 3,
      items: {
        type: "string",
        minLength: 1,
        maxLength: BRAIN_CENTER_EVIDENCE_MAX_LENGTH,
      },
    },
    shortInsight: {
      type: "string",
      minLength: 8,
      maxLength: BRAIN_CENTER_INSIGHT_MAX_LENGTH,
    },
    nuancedDetails: brainCenterNuancedDetailsJsonSchema,
  },
  required: [
    "id",
    "productName",
    "brainRegion",
    "score",
    "confidence",
    "rank",
    "intensity",
    "evidence",
    "shortInsight",
    "nuancedDetails",
  ],
};

const brainSessionMapJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    dominantCenterId: {
      type: "string",
      enum: BRAIN_CENTER_IDS,
    },
    dominantCenter: brainCenterScoreJsonSchema,
    secondaryCenterIds: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "string",
        enum: BRAIN_CENTER_IDS,
      },
    },
    secondaryCenters: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: brainCenterScoreJsonSchema,
    },
    centers: {
      type: "array",
      minItems: 8,
      maxItems: 8,
      items: brainCenterScoreJsonSchema,
    },
    neuroscienceSummary: {
      type: "string",
      minLength: 40,
      maxLength: BRAIN_SESSION_SUMMARY_MAX_LENGTH,
    },
    mostNoticedText: {
      type: "string",
      minLength: 30,
      maxLength: BRAIN_SESSION_MOST_NOTICED_MAX_LENGTH,
    },
    mindMapSeedText: {
      type: "string",
      minLength: 20,
      maxLength: 220,
    },
  },
  required: [
    "dominantCenterId",
    "dominantCenter",
    "secondaryCenterIds",
    "secondaryCenters",
    "centers",
    "neuroscienceSummary",
    "mostNoticedText",
    "mindMapSeedText",
  ],
};

const sessionAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    analysis: {
      type: "string",
      minLength: 120,
      maxLength: SESSION_ANALYSIS_MAX_LENGTH,
    },
    majorInsight: {
      type: "string",
      minLength: 20,
      maxLength: SESSION_ANALYSIS_MAJOR_INSIGHT_MAX_LENGTH,
    },
    observedTrends: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "string",
        minLength: 3,
        maxLength: 32,
      },
    },
    detectedTopics: {
      type: "array",
      maxItems: 5,
      items: {
        type: "string",
        enum: ENTRY_TOPIC_TAXONOMY,
      },
    },
    detectedMood: {
      type: "string",
      enum: DETECTED_MOODS,
    },
    brainSessionMap: brainSessionMapJsonSchema,
    hasEnoughSignal: {
      type: "boolean",
    },
  },
  // `strict: true` requires every declared property to be listed here.
  required: [
    "analysis",
    "majorInsight",
    "observedTrends",
    "detectedTopics",
    "detectedMood",
    "brainSessionMap",
    "hasEnoughSignal",
  ],
};

const goalSuggestionsJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    goals: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: {
            type: "string",
            minLength: 3,
            maxLength: 30,
          },
          description: {
            type: "string",
            minLength: 12,
            maxLength: 96,
          },
          frequency: {
            type: "string",
            enum: ["daily", "weekly", "as_needed"],
          },
          category: {
            type: "string",
            enum: [
              "journaling_habit",
              "stress",
              "mood",
              "relationships",
              "self_awareness",
              "sleep",
              "focus",
              "confidence",
              "general",
            ],
          },
          icon: {
            type: "string",
            enum: [...GOAL_ICON_KEYS],
          },
        },
        // `strict: true` requires every property to appear in `required`.
        required: ["title", "description", "frequency", "category", "icon"],
      },
    },
    hasEnoughSignal: {
      type: "boolean",
    },
  },
  required: ["goals", "hasEnoughSignal"],
};

// The shared companion voice lives in reflectionVoice.helpers so Ask Jade
// speaks with the same safety limits; only the formatting directive below is
// specific to guided reflection.
const SYSTEM_PROMPT = buildReflectionVoicePrompt([
  "Write in tight, human, emotionally intelligent language: one grounded observation and one practical next step, 45–70 words, no filler, clichés, or over-explaining.",
]);

const BRAIN_CENTER_DETAILS: Record<
  BrainReflectionCenterId,
  {
    productName: string;
    brainRegion: string;
    lowSignalScore: number;
  }
> = {
  emotional_intensity: {
    productName: "Emotional Intensity",
    brainRegion: "Amygdala",
    lowSignalScore: 0.22,
  },
  planning_self_control: {
    productName: "Planning & Self-Control",
    brainRegion: "Prefrontal Cortex",
    lowSignalScore: 0.45,
  },
  memory_meaning: {
    productName: "Memory & Meaning",
    brainRegion: "Hippocampus",
    lowSignalScore: 0.35,
  },
  body_inner_signals: {
    productName: "Body & Inner Signals",
    brainRegion: "Insula",
    lowSignalScore: 0.18,
  },
  conflict_attention: {
    productName: "Conflict & Attention",
    brainRegion: "Anterior Cingulate Cortex",
    lowSignalScore: 0.24,
  },
  motivation_reward: {
    productName: "Motivation & Reward",
    brainRegion: "Reward Circuit / Ventral Striatum",
    lowSignalScore: 0.2,
  },
  relationships_perspective: {
    productName: "Relationships & Perspective",
    brainRegion: "Social Brain / Temporoparietal Junction",
    lowSignalScore: 0.26,
  },
  self_reflection_identity: {
    productName: "Self-Reflection & Identity",
    brainRegion: "Default Mode Network",
    lowSignalScore: 0.55,
  },
};

const BRAIN_CENTER_SIGNAL_RULES: Record<
  BrainReflectionCenterId,
  Array<{ terms: string[]; weight: number }>
> = {
  emotional_intensity: [
    {
      terms: ["stress", "stressful", "overwhelm", "overwhelmed"],
      weight: 0.22,
    },
    {
      terms: ["anger", "angry", "mad", "furious", "fear", "afraid"],
      weight: 0.22,
    },
    {
      terms: ["pressure", "pressured", "worried", "worry", "urgent"],
      weight: 0.18,
    },
    { terms: ["heavy", "threat", "panic", "anxious"], weight: 0.16 },
  ],
  planning_self_control: [
    {
      terms: ["discipline", "disciplined", "self-control", "control"],
      weight: 0.26,
    },
    {
      terms: ["tomorrow", "carry forward", "next step", "action"],
      weight: 0.22,
    },
    { terms: ["goal", "plan", "decision", "decide", "choice"], weight: 0.2 },
    {
      terms: ["routine", "habit", "focus", "focused", "protect my morning"],
      weight: 0.18,
    },
  ],
  memory_meaning: [
    {
      terms: ["remember", "memory", "memories", "past", "before"],
      weight: 0.22,
    },
    {
      terms: ["childhood", "old", "again", "repeated", "keeps happening"],
      weight: 0.2,
    },
    { terms: ["lesson", "meaning", "history", "used to"], weight: 0.18 },
  ],
  body_inner_signals: [
    {
      terms: ["tired", "exhausted", "drained", "sleep", "slept"],
      weight: 0.24,
    },
    { terms: ["energy", "body", "physical", "gut", "stomach"], weight: 0.22 },
    { terms: ["hungry", "food", "diet", "pain", "tense"], weight: 0.18 },
  ],
  conflict_attention: [
    {
      terms: ["guilt", "guilty", "stuck", "torn", "mixed feelings"],
      weight: 0.24,
    },
    { terms: ["uncertain", "unsure", "doubt", "contradiction"], weight: 0.22 },
    { terms: ["tension", "conflict", "but", "without turning"], weight: 0.16 },
  ],
  motivation_reward: [
    { terms: ["win", "wins", "progress", "momentum", "excited"], weight: 0.22 },
    { terms: ["stuck to", "consistent", "consistency", "effort"], weight: 0.2 },
    {
      terms: ["reward", "craving", "cravings", "proud", "motivated"],
      weight: 0.2,
    },
  ],
  relationships_perspective: [
    {
      terms: ["dad", "mom", "parent", "family", "brother", "sister"],
      weight: 0.26,
    },
    { terms: ["friend", "partner", "relationship", "people"], weight: 0.22 },
    {
      terms: ["judged", "seen", "belonging", "perception", "empathy"],
      weight: 0.2,
    },
  ],
  self_reflection_identity: [
    {
      terms: ["myself", "self", "self-image", "identity", "who I am"],
      weight: 0.24,
    },
    {
      terms: ["becoming", "values", "purpose", "growth", "better"],
      weight: 0.22,
    },
    {
      terms: ["inner", "prove", "proving", "alignment", "personal"],
      weight: 0.18,
    },
  ],
};

const normalizeText = (value: string, limit = 900) =>
  value.trim().replace(/\s+/g, " ").slice(0, limit);

const compactSessionAnalysisText = (value: string) => {
  const normalized = normalizeText(value);

  if (normalized.length <= SESSION_ANALYSIS_MAX_LENGTH) {
    return normalized;
  }

  const sentences = normalized.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [
    normalized,
  ];
  let compact = "";

  for (const sentence of sentences) {
    const candidate = `${compact}${compact ? " " : ""}${sentence.trim()}`;

    if (candidate.length > SESSION_ANALYSIS_MAX_LENGTH) {
      break;
    }

    compact = candidate;
  }

  return compact || normalizeText(normalized, SESSION_ANALYSIS_MAX_LENGTH);
};

const getMeaningfulWords = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^[-']+|[-']+$/g, ""))
    .filter((word) => word.length >= 3 && /[a-z]/.test(word));

const looksLikeGibberishWord = (word: string) => {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");

  if (!normalized) {
    return true;
  }

  if (
    /^(asdf|qwer|zxcv|hjkl|jkl|qaz|wsx|edc|rfv|tgb|yhn|ujm)+$/.test(normalized)
  ) {
    return true;
  }

  if (/(.)\1{3,}/.test(normalized)) {
    return true;
  }

  if (normalized.length >= 5 && !/[aeiouy]/.test(normalized)) {
    return true;
  }

  if (/[bcdfghjklmnpqrstvwxyz]{5,}/.test(normalized)) {
    return true;
  }

  return false;
};

const looksLikeLowSignalText = (value: string) => {
  const meaningfulWords = getMeaningfulWords(value);
  const informativeWords = meaningfulWords.filter(
    (word) => !looksLikeGibberishWord(word)
  );
  const uniqueWords = new Set(informativeWords);
  const gibberishWords = meaningfulWords.filter(looksLikeGibberishWord);
  const repeatedCharacterRuns = (value.match(/(.)\1{4,}/g) || []).length;
  const alphaNumeric = value.replace(/[^a-z0-9]/gi, "");
  const vowelCount = (alphaNumeric.match(/[aeiou]/gi) || []).length;
  const vowelRatio = alphaNumeric.length ? vowelCount / alphaNumeric.length : 0;

  if (informativeWords.length < 8 || uniqueWords.size < 5) {
    return true;
  }

  if (
    gibberishWords.length >= 3 &&
    gibberishWords.length / Math.max(meaningfulWords.length, 1) >= 0.3
  ) {
    return true;
  }

  if (repeatedCharacterRuns >= 2) {
    return true;
  }

  return alphaNumeric.length >= 24 && vowelRatio < 0.18;
};

const looksLikeMostlyGibberishText = (value: string) => {
  const meaningfulWords = getMeaningfulWords(value);
  const gibberishWords = meaningfulWords.filter(looksLikeGibberishWord);
  const informativeWords = meaningfulWords.filter(
    (word) => !looksLikeGibberishWord(word)
  );
  const repeatedCharacterRuns = (value.match(/(.)\1{4,}/g) || []).length;

  if (
    meaningfulWords.length >= 3 &&
    gibberishWords.length / meaningfulWords.length >= 0.3
  ) {
    return true;
  }

  if (repeatedCharacterRuns >= 2) {
    return true;
  }

  return meaningfulWords.length >= 4 && informativeWords.length < 2;
};

const getAnswer = (answers: GuidedReflectionPromptAnswer[], id: string) =>
  normalizeText(
    answers.find((answer) => answer.questionId === id)?.answer || "",
    260
  );

/**
 * Case-insensitive because the tone can arrive either as a stored option id
 * (`"direct"`, from the client) or as its display label (`"Direct"`, from the
 * server-side personalization profile).
 */
const getContextTone = (context?: GuidedReflectionOnboardingContext) =>
  context?.reflectionTone?.[0]?.trim().toLowerCase() || "neutral";

/**
 * Guided reflection is the one surface that also receives onboarding answers in
 * the request body. That is not redundant: during the V2 first reflection the
 * user has just answered those questions and nothing is persisted yet, so the
 * client copy is the only source. The server profile is therefore the base and
 * the client context overrides it field by field.
 */
const mergeGuidedReflectionProfile = (
  storedProfile: UserPromptProfile | undefined,
  clientContext: GuidedReflectionOnboardingContext | undefined
): UserPromptProfile | null => {
  const merged: UserPromptProfile = { ...(storedProfile || {}) };

  const ageRange = toOnboardingLabel(clientContext?.ageRange);
  const lifeContext = toOnboardingLabel(clientContext?.primaryContext);
  const reflectionTone = toOnboardingLabel(clientContext?.reflectionTone?.[0]);
  const focusAreas = toOnboardingLabelList(
    [
      clientContext?.primarySupportFocus,
      ...(clientContext?.supportFocusAreas || []),
    ].filter((value): value is string => Boolean(value))
  );

  if (ageRange) {
    merged.ageRange = ageRange;
  }

  if (lifeContext) {
    merged.lifeContext = lifeContext;
  }

  if (reflectionTone) {
    merged.reflectionTone = reflectionTone;
  }

  if (focusAreas) {
    merged.focusAreas = focusAreas;
  }

  return Object.keys(merged).length > 0 ? merged : null;
};

/**
 * Resolves the personalization for a guided-reflection request, and returns the
 * merged answers back in `onboardingContext` shape so the deterministic
 * fallbacks (`buildFallbackSummary` and friends) pick up the same tone the model
 * does, even when the AI call is skipped or fails.
 */
const resolveGuidedReflectionPersonalization = async <
  T extends FirstReflectionSummaryInput
>(
  input: T
): Promise<{
  input: T;
  userProfile: UserPromptProfile | null;
  systemDirective: string;
}> => {
  const stored = await buildUserPersonalization(input.userId);
  const userProfile = mergeGuidedReflectionProfile(
    stored?.promptProfile,
    input.onboardingContext
  );

  if (!userProfile) {
    return { input, userProfile: null, systemDirective: "" };
  }

  return {
    input: {
      ...input,
      onboardingContext: {
        ...(input.onboardingContext || {}),
        reflectionTone: userProfile.reflectionTone
          ? [userProfile.reflectionTone]
          : input.onboardingContext?.reflectionTone,
      },
    },
    userProfile,
    systemDirective: buildPersonalizationDirective(userProfile.reflectionTone),
  };
};

const clampSignal = (value: number, fallback = 0) => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, Number(value.toFixed(2))));
};

const getBrainCenterIntensity = (score: number): BrainCenterIntensity => {
  if (score >= 0.67) {
    return "high";
  }

  if (score >= 0.34) {
    return "moderate";
  }

  return "low";
};

const getEvidenceComparableText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const getBrainCenterTerms = (id: BrainReflectionCenterId) =>
  BRAIN_CENTER_SIGNAL_RULES[id].flatMap((rule) => rule.terms);

const getUserWrittenSessionText = (
  input: GuidedReflectionSessionAnalysisInput
) =>
  [
    ...input.promptAnswers.map((answer) => answer.answer),
    ...(input.threadMessages || [])
      .filter((message) => message.role === "user")
      .map((message) => message.text),
  ].join(" ");

const getSnippetFromSentence = (sentence: string, term: string) => {
  const words = sentence.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [];

  if (!words.length) {
    return "";
  }

  const comparableWords = words.map(getEvidenceComparableText);
  const termWords = getEvidenceComparableText(term).split(" ").filter(Boolean);
  let matchIndex = comparableWords.findIndex((word) =>
    termWords.includes(word)
  );

  if (termWords.length > 1) {
    const phrase = termWords.join(" ");
    const joined = comparableWords.join(" ");
    const phraseIndex = joined.indexOf(phrase);

    if (phraseIndex >= 0) {
      const prefix = joined.slice(0, phraseIndex).trim();
      matchIndex = prefix ? prefix.split(" ").length : 0;
    }
  }

  if (matchIndex < 0) {
    matchIndex = 0;
  }

  const start = Math.max(0, matchIndex - 1);
  const end = Math.min(
    words.length,
    Math.max(matchIndex + termWords.length + 2, start + 2)
  );

  return words.slice(start, Math.min(end, start + 6)).join(" ");
};

const extractEvidenceForCenter = (
  userWriting: string,
  id: BrainReflectionCenterId,
  limit = 3
) => {
  const comparableWriting = getEvidenceComparableText(userWriting);

  if (!comparableWriting) {
    return [];
  }

  const sentences = userWriting
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const snippets: string[] = [];

  for (const term of getBrainCenterTerms(id)) {
    const comparableTerm = getEvidenceComparableText(term);

    if (!comparableTerm || !comparableWriting.includes(comparableTerm)) {
      continue;
    }

    const sentence =
      sentences.find((item) =>
        getEvidenceComparableText(item).includes(comparableTerm)
      ) || userWriting;
    const snippet = getSnippetFromSentence(sentence, term);

    if (
      snippet &&
      !snippets.some(
        (item) =>
          getEvidenceComparableText(item) === getEvidenceComparableText(snippet)
      )
    ) {
      snippets.push(snippet);
    }

    if (snippets.length >= limit) {
      break;
    }
  }

  return snippets;
};

const sanitizeEvidence = (
  evidence: string[],
  userWriting: string,
  limit = 3
) => {
  const comparableWriting = getEvidenceComparableText(userWriting);
  const sanitized: string[] = [];

  if (!comparableWriting) {
    return sanitized;
  }

  for (const item of evidence) {
    const snippet = normalizeText(item, BRAIN_CENTER_EVIDENCE_MAX_LENGTH);
    const comparableSnippet = getEvidenceComparableText(snippet);

    if (
      comparableSnippet &&
      comparableWriting.includes(comparableSnippet) &&
      !sanitized.some(
        (value) => getEvidenceComparableText(value) === comparableSnippet
      )
    ) {
      sanitized.push(snippet);
    }

    if (sanitized.length >= limit) {
      break;
    }
  }

  return sanitized;
};

const detectTimeOrientation = (
  text: string
): BrainCenterNuancedDetails["timeOrientation"] => {
  const comparable = getEvidenceComparableText(text);
  const hasPast = /\b(yesterday|past|before|remember|childhood|old)\b/.test(
    comparable
  );
  const hasFuture = /\b(tomorrow|next|future|plan|goal|carry)\b/.test(
    comparable
  );

  if (hasPast && hasFuture) {
    return "mixed";
  }

  if (hasPast) {
    return "past";
  }

  if (hasFuture) {
    return "future";
  }

  return "present";
};

const detectSelfOtherFocus = (
  text: string,
  id: BrainReflectionCenterId
): BrainCenterNuancedDetails["selfOtherFocus"] => {
  const comparable = getEvidenceComparableText(text);
  const hasOthers =
    /\b(dad|mom|friend|partner|family|people|judged|seen|relationship)\b/.test(
      comparable
    );
  const hasSelf = /\b(i|me|my|myself|self|identity|becoming|values)\b/.test(
    comparable
  );

  if (id === "relationships_perspective") {
    return hasSelf ? "mixed" : "others";
  }

  if (hasOthers && hasSelf) {
    return "mixed";
  }

  return hasOthers ? "others" : "self";
};

const getActionOrientation = (
  id: BrainReflectionCenterId
): NonNullable<BrainCenterNuancedDetails["actionOrientation"]> => {
  if (id === "planning_self_control") {
    return "planning";
  }

  if (id === "motivation_reward") {
    return "acting";
  }

  if (id === "emotional_intensity" || id === "conflict_attention") {
    return "processing";
  }

  return "reflecting";
};

const buildNuancedDetails = (
  id: BrainReflectionCenterId,
  userWriting: string,
  evidence: string[]
): BrainCenterNuancedDetails => {
  const repeatedSignal = evidence[0] || "";

  const detailByCenter: Record<
    BrainReflectionCenterId,
    Pick<BrainCenterNuancedDetails, "emotionalTone" | "cognitivePattern">
  > = {
    emotional_intensity: {
      emotionalTone: "The writing carries some emotional charge or pressure.",
      cognitivePattern:
        "The mind appears to be tracking urgency, stress, or threat response.",
    },
    planning_self_control: {
      emotionalTone: "The tone leans toward steadiness and direction.",
      cognitivePattern:
        "The reflection organizes around choices, restraint, and next actions.",
    },
    memory_meaning: {
      emotionalTone: "The tone holds a meaning-making quality.",
      cognitivePattern:
        "The writing connects present experience with past moments or lessons.",
    },
    body_inner_signals: {
      emotionalTone: "The tone is grounded in the body's internal signals.",
      cognitivePattern:
        "The reflection notices energy, sleep, food, or physical state.",
    },
    conflict_attention: {
      emotionalTone:
        "The tone suggests competing feelings or unresolved tension.",
      cognitivePattern:
        "Attention appears split between two possible readings or choices.",
    },
    motivation_reward: {
      emotionalTone: "The tone includes momentum, reward, or reinforcement.",
      cognitivePattern:
        "The reflection tracks progress, effort, or what felt worth repeating.",
    },
    relationships_perspective: {
      emotionalTone:
        "The tone includes social awareness or being perceived by others.",
      cognitivePattern:
        "The writing considers other people, belonging, judgment, or perspective.",
    },
    self_reflection_identity: {
      emotionalTone:
        "The tone turns inward toward identity and personal growth.",
      cognitivePattern:
        "The reflection asks what this says about the user's inner narrative.",
    },
  };

  return {
    ...detailByCenter[id],
    timeOrientation: detectTimeOrientation(userWriting),
    selfOtherFocus: detectSelfOtherFocus(userWriting, id),
    actionOrientation: getActionOrientation(id),
    ...(repeatedSignal ? { repeatedSignal } : {}),
  };
};

const buildShortInsight = (
  id: BrainReflectionCenterId,
  score: number,
  evidence: string[]
) => {
  const phrase = evidence[0]
    ? `around "${evidence[0]}"`
    : "lightly in the session";

  if (score < 0.25) {
    return `${BRAIN_CENTER_DETAILS[id].productName} was present only lightly in this reflection.`;
  }

  const insightByCenter: Record<BrainReflectionCenterId, string> = {
    emotional_intensity: `This center picked up the emotional charge ${phrase}.`,
    planning_self_control: `This center stood out through discipline, direction, or next-step thinking ${phrase}.`,
    memory_meaning: `This center noticed the way past experience or meaning-making shaped the entry ${phrase}.`,
    body_inner_signals: `This center reflected body awareness, energy, rest, or internal signals ${phrase}.`,
    conflict_attention: `This center captured mixed feelings, tension, or being pulled between signals ${phrase}.`,
    motivation_reward: `This center reflected momentum, progress, reward, or effort ${phrase}.`,
    relationships_perspective: `This center stood out through social perception, belonging, or another person's role ${phrase}.`,
    self_reflection_identity: `This center reflected self-talk, values, identity, or who the user is becoming ${phrase}.`,
  };

  return insightByCenter[id];
};

const buildBrainCenterScore = ({
  id,
  score,
  confidence,
  rank,
  evidence,
  userWriting,
  shortInsight,
  nuancedDetails,
}: {
  id: BrainReflectionCenterId;
  score: number;
  confidence: number;
  rank: number;
  evidence: string[];
  userWriting: string;
  shortInsight?: string | undefined;
  nuancedDetails?: BrainCenterNuancedDetails | undefined;
}): BrainCenterScore => {
  const safeScore = clampSignal(score, BRAIN_CENTER_DETAILS[id].lowSignalScore);
  const safeEvidence = evidence
    .map((item) => normalizeText(item, BRAIN_CENTER_EVIDENCE_MAX_LENGTH))
    .filter(Boolean)
    .slice(0, 3);

  return {
    id,
    productName: BRAIN_CENTER_DETAILS[id].productName,
    brainRegion: BRAIN_CENTER_DETAILS[id].brainRegion,
    score: safeScore,
    confidence: clampSignal(confidence, 0.5),
    rank,
    intensity: getBrainCenterIntensity(safeScore),
    evidence: safeEvidence,
    shortInsight: shortInsight?.trim()
      ? normalizeText(shortInsight, BRAIN_CENTER_INSIGHT_MAX_LENGTH)
      : buildShortInsight(id, safeScore, safeEvidence),
    nuancedDetails: {
      ...buildNuancedDetails(id, userWriting, safeEvidence),
      ...(nuancedDetails || {}),
    },
  };
};

const rankBrainCenters = (centers: BrainCenterScore[]) => {
  const sorted = [...centers].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return (
      BRAIN_CENTER_IDS.indexOf(left.id) - BRAIN_CENTER_IDS.indexOf(right.id)
    );
  });

  if (sorted[0] && sorted[1] && sorted[0].score <= sorted[1].score) {
    sorted[0] = {
      ...sorted[0],
      score: clampSignal(sorted[1].score + 0.03, sorted[0].score),
    };
  }

  return sorted.map((center, index) => ({
    ...center,
    rank: index + 1,
    intensity: getBrainCenterIntensity(center.score),
  }));
};

const hasFlatScores = (centers: BrainCenterScore[]) => {
  const uniqueScores = new Set(
    centers.map((center) => center.score.toFixed(2))
  );
  return uniqueScores.size <= 1;
};

const getCenterKeywordScore = (id: BrainReflectionCenterId, text: string) => {
  const comparable = getEvidenceComparableText(text);

  return BRAIN_CENTER_SIGNAL_RULES[id].reduce((total, rule) => {
    const matched = rule.terms.some((term) =>
      comparable.includes(getEvidenceComparableText(term))
    );

    return matched ? total + rule.weight : total;
  }, 0);
};

const buildBrainSessionMapFromCenters = (
  centers: BrainCenterScore[],
  fallbackSummary?: Partial<
    Pick<BrainSessionMap, "neuroscienceSummary" | "mindMapSeedText">
  >
): BrainSessionMap => {
  const rankedCenters = rankBrainCenters(
    hasFlatScores(centers)
      ? centers.map((center) => ({
          ...center,
          score: BRAIN_CENTER_DETAILS[center.id].lowSignalScore,
        }))
      : centers
  );
  const dominantCenter = rankedCenters[0] as BrainCenterScore;
  const secondaryCenters = rankedCenters.slice(1, 4);
  const secondaryNames = secondaryCenters
    .map((center) => center.productName)
    .join(", ");
  const evidenceText = dominantCenter.evidence[0]
    ? ` The clearest evidence was "${dominantCenter.evidence[0]}."`
    : "";

  return {
    dominantCenterId: dominantCenter.id,
    dominantCenter,
    secondaryCenterIds: secondaryCenters.map((center) => center.id),
    secondaryCenters,
    centers: rankedCenters,
    neuroscienceSummary: normalizeText(
      fallbackSummary?.neuroscienceSummary ||
        `Your reflection leaned most strongly toward ${dominantCenter.productName}. ${dominantCenter.shortInsight}${evidenceText} Secondary signals included ${secondaryNames}.`,
      BRAIN_SESSION_SUMMARY_MAX_LENGTH
    ),
    mostNoticedText: normalizeText(
      `The strongest center in this session was ${
        dominantCenter.productName
      }, because your writing most clearly returned to ${
        dominantCenter.evidence[0] || dominantCenter.productName.toLowerCase()
      }.`,
      BRAIN_SESSION_MOST_NOTICED_MAX_LENGTH
    ),
    mindMapSeedText:
      fallbackSummary?.mindMapSeedText ||
      "Your first reflection has added its first signal to your Mind Map.",
  };
};

const buildDefaultBrainSessionMap = (
  input?: GuidedReflectionSessionAnalysisInput
): BrainSessionMap => {
  const userWriting = input ? getUserWrittenSessionText(input) : "";
  const centers = BRAIN_CENTER_IDS.map((id, index) => {
    const evidence = extractEvidenceForCenter(userWriting, id);

    return buildBrainCenterScore({
      id,
      score: BRAIN_CENTER_DETAILS[id].lowSignalScore,
      confidence: id === "self_reflection_identity" ? 0.58 : 0.44,
      rank: index + 1,
      evidence,
      userWriting,
    });
  });

  return buildBrainSessionMapFromCenters(centers, {
    neuroscienceSummary:
      "This reflection has started building your personal Mind Map by capturing what you noticed, what challenged you, and what you want to carry forward.",
    mindMapSeedText:
      "Your first reflection has added its first signal to your Mind Map.",
  });
};

const buildHeuristicBrainSessionMap = (
  input: GuidedReflectionSessionAnalysisInput
): BrainSessionMap => {
  const userWriting = getUserWrittenSessionText(input);

  if (looksLikeLowSignalText(userWriting)) {
    return buildDefaultBrainSessionMap(input);
  }

  const carryAnswer = getAnswer(
    input.promptAnswers,
    "carry_tomorrow"
  ).toLowerCase();
  const goodAnswer = getAnswer(
    input.promptAnswers,
    "good_exciting"
  ).toLowerCase();
  const hurdleAnswer = getAnswer(input.promptAnswers, "hurdle").toLowerCase();

  const centers = BRAIN_CENTER_IDS.map((id, index) => {
    let rawScore = 0.1 + getCenterKeywordScore(id, userWriting);

    if (id === "planning_self_control" && carryAnswer) {
      rawScore += 0.12;
    }

    if (id === "motivation_reward" && goodAnswer) {
      rawScore += 0.06;
    }

    if (id === "emotional_intensity" && hurdleAnswer) {
      rawScore += 0.06;
    }

    if (
      id === "relationships_perspective" &&
      /dad|mom|family|friend|partner|judged/.test(hurdleAnswer)
    ) {
      rawScore += 0.1;
    }

    if (id === "self_reflection_identity") {
      rawScore += 0.08;
    }

    const score = Math.min(0.92, rawScore);
    const evidence = extractEvidenceForCenter(userWriting, id);

    return buildBrainCenterScore({
      id,
      score,
      confidence: Math.min(0.86, 0.48 + evidence.length * 0.1 + score * 0.18),
      rank: index + 1,
      evidence,
      userWriting,
    });
  });

  return buildBrainSessionMapFromCenters(centers);
};

const normalizeBrainSessionMap = (
  brainSessionMap: BrainSessionMap,
  input: GuidedReflectionSessionAnalysisInput,
  fallback: BrainSessionMap
): BrainSessionMap => {
  const userWriting = getUserWrittenSessionText(input);
  const fallbackCentersById = new Map(
    fallback.centers.map((center) => [center.id, center])
  );
  const aiCentersById = new Map(
    brainSessionMap.centers.map((center) => [center.id, center])
  );
  const centers = BRAIN_CENTER_IDS.map((id, index) => {
    const aiCenter = aiCentersById.get(id);
    const fallbackCenter = fallbackCentersById.get(id);
    const aiEvidence = aiCenter
      ? sanitizeEvidence(aiCenter.evidence, userWriting)
      : [];
    const fallbackEvidence =
      fallbackCenter?.evidence || extractEvidenceForCenter(userWriting, id);

    return buildBrainCenterScore({
      id,
      score:
        aiCenter?.score ??
        fallbackCenter?.score ??
        BRAIN_CENTER_DETAILS[id].lowSignalScore,
      confidence: aiCenter?.confidence ?? fallbackCenter?.confidence ?? 0.5,
      rank: index + 1,
      evidence: aiEvidence.length ? aiEvidence : fallbackEvidence,
      userWriting,
      shortInsight: aiCenter?.shortInsight || fallbackCenter?.shortInsight,
      nuancedDetails: {
        ...(fallbackCenter?.nuancedDetails || {}),
        ...(aiCenter?.nuancedDetails || {}),
      },
    });
  });
  const normalized = buildBrainSessionMapFromCenters(centers);
  const aiNeuroscienceSummary =
    brainSessionMap.neuroscienceSummary?.trim() || "";
  const aiMostNoticedText = brainSessionMap.mostNoticedText?.trim() || "";
  const aiSummaryMatchesDominant = aiNeuroscienceSummary.includes(
    normalized.dominantCenter.productName
  );
  const aiMostNoticedMatchesDominant = aiMostNoticedText.includes(
    normalized.dominantCenter.productName
  );

  return {
    ...normalized,
    neuroscienceSummary: aiSummaryMatchesDominant
      ? normalizeText(aiNeuroscienceSummary, BRAIN_SESSION_SUMMARY_MAX_LENGTH)
      : fallback.neuroscienceSummary,
    mostNoticedText: aiMostNoticedMatchesDominant
      ? normalizeText(aiMostNoticedText, BRAIN_SESSION_MOST_NOTICED_MAX_LENGTH)
      : normalized.mostNoticedText,
    mindMapSeedText:
      brainSessionMap.mindMapSeedText?.trim() || fallback.mindMapSeedText,
  };
};

const getSuggestionInstruction = (action?: GuidedSuggestionAction) => {
  switch (action) {
    case "gentle_prompt":
      return "Return one gentle follow-up prompt and one short sentence explaining why it may help.";
    case "go_deeper":
      return "Offer a deeper reflection based on the user's answers while staying grounded and non-diagnostic.";
    case "another_perspective":
      return "Offer one alternative perspective without invalidating the user's feelings.";
    case "small_next_step":
      return "Suggest one small practical next step for tomorrow.";
    case "summarize":
      return "Summarize what the user has written so far in 2-3 sentences.";
    default:
      return "Respond to the user's added note with one concise deeper reflection.";
  }
};

const canUseOnboardingOpenAi = () => isOpenAiConfigured();

/**
 * Guided reflection is a premium (paid) experience. This gate requires an active
 * premium entitlement, except when GUIDED_REFLECTION_ALLOW_NON_PREMIUM is set
 * for development and testing. Flip the env off to enforce premium.
 */
const canUseGuidedReflectionAi = async (userId: string) => {
  if (process.env.GUIDED_REFLECTION_ALLOW_NON_PREMIUM === "true") {
    return canUseOnboardingOpenAi();
  }
  return canUseOpenAiForUser(userId);
};

/**
 * Best-effort embedding of the user's own writing in this session, used to pull
 * the most relevant past entries into long-term memory. Returns null on any
 * failure so memory falls back to rolling narrative + recurring themes.
 */
const buildSessionQueryEmbedding = async (
  input: GuidedReflectionSessionAnalysisInput
): Promise<number[] | null> => {
  const text = getUserWrittenSessionText(input);
  if (!text.trim()) {
    return null;
  }
  return requestEmbedding(normalizeText(text, 1600));
};

const buildSafetyFirstSummary = (): FirstReflectionSummaryResponse => ({
  reflection:
    "This entry sounds like it may need real support before deeper reflection. Keep this simple and immediate: if anyone might be in danger, reach out to a trusted person or local emergency support now. Journal.IO can hold the words, but safety should come first.",
  followUpQuestion: "What safe step can you take outside the app?",
  takeaway: "Support first, reflection second.",
});

const buildSafetyFirstDeeperResponse =
  (): GuidedReflectionGoDeeperResponse => ({
    reflection:
      "This is important enough to keep grounded in real-world support. If there is any chance of immediate harm, pause the reflection and contact a trusted person or local emergency support. You can come back to writing when things feel safer.",
    nextQuestion: "What safe step can you take outside the app?",
    canGoDeeper: false,
  });

const buildLowSignalFirstSummary = (): FirstReflectionSummaryResponse => ({
  reflection:
    "I do not have enough clear information yet to make a useful reflection. Journal.IO works best when you add a few specific words about what happened, what felt difficult, and what you want to carry into tomorrow. You can keep this simple and try again with one honest sentence per prompt.",
  followUpQuestion: "What specific moment from today can you name?",
  takeaway: "Add a little more detail so the reflection can stay useful.",
});

const buildLowSignalDeeperResponse = (): GuidedReflectionGoDeeperResponse => ({
  reflection:
    "There is not enough clear information to go deeper usefully yet. Add one specific moment, the feeling it brought up, and what you needed then. That detail will make the next reflection more grounded and practical, without forcing meaning that your words do not support.",
  nextQuestion: "What specific moment from today can you name?",
  canGoDeeper: true,
});

const hasSafetySignal = (
  answers: GuidedReflectionPromptAnswer[],
  extraText = ""
) => {
  const combinedText = [
    ...answers.map((answer) => answer.answer),
    extraText,
  ].join(" ");

  return hasJournalSafetySignal(detectJournalSafetySignal(combinedText));
};

const buildFallbackSummary = ({
  promptAnswers,
  onboardingContext,
}: FirstReflectionSummaryInput): FirstReflectionSummaryResponse => {
  const good =
    normalizeText(getAnswer(promptAnswers, "good_exciting"), 72) ||
    "something worth noticing";
  const hurdle =
    normalizeText(getAnswer(promptAnswers, "hurdle"), 72) ||
    "something that felt difficult";
  const carry =
    normalizeText(getAnswer(promptAnswers, "carry_tomorrow"), 72) ||
    "one small thing to carry forward";
  const tone = getContextTone(onboardingContext);
  const practicalEnding =
    tone === "practical"
      ? " For tomorrow, keep the next step small enough to actually use."
      : " For tomorrow, let one small reminder be enough.";

  return {
    reflection: capWords(
      `Today includes ${good}, but ${hurdle} deserves slightly more attention because unresolved friction often carries the clearest next signal. Notice what triggered it, what it cost, or what need went unanswered without turning it into a verdict on yourself. ${good} still matters as evidence of capacity.${practicalEnding} Use ${carry} in one visible action and notice what remains difficult.`
    ),
    followUpQuestion:
      "What made the difficult moment harder than it needed to be?",
    takeaway: "Face the friction clearly, then choose one grounded next step.",
  };
};

const buildFallbackDeeperResponse = ({
  promptAnswers,
  currentText,
  suggestionAction,
  onboardingContext,
}: GuidedReflectionGoDeeperInput): GuidedReflectionGoDeeperResponse => {
  const note = normalizeText(currentText, 84);
  const good =
    normalizeText(getAnswer(promptAnswers, "good_exciting"), 64) ||
    "what went well";
  const hurdle =
    normalizeText(getAnswer(promptAnswers, "hurdle"), 64) ||
    "what felt difficult";
  const carry =
    normalizeText(getAnswer(promptAnswers, "carry_tomorrow"), 64) ||
    "what you want to carry forward";
  const tone = getContextTone(onboardingContext);
  const nextQuestion =
    tone === "direct"
      ? "What is the clearest next action from here?"
      : "What small change would make tomorrow feel more aligned?";

  if (suggestionAction === "another_perspective") {
    return {
      reflection: capWords(
        `Another perspective is that ${good} does not cancel ${hurdle}; it shows you had some capacity while a harder pattern was still active. Give the friction more attention: what triggered it, what kept it going, and what it asked from you. Let ${carry} guide one visible choice tomorrow without pretending the unresolved part has disappeared.`
      ),
      nextQuestion,
      canGoDeeper: true,
    };
  }

  if (suggestionAction === "small_next_step") {
    return {
      reflection: capWords(
        `A practical next step is to choose one concrete action that supports ${carry}. Keep it small enough to do even if ${hurdle} still feels present. Give it a clear time or trigger tomorrow, then treat completion as information rather than a test of your motivation or worth.`
      ),
      nextQuestion: "Which action can you make smaller and more specific?",
      canGoDeeper: true,
    };
  }

  if (suggestionAction === "summarize") {
    return {
      reflection: capWords(
        `Your entry holds three threads: ${hurdle}, ${good}, and ${carry}. The difficult part deserves the closest look because it may show what keeps creating friction; the positive part shows what capacity is already available. A practical conclusion is to choose one action that supports what you want to carry forward without pretending the harder pattern is resolved.`
      ),
      nextQuestion: "What part of that summary feels most true?",
      canGoDeeper: false,
    };
  }

  if (suggestionAction === "gentle_prompt") {
    return {
      reflection: capWords(
        `A gentle place to continue is the moment around ${hurdle}. Rather than judging how you handled it, notice what you needed and whether you could name that need at the time. This may turn the experience into one useful signal for tomorrow instead of another reason to criticize yourself.`
      ),
      nextQuestion: "What did that part of the day need from you?",
      canGoDeeper: true,
    };
  }

  return {
    reflection: capWords(
      `This added note gives the reflection more shape: ${note}. Look first at the friction it reveals, including what may be repeating, avoided, or left unresolved, while staying within what you actually wrote. Then notice the strength or resource that is still available. Choose one small response for tomorrow and track what remains difficult instead of rushing to a positive conclusion.`
    ),
    nextQuestion,
    canGoDeeper: true,
  };
};

const getSessionText = (input: GuidedReflectionSessionAnalysisInput) =>
  [
    ...input.promptAnswers.map((answer) => answer.answer),
    input.aiSummary || "",
    ...(input.threadMessages || []).map((message) => message.text),
  ].join(" ");

const LOW_SIGNAL_ANALYSIS_TEXT =
  "There is not enough clear information in this session to form a useful insight yet. Journal.IO can notice patterns best when the entry includes a few specific details about what happened, what felt difficult, and what you want to carry forward. You can still save this entry, and future reflections will give the app more to work with.";
const LOW_SIGNAL_MAJOR_INSIGHT =
  "Major insight: there is not enough clear detail yet to identify a reliable pattern.";
const LOW_SIGNAL_TRENDS = [
  "More detail needed",
  "Reflection started",
  "Tomorrow",
];

const buildLowSignalSessionAnalysis = (
  input?: GuidedReflectionSessionAnalysisInput
): GuidedReflectionSessionAnalysisResponse => ({
  analysis: LOW_SIGNAL_ANALYSIS_TEXT,
  majorInsight: LOW_SIGNAL_MAJOR_INSIGHT,
  observedTrends: [...LOW_SIGNAL_TRENDS],
  topicsObserved: [...LOW_SIGNAL_TRENDS],
  detectedTopics: [],
  detectedMood: "okay",
  brainSessionMap: buildDefaultBrainSessionMap(input),
  hasEnoughSignal: false,
  isFallback: false,
});

/**
 * Sentences long enough to stand on their own, used to keep the open-ended
 * fallback anchored in what the user actually wrote.
 */
const getSessionSentences = (value: string) =>
  value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => normalizeText(sentence, 160))
    .filter((sentence) => sentence.split(" ").filter(Boolean).length >= 3);

const buildSessionAnalysisFallback = ({
  userId,
  promptAnswers,
  aiSummary,
  threadMessages,
}: GuidedReflectionSessionAnalysisInput): GuidedReflectionSessionAnalysisResponse => {
  const good = getAnswer(promptAnswers, "good_exciting");
  const hurdle = getAnswer(promptAnswers, "hurdle");
  const carry = getAnswer(promptAnswers, "carry_tomorrow");
  const brainMapInput: GuidedReflectionSessionAnalysisInput = {
    userId,
    promptAnswers,
    ...(aiSummary ? { aiSummary } : {}),
    ...(threadMessages ? { threadMessages } : {}),
  };
  const userWriting = getUserWrittenSessionText(brainMapInput);
  const metadata = detectEntryMetadataHeuristically(userWriting);
  // Open-ended entries arrive as a single `open_ended_entry` answer, so none of
  // the guided question ids resolve. Anchoring on the user's own sentences
  // keeps the fallback about their entry instead of generic guided-flow copy.
  const isGuidedShaped = Boolean(good || hurdle || carry);
  const sentences = getSessionSentences(userWriting);
  const opening = sentences[0] || normalizeText(userWriting, 160);
  const closing = sentences[sentences.length - 1] || opening;

  const analysisSentences = isGuidedShaped
    ? [
        `The clearest unresolved signal is ${
          hurdle || "one harder moment"
        }, and it deserves slightly more attention than the steadier moment because it may show where pressure, avoidance, or an unmet need is still active.`,
        `${
          good || "One steady moment"
        } remains useful evidence of capacity, but it should not soften or erase the harder part.`,
        `The direction for tomorrow is ${
          carry || "one thing to carry into tomorrow"
        }, which gives the session a practical response rather than a falsely resolved ending.`,
        `A broader pattern may be emerging around facing friction more directly while using existing strengths to support one specific action.`,
      ]
    : [
        `The clearest signal in this entry sits around "${opening}", which suggests that is what currently carries the most weight for you.`,
        closing && closing !== opening
          ? `Where the writing moves toward "${closing}", it reads as something still open rather than settled.`
          : `The rest of the entry stays close to that same thread rather than resolving it.`,
        `A fuller reflection next time would let Journal.IO show the pattern here more precisely.`,
      ];

  return {
    analysis: compactSessionAnalysisText(analysisSentences.join(" ")),
    majorInsight: isGuidedShaped
      ? "Major insight: the strongest signal is the unresolved friction and the chance to meet it with one grounded action."
      : "Major insight: the strongest signal is what you kept returning to in this entry.",
    observedTrends: isGuidedShaped
      ? ["Pressure", "Unresolved friction", "Steadiness", "Tomorrow"]
      : ["Unresolved thread", "Written reflection", "Tomorrow"],
    topicsObserved: metadata.detectedTopics,
    detectedTopics: metadata.detectedTopics,
    detectedMood: metadata.detectedMood,
    brainSessionMap: buildHeuristicBrainSessionMap(brainMapInput),
    hasEnoughSignal: true,
    isFallback: true,
  };
};

const buildFallbackGoalSuggestions = (
  input?: Partial<GuidedReflectionGoalSuggestionsInput>,
  hasEnoughSignal = true
): GuidedReflectionGoalSuggestionsResponse => {
  const hurdle = normalizeText(
    getAnswer(input?.promptAnswers || [], "hurdle") || "the hardest moment",
    32
  );
  const carry = normalizeText(
    getAnswer(input?.promptAnswers || [], "carry_tomorrow") ||
      "your next priority",
    38
  );
  const sessionText = [
    ...(input?.promptAnswers || []).map((answer) => answer.answer),
    input?.aiSummary || "",
    input?.sessionAnalysis?.analysis || "",
    input?.sessionAnalysis?.majorInsight || "",
    ...(input?.sessionAnalysis?.observedTrends || []),
  ]
    .join(" ")
    .toLowerCase();
  const goals: FirstReflectionGoalSuggestion[] = [
    {
      title: "Write for 5 minutes",
      description:
        "After dinner, write the one moment from today you want to remember.",
      frequency: "daily",
      category: "journaling_habit",
      icon: "journal",
    },
    {
      title: "Write one line after dinner",
      description:
        "After dinner, write one line about what repeated in your day.",
      frequency: "daily",
      category: "self_awareness",
      icon: "mood",
    },
    {
      title: "Start tomorrow in 5 minutes",
      description: `Before noon, spend five minutes on: ${carry}.`,
      frequency: "as_needed",
      category: "general",
      icon: "target",
    },
  ];

  if (sessionText.includes("stress") || sessionText.includes("pressure")) {
    goals.unshift({
      title: "Pause and name the pressure",
      description: `When ${hurdle} comes up, pause one minute and name your next small step.`,
      frequency: "as_needed",
      category: "stress",
      icon: "anxiety",
    });
  }

  if (sessionText.includes("discipline") || sessionText.includes("habit")) {
    goals.unshift({
      title: "Do one steady 5-minute task",
      description:
        "Before noon, repeat the smallest useful part of your routine for five minutes.",
      frequency: "daily",
      category: "general",
      icon: "target",
    });
  }

  return {
    goals: goals.slice(0, hasEnoughSignal ? 4 : 3),
    hasEnoughSignal,
  };
};

const createFirstReflectionSummary = async (
  input: FirstReflectionSummaryInput
): Promise<FirstReflectionSummaryResponse> => {
  if (hasSafetySignal(input.promptAnswers)) {
    return buildSafetyFirstSummary();
  }

  if (looksLikeMostlyGibberishText(getSessionText(input))) {
    return buildLowSignalFirstSummary();
  }

  const {
    input: personalizedInput,
    userProfile,
    systemDirective,
  } = await resolveGuidedReflectionPersonalization(input);
  const fallback = buildFallbackSummary(personalizedInput);

  if (!(await canUseGuidedReflectionAi(input.userId))) {
    return fallback;
  }

  const queryEmbedding = await buildSessionQueryEmbedding(input);
  const longTermMemory = await buildUserReflectionMemory(input.userId, {
    queryEmbedding,
  });

  const aiResponse = await requestStructuredOpenAi({
    feature: "first guided reflection summary",
    schemaName: "first_guided_reflection_summary",
    schema: guidedReflectionJsonSchema,
    parser: reflectionSummarySchema,
    model: GUIDED_REFLECTION_MODEL(),
    maxOutputTokens: 360,
    reasoningEffort: GUIDED_REFLECTION_REASONING_EFFORT(),
    messages: [
      {
        role: "system",
        content: [SYSTEM_PROMPT, systemDirective].filter(Boolean).join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Open the guided reflection with 45-70 words. Give one grounded observation from the user's own words and one practical next step. Acknowledge anything heavy with care, but do not over-explain or claim therapeutic authority. Set followUpQuestion to one specific, curious question of 6-24 words and at most 160 characters that opens the thread most worth exploring — a short lead-in before the question is fine. Keep the question separate from reflection.",
          promptAnswers: input.promptAnswers.map((answer) => ({
            questionId: answer.questionId,
            question: answer.question,
            answer: normalizeText(answer.answer),
          })),
          longTermMemory: longTermMemory || "No prior sessions yet.",
          userProfile,
          fallbackStyleExample: fallback.reflection,
        }),
      },
    ],
  });

  if (!aiResponse) {
    return fallback;
  }

  return {
    reflection: aiResponse.reflection,
    followUpQuestion: aiResponse.followUpQuestion,
    ...(aiResponse.takeaway ? { takeaway: aiResponse.takeaway } : {}),
  };
};

const createGuidedReflectionGoDeeper = async (
  input: GuidedReflectionGoDeeperInput
): Promise<GuidedReflectionGoDeeperResponse> => {
  if (hasSafetySignal(input.promptAnswers, input.currentText)) {
    return buildSafetyFirstDeeperResponse();
  }

  if (looksLikeMostlyGibberishText(getSessionText(input))) {
    return buildLowSignalDeeperResponse();
  }

  const {
    input: personalizedInput,
    userProfile,
    systemDirective,
  } = await resolveGuidedReflectionPersonalization(input);
  const fallback = buildFallbackDeeperResponse(personalizedInput);

  if (!(await canUseGuidedReflectionAi(input.userId))) {
    return fallback;
  }

  const queryEmbedding = await buildSessionQueryEmbedding(input);
  const longTermMemory = await buildUserReflectionMemory(input.userId, {
    queryEmbedding,
  });
  const turnsSoFar = (input.previousDeeperReflections || []).length;

  const aiResponse = await requestStructuredOpenAi({
    feature: "guided reflection go deeper",
    schemaName: "guided_reflection_go_deeper",
    schema: goDeeperJsonSchema,
    parser: goDeeperResponseSchema,
    model: GUIDED_REFLECTION_MODEL(),
    maxOutputTokens: 360,
    reasoningEffort: GUIDED_REFLECTION_REASONING_EFFORT(),
    messages: [
      {
        role: "system",
        content: [
          SYSTEM_PROMPT,
          "This is a live, therapeutically informed deepening conversation. React to the user's latest answer specifically.",
          "Write 45-70 words with one grounded observation and one practical next step. If they shared something heavy, acknowledge it with care first.",
          "Then ask exactly one separate question of 6-24 words and at most 160 characters. It must build directly on their answer without sounding generic. You have room for a short lead-in before the question when it makes the question land more precisely.",
          "Follow the probing ladder: when their answer reveals a behaviour, coping habit, avoidance, or contradiction, aim the question at its function or cost (how it helps or hurts them, what it protects them from, what need it meets, whether it is becoming a pattern) rather than moving to a new topic. Go one rung deeper than they went, without judging the behaviour.",
          "Read whether they want to go deeper or simply be heard. If they are venting or emotionally full, keep the reflection validating and make the question soft and optional — never push. If there is a real thread to pull, invite them further in.",
          "Set canGoDeeper to false only when the reflection has reached a natural, resolved stopping point or the user clearly has nothing left to explore; otherwise true.",
          "Use longTermMemory actively: when today echoes a specific incident, relationship, or thread the user raised in a past session, name it and check the connection directly (e.g. 'a few entries back you mentioned X — does this feel connected?'). Prefer a concrete past detail over a vague 'you often…'. Never fabricate history; if memory is empty or unrelated, stay with today.",
          systemDirective,
        ]
          .filter(Boolean)
          .join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Continue the deepening conversation: reflect honestly on the user's latest answer, acknowledging anything heavy with care first, then ask one follow-up question — deeper when there's something to explore, gentler when they mainly need to be heard. Do not repeat earlier reflections.",
          turnsSoFar,
          suggestionAction: input.suggestionAction || null,
          suggestionInstruction: getSuggestionInstruction(
            input.suggestionAction
          ),
          promptAnswers: input.promptAnswers.map((answer) => ({
            questionId: answer.questionId,
            question: answer.question,
            answer: normalizeText(answer.answer),
          })),
          aiSummary: input.aiSummary ? normalizeText(input.aiSummary, 700) : "",
          previousDeeperReflections: (
            input.previousDeeperReflections || []
          ).map((item) => normalizeText(item, 500)),
          threadMessages: (input.threadMessages || []).map((message) => ({
            role: message.role,
            kind: normalizeText(message.kind, 80),
            text: normalizeText(message.text, 700),
            actionType: message.actionType || null,
            promptQuestion: message.promptQuestion
              ? normalizeText(message.promptQuestion, 100)
              : null,
          })),
          currentText: normalizeText(input.currentText),
          longTermMemory: longTermMemory || "No prior sessions yet.",
          userProfile,
        }),
      },
    ],
  });

  if (!aiResponse) {
    return fallback;
  }

  return {
    reflection: aiResponse.reflection,
    nextQuestion: aiResponse.nextQuestion,
    canGoDeeper: aiResponse.canGoDeeper,
  };
};

const createGuidedReflectionSessionAnalysis = async (
  input: GuidedReflectionSessionAnalysisInput
): Promise<GuidedReflectionSessionAnalysisResponse> => {
  const sessionText = getSessionText(input);

  if (looksLikeLowSignalText(sessionText)) {
    return buildLowSignalSessionAnalysis(input);
  }

  if (hasSafetySignal(input.promptAnswers, sessionText)) {
    return {
      analysis:
        "This session includes signals that should be treated with care before deeper pattern-reading. The safest insight is to keep the next step grounded in support, stability, and one immediate action outside the app if anything feels urgent. Journal.IO can help organize the reflection, but it should not replace real-world support when safety may be involved.",
      majorInsight:
        "Major insight: prioritize safety and real-world support before deeper reflection.",
      observedTrends: ["Safety", "Support", "Grounding"],
      topicsObserved: ["Safety", "Support", "Grounding"],
      detectedTopics: [],
      detectedMood: "terrible",
      brainSessionMap: buildHeuristicBrainSessionMap(input),
      hasEnoughSignal: true,
      isFallback: false,
    };
  }

  const fallback = buildSessionAnalysisFallback(input);

  if (!(await canUseGuidedReflectionAi(input.userId))) {
    return fallback;
  }

  const { userProfile, systemDirective } =
    await resolveGuidedReflectionPersonalization(input);

  const queryEmbedding = await buildSessionQueryEmbedding(input);
  const longTermMemory = await buildUserReflectionMemory(input.userId, {
    queryEmbedding,
  });

  const aiResponse = await requestStructuredOpenAi({
    feature: "guided reflection session analysis",
    schemaName: "guided_reflection_session_analysis",
    schema: sessionAnalysisJsonSchema,
    parser: sessionAnalysisResponseSchema,
    maxOutputTokens: 2400,
    model: SESSION_ANALYSIS_MODEL(),
    // High reasoning by default for nuanced reflective depth; env-tunable
    // via OPENAI_GUIDED_REFLECTION_REASONING_EFFORT. maxOutputTokens stays at
    // 2400 so the full 8-center brainSessionMap never truncates.
    reasoningEffort: GUIDED_REFLECTION_REASONING_EFFORT(),
    messages: [
      {
        role: "system",
        content: [
          SYSTEM_PROMPT,
          "For this task, write a session-level insight, not another reflective chat reply.",
          "Read like a skilled, grounded reflection guide: surface the clearest behaviour-focused pattern and, where the writing shows it, name the trigger or the feeling it regulates (the behaviour AND what sets it off or what it soothes), because that link is usually what the user cannot see. Where longTermMemory supports it, connect this to a specific past detail and note how it may be recurring. Name the pattern and its cost or function; never label the behaviour good or bad, never moralise, never clinical, diagnostic, or authority-claiming.",
          "Use behavior-focused language such as 'suggests', 'may show', 'appears connected to', and 'the clearest signal is'.",
          "Apply the challenge-forward balance across the analysis, major insight, trends, detected topics, and reflection-center reasoning. Do not let an encouraging conclusion hide supported difficulty.",
          "If the writing is unclear or too sparse, say there is not enough information rather than inventing insight.",
          "Keep it short but genuinely insightful: a precise 3-4 sentence analysis (no more than about 110 words), one bold-worthy major insight sentence without markdown, 2-4 short trend labels, and a brain-inspired reflection-center classification.",
          `Return one to five genuine detectedTopics using only this taxonomy: ${ENTRY_TOPIC_TAXONOMY.join(
            ", "
          )}.`,
          "Whenever hasEnoughSignal is true you must return at least one detectedTopic: choose the closest taxonomy entry rather than returning an empty list. Return an empty list only when hasEnoughSignal is false.",
          "Set hasEnoughSignal to false only when the writing is too sparse, too vague, or too unreadable to support a real pattern, and true whenever there is enough to say something specific about this session.",
          "Classify detectedMood as exactly one of amazing, good, okay, bad, or terrible. Use okay when the tone is mixed or unclear.",
          "The brainSessionMap must always include all 8 centers, exactly one dominant center, 1-3 secondary centers, and centers sorted by score descending.",
          "Scores and confidence values must be between 0 and 1, must not all be equal, and the dominant center must have the highest score.",
          "Classify by the overall meaning of the session, not shallow keyword matching.",
          "Evidence must come only from the user-authored prompt answers or user thread messages, not from assistant text. Keep up to three evidence chips short, usually 2-6 words, and do not invent facts.",
          "Use premium, concise, emotionally intelligent language. Do not sound robotic, clinical, or over-explain the neuroscience.",
          systemDirective,
        ]
          .filter(Boolean)
          .join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Analyze the full reflection session. Identify meaningful behavior-focused patterns, what the user may be trying to carry forward, genuine detected topics, one five-value mood, and the required brainSessionMap. Do not diagnose, claim therapy, or invent facts.",
          brainReflectionCenters: BRAIN_CENTER_IDS.map((id) => ({
            id,
            productName: BRAIN_CENTER_DETAILS[id].productName,
            brainRegion: BRAIN_CENTER_DETAILS[id].brainRegion,
          })),
          classificationRules: {
            emotional_intensity:
              "Stress, overwhelm, anger, fear, pressure, emotional charge, threat response, emotional urgency.",
            planning_self_control:
              "Goals, discipline, decisions, planning, restraint, rational thought, problem solving, tomorrow's actions.",
            memory_meaning:
              "Memories, past experiences, repeated moments, lessons, personal history, meaning-making.",
            body_inner_signals:
              "Tiredness, sleep, energy, hunger, body sensations, gut feeling, physical awareness, internal state.",
            conflict_attention:
              "Inner conflict, guilt, uncertainty, mixed feelings, attention, being stuck, competing choices.",
            motivation_reward:
              "Wins, cravings, excitement, progress, effort, reward, momentum, habit reinforcement.",
            relationships_perspective:
              "Family, friends, social judgment, empathy, belonging, conflict with others, being seen, perspective-taking.",
            self_reflection_identity:
              "Self-talk, identity, values, purpose, personal growth, who the user is becoming, inner narrative.",
          },
          promptAnswers: input.promptAnswers.map((answer) => ({
            questionId: answer.questionId,
            question: answer.question,
            answer: normalizeText(answer.answer),
          })),
          userWritingOnly: normalizeText(
            getUserWrittenSessionText(input),
            1600
          ),
          longTermMemory: longTermMemory || "No prior sessions yet.",
          aiSummary: input.aiSummary ? normalizeText(input.aiSummary, 900) : "",
          threadMessages: (input.threadMessages || []).map((message) => ({
            role: message.role,
            kind: normalizeText(message.kind, 80),
            text: normalizeText(message.text, 900),
            actionType: message.actionType || null,
            promptQuestion: message.promptQuestion
              ? normalizeText(message.promptQuestion, 100)
              : null,
          })),
          userProfile,
          fallbackStyleExample: fallback.analysis,
        }),
      },
    ],
  });

  if (!aiResponse) {
    return fallback;
  }

  const brainSessionMap = normalizeBrainSessionMap(
    aiResponse.brainSessionMap,
    input,
    fallback.brainSessionMap
  );

  // The schema forces a 120-character analysis even when the model has nothing
  // to work with, so the placeholder copy is authored here instead. The brain
  // map still comes from the model — the screen keeps rendering its cards.
  if (!aiResponse.hasEnoughSignal) {
    return {
      analysis: LOW_SIGNAL_ANALYSIS_TEXT,
      majorInsight: LOW_SIGNAL_MAJOR_INSIGHT,
      observedTrends: [...LOW_SIGNAL_TRENDS],
      topicsObserved: normalizeDetectedTopics(aiResponse.detectedTopics),
      detectedTopics: normalizeDetectedTopics(aiResponse.detectedTopics),
      detectedMood: aiResponse.detectedMood,
      brainSessionMap,
      hasEnoughSignal: false,
      isFallback: false,
    };
  }

  // A session with real signal should carry at least one tag, otherwise the
  // Topics Detected card has nothing to show. Fall back to the heuristic
  // taxonomy match rather than inventing one — the card has a placeholder for
  // the rare case where neither finds anything.
  const modelTopics = normalizeDetectedTopics(aiResponse.detectedTopics);
  const detectedTopics = modelTopics.length
    ? modelTopics
    : detectEntryMetadataHeuristically(getUserWrittenSessionText(input))
        .detectedTopics;

  return {
    analysis: aiResponse.analysis,
    majorInsight: `Major insight: ${aiResponse.majorInsight.replace(
      /^major insight:\s*/i,
      ""
    )}`,
    observedTrends: aiResponse.observedTrends,
    topicsObserved: detectedTopics,
    detectedTopics,
    detectedMood: aiResponse.detectedMood,
    brainSessionMap,
    hasEnoughSignal: true,
    isFallback: false,
  };
};

const createGuidedReflectionGoalSuggestions = async (
  input: GuidedReflectionGoalSuggestionsInput
): Promise<GuidedReflectionGoalSuggestionsResponse> => {
  const sessionText = [
    getSessionText(input),
    input.sessionAnalysis?.analysis || "",
    input.sessionAnalysis?.majorInsight || "",
    ...(input.sessionAnalysis?.observedTrends || []),
  ].join(" ");
  const hasEnoughSignal =
    input.sessionAnalysis?.hasEnoughSignal === false
      ? false
      : !looksLikeLowSignalText(sessionText);
  const fallback = buildFallbackGoalSuggestions(input, hasEnoughSignal);
  const existingGoalContext = await getSavedGoalSuggestionContext(input.userId);
  const withNovelGoals = async (
    response: GuidedReflectionGoalSuggestionsResponse,
    useEmbeddings: boolean
  ): Promise<GuidedReflectionGoalSuggestionsResponse> => ({
    ...response,
    goals: await prepareNovelGoalSuggestions(
      response.goals,
      existingGoalContext,
      useEmbeddings
    ),
  });

  if (!hasEnoughSignal) {
    return withNovelGoals(fallback, false);
  }

  if (hasSafetySignal(input.promptAnswers, sessionText)) {
    return withNovelGoals({
      goals: [
        {
          title: "Choose one safe next step",
          description:
            "Name one grounded action outside the app that helps you feel safer today.",
          frequency: "as_needed",
          category: "general",
          icon: "target",
        },
        {
          title: "Write what support means",
          description:
            "Use one short entry to name what real support would look like right now.",
          frequency: "as_needed",
          category: "self_awareness",
          icon: "mood",
        },
      ],
      hasEnoughSignal: true,
    }, false);
  }

  if (!(await canUseGuidedReflectionAi(input.userId))) {
    return withNovelGoals(fallback, false);
  }

  const queryEmbedding = await buildSessionQueryEmbedding(input);
  const longTermMemory = await buildUserReflectionMemory(input.userId, {
    queryEmbedding,
  });
  const { userProfile, systemDirective } =
    await resolveGuidedReflectionPersonalization(input);

  const aiResponse = await requestStructuredOpenAi({
    feature: "guided reflection goal suggestions",
    schemaName: "guided_reflection_goal_suggestions",
    schema: goalSuggestionsJsonSchema,
    parser: goalSuggestionsResponseSchema,
    model: GUIDED_REFLECTION_MODEL(),
    maxOutputTokens: 520,
    reasoningEffort: "medium",
    messages: [
      {
        role: "system",
        content: [
          SYSTEM_PROMPT,
          "Suggest specific, doable goals that are clearly connected to what the user actually said.",
          AI_ACTION_BALANCE_GUIDANCE,
          "Do not create medical, clinical, diagnostic, shame-based, or treatment-plan goals.",
          "Anchor goals in the user's real themes while allowing a broadly useful contextual action, such as a walk or change of setting, when it is a plausible experiment. Direct advice is welcome when the useful action is clear, but never state a speculative hidden cause as fact.",
          "Do not repeat or paraphrase existingGoals. Changing the duration, time, meal, or trigger does not make the same core action new. Return fewer goals rather than padding.",
          "Every goal must be a concrete, low-effort action with a clear trigger, time limit, quantity, or first step — never vague. Prefer actions like a ten-minute walk after a named event, one sentence after dinner about a named concern, or one gym session on a named day.",
          "Avoid vague titles or descriptions such as reflect more, notice a pattern, be mindful, or work on yourself unless they specify exactly when and what to do.",
          "Use a direct imperative title of at most 30 characters and one precise description of at most 96 characters.",
          // Without an explicit instruction models bias toward the first enum member.
          "Set `icon` to the single best-fitting key from the provided enum for what the goal is about, and use `target` when nothing fits.",
          "Return only the number of goals genuinely supported by the material — 1 to 4 when there is signal, 1 to 3 safe fallback-style goals for low signal. Never pad.",
          systemDirective,
        ]
          .filter(Boolean)
          .join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Create one to four specific, doable, non-clinical goals grounded in concrete details from the session (and recurring themes in longTermMemory). A goal may address an adjacent life area the user actually mentioned. Keep titles under 30 characters and descriptions under 96 characters. Do not pad with generic advice. Goals are local suggestions only and will not be persisted yet.",
          promptAnswers: input.promptAnswers.map((answer) => ({
            questionId: answer.questionId,
            question: answer.question,
            answer: normalizeText(answer.answer),
          })),
          aiSummary: input.aiSummary ? normalizeText(input.aiSummary, 900) : "",
          threadMessages: (input.threadMessages || []).map((message) => ({
            role: message.role,
            kind: normalizeText(message.kind, 80),
            text: normalizeText(message.text, 900),
            actionType: message.actionType || null,
          })),
          sessionAnalysis: input.sessionAnalysis || {},
          longTermMemory: longTermMemory || "No prior sessions yet.",
          existingGoals: existingGoalContext.goals,
          userProfile,
          fallbackExamples: fallback.goals,
        }),
      },
    ],
  });

  if (!aiResponse) {
    return withNovelGoals(fallback, true);
  }

  return withNovelGoals({
    goals: aiResponse.goals.slice(0, 4),
    hasEnoughSignal: aiResponse.hasEnoughSignal,
  }, true);
};

export type {
  BrainCenterScore,
  BrainReflectionCenterId,
  BrainSessionMap,
  FirstReflectionSummaryInput,
  FirstReflectionSummaryResponse,
  GuidedReflectionGoDeeperInput,
  GuidedReflectionGoDeeperResponse,
  GuidedReflectionGoalSuggestionsInput,
  GuidedReflectionGoalSuggestionsResponse,
  GuidedReflectionOnboardingContext,
  GuidedReflectionPromptAnswer,
  GuidedReflectionSessionAnalysisInput,
  GuidedReflectionSessionAnalysisResponse,
  GuidedSuggestionAction,
  GuidedThreadMessage,
  FirstReflectionGoalSuggestion,
};
export {
  createFirstReflectionSummary,
  createGuidedReflectionGoDeeper,
  createGuidedReflectionGoalSuggestions,
  createGuidedReflectionSessionAnalysis,
};
