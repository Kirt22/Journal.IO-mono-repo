import type { GoalIconKey } from "../constants/goalIcons";
import { AI_REQUEST_TIMEOUT_MS, request } from "../utils/apiClient";

/**
 * These four routes all wait on a model call, so the default 20s deadline would
 * cut them off mid-thought. Raised here rather than loosening the default,
 * which exists to stop a dead backend from hanging the app on boot.
 */
const AI_REQUEST_BEHAVIOR = { timeoutMs: AI_REQUEST_TIMEOUT_MS };

type GuidedReflectionOnboardingContext = {
  ageRange?: string;
  primaryContext?: string;
  reflectionTone?: string[];
  primarySupportFocus?: string;
  supportFocusAreas?: string[];
  preferredTheme?: string;
};

type FirstReflectionPromptAnswer = {
  questionId: "good_exciting" | "hurdle" | "carry_tomorrow";
  question: string;
  answer: string;
};

type GuidedReflectionPromptAnswer = {
  questionId: string;
  question: string;
  answer: string;
};

type GuidedSuggestionAction =
  | "gentle_prompt"
  | "go_deeper"
  | "another_perspective"
  | "small_next_step"
  | "summarize";

/**
 * One trigger -> emotional response link a guided turn surfaced.
 *
 * Guided reflection keeps no server-side session, so this state rides on the
 * client the same way `previousDeeperReflections` already does: the server
 * returns the full merged list each turn, the client stores it verbatim, and
 * sends it straight back on the next call. The client never merges or edits it
 * — the server re-validates everything on arrival.
 */
export type GuidedSessionTrigger = {
  trigger: string;
  emotionalResponse: string;
  evidenceQuote: string;
  confidence: number;
  sessionOccurrences: number;
};

export type GuidedSessionSignals = {
  triggers: GuidedSessionTrigger[];
  /** The trigger the next question is aimed at. Empty when none yet. */
  activeTrigger: string;
  /** Which rung of the probing ladder the next question sits on. */
  triggerStage: "surface" | "test" | "function" | "none";
};

type GuidedReflectionThreadMessagePayload = {
  role: "user" | "assistant";
  kind: string;
  text: string;
  actionType?: GuidedSuggestionAction;
  promptQuestion?: string;
};

type FirstReflectionSummaryPayload = {
  promptAnswers: FirstReflectionPromptAnswer[];
  onboardingContext?: GuidedReflectionOnboardingContext;
};

type GuidedReflectionGoDeeperPayload = {
  promptAnswers: GuidedReflectionPromptAnswer[];
  aiSummary?: string;
  previousDeeperReflections?: string[];
  threadMessages?: GuidedReflectionThreadMessagePayload[];
  currentText: string;
  suggestionAction?: GuidedSuggestionAction;
  previousSignals?: GuidedSessionTrigger[];
  onboardingContext?: GuidedReflectionOnboardingContext;
};

type GuidedReflectionSessionAnalysisPayload = {
  journalId?: string;
  promptAnswers: GuidedReflectionPromptAnswer[];
  aiSummary?: string;
  threadMessages?: GuidedReflectionThreadMessagePayload[];
  sessionSignals?: GuidedSessionTrigger[];
  onboardingContext?: GuidedReflectionOnboardingContext;
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

type BrainCenterScore = {
  id: BrainReflectionCenterId;
  productName: string;
  brainRegion: string;
  score: number;
  confidence: number;
  rank: number;
  intensity: "low" | "moderate" | "high";
  evidence: string[];
  shortInsight: string;
  nuancedDetails: {
    emotionalTone?: string;
    cognitivePattern?: string;
    timeOrientation?: "past" | "present" | "future" | "mixed";
    selfOtherFocus?: "self" | "others" | "mixed";
    actionOrientation?: "reflecting" | "planning" | "avoiding" | "processing" | "acting";
    repeatedSignal?: string;
  };
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

type FirstReflectionGoalSuggestionPayload = {
  title: string;
  description: string;
  frequency: "daily" | "weekly" | "as_needed";
  category: FirstReflectionGoalCategory;
  /** Curated key from constants/goalIcons, chosen by the model. */
  icon: GoalIconKey;
};

type GuidedReflectionGoalSuggestionsPayload = GuidedReflectionSessionAnalysisPayload & {
  sessionAnalysis?: {
    analysis?: string;
    majorInsight?: string;
    observedTrends?: string[];
    hasEnoughSignal?: boolean;
  };
};

type FirstReflectionSummaryResponse = {
  reflection: string;
  // A therapist-style follow-up question delivered with the opening analysis to
  // draw the user deeper. Becomes the first question of the go-deeper thread.
  followUpQuestion: string;
  takeaway?: string;
  sessionSignals?: GuidedSessionSignals;
};

type GuidedReflectionGoDeeperResponse = {
  reflection: string;
  // Adaptive, therapist-style next question generated from the user's last
  // answer. The user chooses whether to answer it or wrap up (user-paced).
  nextQuestion: string;
  // False once the reflection reaches a natural, resolved stopping point.
  canGoDeeper: boolean;
  // Every trigger the session has surfaced so far, not just this turn — store
  // it as-is and send it straight back as `previousSignals`.
  sessionSignals?: GuidedSessionSignals;
};

type GuidedReflectionSessionAnalysisResponse = {
  analysis: string;
  majorInsight: string;
  observedTrends: string[];
  /**
   * Trigger -> response links the session evidenced, each graded against what
   * the pattern graph already knows. `status` and `occurrences` are set by the
   * server from the graph, never by the model.
   */
  triggersObserved?: {
    trigger: string;
    emotionalResponse: string;
    evidenceQuote: string;
    confidence: number;
    status: "emerging" | "recurring" | "confirmed";
    occurrences: number;
  }[];
  patternAssessment?: {
    label: string;
    basis: string;
    status: "emerging" | "recurring" | "confirmed";
    occurrences: number;
  }[];
  topicsObserved?: string[];
  detectedTopics: string[];
  detectedMood: "amazing" | "good" | "okay" | "bad" | "terrible";
  brainSessionMap: BrainSessionMap;
  hasEnoughSignal: boolean;
};

type GuidedReflectionGoalSuggestionsResponse = {
  goals: FirstReflectionGoalSuggestionPayload[];
  hasEnoughSignal: boolean;
};

const createFirstReflectionSummary = async (
  payload: FirstReflectionSummaryPayload
) => {
  const response = await request<FirstReflectionSummaryResponse>(
    "/guided-reflection/first-summary",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    AI_REQUEST_BEHAVIOR
  );

  return response.data;
};

const createGuidedReflectionDeeperResponse = async (
  payload: GuidedReflectionGoDeeperPayload
) => {
  const response = await request<GuidedReflectionGoDeeperResponse>(
    "/guided-reflection/go-deeper",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    AI_REQUEST_BEHAVIOR
  );

  return response.data;
};

const createGuidedReflectionSessionAnalysis = async (
  payload: GuidedReflectionSessionAnalysisPayload
) => {
  const response = await request<GuidedReflectionSessionAnalysisResponse>(
    "/guided-reflection/session-analysis",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    AI_REQUEST_BEHAVIOR
  );

  return response.data;
};

const createGuidedReflectionGoalSuggestions = async (
  payload: GuidedReflectionGoalSuggestionsPayload
) => {
  const response = await request<GuidedReflectionGoalSuggestionsResponse>(
    "/guided-reflection/goal-suggestions",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    AI_REQUEST_BEHAVIOR
  );

  return response.data;
};

export type {
  BrainCenterScore,
  BrainReflectionCenterId,
  BrainSessionMap,
  FirstReflectionGoalCategory,
  FirstReflectionGoalSuggestionPayload,
  FirstReflectionPromptAnswer,
  FirstReflectionSummaryPayload,
  FirstReflectionSummaryResponse,
  GuidedReflectionGoDeeperPayload,
  GuidedReflectionGoDeeperResponse,
  GuidedReflectionGoalSuggestionsPayload,
  GuidedReflectionGoalSuggestionsResponse,
  GuidedReflectionOnboardingContext,
  GuidedReflectionPromptAnswer,
  GuidedReflectionSessionAnalysisPayload,
  GuidedReflectionSessionAnalysisResponse,
  GuidedReflectionThreadMessagePayload,
  GuidedSuggestionAction,
};
export {
  createFirstReflectionSummary,
  createGuidedReflectionDeeperResponse,
  createGuidedReflectionGoalSuggestions,
  createGuidedReflectionSessionAnalysis,
};
