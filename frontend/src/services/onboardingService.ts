import { request } from "../utils/apiClient";
import { CURRENT_ONBOARDING_VERSION } from "../config/onboarding";
import type { AuthUser } from "./authService";
import type { OnboardingCompletionData } from "../types/onboarding";

type OnboardingDemoMood = "great" | "good" | "okay" | "low" | "stressed";

type OnboardingDemoAnalysisRequest = {
  mood: OnboardingDemoMood;
  feeling?: string;
  challenge?: string;
  thoughts: string;
};

type OnboardingDemoKeyword = {
  label: string;
  description: string;
};

type OnboardingDemoAnalysisResponse = {
  moodTone: string;
  summary: string;
  keywords: OnboardingDemoKeyword[];
  prompt: string;
};

type CompleteOnboardingPayload = OnboardingCompletionData;

const generateOnboardingDemoAnalysis = async (
  payload: OnboardingDemoAnalysisRequest
) => {
  const response = await request<OnboardingDemoAnalysisResponse>(
    "/onboarding/demo-analysis",
    {
      body: JSON.stringify(payload),
      method: "POST",
    }
  );

  return response.data;
};

const completeOnboarding = async (payload: CompleteOnboardingPayload) => {
  const response = await request<AuthUser>("/onboarding/complete", {
    body: JSON.stringify({
      ...payload,
      version: CURRENT_ONBOARDING_VERSION,
    }),
    method: "POST",
  });

  return response.data;
};

export { completeOnboarding, generateOnboardingDemoAnalysis };
export type {
  CompleteOnboardingPayload,
  OnboardingDemoAnalysisRequest,
  OnboardingDemoAnalysisResponse,
  OnboardingDemoKeyword,
  OnboardingDemoMood,
};
