import * as Keychain from "react-native-keychain";

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

const KEYCHAIN_SERVICE = "journalio.auth.tokens";
const KEYCHAIN_USERNAME = "token";
const DEVICE_ONLY_KEYCHAIN_USERNAME = "secure";
const AUTH_USER_CACHE_SERVICE = "journalio.auth.user.secure";
const ONBOARDING_CACHE_SERVICE = "journalio.onboardingData.secure";
// Holds a part-finished onboarding draft, so it is as personal as the
// completed answers next to it and gets the same device-only treatment.
const ONBOARDING_RESUME_SERVICE = "journalio.onboardingResume.secure";

const getKeychainOptions = () => ({
  service: KEYCHAIN_SERVICE,
});

const getDeviceOnlyOptions = (service: string) => ({
  accessible:
    Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY ||
    Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  service,
});

const saveTokens = async (tokens: AuthTokens) => {
  await Keychain.setGenericPassword(
    KEYCHAIN_USERNAME,
    JSON.stringify(tokens),
    getKeychainOptions()
  );
};

const getTokens = async (): Promise<AuthTokens | null> => {
  const credentials = await Keychain.getGenericPassword(getKeychainOptions());

  if (!credentials) {
    return null;
  }

  try {
    const parsed = JSON.parse(credentials.password) as Partial<AuthTokens>;

    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string"
    ) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
    };
  } catch {
    return null;
  }
};

const getAccessToken = async () => {
  const tokens = await getTokens();
  return tokens?.accessToken || null;
};

const clearTokens = async () => {
  await Keychain.resetGenericPassword(getKeychainOptions());
};

const saveDeviceOnlyValue = async (service: string, value: string) => {
  await Keychain.setGenericPassword(
    DEVICE_ONLY_KEYCHAIN_USERNAME,
    value,
    getDeviceOnlyOptions(service)
  );
};

const getDeviceOnlyValue = async (service: string): Promise<string | null> => {
  const credentials = await Keychain.getGenericPassword(
    getDeviceOnlyOptions(service)
  );

  if (!credentials) {
    return null;
  }

  return credentials.password;
};

const clearDeviceOnlyValue = async (service: string) => {
  await Keychain.resetGenericPassword(getDeviceOnlyOptions(service));
};

export {
  AUTH_USER_CACHE_SERVICE,
  ONBOARDING_CACHE_SERVICE,
  ONBOARDING_RESUME_SERVICE,
  clearDeviceOnlyValue,
  clearTokens,
  getAccessToken,
  getDeviceOnlyValue,
  getTokens,
  saveDeviceOnlyValue,
  saveTokens,
};
export type { AuthTokens };
