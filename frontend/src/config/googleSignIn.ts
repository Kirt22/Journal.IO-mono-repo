import { Platform } from "react-native";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { env } from "./env";

let isGoogleSignInConfigured = false;

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
    throw new Error("Google sign-in is not configured for this build.");
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

    return idToken;
  } catch (error) {
    const errorCode = getGoogleErrorCode(error);

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
