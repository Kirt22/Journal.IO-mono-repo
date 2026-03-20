describe("tokenStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("falls back to in-memory tokens when keychain writes fail", async () => {
    const keychain = require("react-native-keychain");
    keychain.setGenericPassword.mockRejectedValueOnce(
      new Error("native unavailable")
    );

    const { clearTokens, getTokens, saveTokens } = require(
      "../src/utils/tokenStorage"
    );
    const tokens = {
      accessToken: "access-token",
      refreshToken: "refresh-token",
    };

    await saveTokens(tokens);
    await expect(getTokens()).resolves.toEqual(tokens);

    await clearTokens();
    await expect(getTokens()).resolves.toBeNull();
  });

  it("returns null when the token read path cannot reach keychain", async () => {
    const keychain = require("react-native-keychain");
    keychain.getGenericPassword.mockRejectedValueOnce(
      new Error("native unavailable")
    );

    const { getAccessToken } = require("../src/utils/tokenStorage");

    await expect(getAccessToken()).resolves.toBeNull();
  });
});
