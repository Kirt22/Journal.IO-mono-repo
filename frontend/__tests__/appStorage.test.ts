describe("appStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("persists install and onboarding flags in AsyncStorage only", async () => {
    const storageState = new Map<string, string>();
    const asyncStorage = {
      setItem: jest.fn(async (key: string, value: string) => {
        storageState.set(key, value);
      }),
      getItem: jest.fn(async (key: string) => {
        return storageState.get(key) || null;
      }),
      removeItem: jest.fn(async (key: string) => {
        storageState.delete(key);
      }),
    };
    const keychain = {
      getGenericPassword: jest.fn(async () => false),
      setGenericPassword: jest.fn(async () => true),
      resetGenericPassword: jest.fn(async () => true),
    };

    jest.doMock("react-native-keychain", () => keychain);
    jest.doMock("@react-native-async-storage/async-storage", () => ({
      __esModule: true,
      default: asyncStorage,
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

    expect(asyncStorage.setItem).toHaveBeenCalled();
    expect(asyncStorage.getItem).toHaveBeenCalled();
    expect(asyncStorage.removeItem).toHaveBeenCalled();
    expect(keychain.setGenericPassword).not.toHaveBeenCalled();
    expect(keychain.getGenericPassword).not.toHaveBeenCalled();
    expect(keychain.resetGenericPassword).not.toHaveBeenCalled();
  });
});
