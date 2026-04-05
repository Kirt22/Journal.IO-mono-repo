import {
  API_BASE_URL,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from "@env";

const normalizeEnvValue = (value?: string | null) => {

  console.log("[env] raw value", { value });
  console.log("[env] raw value", API_BASE_URL, GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID);
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const withoutQuotes = trimmed.replace(/^["']|["']$/g, "").trim();
  return withoutQuotes || null;
};

const env = {
  apiBaseUrl: normalizeEnvValue(API_BASE_URL),
  googleWebClientId: normalizeEnvValue(GOOGLE_WEB_CLIENT_ID),
  googleIosClientId: normalizeEnvValue(GOOGLE_IOS_CLIENT_ID),
} as const;

export { env };
