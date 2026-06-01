import { request } from "../utils/apiClient";

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

export { generateOnboardingDemoAnalysis };
export type {
  OnboardingDemoAnalysisRequest,
  OnboardingDemoAnalysisResponse,
  OnboardingDemoKeyword,
  OnboardingDemoMood,
};
