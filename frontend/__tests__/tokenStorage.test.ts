describe("tokenStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("persists tokens to keychain and survives a reload", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "ios" },
    }));

    const keychainState = new Map<string, string>();
    jest.doMock("react-native-keychain", () => ({
      setGenericPassword: jest.fn(
        async (_username: string, password: string, options?: { service?: string }) => {
          keychainState.set(options?.service || "default", password);
          return true;
        }
      ),
      getGenericPassword: jest.fn(async (options?: { service?: string }) => {
        const password = keychainState.get(options?.service || "default");

        if (!password) {
          return false;
        }

        return {
          username: "token",
          password,
        };
      }),
      resetGenericPassword: jest.fn(
        async (options?: { service?: string }) => {
          keychainState.delete(options?.service || "default");
          return true;
        }
      ),
    }));
    jest.doMock("@react-native-async-storage/async-storage", () => ({
      __esModule: true,
      default: {
        setItem: jest.fn(async () => undefined),
        getItem: jest.fn(async () => null),
        removeItem: jest.fn(async () => undefined),
      },
    }));

    const { getTokens, saveTokens } = require("../src/utils/tokenStorage");
    const tokens = {
      accessToken: "header.payload.signature",
      refreshToken: "refresh-token",
    };

    await saveTokens(tokens);
    await expect(getTokens()).resolves.toEqual(tokens);

    jest.resetModules();
    jest.doMock("react-native", () => ({
      Platform: { OS: "ios" },
    }));
    jest.doMock("react-native-keychain", () => ({
      setGenericPassword: jest.fn(
        async (_username: string, password: string, options?: { service?: string }) => {
          keychainState.set(options?.service || "default", password);
          return true;
        }
      ),
      getGenericPassword: jest.fn(async (options?: { service?: string }) => {
        const password = keychainState.get(options?.service || "default");

        if (!password) {
          return false;
        }

        return {
          username: "token",
          password,
        };
      }),
      resetGenericPassword: jest.fn(
        async (options?: { service?: string }) => {
          keychainState.delete(options?.service || "default");
          return true;
        }
      ),
    }));
    jest.doMock("@react-native-async-storage/async-storage", () => ({
      __esModule: true,
      default: {
        setItem: jest.fn(async () => undefined),
        getItem: jest.fn(async () => null),
        removeItem: jest.fn(async () => undefined),
      },
    }));

    const reloadedStorage = require("../src/utils/tokenStorage");
    await expect(reloadedStorage.getTokens()).resolves.toEqual(tokens);

    await reloadedStorage.clearTokens();
    await expect(reloadedStorage.getTokens()).resolves.toBeNull();
  });

  it("returns the access token from keychain data", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "ios" },
    }));
    jest.doMock("react-native-keychain", () => ({
      getGenericPassword: jest.fn(async () => ({
        username: "token",
        password: JSON.stringify({
          accessToken: "header.payload.signature",
          refreshToken: "refresh-token",
        }),
      })),
      setGenericPassword: jest.fn(async () => undefined),
      resetGenericPassword: jest.fn(async () => undefined),
    }));
    jest.doMock("@react-native-async-storage/async-storage", () => ({
      __esModule: true,
      default: {
        setItem: jest.fn(async () => undefined),
        getItem: jest.fn(async () => null),
        removeItem: jest.fn(async () => undefined),
      },
    }));

    const { getAccessToken } = require("../src/utils/tokenStorage");

    await expect(getAccessToken()).resolves.toBe("header.payload.signature");
  });

  it("persists the onboarding completion flag to app storage", async () => {
    const storageState = new Map<string, string>();

    jest.doMock("react-native", () => ({
      Platform: { OS: "ios" },
    }));
    jest.doMock("react-native-keychain", () => ({
      getGenericPassword: jest.fn(async () => false),
      setGenericPassword: jest.fn(async () => undefined),
      resetGenericPassword: jest.fn(async () => undefined),
    }));
    jest.doMock("@react-native-async-storage/async-storage", () => ({
      __esModule: true,
      default: {
        setItem: jest.fn(async (key: string, value: string) => {
          storageState.set(key, value);
        }),
        getItem: jest.fn(async (key: string) => {
          return storageState.get(key) || null;
        }),
        removeItem: jest.fn(async (key: string) => {
          storageState.delete(key);
        }),
      },
    }));

    const {
      clearOnboardingCompleted,
      getOnboardingCompleted,
      hasSeenInstall,
      markInstallSeen,
      saveOnboardingCompleted,
    } = require("../src/utils/tokenStorage");

    await expect(hasSeenInstall()).resolves.toBe(false);
    await markInstallSeen();
    await expect(hasSeenInstall()).resolves.toBe(true);

    await saveOnboardingCompleted(true);
    await expect(getOnboardingCompleted()).resolves.toBe(true);

    await clearOnboardingCompleted();
    await expect(getOnboardingCompleted()).resolves.toBe(false);
  });
});
