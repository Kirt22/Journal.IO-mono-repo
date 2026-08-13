export type OnboardingCompletionData = {
  ageRange: string;
  journalingExperience: string;
  goals: string[];
  supportFocusAreas: string[];
  reminderPreference: string;
  privacyConsent: boolean;
};

export type OnboardingV2Draft = {
  version: 2;
  displayName?: string;
  referralSource?: string;
  referralSourceOther?: string;
  whatBringsYouHere?: string[];
  supportFocusAreas?: string[];
  primarySupportFocus?: string;
  primaryContext?: string;
  ageRange?: string;
  reflectionTone?: string[];
  preferredTheme?: string;
  privacyConsent?: boolean;
  /** ISO timestamp captured when the user signs the onboarding commitment. */
  commitmentSignedAt?: string;
};
