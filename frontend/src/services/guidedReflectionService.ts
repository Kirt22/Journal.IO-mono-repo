import { request } from "../utils/apiClient";

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

type GuidedReflectionThreadMessagePayload = {
  role: "user" | "assistant";
  kind: string;
  text: string;
  actionType?: GuidedSuggestionAction;
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
  onboardingContext?: GuidedReflectionOnboardingContext;
};

type GuidedReflectionSessionAnalysisPayload = {
  promptAnswers: GuidedReflectionPromptAnswer[];
  aiSummary?: string;
  threadMessages?: GuidedReflectionThreadMessagePayload[];
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
    }
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
    }
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
    }
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
    }
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
