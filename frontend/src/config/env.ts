import {
  API_BASE_URL,
  FRONTEND_ENV,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  REVENUECAT_ANDROID_API_KEY,
  REVENUECAT_IOS_API_KEY,
  IOS_APP_STORE_ID,
  ANDROID_PLAY_STORE_PACKAGE_NAME,
  ALLOW_NON_PREMIUM_AI,
} from "@env";

const normalizeEnvValue = (value?: string | null) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const withoutQuotes = trimmed.replace(/^["']|["']$/g, "").trim();
  return withoutQuotes || null;
};

const env = {
  apiBaseUrl: normalizeEnvValue(API_BASE_URL),
  frontendEnv: normalizeEnvValue(FRONTEND_ENV),
  isDevFrontendEnv: normalizeEnvValue(FRONTEND_ENV)?.toLowerCase() === "dev",
  isSimulatorFrontendEnv:
    normalizeEnvValue(FRONTEND_ENV)?.toLowerCase() === "simulator",
  googleWebClientId: normalizeEnvValue(GOOGLE_WEB_CLIENT_ID),
  googleIosClientId: normalizeEnvValue(GOOGLE_IOS_CLIENT_ID),
  revenueCatIosApiKey: normalizeEnvValue(REVENUECAT_IOS_API_KEY),
  revenueCatAndroidApiKey: normalizeEnvValue(REVENUECAT_ANDROID_API_KEY),
  iosAppStoreId: normalizeEnvValue(IOS_APP_STORE_ID),
  androidPlayStorePackageName: normalizeEnvValue(
    ANDROID_PLAY_STORE_PACKAGE_NAME
  ),
  // Dev/testing only: treat the user as premium + AI-enabled so the premium
  // Mind Map (and other AI surfaces) can be exercised without a subscription.
  // Pair with the backend AI_ALLOW_NON_PREMIUM env. Never enable in production.
  allowNonPremiumAi:
    normalizeEnvValue(ALLOW_NON_PREMIUM_AI)?.toLowerCase() === "true",
} as const;

export { env };
