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

export {
  createOnboardingDemoAnalysisSchema,
  onboardingDemoAnalysisBodySchema,
  onboardingDemoMoodSchema,
};
