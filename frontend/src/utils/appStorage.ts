import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OnboardingCompletionData } from "../types/onboarding";
import {
  ONBOARDING_CACHE_SERVICE,
  ONBOARDING_RESUME_SERVICE,
  clearDeviceOnlyValue,
  getDeviceOnlyValue,
  saveDeviceOnlyValue,
} from "./keychainStorage";
import {
  isOnboardingResumePoint,
  type OnboardingResumePoint,
} from "./onboardingResume";

const INSTALL_SEEN_KEY = "journalio.installSeen";
const ONBOARDING_COMPLETED_KEY = "journalio.onboardingCompleted";
const ONBOARDING_DATA_KEY = "journalio.onboardingData";
const HIDE_JOURNAL_PREVIEWS_KEY = "journalio.hideJournalPreviews";
const HAPTICS_ENABLED_KEY = "journalio.hapticsEnabled";
const POST_AUTH_PAYWALL_SEEN_KEY = "journalio.postAuthPaywallSeen";
const LAST_KNOWN_STREAK_KEY = "journalio.home.lastKnownStreak";
const REFLECTION_SEEN_DATE_KEY = "journalio.home.reflectionSeenDateKey";

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
    let rawValue = await getDeviceOnlyValue(ONBOARDING_CACHE_SERVICE);

    if (!rawValue) {
      const legacyValue = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);

      if (!legacyValue) {
        return null;
      }

      try {
        const parsedLegacyValue = JSON.parse(legacyValue);

        if (!isStoredOnboardingData(parsedLegacyValue)) {
          await AsyncStorage.removeItem(ONBOARDING_DATA_KEY);
          return null;
        }

        try {
          await saveDeviceOnlyValue(ONBOARDING_CACHE_SERVICE, legacyValue);
        } finally {
          await AsyncStorage.removeItem(ONBOARDING_DATA_KEY);
        }

        rawValue = legacyValue;
      } catch {
        await AsyncStorage.removeItem(ONBOARDING_DATA_KEY);
        return null;
      }
    }

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
  await saveDeviceOnlyValue(ONBOARDING_CACHE_SERVICE, JSON.stringify(data));
  await AsyncStorage.removeItem(ONBOARDING_DATA_KEY);
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

const getHapticsEnabled = async () => {
  return (await AsyncStorage.getItem(HAPTICS_ENABLED_KEY)) !== "false";
};

const saveHapticsEnabled = async (enabled: boolean) => {
  await AsyncStorage.setItem(
    HAPTICS_ENABLED_KEY,
    enabled ? "true" : "false"
  );
};

/**
 * The mood API only reports the current streak, so "it just reset" can only be
 * inferred by comparing against the last value we saw. Returns null when we have
 * never stored one — a fresh install cannot know, and the nudge stays quiet.
 */
const getLastKnownStreak = async (): Promise<number | null> => {
  const rawValue = await AsyncStorage.getItem(LAST_KNOWN_STREAK_KEY);

  if (rawValue === null) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const saveLastKnownStreak = async (streak: number) => {
  await AsyncStorage.setItem(LAST_KNOWN_STREAK_KEY, String(streak));
};

/** Local date key of the last daily reflection the user actually opened. */
const getReflectionSeenDateKey = async (): Promise<string | null> => {
  return AsyncStorage.getItem(REFLECTION_SEEN_DATE_KEY);
};

const saveReflectionSeenDateKey = async (dateKey: string) => {
  await AsyncStorage.setItem(REFLECTION_SEEN_DATE_KEY, dateKey);
};

const clearOnboardingCompleted = async () => {
  await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
};

const clearStoredOnboardingData = async () => {
  await Promise.all([
    clearDeviceOnlyValue(ONBOARDING_CACHE_SERVICE),
    AsyncStorage.removeItem(ONBOARDING_DATA_KEY),
  ]);
};

const clearPostAuthPaywallSeen = async () => {
  await AsyncStorage.removeItem(POST_AUTH_PAYWALL_SEEN_KEY);
};

/**
 * Where an interrupted onboarding left off. Written as the user moves through
 * the journey and read once, on the boot that routes back to onboarding.
 */
const getOnboardingResumePoint =
  async (): Promise<OnboardingResumePoint | null> => {
    const rawValue = await getDeviceOnlyValue(ONBOARDING_RESUME_SERVICE);

    if (!rawValue) {
      return null;
    }

    try {
      const parsedValue = JSON.parse(rawValue);
      return isOnboardingResumePoint(parsedValue) ? parsedValue : null;
    } catch {
      return null;
    }
  };

const saveOnboardingResumePoint = async (point: OnboardingResumePoint) => {
  await saveDeviceOnlyValue(ONBOARDING_RESUME_SERVICE, JSON.stringify(point));
};

const clearOnboardingResumePoint = async () => {
  await clearDeviceOnlyValue(ONBOARDING_RESUME_SERVICE);
};

export {
  clearOnboardingCompleted,
  clearOnboardingResumePoint,
  clearPostAuthPaywallSeen,
  clearStoredOnboardingData,
  getHapticsEnabled,
  getHideJournalPreviews,
  getLastKnownStreak,
  getReflectionSeenDateKey,
  getOnboardingCompleted,
  getOnboardingResumePoint,
  getPostAuthPaywallSeen,
  getStoredOnboardingData,
  hasSeenInstall,
  markInstallSeen,
  saveHapticsEnabled,
  saveHideJournalPreviews,
  saveOnboardingCompleted,
  saveOnboardingResumePoint,
  saveLastKnownStreak,
  savePostAuthPaywallSeen,
  saveReflectionSeenDateKey,
  saveStoredOnboardingData,
};
