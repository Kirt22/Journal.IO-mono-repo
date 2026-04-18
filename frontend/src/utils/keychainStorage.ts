import * as Keychain from "react-native-keychain";

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

const KEYCHAIN_SERVICE = "journalio.auth.tokens";
const KEYCHAIN_USERNAME = "token";

const getKeychainOptions = () => ({
  service: KEYCHAIN_SERVICE,
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

export { clearTokens, getAccessToken, getTokens, saveTokens };
export type { AuthTokens };
