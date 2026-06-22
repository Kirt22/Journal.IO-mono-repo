import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "../services/authService";

const AUTH_USER_CACHE_KEY = "journalio.auth.user";

const isNullableString = (value: unknown) =>
  value === null || typeof value === "string";

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
    Array.isArray(candidate.journalingGoals) &&
    candidate.journalingGoals.every(goal => typeof goal === "string") &&
    isNullableString(candidate.avatarColor) &&
    typeof candidate.profileSetupCompleted === "boolean" &&
    typeof candidate.onboardingCompleted === "boolean" &&
    isNullableString(candidate.profilePic) &&
    (candidate.aiOptIn === null || typeof candidate.aiOptIn === "boolean")
  );
};

const getCachedAuthUser = async (): Promise<AuthUser | null> => {
  const rawValue = await AsyncStorage.getItem(AUTH_USER_CACHE_KEY);

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
  await AsyncStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(user));
};

const clearCachedAuthUser = async () => {
  await AsyncStorage.removeItem(AUTH_USER_CACHE_KEY);
};

export { clearCachedAuthUser, getCachedAuthUser, saveCachedAuthUser };
