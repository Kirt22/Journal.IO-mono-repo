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
    throw new Error("Google sign-in is not available right now.");
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
      // The shape of a successful-but-tokenless response is the only clue to why
      // it happened, and the caller collapses this into generic copy. Log the keys
      // only — never the response itself, which carries the user's profile.
      console.warn(
        "[GoogleSignIn] signIn() returned no idToken. Result keys:",
        result && typeof result === "object" ? Object.keys(result) : typeof result
      );
      throw new Error("Google sign-in could not be completed right now. Please try again.");
    }

    return idToken;
  } catch (error) {
    const errorCode = getGoogleErrorCode(error);

    if (errorCode === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }

    // Everything below is rendered to the user as one generic sentence, so this is
    // the only place the native failure is still visible. DEVELOPER_ERROR here
    // means a client ID / URL scheme mismatch rather than anything the user did.
    console.warn("[GoogleSignIn] signIn() failed", {
      code: errorCode,
      message: error instanceof Error ? error.message : String(error),
      userInfo: (error as { userInfo?: unknown } | null)?.userInfo,
    });

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

// The native GIDSignIn session lives in the iOS keychain and outlives the app's own
// sign-out. Left in place, the next "Continue with Google" silently reuses the last
// account instead of showing the chooser — which reads as "it signed me into the
// wrong account" or "it won't let me switch".
const signOutFromGoogle = async () => {
  try {
    configureGoogleSignIn();
    await GoogleSignin.signOut();
  } catch (error) {
    // Clearing the Google session is best-effort; it must never block our own sign-out.
    console.warn("[GoogleSignIn] signOut() failed", error);
  }
};

export { getGoogleIdToken, signOutFromGoogle };
