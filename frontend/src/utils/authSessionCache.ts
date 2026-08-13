import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "../services/authService";
import {
  AUTH_USER_CACHE_SERVICE,
  clearDeviceOnlyValue,
  getDeviceOnlyValue,
  saveDeviceOnlyValue,
} from "./keychainStorage";

const AUTH_USER_CACHE_KEY = "journalio.auth.user";

const isNullableString = (value: unknown) =>
  value === null || typeof value === "string";

const isOptionalNullableString = (value: unknown) =>
  value === undefined || isNullableString(value);

const isOptionalNullableNumber = (value: unknown) =>
  value === undefined || value === null || typeof value === "number";

const isOptionalBoolean = (value: unknown) =>
  value === undefined || typeof value === "boolean";

const isCachedAuthUser = (value: unknown): value is AuthUser => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.userId === "string" &&
    typeof candidate.name === "string" &&
    isNullableString(candidate.phoneNumber) &&
    isNullableString(candidate.email) &&
    isOptionalNullableString(candidate.createdAt) &&
    Array.isArray(candidate.journalingGoals) &&
    candidate.journalingGoals.every(goal => typeof goal === "string") &&
    isNullableString(candidate.avatarColor) &&
    typeof candidate.profileSetupCompleted === "boolean" &&
    isOptionalBoolean(candidate.onboardingCompleted) &&
    isOptionalNullableNumber(candidate.onboardingVersion) &&
    isOptionalNullableString(candidate.onboardingCompletedAt) &&
    isOptionalBoolean(candidate.hasJournalEntries) &&
    (candidate.journalCount === undefined ||
      typeof candidate.journalCount === "number") &&
    isNullableString(candidate.profilePic)
  );
};

const getCachedAuthUser = async (): Promise<AuthUser | null> => {
  let rawValue = await getDeviceOnlyValue(AUTH_USER_CACHE_SERVICE);

  if (!rawValue) {
    const legacyValue = await AsyncStorage.getItem(AUTH_USER_CACHE_KEY);

    if (!legacyValue) {
      return null;
    }

    try {
      const parsedLegacyValue = JSON.parse(legacyValue);

      if (!isCachedAuthUser(parsedLegacyValue)) {
        await AsyncStorage.removeItem(AUTH_USER_CACHE_KEY);
        return null;
      }

      try {
        await saveDeviceOnlyValue(AUTH_USER_CACHE_SERVICE, legacyValue);
      } finally {
        await AsyncStorage.removeItem(AUTH_USER_CACHE_KEY);
      }

      rawValue = legacyValue;
    } catch {
      await AsyncStorage.removeItem(AUTH_USER_CACHE_KEY);
      return null;
    }
  }

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return isCachedAuthUser(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
};

const saveCachedAuthUser = async (user: AuthUser) => {
  await saveDeviceOnlyValue(AUTH_USER_CACHE_SERVICE, JSON.stringify(user));
  await AsyncStorage.removeItem(AUTH_USER_CACHE_KEY);
};

const clearCachedAuthUser = async () => {
  await Promise.all([
    clearDeviceOnlyValue(AUTH_USER_CACHE_SERVICE),
    AsyncStorage.removeItem(AUTH_USER_CACHE_KEY),
  ]);
};

export { clearCachedAuthUser, getCachedAuthUser, saveCachedAuthUser };
