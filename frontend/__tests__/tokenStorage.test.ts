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
    const keychain = require("react-native-keychain");

    keychain.setGenericPassword.mockImplementation(
      async (_username: string, password: string, options?: { service?: string }) => {
        keychainState.set(options?.service || "default", password);
        return true;
      }
    );
    keychain.getGenericPassword.mockImplementation(
      async (options?: { service?: string }) => {
        const password = keychainState.get(options?.service || "default");

        if (!password) {
          return false;
        }

        return {
          username: "token",
          password,
        };
      }
    );
    keychain.resetGenericPassword.mockImplementation(
      async (options?: { service?: string }) => {
        keychainState.delete(options?.service || "default");
        return true;
      }
    );

    const { clearTokens, getTokens, saveTokens } = require(
      "../src/utils/tokenStorage"
    );
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
    const reloadedKeychain = require("react-native-keychain");
    reloadedKeychain.setGenericPassword.mockImplementation(
      async (_username: string, password: string, options?: { service?: string }) => {
        keychainState.set(options?.service || "default", password);
        return true;
      }
    );
    reloadedKeychain.getGenericPassword.mockImplementation(
      async (options?: { service?: string }) => {
        const password = keychainState.get(options?.service || "default");

        if (!password) {
          return false;
        }

        return {
          username: "token",
          password,
        };
      }
    );
    reloadedKeychain.resetGenericPassword.mockImplementation(
      async (options?: { service?: string }) => {
        keychainState.delete(options?.service || "default");
        return true;
      }
    );

    const reloadedStorage = require("../src/utils/tokenStorage");
    await expect(reloadedStorage.getTokens()).resolves.toEqual(tokens);

    await reloadedStorage.clearTokens();
    await expect(reloadedStorage.getTokens()).resolves.toBeNull();
  });

  it("returns the access token from keychain data", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "ios" },
    }));

    const keychain = require("react-native-keychain");
    keychain.getGenericPassword.mockResolvedValueOnce({
      username: "token",
      password: JSON.stringify({
        accessToken: "header.payload.signature",
        refreshToken: "refresh-token",
      }),
    });

    const { getAccessToken } = require("../src/utils/tokenStorage");

    await expect(getAccessToken()).resolves.toBe("header.payload.signature");
  });
});
