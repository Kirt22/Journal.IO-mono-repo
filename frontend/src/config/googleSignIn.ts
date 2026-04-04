import { Platform } from "react-native";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { env } from "./env";

let isGoogleSignInConfigured = false;

const decodeJwtPayload = (token: string) => {
  const parts = token.split(".");

  if (parts.length < 2) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4 || 4)) % 4),
      "="
    );
    const decoded =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");

    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const extractGoogleIdToken = (result: unknown): string | null => {
  if (!result || typeof result !== "object") {
    return null;
  }

  if ("idToken" in result && typeof result.idToken === "string") {
    return result.idToken;
  }

  if (
    "data" in result &&
    result.data &&
    typeof result.data === "object" &&
    "idToken" in result.data &&
    typeof result.data.idToken === "string"
  ) {
    return result.data.idToken;
  }

  return null;
};

const isCancelledResponse = (result: unknown) => {
  if (!result || typeof result !== "object") {
    return false;
  }

  const resultRecord = result as { type?: unknown };

  return (
    "type" in resultRecord &&
    resultRecord.type === "cancelled"
  );
};

const getGoogleErrorCode = (error: unknown) => {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }

  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : null;
};

const configureGoogleSignIn = () => {
  if (isGoogleSignInConfigured) {
    return;
  }

  if (!env.googleWebClientId) {
    if (__DEV__) {
      console.log("[googleSignIn] missing Google web client ID", {
        platform: Platform.OS,
        hasIosClientId: Boolean(env.googleIosClientId),
      });
    }
    throw new Error("Google sign-in is not configured for this build.");
  }

  if (__DEV__) {
    console.log("[googleSignIn] configure", {
      platform: Platform.OS,
      webClientId: env.googleWebClientId,
      iosClientId: env.googleIosClientId,
    });
  }

  GoogleSignin.configure({
    webClientId: env.googleWebClientId,
    iosClientId:
      Platform.OS === "ios" ? env.googleIosClientId || undefined : undefined,
    scopes: ["email", "profile"],
  });

  isGoogleSignInConfigured = true;
};

const getGoogleIdToken = async () => {
  configureGoogleSignIn();

  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });
  }

  try {
    const result = await GoogleSignin.signIn();

    if (isCancelledResponse(result)) {
      return null;
    }

    const idToken = extractGoogleIdToken(result);

    if (!idToken) {
      throw new Error(
        "Google sign-in did not return an ID token. Check the OAuth client configuration."
      );
    }

    if (__DEV__) {
      const payload = decodeJwtPayload(idToken);

      console.log("[googleSignIn] decoded idToken payload", {
        aud: payload?.aud,
        azp: payload?.azp,
        iss: payload?.iss,
      });
    }

    return idToken;
  } catch (error) {
    const errorCode = getGoogleErrorCode(error);

    if (__DEV__) {
      console.log("[googleSignIn] signIn error", {
        code: errorCode,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if (errorCode === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }

    if (errorCode === statusCodes.IN_PROGRESS) {
      throw new Error("Google sign-in is already in progress.");
    }

    if (errorCode === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error(
        "Google Play Services are unavailable or out of date on this device."
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Unable to sign in with Google right now.");
  }
};

export { getGoogleIdToken };
