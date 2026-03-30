import { Platform } from "react-native";

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

const KEYCHAIN_SERVICE = "journal.io.auth";
let inMemoryTokens: AuthTokens | null = null;

const getKeychain = (): any => {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    return require("react-native-keychain");
  } catch {
    return null;
  }
};

const parseTokens = (value: string | null): AuthTokens | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<AuthTokens>;

    if (
      typeof parsed.accessToken === "string" &&
      parsed.accessToken.length > 0 &&
      typeof parsed.refreshToken === "string" &&
      parsed.refreshToken.length > 0
    ) {
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
      };
    }
  } catch {
    return null;
  }

  return null;
};

const saveTokens = async (tokens: AuthTokens): Promise<void> => {
  inMemoryTokens = tokens;

  const keychain = getKeychain();

  if (!keychain?.setGenericPassword) {
    return;
  }

  try {
    await keychain.setGenericPassword("token", JSON.stringify(tokens), {
      service: KEYCHAIN_SERVICE,
    });
  } catch {
    // Keep the in-memory fallback so the auth flow can continue in non-native runtimes.
  }
};

const getTokens = async (): Promise<AuthTokens | null> => {
  const keychain = getKeychain();

  if (keychain?.getGenericPassword) {
    try {
      const credentials = await keychain.getGenericPassword({
        service: KEYCHAIN_SERVICE,
      });

      if (credentials) {
        const storedTokens = parseTokens(credentials.password);

        if (storedTokens) {
          inMemoryTokens = storedTokens;
          return storedTokens;
        }
      }
    } catch {
      // Fall through to the in-memory cache if the native store is unavailable.
    }
  }

  return inMemoryTokens;
};

const getAccessToken = async (): Promise<string | null> => {
  const tokens = await getTokens();
  return tokens?.accessToken || null;
};

const clearTokens = async (): Promise<void> => {
  inMemoryTokens = null;

  const keychain = getKeychain();

  if (!keychain?.resetGenericPassword) {
    return;
  }

  try {
    await keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  } catch {
    // Ignore cleanup failures in runtimes without native keychain support.
  }
};

export { clearTokens, getAccessToken, getTokens, saveTokens };
export type { AuthTokens };
