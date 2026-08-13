import { useState } from "react";
import type { OnboardingV2Draft } from "../types/onboarding";

const createInitialOnboardingV2Draft = (): OnboardingV2Draft => ({
  version: 2,
  whatBringsYouHere: [],
  supportFocusAreas: [],
  reflectionTone: [],
  privacyConsent: false,
});

const toggleValue = (values: string[] = [], value: string) =>
  values.includes(value)
    ? values.filter(item => item !== value)
    : [...values, value];

export function useOnboardingV2State() {
  const [draft, setDraft] = useState<OnboardingV2Draft>(
    createInitialOnboardingV2Draft
  );

  const toggleDraftArrayValue = (
    key: "whatBringsYouHere" | "supportFocusAreas" | "reflectionTone",
    value: string
  ) => {
    setDraft(currentDraft => ({
      ...currentDraft,
      [key]: toggleValue(currentDraft[key], value),
    }));
  };

  const setDraftValue = <Key extends keyof OnboardingV2Draft>(
    key: Key,
    value: OnboardingV2Draft[Key]
  ) => {
    setDraft(currentDraft => ({
      ...currentDraft,
      [key]: value,
    }));
  };

  const setDraftArraySingleValue = (
    key: "whatBringsYouHere" | "supportFocusAreas" | "reflectionTone",
    value: string
  ) => {
    setDraft(currentDraft => ({
      ...currentDraft,
      [key]: [value],
    }));
  };

  return {
    draft,
    setDraftValue,
    setDraftArraySingleValue,
    toggleDraftArrayValue,
  };
}
