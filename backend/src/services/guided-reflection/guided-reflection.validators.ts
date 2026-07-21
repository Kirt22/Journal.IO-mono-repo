import { z } from "zod";

const onboardingContextSchema = z
  .object({
    ageRange: z.string().trim().max(80).optional(),
    primaryContext: z.string().trim().max(80).optional(),
    reflectionTone: z.array(z.string().trim().max(40)).max(6).optional(),
    primarySupportFocus: z.string().trim().max(80).optional(),
    supportFocusAreas: z.array(z.string().trim().max(80)).max(12).optional(),
    preferredTheme: z.string().trim().max(80).optional(),
  })
  .optional();

const firstReflectionPromptAnswerSchema = z.object({
  questionId: z.enum(["good_exciting", "hurdle", "carry_tomorrow"]),
  question: z.string().trim().min(1).max(180),
  answer: z.string().trim().min(2).max(900),
});

const guidedReflectionPromptAnswerSchema = z.object({
  questionId: z.string().trim().min(1).max(80),
  question: z.string().trim().min(1).max(180),
  answer: z.string().trim().min(1).max(900),
});

const guidedSuggestionActionSchema = z.enum([
  "gentle_prompt",
  "go_deeper",
  "another_perspective",
  "small_next_step",
  "summarize",
]);

const guidedThreadMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  kind: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(1200),
  actionType: guidedSuggestionActionSchema.optional(),
});

const sessionAnalysisPayloadSchema = z
  .object({
    analysis: z.string().trim().max(1400).optional(),
    majorInsight: z.string().trim().max(320).optional(),
    observedTrends: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
    hasEnoughSignal: z.boolean().optional(),
  })
  .optional();

const createFirstReflectionSummarySchema = z.object({
  body: z.object({
    promptAnswers: z.array(firstReflectionPromptAnswerSchema).length(3),
    onboardingContext: onboardingContextSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const createGuidedReflectionGoDeeperSchema = z.object({
  body: z.object({
    promptAnswers: z.array(guidedReflectionPromptAnswerSchema).min(1).max(6),
    aiSummary: z.string().trim().max(1200).optional(),
    previousDeeperReflections: z.array(z.string().trim().min(1).max(900)).max(3).optional(),
    threadMessages: z.array(guidedThreadMessageSchema).max(8).optional(),
    currentText: z.string().trim().min(2).max(900),
    suggestionAction: guidedSuggestionActionSchema.optional(),
    onboardingContext: onboardingContextSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const createGuidedReflectionSessionAnalysisSchema = z.object({
  body: z.object({
    promptAnswers: z.array(guidedReflectionPromptAnswerSchema).min(3).max(6),
    aiSummary: z.string().trim().max(1200).optional(),
    threadMessages: z.array(guidedThreadMessageSchema).max(10).optional(),
    onboardingContext: onboardingContextSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const createGuidedReflectionGoalSuggestionsSchema = z.object({
  body: z.object({
    promptAnswers: z.array(guidedReflectionPromptAnswerSchema).min(3).max(6),
    aiSummary: z.string().trim().max(1200).optional(),
    threadMessages: z.array(guidedThreadMessageSchema).max(10).optional(),
    sessionAnalysis: sessionAnalysisPayloadSchema,
    onboardingContext: onboardingContextSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export {
  createFirstReflectionSummarySchema,
  createGuidedReflectionGoDeeperSchema,
  createGuidedReflectionGoalSuggestionsSchema,
  createGuidedReflectionSessionAnalysisSchema,
};
