import { z } from "zod";
import {
  detectJournalSafetySignal,
  hasJournalSafetySignal,
} from "../../helpers/journalSafety.helpers";
import {
  getUserAiAccessState,
  isOpenAiConfigured,
  requestStructuredOpenAi,
} from "../../helpers/openai.helpers";

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
};

type GuidedReflectionGoalSuggestionsInput = GuidedReflectionSessionAnalysisInput & {
  sessionAnalysis?: {
    analysis?: string;
    majorInsight?: string;
    observedTrends?: string[];
    hasEnoughSignal?: boolean;
  };
};

type FirstReflectionSummaryResponse = {
  reflection: string;
  takeaway?: string;
};

type GuidedReflectionGoDeeperResponse = {
  reflection: string;
  followUpPrompt?: string;
};

type GuidedReflectionSessionAnalysisResponse = {
  analysis: string;
  majorInsight: string;
  observedTrends: string[];
  topicsObserved?: string[];
  brainSessionMap: BrainSessionMap;
  hasEnoughSignal: boolean;
};

const SESSION_ANALYSIS_MODEL = () =>
  process.env.OPENAI_GUIDED_REFLECTION_SESSION_ANALYSIS_MODEL?.trim() ||
  "gpt-5.6-terra";
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

const reflectionSummarySchema = z.object({
  reflection: z.string().trim().min(40).max(700),
  takeaway: z.string().trim().min(8).max(220).optional(),
});

const goDeeperResponseSchema = z.object({
  reflection: z.string().trim().min(30).max(650),
  followUpPrompt: z.string().trim().min(8).max(180).optional(),
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
  evidence: z.array(z.string().trim().min(1).max(BRAIN_CENTER_EVIDENCE_MAX_LENGTH)).max(3),
  shortInsight: z.string().trim().min(8).max(BRAIN_CENTER_INSIGHT_MAX_LENGTH),
  nuancedDetails: brainCenterNuancedDetailsSchema,
});

const brainSessionMapSchema = z.object({
  dominantCenterId: brainReflectionCenterIdSchema,
  dominantCenter: brainCenterScoreSchema,
  secondaryCenterIds: z.array(brainReflectionCenterIdSchema).min(1).max(3),
  secondaryCenters: z.array(brainCenterScoreSchema).min(1).max(3),
  centers: z.array(brainCenterScoreSchema).length(8),
  neuroscienceSummary: z.string().trim().min(40).max(BRAIN_SESSION_SUMMARY_MAX_LENGTH),
  mostNoticedText: z.string().trim().min(30).max(BRAIN_SESSION_MOST_NOTICED_MAX_LENGTH),
  mindMapSeedText: z.string().trim().min(20).max(220),
});

const sessionAnalysisResponseSchema = z.object({
  analysis: z.string().trim().min(120).max(SESSION_ANALYSIS_MAX_LENGTH),
  majorInsight: z.string().trim().min(20).max(SESSION_ANALYSIS_MAJOR_INSIGHT_MAX_LENGTH),
  observedTrends: z.array(z.string().trim().min(3).max(32)).min(2).max(4),
  topicsObserved: z.array(z.string().trim().min(3).max(32)).min(2).max(4).optional(),
  brainSessionMap: brainSessionMapSchema,
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
      minLength: 40,
      maxLength: 700,
    },
    takeaway: {
      type: "string",
      minLength: 8,
      maxLength: 220,
    },
  },
  required: ["reflection", "takeaway"],
};

const goDeeperJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reflection: {
      type: "string",
      minLength: 30,
      maxLength: 650,
    },
    followUpPrompt: {
      type: "string",
      minLength: 8,
      maxLength: 180,
    },
  },
  required: ["reflection", "followUpPrompt"],
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
    topicsObserved: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "string",
        minLength: 3,
        maxLength: 32,
      },
    },
    brainSessionMap: brainSessionMapJsonSchema,
  },
  required: ["analysis", "majorInsight", "observedTrends", "topicsObserved", "brainSessionMap"],
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
        },
        required: ["title", "description", "frequency", "category"],
      },
    },
    hasEnoughSignal: {
      type: "boolean",
    },
  },
  required: ["goals", "hasEnoughSignal"],
};

const SYSTEM_PROMPT = [
  "You are Journal.IO, a private guided journaling assistant.",
  "You help users reflect on their day in concise, emotionally safe language.",
  "You are not a therapist, doctor, or diagnostic tool.",
  "Do not diagnose, moralize, shame, or overstate certainty.",
  "Do not invent details beyond what the user wrote.",
  "Keep the response warm, calm, practical, and non-clinical.",
  "If the user mentions sensitive or sexual content, respond neutrally and without shame.",
  "Keep the response to 2-4 short sentences.",
].join(" ");

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
    { terms: ["stress", "stressful", "overwhelm", "overwhelmed"], weight: 0.22 },
    { terms: ["anger", "angry", "mad", "furious", "fear", "afraid"], weight: 0.22 },
    { terms: ["pressure", "pressured", "worried", "worry", "urgent"], weight: 0.18 },
    { terms: ["heavy", "threat", "panic", "anxious"], weight: 0.16 },
  ],
  planning_self_control: [
    { terms: ["discipline", "disciplined", "self-control", "control"], weight: 0.26 },
    { terms: ["tomorrow", "carry forward", "next step", "action"], weight: 0.22 },
    { terms: ["goal", "plan", "decision", "decide", "choice"], weight: 0.2 },
    { terms: ["routine", "habit", "focus", "focused", "protect my morning"], weight: 0.18 },
  ],
  memory_meaning: [
    { terms: ["remember", "memory", "memories", "past", "before"], weight: 0.22 },
    { terms: ["childhood", "old", "again", "repeated", "keeps happening"], weight: 0.2 },
    { terms: ["lesson", "meaning", "history", "used to"], weight: 0.18 },
  ],
  body_inner_signals: [
    { terms: ["tired", "exhausted", "drained", "sleep", "slept"], weight: 0.24 },
    { terms: ["energy", "body", "physical", "gut", "stomach"], weight: 0.22 },
    { terms: ["hungry", "food", "diet", "pain", "tense"], weight: 0.18 },
  ],
  conflict_attention: [
    { terms: ["guilt", "guilty", "stuck", "torn", "mixed feelings"], weight: 0.24 },
    { terms: ["uncertain", "unsure", "doubt", "contradiction"], weight: 0.22 },
    { terms: ["tension", "conflict", "but", "without turning"], weight: 0.16 },
  ],
  motivation_reward: [
    { terms: ["win", "wins", "progress", "momentum", "excited"], weight: 0.22 },
    { terms: ["stuck to", "consistent", "consistency", "effort"], weight: 0.2 },
    { terms: ["reward", "craving", "cravings", "proud", "motivated"], weight: 0.2 },
  ],
  relationships_perspective: [
    { terms: ["dad", "mom", "parent", "family", "brother", "sister"], weight: 0.26 },
    { terms: ["friend", "partner", "relationship", "people"], weight: 0.22 },
    { terms: ["judged", "seen", "belonging", "perception", "empathy"], weight: 0.2 },
  ],
  self_reflection_identity: [
    { terms: ["myself", "self", "self-image", "identity", "who I am"], weight: 0.24 },
    { terms: ["becoming", "values", "purpose", "growth", "better"], weight: 0.22 },
    { terms: ["inner", "prove", "proving", "alignment", "personal"], weight: 0.18 },
  ],
};

const normalizeText = (value: string, limit = 900) =>
  value.trim().replace(/\s+/g, " ").slice(0, limit);

const compactSessionAnalysisText = (value: string) => {
  const normalized = normalizeText(value);

  if (normalized.length <= SESSION_ANALYSIS_MAX_LENGTH) {
    return normalized;
  }

  const sentences = normalized.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [normalized];
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
    .map(word => word.replace(/^[-']+|[-']+$/g, ""))
    .filter(word => word.length >= 3 && /[a-z]/.test(word));

const looksLikeGibberishWord = (word: string) => {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");

  if (!normalized) {
    return true;
  }

  if (/^(asdf|qwer|zxcv|hjkl|jkl|qaz|wsx|edc|rfv|tgb|yhn|ujm)+$/.test(normalized)) {
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
  const informativeWords = meaningfulWords.filter(word => !looksLikeGibberishWord(word));
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
  const informativeWords = meaningfulWords.filter(word => !looksLikeGibberishWord(word));
  const repeatedCharacterRuns = (value.match(/(.)\1{4,}/g) || []).length;

  if (meaningfulWords.length >= 3 && gibberishWords.length / meaningfulWords.length >= 0.3) {
    return true;
  }

  if (repeatedCharacterRuns >= 2) {
    return true;
  }

  return meaningfulWords.length >= 4 && informativeWords.length < 2;
};

const getAnswer = (answers: GuidedReflectionPromptAnswer[], id: string) =>
  normalizeText(answers.find(answer => answer.questionId === id)?.answer || "", 260);

const getContextTone = (context?: GuidedReflectionOnboardingContext) =>
  context?.reflectionTone?.[0] || "neutral";

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
  BRAIN_CENTER_SIGNAL_RULES[id].flatMap(rule => rule.terms);

const getUserWrittenSessionText = (input: GuidedReflectionSessionAnalysisInput) =>
  [
    ...input.promptAnswers.map(answer => answer.answer),
    ...(input.threadMessages || [])
      .filter(message => message.role === "user")
      .map(message => message.text),
  ].join(" ");

const getSnippetFromSentence = (sentence: string, term: string) => {
  const words = sentence.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [];

  if (!words.length) {
    return "";
  }

  const comparableWords = words.map(getEvidenceComparableText);
  const termWords = getEvidenceComparableText(term).split(" ").filter(Boolean);
  let matchIndex = comparableWords.findIndex(word => termWords.includes(word));

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
  const end = Math.min(words.length, Math.max(matchIndex + termWords.length + 2, start + 2));

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
    .map(sentence => sentence.trim())
    .filter(Boolean);
  const snippets: string[] = [];

  for (const term of getBrainCenterTerms(id)) {
    const comparableTerm = getEvidenceComparableText(term);

    if (!comparableTerm || !comparableWriting.includes(comparableTerm)) {
      continue;
    }

    const sentence =
      sentences.find(item => getEvidenceComparableText(item).includes(comparableTerm)) ||
      userWriting;
    const snippet = getSnippetFromSentence(sentence, term);

    if (snippet && !snippets.some(item => getEvidenceComparableText(item) === getEvidenceComparableText(snippet))) {
      snippets.push(snippet);
    }

    if (snippets.length >= limit) {
      break;
    }
  }

  return snippets;
};

const sanitizeEvidence = (evidence: string[], userWriting: string, limit = 3) => {
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
      !sanitized.some(value => getEvidenceComparableText(value) === comparableSnippet)
    ) {
      sanitized.push(snippet);
    }

    if (sanitized.length >= limit) {
      break;
    }
  }

  return sanitized;
};

const detectTimeOrientation = (text: string): BrainCenterNuancedDetails["timeOrientation"] => {
  const comparable = getEvidenceComparableText(text);
  const hasPast = /\b(yesterday|past|before|remember|childhood|old)\b/.test(comparable);
  const hasFuture = /\b(tomorrow|next|future|plan|goal|carry)\b/.test(comparable);

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
  const hasOthers = /\b(dad|mom|friend|partner|family|people|judged|seen|relationship)\b/.test(
    comparable
  );
  const hasSelf = /\b(i|me|my|myself|self|identity|becoming|values)\b/.test(comparable);

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
      cognitivePattern: "The mind appears to be tracking urgency, stress, or threat response.",
    },
    planning_self_control: {
      emotionalTone: "The tone leans toward steadiness and direction.",
      cognitivePattern: "The reflection organizes around choices, restraint, and next actions.",
    },
    memory_meaning: {
      emotionalTone: "The tone holds a meaning-making quality.",
      cognitivePattern: "The writing connects present experience with past moments or lessons.",
    },
    body_inner_signals: {
      emotionalTone: "The tone is grounded in the body's internal signals.",
      cognitivePattern: "The reflection notices energy, sleep, food, or physical state.",
    },
    conflict_attention: {
      emotionalTone: "The tone suggests competing feelings or unresolved tension.",
      cognitivePattern: "Attention appears split between two possible readings or choices.",
    },
    motivation_reward: {
      emotionalTone: "The tone includes momentum, reward, or reinforcement.",
      cognitivePattern: "The reflection tracks progress, effort, or what felt worth repeating.",
    },
    relationships_perspective: {
      emotionalTone: "The tone includes social awareness or being perceived by others.",
      cognitivePattern: "The writing considers other people, belonging, judgment, or perspective.",
    },
    self_reflection_identity: {
      emotionalTone: "The tone turns inward toward identity and personal growth.",
      cognitivePattern: "The reflection asks what this says about the user's inner narrative.",
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
  const phrase = evidence[0] ? `around "${evidence[0]}"` : "lightly in the session";

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
    .map(item => normalizeText(item, BRAIN_CENTER_EVIDENCE_MAX_LENGTH))
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

    return BRAIN_CENTER_IDS.indexOf(left.id) - BRAIN_CENTER_IDS.indexOf(right.id);
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
  const uniqueScores = new Set(centers.map(center => center.score.toFixed(2)));
  return uniqueScores.size <= 1;
};

const getCenterKeywordScore = (id: BrainReflectionCenterId, text: string) => {
  const comparable = getEvidenceComparableText(text);

  return BRAIN_CENTER_SIGNAL_RULES[id].reduce((total, rule) => {
    const matched = rule.terms.some(term =>
      comparable.includes(getEvidenceComparableText(term))
    );

    return matched ? total + rule.weight : total;
  }, 0);
};

const buildBrainSessionMapFromCenters = (
  centers: BrainCenterScore[],
  fallbackSummary?: Partial<Pick<BrainSessionMap, "neuroscienceSummary" | "mindMapSeedText">>
): BrainSessionMap => {
  const rankedCenters = rankBrainCenters(hasFlatScores(centers) ? centers.map(center => ({
    ...center,
    score: BRAIN_CENTER_DETAILS[center.id].lowSignalScore,
  })) : centers);
  const dominantCenter = rankedCenters[0] as BrainCenterScore;
  const secondaryCenters = rankedCenters.slice(1, 4);
  const secondaryNames = secondaryCenters.map(center => center.productName).join(", ");
  const evidenceText = dominantCenter.evidence[0]
    ? ` The clearest evidence was "${dominantCenter.evidence[0]}."`
    : "";

  return {
    dominantCenterId: dominantCenter.id,
    dominantCenter,
    secondaryCenterIds: secondaryCenters.map(center => center.id),
    secondaryCenters,
    centers: rankedCenters,
    neuroscienceSummary: normalizeText(
      fallbackSummary?.neuroscienceSummary ||
      `Your reflection leaned most strongly toward ${dominantCenter.productName}. ${dominantCenter.shortInsight}${evidenceText} Secondary signals included ${secondaryNames}.`,
      BRAIN_SESSION_SUMMARY_MAX_LENGTH
    ),
    mostNoticedText:
      normalizeText(
        `The strongest center in this session was ${dominantCenter.productName}, because your writing most clearly returned to ${dominantCenter.evidence[0] || dominantCenter.productName.toLowerCase()}.`,
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
    mindMapSeedText: "Your first reflection has added its first signal to your Mind Map.",
  });
};

const buildHeuristicBrainSessionMap = (
  input: GuidedReflectionSessionAnalysisInput
): BrainSessionMap => {
  const userWriting = getUserWrittenSessionText(input);

  if (looksLikeLowSignalText(userWriting)) {
    return buildDefaultBrainSessionMap(input);
  }

  const carryAnswer = getAnswer(input.promptAnswers, "carry_tomorrow").toLowerCase();
  const goodAnswer = getAnswer(input.promptAnswers, "good_exciting").toLowerCase();
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

    if (id === "relationships_perspective" && /dad|mom|family|friend|partner|judged/.test(hurdleAnswer)) {
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
  const fallbackCentersById = new Map(fallback.centers.map(center => [center.id, center]));
  const aiCentersById = new Map(brainSessionMap.centers.map(center => [center.id, center]));
  const centers = BRAIN_CENTER_IDS.map((id, index) => {
    const aiCenter = aiCentersById.get(id);
    const fallbackCenter = fallbackCentersById.get(id);
    const aiEvidence = aiCenter ? sanitizeEvidence(aiCenter.evidence, userWriting) : [];
    const fallbackEvidence = fallbackCenter?.evidence || extractEvidenceForCenter(userWriting, id);

    return buildBrainCenterScore({
      id,
      score: aiCenter?.score ?? fallbackCenter?.score ?? BRAIN_CENTER_DETAILS[id].lowSignalScore,
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
  const aiNeuroscienceSummary = brainSessionMap.neuroscienceSummary?.trim() || "";
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
    mindMapSeedText: brainSessionMap.mindMapSeedText?.trim() || fallback.mindMapSeedText,
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

const canUseOnboardingOpenAi = async (userId: string) => {
  if (!isOpenAiConfigured()) {
    return false;
  }

  const accessState = await getUserAiAccessState(userId);
  return accessState.aiOptIn !== false;
};

const buildSafetyFirstSummary = (): FirstReflectionSummaryResponse => ({
  reflection:
    "This entry sounds like it may need real support before deeper reflection. Keep this simple and immediate: if anyone might be in danger, reach out to a trusted person or local emergency support now. Journal.IO can hold the words, but safety should come first.",
  takeaway: "Support first, reflection second.",
});

const buildSafetyFirstDeeperResponse = (): GuidedReflectionGoDeeperResponse => ({
  reflection:
    "This is important enough to keep grounded in real-world support. If there is any chance of immediate harm, pause the reflection and contact a trusted person or local emergency support. You can come back to writing when things feel safer.",
  followUpPrompt: "What is the safest next step you can take outside the app?",
});

const buildLowSignalFirstSummary = (): FirstReflectionSummaryResponse => ({
  reflection:
    "I do not have enough clear information yet to make a useful reflection. Journal.IO works best when you add a few specific words about what happened, what felt difficult, and what you want to carry into tomorrow. You can keep this simple and try again with one honest sentence per prompt.",
  takeaway: "Add a little more detail so the reflection can stay useful.",
});

const buildLowSignalDeeperResponse = (): GuidedReflectionGoDeeperResponse => ({
  reflection:
    "I do not have enough clear information to go deeper in a useful way yet. Add one specific detail about what happened or what you felt, and Journal.IO can respond with a more grounded reflection.",
  followUpPrompt: "What is one real detail from today that you can name clearly?",
});

const hasSafetySignal = (answers: GuidedReflectionPromptAnswer[], extraText = "") => {
  const combinedText = [
    ...answers.map(answer => answer.answer),
    extraText,
  ].join(" ");

  return hasJournalSafetySignal(detectJournalSafetySignal(combinedText));
};

const buildFallbackSummary = ({
  promptAnswers,
  onboardingContext,
}: FirstReflectionSummaryInput): FirstReflectionSummaryResponse => {
  const good = getAnswer(promptAnswers, "good_exciting") || "something worth noticing";
  const hurdle = getAnswer(promptAnswers, "hurdle") || "something that felt difficult";
  const carry =
    getAnswer(promptAnswers, "carry_tomorrow") || "one small thing to carry forward";
  const tone = getContextTone(onboardingContext);
  const practicalEnding =
    tone === "practical"
      ? " For tomorrow, keep the next step small enough to actually use."
      : " For tomorrow, let one small reminder be enough.";

  return {
    reflection: `Today seems to hold both ${good} and ${hurdle}. The useful part is that you noticed both instead of letting one cancel out the other. What you want to carry forward is ${carry}.${practicalEnding}`,
    takeaway: "Hold the full picture, then choose one small next step.",
  };
};

const buildFallbackDeeperResponse = ({
  promptAnswers,
  currentText,
  suggestionAction,
  onboardingContext,
}: GuidedReflectionGoDeeperInput): GuidedReflectionGoDeeperResponse => {
  const note = normalizeText(currentText, 220);
  const good = getAnswer(promptAnswers, "good_exciting") || "what went well";
  const hurdle = getAnswer(promptAnswers, "hurdle") || "what felt difficult";
  const carry = getAnswer(promptAnswers, "carry_tomorrow") || "what you want to carry forward";
  const tone = getContextTone(onboardingContext);
  const followUpPrompt =
    tone === "direct"
      ? "What is the clearest next action from here?"
      : "What would make tomorrow feel a little more aligned with what you noticed?";

  if (suggestionAction === "another_perspective") {
    return {
      reflection: `Another way to see this is that today was not only about ${hurdle}; it was also about the steadiness shown in ${good}. The discomfort can be real while still leaving room for ${carry} to guide tomorrow.`,
      followUpPrompt,
    };
  }

  if (suggestionAction === "small_next_step") {
    return {
      reflection: `A small next step could be to choose one concrete action that supports ${carry}. Keep it narrow enough that tomorrow-you can actually do it, even if ${hurdle} still feels present.`,
      followUpPrompt: "What is one action you can make smaller than it currently feels?",
    };
  }

  if (suggestionAction === "summarize") {
    return {
      reflection: `So far, your entry holds three threads: ${good}, ${hurdle}, and ${carry}. You are naming what stood out, what felt difficult, and what you want to bring forward without needing to turn it into a perfect conclusion.`,
      followUpPrompt: "What part of that summary feels most true?",
    };
  }

  if (suggestionAction === "gentle_prompt") {
    return {
      reflection: `A gentle place to continue is this: what did the part of today around ${hurdle} need from you in that moment? This may help because it keeps the focus on care and clarity instead of judgment.`,
      followUpPrompt: "What did that part of the day need from you?",
    };
  }

  return {
    reflection: `This added note gives the reflection more shape: ${note}. A useful way to read it is as information about what matters to you right now, not as a verdict on the day. Keep the next step gentle and specific.`,
    followUpPrompt,
  };
};

const getSessionText = (input: GuidedReflectionSessionAnalysisInput) =>
  [
    ...input.promptAnswers.map(answer => answer.answer),
    input.aiSummary || "",
    ...(input.threadMessages || []).map(message => message.text),
  ].join(" ");

const buildLowSignalSessionAnalysis = (
  input?: GuidedReflectionSessionAnalysisInput
): GuidedReflectionSessionAnalysisResponse => ({
  analysis:
    "There is not enough clear information in this session to form a useful insight yet. Journal.IO can notice patterns best when the entry includes a few specific details about what happened, what felt difficult, and what you want to carry forward. You can still save this entry, and future reflections will give the app more to work with.",
  majorInsight:
    "Major insight: there is not enough clear detail yet to identify a reliable pattern.",
  observedTrends: ["More detail needed", "Reflection started", "Tomorrow"],
  topicsObserved: ["More detail needed", "Reflection started", "Tomorrow"],
  brainSessionMap: buildDefaultBrainSessionMap(input),
  hasEnoughSignal: false,
});

const buildSessionAnalysisFallback = ({
  userId,
  promptAnswers,
  aiSummary,
  threadMessages,
}: GuidedReflectionSessionAnalysisInput): GuidedReflectionSessionAnalysisResponse => {
  const good = getAnswer(promptAnswers, "good_exciting") || "one steady moment";
  const hurdle = getAnswer(promptAnswers, "hurdle") || "one harder moment";
  const carry =
    getAnswer(promptAnswers, "carry_tomorrow") || "one thing to carry into tomorrow";
  const brainMapInput: GuidedReflectionSessionAnalysisInput = {
    userId,
    promptAnswers,
    ...(aiSummary ? { aiSummary } : {}),
    ...(threadMessages ? { threadMessages } : {}),
  };

  return {
    analysis: compactSessionAnalysisText([
      `This session suggests a useful contrast between ${good} and ${hurdle}.`,
      `The important part is not that the day was perfectly resolved; it is that the entry names both a point of steadiness and a point of friction without letting one erase the other.`,
      `The clearest direction for tomorrow is ${carry}, which gives the reflection a practical anchor instead of leaving it as only a recap.`,
      `A broader pattern may be emerging around noticing pressure, choosing a steadier response, and returning to one specific intention.`,
    ].join(" ")),
    majorInsight:
      "Major insight: the strongest signal is the move from noticing pressure to choosing one grounded action for tomorrow.",
    observedTrends: ["Steadiness", "Pressure", "Tomorrow", "Self-awareness"],
    topicsObserved: ["Steadiness", "Pressure", "Tomorrow", "Self-awareness"],
    brainSessionMap: buildHeuristicBrainSessionMap(brainMapInput),
    hasEnoughSignal: true,
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
    getAnswer(input?.promptAnswers || [], "carry_tomorrow") || "your next priority",
    38
  );
  const sessionText = [
    ...(input?.promptAnswers || []).map(answer => answer.answer),
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
      description: "After dinner, write the one moment from today you want to remember.",
      frequency: "daily",
      category: "journaling_habit",
    },
    {
      title: "Write one line after dinner",
      description: "After dinner, write one line about what repeated in your day.",
      frequency: "daily",
      category: "self_awareness",
    },
    {
      title: "Start tomorrow in 5 minutes",
      description: `Before noon, spend five minutes on: ${carry}.`,
      frequency: "as_needed",
      category: "general",
    },
  ];

  if (sessionText.includes("stress") || sessionText.includes("pressure")) {
    goals.unshift({
      title: "Pause and name the pressure",
      description: `When ${hurdle} comes up, pause one minute and name your next small step.`,
      frequency: "as_needed",
      category: "stress",
    });
  }

  if (sessionText.includes("discipline") || sessionText.includes("habit")) {
    goals.unshift({
      title: "Do one steady 5-minute task",
      description: "Before noon, repeat the smallest useful part of your routine for five minutes.",
      frequency: "daily",
      category: "general",
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

  const fallback = buildFallbackSummary(input);

  if (!(await canUseOnboardingOpenAi(input.userId))) {
    return fallback;
  }

  const aiResponse = await requestStructuredOpenAi({
    feature: "first guided reflection summary",
    schemaName: "first_guided_reflection_summary",
    schema: guidedReflectionJsonSchema,
    parser: reflectionSummarySchema,
    maxOutputTokens: 220,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: JSON.stringify({
          task:
            "Write one short Journal.IO reflection from these three daily prompt answers. Include what the user experienced, one contrast or pattern, and one gentle takeaway for tomorrow.",
          promptAnswers: input.promptAnswers.map(answer => ({
            questionId: answer.questionId,
            question: answer.question,
            answer: normalizeText(answer.answer),
          })),
          onboardingContext: input.onboardingContext || {},
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

  const fallback = buildFallbackDeeperResponse(input);

  if (!(await canUseOnboardingOpenAi(input.userId))) {
    return fallback;
  }

  const aiResponse = await requestStructuredOpenAi({
    feature: "guided reflection go deeper",
    schemaName: "guided_reflection_go_deeper",
    schema: goDeeperJsonSchema,
    parser: goDeeperResponseSchema,
    maxOutputTokens: 210,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: JSON.stringify({
          task:
            "Respond to the user's added note or selected suggestion with one concise deeper reflection and, if useful, one short follow-up prompt. Do not repeat the earlier summary.",
          suggestionAction: input.suggestionAction || null,
          suggestionInstruction: getSuggestionInstruction(input.suggestionAction),
          promptAnswers: input.promptAnswers.map(answer => ({
            questionId: answer.questionId,
            question: answer.question,
            answer: normalizeText(answer.answer),
          })),
          aiSummary: input.aiSummary ? normalizeText(input.aiSummary, 700) : "",
          previousDeeperReflections: (input.previousDeeperReflections || []).map(item =>
            normalizeText(item, 500)
          ),
          threadMessages: (input.threadMessages || []).map(message => ({
            role: message.role,
            kind: normalizeText(message.kind, 80),
            text: normalizeText(message.text, 700),
            actionType: message.actionType || null,
          })),
          currentText: normalizeText(input.currentText),
          onboardingContext: input.onboardingContext || {},
        }),
      },
    ],
  });

  if (!aiResponse) {
    return fallback;
  }

  return {
    reflection: aiResponse.reflection,
    ...(aiResponse.followUpPrompt ? { followUpPrompt: aiResponse.followUpPrompt } : {}),
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
      brainSessionMap: buildHeuristicBrainSessionMap(input),
      hasEnoughSignal: true,
    };
  }

  const fallback = buildSessionAnalysisFallback(input);

  if (!(await canUseOnboardingOpenAi(input.userId))) {
    return fallback;
  }

  const aiResponse = await requestStructuredOpenAi({
    feature: "guided reflection session analysis",
    schemaName: "guided_reflection_session_analysis",
    schema: sessionAnalysisJsonSchema,
    parser: sessionAnalysisResponseSchema,
    maxOutputTokens: 2400,
    model: SESSION_ANALYSIS_MODEL(),
    reasoningEffort: "high",
    messages: [
      {
        role: "system",
        content: [
          SYSTEM_PROMPT,
          "For this task, write a session-level insight, not another reflective chat reply.",
          "Be meaningful and pattern-oriented, but never clinical, diagnostic, or therapy-claiming.",
          "Use behavior-focused language such as 'suggests', 'may show', 'appears connected to', and 'the clearest signal is'.",
          "If the writing is unclear or too sparse, say there is not enough information rather than inventing insight.",
          "Return a precise 3-4 sentence analysis (no more than about 110 words), one bold-worthy major insight sentence without markdown, 2-4 short trend labels, and a brain-inspired reflection-center classification.",
          "The brainSessionMap must always include all 8 centers, exactly one dominant center, 1-3 secondary centers, and centers sorted by score descending.",
          "Scores and confidence values must be between 0 and 1, must not all be equal, and the dominant center must have the highest score.",
          "Classify by the overall meaning of the session, not shallow keyword matching.",
          "Evidence must come only from the user-authored prompt answers or user thread messages, not from assistant text. Keep up to three evidence chips short, usually 2-6 words, and do not invent facts.",
          "Use premium, concise, emotionally intelligent language. Do not sound robotic, clinical, or over-explain the neuroscience.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          task:
            "Analyze the full first-guided-reflection session. Identify meaningful behavioral/emotional patterns, what the user may be trying to carry forward, the strongest non-clinical insight, and the required brainSessionMap. Do not diagnose. Do not use therapy claims. Do not invent facts. If the session is gibberish or too sparse, say there is not enough information and still return a valid brainSessionMap.",
          brainReflectionCenters: BRAIN_CENTER_IDS.map(id => ({
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
          promptAnswers: input.promptAnswers.map(answer => ({
            questionId: answer.questionId,
            question: answer.question,
            answer: normalizeText(answer.answer),
          })),
          userWritingOnly: normalizeText(getUserWrittenSessionText(input), 1600),
          aiSummary: input.aiSummary ? normalizeText(input.aiSummary, 900) : "",
          threadMessages: (input.threadMessages || []).map(message => ({
            role: message.role,
            kind: normalizeText(message.kind, 80),
            text: normalizeText(message.text, 900),
            actionType: message.actionType || null,
          })),
          onboardingContext: input.onboardingContext || {},
          fallbackStyleExample: fallback.analysis,
        }),
      },
    ],
  });

  if (!aiResponse) {
    return fallback;
  }

  return {
    analysis: aiResponse.analysis,
    majorInsight: `Major insight: ${aiResponse.majorInsight.replace(/^major insight:\s*/i, "")}`,
    observedTrends: aiResponse.observedTrends,
    topicsObserved: aiResponse.topicsObserved?.length
      ? aiResponse.topicsObserved
      : aiResponse.observedTrends,
    brainSessionMap: normalizeBrainSessionMap(
      aiResponse.brainSessionMap,
      input,
      fallback.brainSessionMap
    ),
    hasEnoughSignal: true,
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

  if (!hasEnoughSignal) {
    return fallback;
  }

  if (hasSafetySignal(input.promptAnswers, sessionText)) {
    return {
      goals: [
        {
          title: "Choose one safe next step",
          description: "Name one grounded action outside the app that helps you feel safer today.",
          frequency: "as_needed",
          category: "general",
        },
        {
          title: "Write what support means",
          description: "Use one short entry to name what real support would look like right now.",
          frequency: "as_needed",
          category: "self_awareness",
        },
      ],
      hasEnoughSignal: true,
    };
  }

  if (!(await canUseOnboardingOpenAi(input.userId))) {
    return fallback;
  }

  const aiResponse = await requestStructuredOpenAi({
    feature: "guided reflection goal suggestions",
    schemaName: "guided_reflection_goal_suggestions",
    schema: goalSuggestionsJsonSchema,
    parser: goalSuggestionsResponseSchema,
    maxOutputTokens: 420,
    messages: [
      {
        role: "system",
        content: [
          SYSTEM_PROMPT,
          "Suggest small practical journaling/self-reflection goals from the user's first session.",
          "Do not create medical, clinical, diagnostic, shame-based, or treatment-plan goals.",
          "Use the user's actual themes and return only the number of goals supported by those themes; never pad the response with generic goals.",
          "Each goal must be a concrete, low-effort action tied directly to a detail in the user's entry, with a clear trigger, time limit, quantity, or first step. Prefer actions such as a five-minute walk after a named event, one sentence after dinner about a named concern, or choosing a single task before noon.",
          "Use a direct imperative title of at most 30 characters and one precise description of at most 96 characters.",
          "Avoid vague titles or descriptions such as reflect more, notice a pattern, be mindful, or work on yourself unless they specify exactly when and what to do.",
          "Return 1-4 goals when there is enough signal, and 1-3 safe fallback-style goals for low signal.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          task:
            "Create one to four specific, doable, non-clinical actions for the user's first Journal.IO onboarding value flow. Ground every goal in a concrete detail from the entry. Keep titles under 30 characters and descriptions under 96 characters. Do not create a fixed number of goals or pad with generic reflection advice. Goals are local suggestions only and will not be persisted yet.",
          promptAnswers: input.promptAnswers.map(answer => ({
            questionId: answer.questionId,
            question: answer.question,
            answer: normalizeText(answer.answer),
          })),
          aiSummary: input.aiSummary ? normalizeText(input.aiSummary, 900) : "",
          threadMessages: (input.threadMessages || []).map(message => ({
            role: message.role,
            kind: normalizeText(message.kind, 80),
            text: normalizeText(message.text, 900),
            actionType: message.actionType || null,
          })),
          sessionAnalysis: input.sessionAnalysis || {},
          onboardingContext: input.onboardingContext || {},
          fallbackExamples: fallback.goals,
        }),
      },
    ],
  });

  if (!aiResponse) {
    return fallback;
  }

  return {
    goals: aiResponse.goals.slice(0, 4),
    hasEnoughSignal: aiResponse.hasEnoughSignal,
  };
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
