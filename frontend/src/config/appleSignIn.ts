import appleAuth from "@invertase/react-native-apple-authentication";
import { Platform } from "react-native";

type AppleFullName = {
  givenName?: string | null;
  familyName?: string | null;
  nickname?: string | null;
};

type AppleSignInCredential = {
  identityToken: string;
  nonce: string;
  email?: string | null;
  fullName?: AppleFullName | null;
};

const NONCE_LENGTH = 32;
const NONCE_CHARSET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._";
const APPLE_AUTHORIZATION_ERROR_CODES = new Set([
  "1000",
  "1001",
  "1002",
  "1003",
  "1004",
  "1005",
]);

const getRandomBytes = (length: number) => {
  const bytes = new Uint8Array(length);
  const cryptoProvider = (
    globalThis as unknown as {
      crypto?: {
        getRandomValues?: (array: Uint8Array) => Uint8Array;
      };
    }
  ).crypto;

  if (cryptoProvider?.getRandomValues) {
    cryptoProvider.getRandomValues(bytes);
    return bytes;
  }

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return bytes;
};

const generateNonce = () =>
  Array.from(getRandomBytes(NONCE_LENGTH), byte => {
    return NONCE_CHARSET[byte % NONCE_CHARSET.length] || "0";
  }).join("");

const getErrorCode = (error: unknown) => {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" || typeof code === "number" ? String(code) : null;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (!error || typeof error !== "object" || !("message" in error)) {
    return "";
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
};

const isAppleAuthInterruption = (error: unknown) => {
  const code = getErrorCode(error);

  if (
    code === String(appleAuth.Error.CANCELED) ||
    (code ? APPLE_AUTHORIZATION_ERROR_CODES.has(code) : false)
  ) {
    return true;
  }

  return getErrorMessage(error).includes(
    "com.apple.AuthenticationServices.AuthorizationError"
  );
};

const getAppleSignInCredential = async (): Promise<AppleSignInCredential | null> => {
  if (Platform.OS !== "ios" || !appleAuth.isSupported) {
    throw new Error("Apple sign-in is only available on supported iOS devices.");
  }

  const nonce = generateNonce();

  try {
    const credential = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      nonce,
    });

    if (!credential.identityToken) {
      throw new Error("Apple sign-in could not be completed right now.");
    }

    return {
      identityToken: credential.identityToken,
      nonce,
      email: credential.email || null,
      fullName: credential.fullName
        ? {
            givenName: credential.fullName.givenName || null,
            familyName: credential.fullName.familyName || null,
            nickname: credential.fullName.nickname || null,
          }
        : null,
    };
  } catch (error) {
    if (isAppleAuthInterruption(error)) {
      return null;
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Unable to continue with Apple right now.");
  }
};

export { getAppleSignInCredential };
export type { AppleFullName, AppleSignInCredential };
