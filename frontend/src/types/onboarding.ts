export type OnboardingCompletionData = {
  ageRange: string;
  journalingExperience: string;
  goals: string[];
  supportFocusAreas: string[];
  reminderPreference: string;
  aiComfort: boolean;
  privacyConsent: boolean;
};

export type OnboardingV2Draft = {
  version: 2;
  referralSource?: string;
  referralSourceOther?: string;
  whatBringsYouHere?: string[];
  supportFocusAreas?: string[];
  primarySupportFocus?: string;
  primaryContext?: string;
  ageRange?: string;
  reflectionTone?: string[];
  preferredTheme?: string;
  aiComfort?: boolean;
  privacyConsent?: boolean;
};
