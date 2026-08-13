import { z } from "zod";

const onboardingDemoMoodSchema = z.enum(["great", "good", "okay", "low", "stressed"]);

const onboardingDemoAnalysisBodySchema = z.object({
  mood: onboardingDemoMoodSchema,
  feeling: z.string().trim().max(24, "Feeling must be 24 characters or fewer").optional(),
  challenge: z.string().trim().max(80, "Gentle hurdle must be 80 characters or fewer").optional(),
  thoughts: z
    .string()
    .trim()
    .min(1, "Journal thoughts are required")
    .max(500, "Journal thoughts must be 500 characters or fewer"),
});

const createOnboardingDemoAnalysisSchema = z.object({
  body: onboardingDemoAnalysisBodySchema,
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const onboardingStringArraySchema = z.array(z.string().trim().min(1)).max(16);

const onboardingFirstReflectionSummarySchema = z.object({
  title: z.string().trim().max(120).optional(),
  theme: z.string().trim().max(80).optional(),
  tags: onboardingStringArraySchema.optional(),
  mindMapNode: z.string().trim().max(120).optional(),
});

const completeOnboardingBodySchema = z.object({
  version: z.number().int().positive().optional(),
  whatBringsYouHere: onboardingStringArraySchema.optional(),
  supportFocusAreas: onboardingStringArraySchema.optional(),
  primaryContext: z.string().trim().max(120).optional(),
  ageRange: z.string().trim().max(40).optional(),
  reflectionTone: onboardingStringArraySchema.optional(),
  preferredTheme: z.string().trim().max(80).optional(),
  reminderPreference: z.string().trim().max(80).optional(),
  privacyConsent: z.boolean().optional(),
  firstReflectionId: z.string().trim().max(120).optional(),
  firstReflectionSummary: onboardingFirstReflectionSummarySchema.optional(),
  personalGoals: onboardingStringArraySchema.optional(),
  goals: onboardingStringArraySchema.optional(),
  journalingExperience: z.string().trim().max(120).optional(),
  referralSource: z.string().trim().max(80).optional(),
  referralSourceOther: z.string().trim().max(120).optional(),
  commitmentSignedAt: z.string().datetime().optional(),
});

const completeOnboardingSchema = z.object({
  body: completeOnboardingBodySchema,
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export {
  completeOnboardingBodySchema,
  completeOnboardingSchema,
  createOnboardingDemoAnalysisSchema,
  onboardingDemoAnalysisBodySchema,
  onboardingDemoMoodSchema,
};
