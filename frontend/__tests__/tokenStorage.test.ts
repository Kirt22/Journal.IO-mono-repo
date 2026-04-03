describe("tokenStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("persists tokens to keychain and survives a reload", async () => {
    const keychainState = new Map<string, string>();
    const asyncStorage = {
      setItem: jest.fn(async () => undefined),
      getItem: jest.fn(async () => null),
      removeItem: jest.fn(async () => undefined),
    };

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
      default: asyncStorage,
    }));

    const { clearTokens, getTokens, saveTokens } = require("../src/utils/tokenStorage");
    const tokens = {
      accessToken: "header.payload.signature",
      refreshToken: "refresh-token",
    };

    await saveTokens(tokens);
    await expect(getTokens()).resolves.toEqual(tokens);
    expect(asyncStorage.setItem).not.toHaveBeenCalled();

    jest.resetModules();
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
      default: asyncStorage,
    }));

    const reloadedStorage = require("../src/utils/tokenStorage");
    await expect(reloadedStorage.getTokens()).resolves.toEqual(tokens);

    await clearTokens();
    await expect(reloadedStorage.getTokens()).resolves.toBeNull();
  });

  it("returns the access token from keychain data", async () => {
    const asyncStorage = {
      setItem: jest.fn(async () => undefined),
      getItem: jest.fn(async () => null),
      removeItem: jest.fn(async () => undefined),
    };

    jest.doMock("react-native-keychain", () => ({
      getGenericPassword: jest.fn(async () => ({
        username: "token",
        password: JSON.stringify({
          accessToken: "header.payload.signature",
          refreshToken: "refresh-token",
        }),
      })),
      setGenericPassword: jest.fn(async () => true),
      resetGenericPassword: jest.fn(async () => true),
    }));
    jest.doMock("@react-native-async-storage/async-storage", () => ({
      __esModule: true,
      default: asyncStorage,
    }));

    const { getAccessToken } = require("../src/utils/tokenStorage");

    await expect(getAccessToken()).resolves.toBe("header.payload.signature");
    expect(asyncStorage.getItem).not.toHaveBeenCalled();
  });
});
