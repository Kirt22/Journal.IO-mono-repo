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
import {
  AI_ACTION_BALANCE_GUIDANCE,
  AI_EXTRACTION_BALANCE_GUIDANCE,
} from "../../helpers/aiReflectionBalance.helpers";
import {
  CARRIED_TRIGGERS_MAX,
  EMPTY_SESSION_SIGNALS,
  classifyTriggerStatus,
  findSecondPersonPronoun,
  isThirdPersonVoice,
  mergeSessionTriggers,
  sanitizeTriggerEvidence,
  sessionSignalsJsonSchema,
  sessionTriggerJsonSchema,
  sessionSignalsAiSchema,
  sessionTriggerAiSchema,
  toTriggerPatternLabel,
  type SessionSignals,
  type SessionTrigger,
  type TriggerStatus,
} from "../../helpers/emotionalTrigger.helpers";
import {
  getPatternNodeStatsByLabels,
} from "../mindmap/patternGraph.service";
import {
  buildProductPrivacyReply,
  isProductPrivacyQuestion,
} from "../../helpers/productPrivacy.helpers";
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
  topUpGoalSuggestions,
} from "../goals/goals.service";
import { buildGeneralBaselineGoals } from "../../helpers/generalGoalSuggestions.helpers";
import type { GoalSuggestionCategory } from "../../types/goals.types";

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
  /**
   * Triggers earlier turns in this session already surfaced, echoed back by the
   * client. Guided reflection has no server-side session object — the client
   * already replays `previousDeeperReflections` and `threadMessages` the same
   * way — so this arrives as untrusted input and is re-validated on every turn
   * (clinical labels dropped, evidence re-checked against the user's own text).
   */
  previousSignals?: SessionTrigger[];
};

type GuidedReflectionSessionAnalysisInput = FirstReflectionSummaryInput & {
  journalId?: string;
  aiSummary?: string;
  threadMessages?: GuidedThreadMessage[];
  /** What the live turns surfaced, so the end-of-session pass starts warm. */
  sessionSignals?: SessionTrigger[];
  /**
   * Text the app itself put into a saved entry — writing prompts the user
   * tapped to insert, guided section labels, Journal.IO's own earlier
   * reflection. Passed as context so the model knows what they were responding
   * to, and passed *separately* so it can never be mistaken for their words.
   */
  appAuthoredContext?: string;
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

/** Shared with the entry-based goal path so one bank can serve both. */
type FirstReflectionGoalCategory = GoalSuggestionCategory;

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
  /** Trigger state for the client to echo back on the next turn. */
  sessionSignals: SessionSignals;
};

type GuidedReflectionGoDeeperResponse = {
  reflection: string;
  // The next focused question, generated adaptively from the user's last
  // answer. The user decides whether to answer it or wrap up (user-paced).
  nextQuestion: string;
  // False when the session has reached a natural, resolved stopping point.
  canGoDeeper: boolean;
  /**
   * Everything the session has surfaced so far, not just this turn — the client
   * stores exactly this and sends it straight back, so it never has to merge.
   */
  sessionSignals: SessionSignals;
};

/**
 * One trigger the session analysis is reporting on, with how established it is
 * across *all* of this user's entries and sessions.
 *
 * `status` and `occurrences` are attached server-side from the pattern graph
 * and are never taken from the model — a count the model invented is the one
 * error this feature cannot afford, because "the third time this has happened"
 * is precisely the claim the user would act on.
 */
type SessionAnalysisTrigger = {
  trigger: string;
  emotionalResponse: string;
  evidenceQuote: string;
  confidence: number;
  status: TriggerStatus;
  occurrences: number;
};

type SessionAnalysisPattern = {
  label: string;
  basis: string;
  status: TriggerStatus;
  occurrences: number;
};

type GuidedReflectionSessionAnalysisResponse = {
  analysis: string;
  majorInsight: string;
  observedTrends: string[];
  /** Trigger -> emotional response links the session actually evidenced. */
  triggersObserved: SessionAnalysisTrigger[];
  /** Behaviours worth tracking, graded against what the graph already knows. */
  patternAssessment: SessionAnalysisPattern[];
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
const capWords = (value: string, limit = 90) =>
  value.trim().split(/\s+/).filter(Boolean).slice(0, limit).join(" ");

// Both bounds are real gates, not style hints: a reflection outside them fails
// the parse, which makes requestStructuredOpenAi return null and drops the user
// to deterministic fallback copy. They have to track the word budget in
// SYSTEM_PROMPT, or asking the model to be more specific silently disables AI
// reflection altogether.
//
// The floor is the one that bites. SYSTEM_PROMPT now asks for tight, unpadded
// prose, and the model answers it: sampled output lands anywhere from 39 to 76
// words. A 45-word floor rejected roughly two in five good replies and served
// canned copy instead — the exact failure the upper-bound comment warns about,
// arriving from below. 30 words is still a real paragraph, and `.min(120)`
// characters independently blocks a one-line non-answer.
const conciseReflectionSchema = z
  .string()
  .trim()
  .min(120)
  .max(700)
  .refine((value) => getWordCount(value) >= 30 && getWordCount(value) <= 90);
const conciseQuestionSchema = z
  .string()
  .trim()
  .min(8)
  .max(160)
  .refine((value) => {
    // Same asymmetry as the reflection floor: "What happened right before that?"
    // is five words and is exactly the question this prompt should produce.
    const wordCount = getWordCount(value);
    return wordCount >= 4 && wordCount <= 24;
  });

const reflectionSummarySchema = z.object({
  reflection: conciseReflectionSchema,
  followUpQuestion: conciseQuestionSchema,
  takeaway: z.string().trim().min(8).max(220).optional(),
  sessionSignals: sessionSignalsAiSchema,
});

const goDeeperResponseSchema = z.object({
  reflection: conciseReflectionSchema,
  nextQuestion: conciseQuestionSchema,
  canGoDeeper: z.boolean(),
  sessionSignals: sessionSignalsAiSchema,
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

const patternAssessmentAiSchema = z.object({
  label: z.string().trim().max(64),
  basis: z.string().trim().max(160),
});

const sessionAnalysisResponseSchema = z.object({
  analysis: z.string().trim().min(120).max(SESSION_ANALYSIS_MAX_LENGTH),
  majorInsight: z
    .string()
    .trim()
    .min(20)
    .max(SESSION_ANALYSIS_MAJOR_INSIGHT_MAX_LENGTH),
  observedTrends: z.array(z.string().trim().min(3).max(32)).min(2).max(4),
  triggersObserved: z.array(sessionTriggerAiSchema).max(3),
  patternAssessment: z.array(patternAssessmentAiSchema).max(3),
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
      maxLength: 700,
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
    sessionSignals: sessionSignalsJsonSchema,
  },
  required: ["reflection", "followUpQuestion", "takeaway", "sessionSignals"],
};

const goDeeperJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reflection: {
      type: "string",
      minLength: 120,
      maxLength: 700,
    },
    nextQuestion: {
      type: "string",
      minLength: 8,
      maxLength: 160,
    },
    canGoDeeper: {
      type: "boolean",
    },
    sessionSignals: sessionSignalsJsonSchema,
  },
  required: ["reflection", "nextQuestion", "canGoDeeper", "sessionSignals"],
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
    triggersObserved: {
      type: "array",
      maxItems: 3,
      items: sessionTriggerJsonSchema,
    },
    patternAssessment: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string", maxLength: 64 },
          basis: { type: "string", maxLength: 160 },
        },
        required: ["label", "basis"],
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
    "triggersObserved",
    "patternAssessment",
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
  "Write in tight, human, emotionally intelligent language: state the conclusion their entry supports, then one specific next step they can take today. Up to about 90 words — enough to be concrete, never padded. No filler, clichés, hedging, or over-explaining.",
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

/**
 * Everything the user themselves typed during a go-deeper turn, including the
 * answer they just submitted. Evidence quotes are checked against this, so the
 * latest answer has to be in it — that is where the newest trigger came from.
 */
const getUserWrittenGoDeeperText = (input: GuidedReflectionGoDeeperInput) =>
  [
    ...input.promptAnswers.map((answer) => answer.answer),
    ...(input.threadMessages || [])
      .filter((message) => message.role === "user")
      .map((message) => message.text),
    input.currentText,
  ].join(" ");

/**
 * Fold a turn's model output into the session's carried trigger state.
 *
 * Everything the client sent arrives untrusted, so the carried list is run back
 * through the same merge as the new observations: a clinical label smuggled in
 * by a modified client is dropped here, and an evidence quote is only kept if
 * it appears in the user's own writing.
 */
const buildSessionSignals = ({
  previousSignals,
  observed,
  activeTrigger,
  triggerStage,
  userWrittenText,
}: {
  previousSignals: SessionTrigger[] | undefined;
  observed: Array<{
    trigger: string;
    emotionalResponse: string;
    evidenceQuote: string;
    confidence: number;
  }>;
  activeTrigger: string;
  triggerStage: SessionSignals["triggerStage"];
  userWrittenText: string;
}): SessionSignals => {
  const triggers = mergeSessionTriggers(
    sanitizeTriggerEvidence(previousSignals || [], userWrittenText),
    sanitizeTriggerEvidence(observed || [], userWrittenText)
  );

  return {
    triggers,
    // An activeTrigger naming something that did not survive validation would
    // point the next turn's prompt at a trigger the model can no longer see.
    activeTrigger: triggers.some(
      (item) => item.trigger === activeTrigger.trim()
    )
      ? activeTrigger.trim()
      : triggers[0]?.trigger || "",
    triggerStage: triggers.length ? triggerStage : "none",
  };
};

/**
 * Carry the session's triggers forward on a path that never reaches the model.
 *
 * Still re-validates rather than passing the client's payload straight back:
 * these paths are the *easiest* ones to force (send gibberish, or text that
 * trips the safety detector, and the model is skipped entirely), so skipping
 * the checks here would leave a hole that a modified client could drive a
 * fabricated quote or a clinical label through.
 */
const carrySessionSignals = (
  previousSignals: SessionTrigger[] | undefined,
  userWrittenText: string
): SessionSignals => {
  const triggers = mergeSessionTriggers(
    sanitizeTriggerEvidence(previousSignals || [], userWrittenText),
    []
  );
  return {
    triggers,
    activeTrigger: triggers[0]?.trigger || "",
    triggerStage: "none",
  };
};

/**
 * The carried triggers as the prompt sees them, shortest useful shape.
 */
const toCarriedTriggersPayload = (signals: SessionTrigger[]) =>
  signals.slice(0, CARRIED_TRIGGERS_MAX).map((item) => ({
    trigger: item.trigger,
    emotionalResponse: item.emotionalResponse,
    turnsSupported: item.sessionOccurrences,
  }));

/**
 * What the graph already knows about the triggers this session is carrying.
 *
 * Passed *into* the prompt rather than only checked afterwards: a model that
 * knows a trigger is on its third sighting writes prose that agrees with the
 * count attached to the response. Told after the fact, it would have already
 * guessed.
 */
const loadKnownTriggerStats = async (
  userId: string,
  triggers: Array<{ trigger: string; emotionalResponse: string }>
) => {
  const labels = triggers
    .map((item) => toTriggerPatternLabel(item))
    .filter(Boolean);

  if (!labels.length) {
    return [];
  }

  const stats = await getPatternNodeStatsByLabels(userId, labels);

  return stats.map((stat) => ({
    pattern: stat.label,
    timesSeen: stat.occurrences,
    firstSeen: stat.firstSeenAt.toISOString().slice(0, 10),
    lastSeen: stat.lastSeenAt.toISOString().slice(0, 10),
    status: classifyTriggerStatus({
      occurrences: stat.occurrences,
      confidence: stat.confidence,
    }),
  }));
};

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
        "The reflection asks what this says about their inner narrative.",
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
    self_reflection_identity: `This center reflected self-talk, values, identity, or who they are becoming ${phrase}.`,
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
        `The session leaned most strongly toward ${dominantCenter.productName}. ${dominantCenter.shortInsight}${evidenceText} Secondary signals included ${secondaryNames}.`,
      BRAIN_SESSION_SUMMARY_MAX_LENGTH
    ),
    mostNoticedText: normalizeText(
      `The strongest center in this session was ${
        dominantCenter.productName
      }, because their writing most clearly returned to ${
        dominantCenter.evidence[0] || dominantCenter.productName.toLowerCase()
      }.`,
      BRAIN_SESSION_MOST_NOTICED_MAX_LENGTH
    ),
    mindMapSeedText:
      fallbackSummary?.mindMapSeedText ||
      "This first reflection has added its first signal to the Mind Map.",
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
      "This reflection has started building the Mind Map by capturing what they noticed, what challenged them, and what they want to carry forward.",
    mindMapSeedText:
      "This first reflection has added its first signal to the Mind Map.",
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
      return "Return one follow-up prompt and one short sentence saying plainly what it is for.";
    case "go_deeper":
      return "Offer a deeper reflection based on the user's answers: name what their words show rather than circling it.";
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

/**
 * Guided reflection is a premium experience. Development access follows the
 * same global entitlement override as every other Premium surface.
 */
const canUseGuidedReflectionAi = (userId: string) =>
  canUseOpenAiForUser(userId);

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
  sessionSignals: EMPTY_SESSION_SIGNALS,
});

const buildSafetyFirstDeeperResponse = (
  previousSignals: SessionTrigger[] | undefined,
  userWrittenText: string
): GuidedReflectionGoDeeperResponse => ({
    reflection:
      "This is important enough to keep grounded in real-world support. If there is any chance of immediate harm, pause the reflection and contact a trusted person or local emergency support. You can come back to writing when things feel safer.",
    nextQuestion: "What safe step can you take outside the app?",
    canGoDeeper: false,
    sessionSignals: carrySessionSignals(previousSignals, userWrittenText),
  });

const buildLowSignalFirstSummary = (): FirstReflectionSummaryResponse => ({
  reflection:
    "I do not have enough clear information yet to make a useful reflection. Journal.IO works best when you add a few specific words about what happened, what felt difficult, and what you want to carry into tomorrow. You can keep this simple and try again with one honest sentence per prompt.",
  followUpQuestion: "What specific moment from today can you name?",
  takeaway: "Add a little more detail so the reflection can stay useful.",
  sessionSignals: EMPTY_SESSION_SIGNALS,
});

const buildLowSignalDeeperResponse = (
  previousSignals: SessionTrigger[] | undefined,
  userWrittenText: string
): GuidedReflectionGoDeeperResponse => ({
  reflection:
    "There is not enough clear information to go deeper usefully yet. Add one specific moment, the feeling it brought up, and what you needed then. That detail will make the next reflection more grounded and practical, without forcing meaning that your words do not support.",
  nextQuestion: "What specific moment from today can you name?",
  canGoDeeper: true,
  sessionSignals: carrySessionSignals(previousSignals, userWrittenText),
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
    sessionSignals: EMPTY_SESSION_SIGNALS,
  };
};

/**
 * The rung question to fall back to when the model is unavailable.
 *
 * `requestStructuredOpenAi` returns null on *any* failure, and on a bad day
 * that is every turn. Without this the session silently drops back to generic
 * prompts and the trigger thread the user was mid-way through is abandoned —
 * so the deterministic path walks the same ladder, just without the specificity
 * only the model can add.
 */
const buildTriggerLadderQuestion = (
  carried: SessionTrigger[]
): string | null => {
  const strongest = carried[0];
  if (!strongest) {
    return null;
  }

  if (strongest.sessionOccurrences >= 2) {
    return "What does that reaction do for you in the moment?";
  }
  return "What was happening right before that feeling showed up?";
};

const buildFallbackDeeperResponse = ({
  promptAnswers,
  currentText,
  suggestionAction,
  onboardingContext,
  previousSignals,
}: GuidedReflectionGoDeeperInput): GuidedReflectionGoDeeperResponse => {
  const note = normalizeText(currentText, 84);
  const carriedSignals = carrySessionSignals(
    previousSignals,
    [...promptAnswers.map((answer) => answer.answer), currentText].join(" ")
  );
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
  // A live trigger thread outranks the generic tone question: abandoning a
  // half-tested trigger is the exact failure this feature exists to fix.
  const nextQuestion =
    buildTriggerLadderQuestion(carriedSignals.triggers) ||
    (tone === "direct"
      ? "What is the clearest next action from here?"
      : "What small change would make tomorrow feel more aligned?");

  if (suggestionAction === "another_perspective") {
    return {
      reflection: capWords(
        `Another perspective is that ${good} does not cancel ${hurdle}; it shows you had some capacity while a harder pattern was still active. Give the friction more attention: what triggered it, what kept it going, and what it asked from you. Let ${carry} guide one visible choice tomorrow without pretending the unresolved part has disappeared.`
      ),
      nextQuestion,
      canGoDeeper: true,
      sessionSignals: carriedSignals,
    };
  }

  if (suggestionAction === "small_next_step") {
    return {
      reflection: capWords(
        `A practical next step is to choose one concrete action that supports ${carry}. Keep it small enough to do even if ${hurdle} still feels present. Give it a clear time or trigger tomorrow, then treat completion as information rather than a test of your motivation or worth.`
      ),
      nextQuestion: "Which action can you make smaller and more specific?",
      canGoDeeper: true,
      sessionSignals: carriedSignals,
    };
  }

  if (suggestionAction === "summarize") {
    return {
      reflection: capWords(
        `Your entry holds three threads: ${hurdle}, ${good}, and ${carry}. The difficult part deserves the closest look because it may show what keeps creating friction; the positive part shows what capacity is already available. A practical conclusion is to choose one action that supports what you want to carry forward without pretending the harder pattern is resolved.`
      ),
      nextQuestion: "What part of that summary feels most true?",
      canGoDeeper: false,
      sessionSignals: carriedSignals,
    };
  }

  if (suggestionAction === "gentle_prompt") {
    return {
      reflection: capWords(
        `A gentle place to continue is the moment around ${hurdle}. Rather than judging how you handled it, notice what you needed and whether you could name that need at the time. This may turn the experience into one useful signal for tomorrow instead of another reason to criticize yourself.`
      ),
      nextQuestion: "What did that part of the day need from you?",
      canGoDeeper: true,
      sessionSignals: carriedSignals,
    };
  }

  return {
    reflection: capWords(
      `This added note gives the reflection more shape: ${note}. Look first at the friction it reveals, including what may be repeating, avoided, or left unresolved, while staying within what you actually wrote. Then notice the strength or resource that is still available. Choose one small response for tomorrow and track what remains difficult instead of rushing to a positive conclusion.`
    ),
    nextQuestion,
    canGoDeeper: true,
    sessionSignals: carriedSignals,
  };
};

/**
 * The whole session including Journal.IO's own words — the AI summary and every
 * assistant turn.
 *
 * **This is not user writing.** It must never reach an evidence check, a
 * "how much did they write" gate, or a prompt as the person's content: Jade's
 * own 45-90 word reflection alone clears every signal threshold we have, which
 * is exactly how a four-word session used to earn a confident analysis. Use
 * `getUserWrittenSessionText` for anything that judges or quotes the user.
 *
 * It survives for safety detection, where scanning more text is the safer
 * error, and for the goal-suggestion signal blob.
 */
const getSessionTextIncludingAppText = (
  input: GuidedReflectionSessionAnalysisInput
) =>
  [
    ...input.promptAnswers.map((answer) => answer.answer),
    input.aiSummary || "",
    ...(input.threadMessages || []).map((message) => message.text),
  ].join(" ");

// Third person throughout, like every other analysis string: this is a report
// about a session, not a message to the reader. Where the copy would otherwise
// instruct the reader ("you can still save this"), it states the fact
// impersonally rather than reaching for a pronoun.
const LOW_SIGNAL_ANALYSIS_TEXT =
  "This session does not carry enough clear information to name a trigger or a pattern yet. Journal.IO reads what set a feeling off best when an entry includes a few specific details: what happened, what felt difficult, and what came right before it. The entry can still be saved, and later sessions will give the app more to work with.";
const LOW_SIGNAL_MAJOR_INSIGHT =
  "Major insight: there is not enough clear detail yet to link a feeling to what set it off.";
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
  triggersObserved: [],
  patternAssessment: [],
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

/**
 * Replace any analysis text that slipped back into second person.
 *
 * The prompt states the rule six ways, but a model asked to change voice
 * mid-product reverts under pressure — especially on the heavier sessions,
 * which are exactly the ones where being addressed as "you" reads as advice
 * rather than a report. Rather than reject the whole response (which would cost
 * the brain map and the topics too), the offending field alone falls back to
 * the deterministic third-person copy. Same containment `normalizeBrainSessionMap`
 * already applies to summary text that fails its own check.
 */
const enforceThirdPersonField = (
  value: string,
  fallbackValue: string,
  field: string
): string => {
  if (isThirdPersonVoice(value)) {
    return value;
  }

  // Only ever the matched pronoun — the sentence around it is user-derived.
  console.warn(
    `Session analysis fell back to deterministic copy: ${field} used second person ("${findSecondPersonPronoun(
      value
    )}").`
  );
  return fallbackValue;
};

/**
 * Third-person guard over the brain map's free text.
 *
 * These strings are rendered on the same screen as the analysis, so one "your
 * reflection" there undoes the voice everywhere else.
 */
const enforceThirdPersonBrainMap = (
  map: BrainSessionMap,
  fallbackMap: BrainSessionMap
): BrainSessionMap => ({
  ...map,
  neuroscienceSummary: enforceThirdPersonField(
    map.neuroscienceSummary,
    fallbackMap.neuroscienceSummary,
    "neuroscienceSummary"
  ),
  mostNoticedText: enforceThirdPersonField(
    map.mostNoticedText,
    fallbackMap.mostNoticedText,
    "mostNoticedText"
  ),
  mindMapSeedText: enforceThirdPersonField(
    map.mindMapSeedText,
    fallbackMap.mindMapSeedText,
    "mindMapSeedText"
  ),
  dominantCenter: {
    ...map.dominantCenter,
    shortInsight: enforceThirdPersonField(
      map.dominantCenter.shortInsight,
      buildShortInsight(
        map.dominantCenter.id,
        map.dominantCenter.score,
        map.dominantCenter.evidence
      ),
      "dominantCenter.shortInsight"
    ),
  },
  centers: map.centers.map((center) => ({
    ...center,
    shortInsight: enforceThirdPersonField(
      center.shortInsight,
      buildShortInsight(center.id, center.score, center.evidence),
      "center.shortInsight"
    ),
  })),
  secondaryCenters: map.secondaryCenters.map((center) => ({
    ...center,
    shortInsight: enforceThirdPersonField(
      center.shortInsight,
      buildShortInsight(center.id, center.score, center.evidence),
      "center.shortInsight"
    ),
  })),
});

/**
 * Grade what the session surfaced against what the graph already knows.
 *
 * The model supplies the labels and the reasoning; the counts and the
 * emerging/recurring/confirmed grade are attached here from the graph. A
 * fabricated "this is the fourth time" is the one error this feature cannot
 * afford, because that is precisely the claim a user would act on.
 */
const gradeSessionFindings = async ({
  userId,
  triggersObserved,
  patternAssessment,
  userWrittenText,
}: {
  userId: string;
  triggersObserved: Array<{
    trigger: string;
    emotionalResponse: string;
    evidenceQuote: string;
    confidence: number;
  }>;
  patternAssessment: Array<{ label: string; basis: string }>;
  userWrittenText: string;
}): Promise<{
  triggers: SessionAnalysisTrigger[];
  patterns: SessionAnalysisPattern[];
}> => {
  const cleanTriggers = mergeSessionTriggers(
    [],
    sanitizeTriggerEvidence(triggersObserved || [], userWrittenText)
  );

  const triggerLabels = cleanTriggers
    .map((item) => toTriggerPatternLabel(item))
    .filter(Boolean);
  const patternLabels = (patternAssessment || [])
    .map((item) => item.label.trim())
    .filter(Boolean);

  const stats = await getPatternNodeStatsByLabels(userId, [
    ...triggerLabels,
    ...patternLabels,
  ]);
  const statByLabel = new Map(stats.map((stat) => [stat.requestedLabel, stat]));

  const grade = (label: string, sessionConfidence: number) => {
    const stat = statByLabel.get(label);
    // A miss means the graph has never merged this label, so the only sighting
    // is the one in front of us. Ingestion has not run for this session yet —
    // it fires after the snapshot is persisted — so counting it here as 1 is
    // what makes the first sighting read as "new" rather than "seen 0 times".
    const occurrences = stat ? stat.occurrences : 1;
    return {
      occurrences,
      status: classifyTriggerStatus({
        occurrences,
        confidence: stat ? stat.confidence : sessionConfidence,
      }),
    };
  };

  return {
    triggers: cleanTriggers.map((item) => {
      const graded = grade(toTriggerPatternLabel(item), item.confidence);
      return {
        trigger: item.trigger,
        emotionalResponse: item.emotionalResponse,
        evidenceQuote: item.evidenceQuote,
        confidence: item.confidence,
        status: graded.status,
        occurrences: graded.occurrences,
      };
    }),
    patterns: (patternAssessment || [])
      .filter((item) => item.label.trim())
      .map((item) => {
        const graded = grade(item.label.trim(), 0.5);
        return {
          label: item.label.trim(),
          basis: item.basis.trim(),
          status: graded.status,
          occurrences: graded.occurrences,
        };
      }),
  };
};

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
        `The clearest signal in this entry sits around "${opening}", which suggests that is what currently carries the most weight for them.`,
        closing && closing !== opening
          ? `Where the writing moves toward "${closing}", it reads as something still open rather than settled.`
          : `The rest of the entry stays close to that same thread rather than resolving it.`,
        `A fuller reflection next time would let Journal.IO show the pattern here more precisely.`,
      ];

  return {
    analysis: compactSessionAnalysisText(analysisSentences.join(" ")),
    // The deterministic path has no model read of the session, so it reports no
    // triggers rather than guessing at one from keywords. A wrong trigger is
    // worse than none: it would enter the graph and start accumulating.
    triggersObserved: [],
    patternAssessment: [],
    majorInsight: isGuidedShaped
      ? "Major insight: the strongest signal is the unresolved friction and the chance to meet it with one grounded action."
      : "Major insight: the strongest signal is what they kept returning to in this entry.",
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
  // Exactly one writing goal. Two of them ("write for 5 minutes" plus "write one
  // line after dinner") are the same action at different detail levels, and this
  // bank is also shown to the model as fallbackExamples — so any overlap here
  // teaches it to produce overlapping goals.
  const reflectionGoals: FirstReflectionGoalSuggestion[] = [
    {
      title: "Write for 5 minutes",
      description:
        "After dinner, write the one moment from today you want to remember.",
      frequency: "daily",
      category: "journaling_habit",
      icon: "journal",
    },
    {
      title: "Start tomorrow in 5 minutes",
      description: `Before noon, spend five minutes on: ${carry}.`,
      frequency: "as_needed",
      category: "general",
      icon: "target",
    },
  ];
  // Baseline advice that holds when the session gave us little to work with:
  // move the body, then sleep, daylight, and contact. When there is no real
  // signal it leads, because a reflection goal about nothing is busywork.
  const baselineGoals = buildGeneralBaselineGoals(sessionText, 3);
  const goals: FirstReflectionGoalSuggestion[] = hasEnoughSignal
    ? [...reflectionGoals, ...baselineGoals]
    : [...baselineGoals, ...reflectionGoals];

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

  const privacyQuestion = input.promptAnswers
    .map(answer => answer.answer)
    .find(isProductPrivacyQuestion);
  if (privacyQuestion) {
    return {
      reflection: buildProductPrivacyReply(),
      followUpQuestion: "Would you like to continue your reflection now?",
      sessionSignals: EMPTY_SESSION_SIGNALS,
    };
  }

  if (looksLikeMostlyGibberishText(getUserWrittenSessionText(input))) {
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
    maxOutputTokens: 900,
    reasoningEffort: GUIDED_REFLECTION_REASONING_EFFORT(),
    messages: [
      {
        role: "system",
        content: [SYSTEM_PROMPT, systemDirective].filter(Boolean).join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Open the guided reflection in up to 90 words. State the conclusion the user's own words support, then one specific next step they can take today. Acknowledge anything heavy with care, but do not over-explain or claim therapeutic authority. Set followUpQuestion to one specific, curious question of 6-24 words and at most 160 characters that opens the thread most worth exploring — a short lead-in before the question is fine. Keep the question separate from reflection.",
          triggerTask: "This opening also starts the session's trigger thread. Where their answers name a feeling, aim followUpQuestion at what came right before it — the situation, person, time, or thought that set it off — and set triggerStage to surface. If they already named both the feeling and what preceded it, set triggerStage to test and ask whether that same situation has done this before. Record only what their words support in sessionSignals.triggers, copying evidenceQuote verbatim or leaving it empty, and return an empty list when nothing trigger-shaped is there yet. Write every field in English, inside hard limits that cut mid-word when exceeded: trigger 64 characters, emotionalResponse 64, evidenceQuote 180. Rewrite anything longer as a shorter English phrase — never abbreviate, truncate, or compress into another language or symbols; pick a shorter verbatim sentence when the quote will not fit.",
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
    sessionSignals: buildSessionSignals({
      previousSignals: [],
      observed: aiResponse.sessionSignals.triggers,
      activeTrigger: aiResponse.sessionSignals.activeTrigger,
      triggerStage: aiResponse.sessionSignals.triggerStage,
      userWrittenText: input.promptAnswers
        .map((answer) => answer.answer)
        .join(" "),
    }),
  };
};

const createGuidedReflectionGoDeeper = async (
  input: GuidedReflectionGoDeeperInput
): Promise<GuidedReflectionGoDeeperResponse> => {
  if (hasSafetySignal(input.promptAnswers, input.currentText)) {
    return buildSafetyFirstDeeperResponse(
      input.previousSignals,
      getUserWrittenGoDeeperText(input)
    );
  }

  if (isProductPrivacyQuestion(input.currentText)) {
    return {
      reflection: buildProductPrivacyReply(),
      nextQuestion: "Would you like to continue your reflection now?",
      canGoDeeper: true,
      sessionSignals: carrySessionSignals(
        input.previousSignals,
        getUserWrittenGoDeeperText(input)
      ),
    };
  }

  if (looksLikeMostlyGibberishText(getUserWrittenGoDeeperText(input))) {
    return buildLowSignalDeeperResponse(
      input.previousSignals,
      getUserWrittenGoDeeperText(input)
    );
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
  const carriedTriggers = mergeSessionTriggers(input.previousSignals, []);
  const knownTriggers = await loadKnownTriggerStats(
    input.userId,
    carriedTriggers
  );

  const aiResponse = await requestStructuredOpenAi({
    feature: "guided reflection go deeper",
    schemaName: "guided_reflection_go_deeper",
    schema: goDeeperJsonSchema,
    parser: goDeeperResponseSchema,
    model: GUIDED_REFLECTION_MODEL(),
    // Raised from 360: the reflection and question are unchanged in length, but
    // sessionSignals now rides along in the same response. Too tight a cap
    // truncates the JSON, and a truncated payload costs the whole turn — the
    // parser returns null and the user gets the deterministic fallback.
    maxOutputTokens: 700,
    reasoningEffort: GUIDED_REFLECTION_REASONING_EFFORT(),
    messages: [
      {
        role: "system",
        content: [
          SYSTEM_PROMPT,
          "This is a live, therapeutically informed deepening conversation. React to the user's latest answer specifically.",
          "Write up to 90 words: the conclusion their words support, then one specific next step. If they shared something heavy, acknowledge it with care first.",
          "Then ask exactly one separate question of 6-24 words and at most 160 characters. It must build directly on their answer without sounding generic. You have room for a short lead-in before the question when it makes the question land more precisely.",
          "Your job across this session is to find what triggers this person's emotional responses — the specific situation, person, time, or thought that came right before a feeling — and then test whether it repeats. A feeling on its own is a mood; a feeling with what set it off is something they can act on.",
          "Work one rung at a time and set triggerStage to the rung your nextQuestion is on. surface: they named a feeling but not what preceded it, so ask what was happening immediately before it, concretely — who was there, what was said, what they were doing. test: a candidate trigger has been named once but never checked, so ask whether that same situation has produced the same response at other times, or what was different when it did not. function: the trigger has held up, so ask what their response does for them — what it protects them from, what it costs, what would have to be true for them to respond differently.",
          "Never skip a rung, and never move to a new topic while a candidate trigger is still untested. Set activeTrigger to the trigger your nextQuestion is aimed at, or an empty string when nothing trigger-shaped has surfaced yet and you are still opening the thread.",
          "carriedTriggers lists what earlier turns in this same session already surfaced, with how many turns supported each. Advance the rung on the strongest carried trigger rather than restarting on a new one, unless the latest answer clearly opens something more important. knownTriggers lists what their earlier entries and sessions already established, with lifetime counts — when today echoes one of those, say so and check the connection rather than treating it as new.",
          "Record in triggers only what their own words support: the trigger, the emotional response it appears to set off, their verbatim sentence as evidenceQuote, and a 0-1 confidence. Copy the quote exactly or leave it empty — never write one yourself. Return an empty list rather than inventing a trigger; small talk and venting genuinely have none. Name what they do and what set it off, and name the pattern it belongs to where their words support one. Write every field in English, inside hard limits that cut mid-word when exceeded: trigger 64 characters, emotionalResponse 64, evidenceQuote 180. Rewrite anything longer as a shorter English phrase — never abbreviate, truncate, or compress into another language or symbols; pick a shorter verbatim sentence when the quote will not fit.",
          AI_EXTRACTION_BALANCE_GUIDANCE,
          "Read whether they want to go deeper or simply be heard. If they are venting or emotionally full, acknowledge that first and make the question optional rather than insistent — but still say what you actually see. If there is a real thread to pull, take them further into it.",
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
          carriedTriggers: toCarriedTriggersPayload(carriedTriggers),
          knownTriggers,
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
    sessionSignals: buildSessionSignals({
      previousSignals: input.previousSignals,
      observed: aiResponse.sessionSignals.triggers,
      activeTrigger: aiResponse.sessionSignals.activeTrigger,
      triggerStage: aiResponse.sessionSignals.triggerStage,
      userWrittenText: getUserWrittenGoDeeperText(input),
    }),
  };
};

const createGuidedReflectionSessionAnalysis = async (
  input: GuidedReflectionSessionAnalysisInput
): Promise<GuidedReflectionSessionAnalysisResponse> => {
  // Judged on what this person wrote, not on what Journal.IO wrote back at
  // them. A session where they typed four words holds four words of signal
  // however long the reply was.
  if (looksLikeLowSignalText(getUserWrittenSessionText(input))) {
    return buildLowSignalSessionAnalysis(input);
  }

  // Safety deliberately keeps reading the full session, app text included. A
  // false positive costs one generic analysis; a false negative costs more.
  if (
    hasSafetySignal(input.promptAnswers, getSessionTextIncludingAppText(input))
  ) {
    return {
      analysis:
        "This session includes signals that should be treated with care before any deeper pattern-reading. Reporting triggers and patterns is not the right response here; support, stability, and one immediate action outside the app come first if anything feels urgent. Journal.IO can help organize a reflection, but it does not replace real-world support when safety may be involved.",
      majorInsight:
        "Major insight: safety and real-world support come before deeper reflection.",
      observedTrends: ["Safety", "Support", "Grounding"],
      // Deliberately empty: a session carrying a safety signal must not have
      // its content mined into the pattern graph or reported back as a
      // behavioural finding.
      triggersObserved: [],
      patternAssessment: [],
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

  const userWrittenText = getUserWrittenSessionText(input);
  const userWordCount = userWrittenText.split(/\s+/).filter(Boolean).length;
  const carriedSignals = mergeSessionTriggers(input.sessionSignals, []);
  // Fed *into* the prompt, not only checked after it: a model that already
  // knows a trigger is on its third sighting writes prose that agrees with the
  // count attached to the response. Told afterwards, it would have guessed.
  const knownPatterns = await loadKnownTriggerStats(
    input.userId,
    carriedSignals
  );

  const aiResponse = await requestStructuredOpenAi({
    feature: "guided reflection session analysis",
    schemaName: "guided_reflection_session_analysis",
    schema: sessionAnalysisJsonSchema,
    parser: sessionAnalysisResponseSchema,
    maxOutputTokens: 5000,
    model: SESSION_ANALYSIS_MODEL(),
    // High reasoning by default for nuanced reflective depth; env-tunable
    // via OPENAI_GUIDED_REFLECTION_REASONING_EFFORT. max_output_tokens covers
    // reasoning *and* visible output, and this prompt's full 8-center
    // brainSessionMap plus observedTrends runs past 2400 on its own, so the
    // budget is 5000. Under-budgeting here is silent: the response comes back
    // `incomplete`, requestStructuredOpenAi returns null, and the entry gets
    // generic fallback copy with only a logged error to show for it.
    reasoningEffort: GUIDED_REFLECTION_REASONING_EFFORT(),
    messages: [
      {
        role: "system",
        content: [
          SYSTEM_PROMPT,
          "For this task you are writing a third-person report about a session. It is not a reflection, not a chat reply, and not addressed to the reader.",
          "Never use 'you' or 'your' in any field. Refer to the person as 'they' and 'them' throughout — in analysis, majorInsight, observedTrends, and every part of brainSessionMap including neuroscienceSummary, mostNoticedText, mindMapSeedText and each center's shortInsight. Writing about the session itself rather than about a person is also fine where it reads more naturally.",
          "Report from the outside what happened: what the session covered, what set off which emotional response, and which of those look like repeating patterns. Do not comfort, encourage, reassure, advise, or suggest a next step — none of that belongs in this report.",
          "Lead with the trigger-to-response links their own words actually support. A trigger is the situation, person, time, or thought that came right before a feeling. State the order explicitly — what came before what — and never assert an order the writing does not show.",
          "knownPatterns lists what this person's earlier entries and sessions already established, with how many times each has been seen. Use it to say plainly whether something here is showing for the first time, repeating, or already well established. Never state a count knownPatterns does not support, and never invent history. When knownPatterns is empty, treat everything in the session as new.",
          "Only what is under userAuthored was written by this person. Everything under appAuthoredContext — the questions they were asked, Journal.IO's own reflections, and any writing prompt the app inserted into their entry — was written by the app. Use it only to understand what they were responding to.",
          "Never quote appAuthoredContext, never attribute it to them, and never treat a question's subject as something they raised. That the app asked about tomorrow is not evidence they are thinking about tomorrow; only their own answer is. An observation that would still be true if they had written nothing is not an observation about them.",
          "Every evidenceQuote and every brainSessionMap evidence chip must be copied from userAuthored text. If the only sentence that would support a point came from the app, the point is not supported.",
          "userAuthored.wordCount is how much this person actually wrote. When it is small, the session genuinely holds less: say what their few words show and no more, and set hasEnoughSignal to false rather than filling the gap from the questions or from Journal.IO's replies.",
          "Put every trigger the session evidences into triggersObserved, each with the emotional response it appears to set off and their verbatim sentence as evidenceQuote — copied exactly or left empty, never written by you. Put the behaviours worth tracking into patternAssessment with a one-line basis. Return empty lists rather than inventing either; a session about small things genuinely has none.",
          "Write behaviour-focused findings as statements, not as suggestions: 'the criticism came first, then they went quiet', not 'the session suggests a possible link'. State the order and the link their words support, and say plainly when something is genuinely uncertain rather than hedging everything by default. You may name recognised psychological patterns — avoidance, numbing, rumination, attachment behaviour, burnout or depressive markers — as a description of what the session shows. Do not assert a formal disorder as an established medical fact, even if they used that word themselves.",
          "Apply the challenge-forward balance across the analysis, major insight, trends, detected topics, and reflection-center reasoning. Do not let an encouraging conclusion hide supported difficulty.",
          "If the writing is unclear or too sparse, say there is not enough information rather than inventing insight.",
          "Keep it short but genuinely insightful: a precise 3-4 sentence analysis (no more than about 110 words) describing the session, one majorInsight sentence naming the single clearest trigger-to-response link without markdown, 2-4 short observedTrends labels naming triggers or patterns rather than moods, and a brain-inspired reflection-center classification.",
          AI_EXTRACTION_BALANCE_GUIDANCE,
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
          // Without stated budgets the model writes to its natural length and
          // generation is cut at the schema bound. It then tries to fit the
          // remaining meaning into the last character or two, which is how
          // "Getting out of bed despite low" acquired a Chinese 力 on the end.
          "Write every field in English. Hard character limits, and anything longer is cut off mid-word: each observedTrends label 32 characters, majorInsight 180, analysis 680, each brain center shortInsight 180, each evidence chip 48, neuroscienceSummary 240, mostNoticedText 220, each triggersObserved trigger 64 and emotionalResponse 64 and evidenceQuote 180, each patternAssessment label 64 and basis 160. Aim comfortably inside each limit and finish the sentence — a label that needs more than its limit should be rewritten shorter, never abbreviated, truncated, or compressed into another language or symbols.",
          systemDirective,
        ]
          .filter(Boolean)
          .join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Report on the full reflection session in the third person, using only what this person actually wrote. Identify what set off which emotional response, which behaviours look like repeating patterns and how established each already is, genuine detected topics, one five-value mood, and the required brainSessionMap. Do not address the reader, do not advise, do not diagnose, claim therapy, or invent facts.",
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
          // Authorship is split at the top level rather than interleaved, so
          // there is no way to read an app-written question or reflection as
          // something this person said. Everything under userAuthored is theirs;
          // nothing under appAuthoredContext is.
          userAuthored: {
            answers: input.promptAnswers.map((answer) => ({
              questionId: answer.questionId,
              answer: normalizeText(answer.answer),
            })),
            messages: (input.threadMessages || [])
              .filter((message) => message.role === "user")
              .map((message) => normalizeText(message.text, 900))
              .filter(Boolean),
            fullText: normalizeText(userWrittenText, 1600),
            wordCount: userWordCount,
          },
          appAuthoredContext: {
            questionsAsked: [
              ...input.promptAnswers
                .map((answer) => normalizeText(answer.question, 180))
                .filter(Boolean),
              ...(input.threadMessages || [])
                .map((message) =>
                  message.promptQuestion
                    ? normalizeText(message.promptQuestion, 180)
                    : ""
                )
                .filter(Boolean),
            ],
            assistantReflections: [
              input.aiSummary ? normalizeText(input.aiSummary, 900) : "",
              ...(input.threadMessages || [])
                .filter((message) => message.role === "assistant")
                .map((message) => normalizeText(message.text, 900)),
            ].filter(Boolean),
            // Text the app inserted into a saved entry (writing prompts,
            // guided section labels, its own earlier reflection).
            insertedByApp: input.appAuthoredContext
              ? normalizeText(input.appAuthoredContext, 900)
              : "",
          },
          sessionTriggers: toCarriedTriggersPayload(carriedSignals),
          knownPatterns,
          longTermMemory: longTermMemory || "No prior sessions yet.",
          userProfile,
          fallbackStyleExample: fallback.analysis,
        }),
      },
    ],
  });

  if (!aiResponse) {
    return fallback;
  }

  const brainSessionMap = enforceThirdPersonBrainMap(
    normalizeBrainSessionMap(
      aiResponse.brainSessionMap,
      input,
      fallback.brainSessionMap
    ),
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
      // Too little to work with is exactly the case where a trigger would be
      // invented, so nothing is reported and nothing reaches the graph.
      triggersObserved: [],
      patternAssessment: [],
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

  // The live turns and the end-of-session pass see different things: a trigger
  // named on turn two can be buried by turn six. Union the two rather than
  // letting the final call be the only witness.
  const graded = await gradeSessionFindings({
    userId: input.userId,
    triggersObserved: mergeSessionTriggers(
      carriedSignals,
      aiResponse.triggersObserved
    ),
    patternAssessment: aiResponse.patternAssessment,
    userWrittenText,
  });

  return {
    analysis: enforceThirdPersonField(
      aiResponse.analysis,
      fallback.analysis,
      "analysis"
    ),
    majorInsight: enforceThirdPersonField(
      `Major insight: ${aiResponse.majorInsight.replace(
        /^major insight:\s*/i,
        ""
      )}`,
      fallback.majorInsight,
      "majorInsight"
    ),
    observedTrends: aiResponse.observedTrends,
    triggersObserved: graded.triggers,
    patternAssessment: graded.patterns,
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
    getSessionTextIncludingAppText(input),
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
  ): Promise<GuidedReflectionGoalSuggestionsResponse> => {
    const novelGoals = await prepareNovelGoalSuggestions(
      response.goals,
      existingGoalContext,
      useEmbeddings
    );

    return {
      ...response,
      // Novelty filtering can reject everything when saved goals already cover
      // the session, so top up from the baseline bank rather than return none.
      goals: await topUpGoalSuggestions(
        novelGoals,
        buildGeneralBaselineGoals(sessionText, Number.MAX_SAFE_INTEGER),
        existingGoalContext
      ),
    };
  };

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
          "Do not create medical or treatment-plan goals, and do not prescribe anything that belongs to a clinician.",
          "Anchor goals in the user's real themes while allowing a broadly useful contextual action, such as a walk or change of setting, when it is a plausible experiment. Direct advice is welcome when the useful action is clear, but never state a speculative hidden cause as fact.",
          "Do not repeat or paraphrase existingGoals. Changing the duration, time, meal, or trigger does not make the same core action new. Return fewer goals rather than padding.",
          "Never return two goals that share the same core action. Merge them into one goal that keeps the specifics of both: a five-minute writing goal and a write-after-dinner goal become a single goal to write for five minutes after dinner.",
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
          task: "Create one to four specific, doable goals grounded in concrete details from the session (and recurring themes in longTermMemory). A goal may address an adjacent life area the user actually mentioned. Keep titles under 30 characters and descriptions under 96 characters. Do not pad with generic advice. Goals are local suggestions only and will not be persisted yet.",
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
