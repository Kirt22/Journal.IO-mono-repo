import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OnboardingCompletionData } from "../types/onboarding";

const INSTALL_SEEN_KEY = "journalio.installSeen";
const ONBOARDING_COMPLETED_KEY = "journalio.onboardingCompleted";
const ONBOARDING_DATA_KEY = "journalio.onboardingData";
const HIDE_JOURNAL_PREVIEWS_KEY = "journalio.hideJournalPreviews";
const POST_AUTH_PAYWALL_SEEN_KEY = "journalio.postAuthPaywallSeen";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string");

const isStoredOnboardingData = (
  value: unknown
): value is OnboardingCompletionData => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.ageRange === "string" &&
    typeof candidate.journalingExperience === "string" &&
    isStringArray(candidate.goals) &&
    isStringArray(candidate.supportFocusAreas) &&
    typeof candidate.reminderPreference === "string" &&
    typeof candidate.aiComfort === "boolean" &&
    typeof candidate.privacyConsent === "boolean"
  );
};

const hasSeenInstall = async () => {
  return (await AsyncStorage.getItem(INSTALL_SEEN_KEY)) === "true";
};

const markInstallSeen = async () => {
  await AsyncStorage.setItem(INSTALL_SEEN_KEY, "true");
};

const getOnboardingCompleted = async () => {
  return (await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY)) === "true";
};

const saveOnboardingCompleted = async (completed: boolean) => {
  await AsyncStorage.setItem(
    ONBOARDING_COMPLETED_KEY,
    completed ? "true" : "false"
  );
};

const getStoredOnboardingData =
  async (): Promise<OnboardingCompletionData | null> => {
    const rawValue = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);

    if (!rawValue) {
      return null;
    }

    try {
      const parsedValue = JSON.parse(rawValue);
      return isStoredOnboardingData(parsedValue) ? parsedValue : null;
    } catch {
      return null;
    }
  };

const saveStoredOnboardingData = async (data: OnboardingCompletionData) => {
  await AsyncStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(data));
};

const getPostAuthPaywallSeen = async () => {
  const value = await AsyncStorage.getItem(POST_AUTH_PAYWALL_SEEN_KEY);

  if (value === null) {
    return null;
  }

  return value === "true";
};

const savePostAuthPaywallSeen = async (seen: boolean) => {
  await AsyncStorage.setItem(
    POST_AUTH_PAYWALL_SEEN_KEY,
    seen ? "true" : "false"
  );
};

const getHideJournalPreviews = async () => {
  return (await AsyncStorage.getItem(HIDE_JOURNAL_PREVIEWS_KEY)) === "true";
};

const saveHideJournalPreviews = async (enabled: boolean) => {
  await AsyncStorage.setItem(
    HIDE_JOURNAL_PREVIEWS_KEY,
    enabled ? "true" : "false"
  );
};

const clearOnboardingCompleted = async () => {
  await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
};

const clearStoredOnboardingData = async () => {
  await AsyncStorage.removeItem(ONBOARDING_DATA_KEY);
};

const clearPostAuthPaywallSeen = async () => {
  await AsyncStorage.removeItem(POST_AUTH_PAYWALL_SEEN_KEY);
};

export {
  clearOnboardingCompleted,
  clearPostAuthPaywallSeen,
  clearStoredOnboardingData,
  getHideJournalPreviews,
  getOnboardingCompleted,
  getPostAuthPaywallSeen,
  getStoredOnboardingData,
  hasSeenInstall,
  markInstallSeen,
  saveHideJournalPreviews,
  saveOnboardingCompleted,
  savePostAuthPaywallSeen,
  saveStoredOnboardingData,
};
