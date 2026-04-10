import { act } from "react-test-renderer";
import { resetAppStore, useAppStore } from "../src/store/appStore";
import { syncOnboardingReminderPreference } from "../src/services/reminderNotificationsService";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock("../src/services/reminderNotificationsService", () => ({
  syncOnboardingReminderPreference: jest.fn(async () => undefined),
}));

const onboardingData = {
  ageRange: "25-34",
  journalingExperience: "Occasional journaler",
  goals: ["Daily Reflection", "Personal Growth"],
  supportFocusAreas: ["Stress", "Sleep"],
  reminderPreference: "Evening",
  aiComfort: true,
  privacyConsent: true,
};

describe("appStore", () => {
  beforeEach(() => {
    resetAppStore();
    jest.useFakeTimers();
    (syncOnboardingReminderPreference as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    resetAppStore();
  });

  it("preserves onboarding data and advances into auth after the handoff delay", async () => {
    const store = useAppStore;

    await act(async () => {
      const transition = store.getState().completeOnboarding(onboardingData);

      expect(store.getState().isCompletingOnboarding).toBe(true);
      expect(store.getState().onboardingData).toEqual(onboardingData);
      expect(store.getState().stage).toBe("onboarding");

      jest.advanceTimersByTime(220);
      await transition;
    });

    expect(store.getState().isCompletingOnboarding).toBe(false);
    expect(store.getState().stage).toBe("auth");
    expect(syncOnboardingReminderPreference).toHaveBeenCalledWith("Evening");
  });

  it("continues from paywall into auth", () => {
    const store = useAppStore;

    act(() => {
      useAppStore.setState({ stage: "paywall" });
      store.getState().continueFromPaywall();
    });

    expect(store.getState().stage).toBe("auth");
  });

  it("returns to the stored stage when paywall is opened from inside the app", () => {
    const store = useAppStore;

    act(() => {
      useAppStore.setState({
        stage: "main-app",
        session: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          user: {
            userId: "user-123",
            name: "Alex",
            phoneNumber: null,
            email: "alex@example.com",
            isPremium: false,
            journalingGoals: [],
            avatarColor: "#8E4636",
            profileSetupCompleted: true,
            onboardingCompleted: true,
            profilePic: null,
            aiOptIn: true,
          },
        },
      });
      store.getState().openPaywall("main-app");
    });

    expect(store.getState().stage).toBe("paywall");
    expect(store.getState().paywallReturnStage).toBe("main-app");

    act(() => {
      store.getState().continueFromPaywall();
    });

    expect(store.getState().stage).toBe("main-app");
    expect(store.getState().paywallReturnStage).toBeNull();
  });

  it("stores placement context when opening a paywall for a specific surface", () => {
    const store = useAppStore;

    act(() => {
      useAppStore.setState({ stage: "main-app" });
      store.getState().openPaywallForPlacement({
        placementKey: "home_ai_card_locked",
        returnStage: "main-app",
        screenKey: "home",
      });
    });

    expect(store.getState().stage).toBe("paywall");
    expect(store.getState().activePaywallPlacementKey).toBe("home_ai_card_locked");
    expect(store.getState().activePaywallScreenKey).toBe("home");

    act(() => {
      store.getState().continueFromPaywall();
    });

    expect(store.getState().activePaywallPlacementKey).toBeNull();
    expect(store.getState().activePaywallScreenKey).toBeNull();
  });

  it("saves auth tokens before syncing pending premium activation after sign-in", async () => {
    jest.resetModules();

    const callOrder: string[] = [];

    jest.doMock("../src/utils/tokenStorage", () => ({
      clearOnboardingCompleted: jest.fn(async () => undefined),
      clearPostAuthPaywallSeen: jest.fn(async () => undefined),
      clearTokens: jest.fn(async () => undefined),
      getAccessToken: jest.fn(async () => null),
      getOnboardingCompleted: jest.fn(async () => true),
      getPostAuthPaywallSeen: jest.fn(async () => true),
      hasSeenInstall: jest.fn(async () => true),
      getTokens: jest.fn(async () => null),
      markInstallSeen: jest.fn(async () => undefined),
      saveOnboardingCompleted: jest.fn(async () => undefined),
      savePostAuthPaywallSeen: jest.fn(async () => undefined),
      saveTokens: jest.fn(async () => {
        callOrder.push("saveTokens");
      }),
    }));

    jest.doMock("../src/services/authService", () => ({
      resendEmailVerification: jest.fn(),
      logout: jest.fn(async () => undefined),
      signInWithEmail: jest.fn(async () => ({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: {
          userId: "user-123",
          name: "Alex",
          phoneNumber: null,
          email: "alex@example.com",
          isPremium: false,
          journalingGoals: [],
          avatarColor: "#8E4636",
          profileSetupCompleted: true,
          onboardingCompleted: true,
          profilePic: null,
          aiOptIn: true,
        },
      })),
      signInWithGoogle: jest.fn(),
      signUpWithEmail: jest.fn(),
      verifyEmail: jest.fn(),
      type: {},
    }));

    jest.doMock("../src/services/userService", () => ({
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      updatePremiumStatus: jest.fn(async () => {
        callOrder.push("updatePremiumStatus");
        return {
          userId: "user-123",
          name: "Alex",
          phoneNumber: null,
          email: "alex@example.com",
          isPremium: true,
          journalingGoals: [],
          avatarColor: "#8E4636",
          profileSetupCompleted: true,
          onboardingCompleted: true,
          profilePic: null,
          aiOptIn: true,
        };
      }),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    act(() => {
      freshStore.setState({ pendingPremiumActivation: true });
    });

    await act(async () => {
      await freshStore.getState().signIn({
        email: "alex@example.com",
        password: "password-123",
      });
    });

    expect(callOrder).toEqual(["saveTokens", "updatePremiumStatus"]);
    expect(freshStore.getState().session?.user.isPremium).toBe(true);
    expect(freshStore.getState().pendingPremiumActivation).toBe(false);
  });

  it("clears local reminders when onboarding selects no reminders", async () => {
    const store = useAppStore;

    await act(async () => {
      const transition = store.getState().completeOnboarding({
        ...onboardingData,
        reminderPreference: "none",
      });

      jest.advanceTimersByTime(220);
      await transition;
    });

    expect(syncOnboardingReminderPreference).toHaveBeenCalledWith("none");
  });

  it("moves auth navigation into the shared store and resets cleanly", async () => {
    const store = useAppStore;

    await act(async () => {
      await store.getState().continueWithEmail();
    });

    expect(store.getState().authSource).toBe("email");
    expect(store.getState().stage).toBe("create-account");

    act(() => {
      store.getState().setActiveTab("profile");
      store.getState().openNewEntry();
      store.getState().setThemeModeOverride("dark");
      store.getState().restartFlow();
    });

    expect(store.getState().stage).toBe("onboarding");
    expect(store.getState().activeTab).toBe("home");
    expect(store.getState().authSource).toBeNull();
    expect(store.getState().themeModeOverride).toBeNull();
  });

  it("stores and clears a prefilled prompt when opening new entry from home", () => {
    const store = useAppStore;

    act(() => {
      store.getState().openNewEntry({
        initialPrompt: "What felt most steady or grounding in your day?",
      });
    });

    expect(store.getState().stage).toBe("new-entry");
    expect(store.getState().pendingNewEntryPrompt).toBe(
      "What felt most steady or grounding in your day?"
    );

    act(() => {
      store.getState().closeNewEntry();
    });

    expect(store.getState().pendingNewEntryPrompt).toBeNull();
  });

  it("updates ai opt-in on the active session user", () => {
    const store = useAppStore;

    useAppStore.setState({
      session: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: {
          userId: "user-123",
          name: "Alex",
          phoneNumber: null,
          email: "alex@example.com",
          journalingGoals: [],
          avatarColor: "#8E4636",
          profileSetupCompleted: true,
          onboardingCompleted: true,
          profilePic: null,
          aiOptIn: true,
        },
      },
    });

    act(() => {
      store.getState().setSessionAiOptIn(false);
    });

    expect(store.getState().session?.user.aiOptIn).toBe(false);
  });

  it("persists premium activation immediately when a signed-in user upgrades", async () => {
    jest.resetModules();

    const updatePremiumStatus = jest.fn(async () => ({
      userId: "user-123",
      name: "Alex",
      phoneNumber: null,
      email: "alex@example.com",
      isPremium: true,
      journalingGoals: [],
      avatarColor: "#8E4636",
      profileSetupCompleted: false,
      onboardingCompleted: true,
      profilePic: null,
      aiOptIn: true,
    }));

    jest.doMock("../src/services/userService", () => ({
      getProfile: jest.fn(),
      updatePremiumStatus,
      updateProfile: jest.fn(),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    act(() => {
      freshStore.setState({
        pendingPremiumActivation: true,
        session: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          user: {
            userId: "user-123",
            name: "Alex",
            phoneNumber: null,
            email: "alex@example.com",
            isPremium: false,
            journalingGoals: [],
            avatarColor: "#8E4636",
            profileSetupCompleted: false,
            onboardingCompleted: true,
            profilePic: null,
            aiOptIn: true,
          },
        },
      });
    });

    await act(async () => {
      await freshStore.getState().setSessionPremiumStatus(true);
    });

    expect(updatePremiumStatus).toHaveBeenCalledWith({ isPremium: true });
    expect(freshStore.getState().session?.user.isPremium).toBe(true);
    expect(freshStore.getState().pendingPremiumActivation).toBe(false);
  });

  it("stores the hide journal previews device preference", async () => {
    const store = useAppStore;

    await act(async () => {
      await store.getState().setHideJournalPreviews(true);
    });

    expect(store.getState().hideJournalPreviews).toBe(true);
  });

  it("boots into auth on the same install after tokens are gone", async () => {
    jest.resetModules();
    jest.doMock("../src/utils/tokenStorage", () => ({
      clearOnboardingCompleted: jest.fn(async () => undefined),
      clearPostAuthPaywallSeen: jest.fn(async () => undefined),
      clearTokens: jest.fn(async () => undefined),
      getAccessToken: jest.fn(async () => null),
      getOnboardingCompleted: jest.fn(async () => true),
      getPostAuthPaywallSeen: jest.fn(async () => true),
      hasSeenInstall: jest.fn(async () => true),
      getTokens: jest.fn(async () => null),
      markInstallSeen: jest.fn(async () => undefined),
      saveOnboardingCompleted: jest.fn(async () => undefined),
      savePostAuthPaywallSeen: jest.fn(async () => undefined),
      saveTokens: jest.fn(async () => undefined),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    await act(async () => {
      await freshStore.getState().bootstrapAuthGate();
    });

    expect(freshStore.getState().hasBootstrappedAuthGate).toBe(true);
    expect(freshStore.getState().stage).toBe("auth");
  });

  it("boots directly into home when a signed-in session is already stored", async () => {
    jest.resetModules();

    jest.doMock("../src/utils/tokenStorage", () => ({
      clearOnboardingCompleted: jest.fn(async () => undefined),
      clearPostAuthPaywallSeen: jest.fn(async () => undefined),
      clearTokens: jest.fn(async () => undefined),
      getAccessToken: jest.fn(async () => "access-token"),
      getOnboardingCompleted: jest.fn(async () => false),
      getPostAuthPaywallSeen: jest.fn(async () => true),
      hasSeenInstall: jest.fn(async () => true),
      getTokens: jest.fn(async () => ({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      })),
      markInstallSeen: jest.fn(async () => undefined),
      saveOnboardingCompleted: jest.fn(async () => undefined),
      savePostAuthPaywallSeen: jest.fn(async () => undefined),
      saveTokens: jest.fn(async () => undefined),
    }));
    jest.doMock("../src/services/userService", () => ({
      getProfile: jest.fn(async () => ({
        userId: "user-123",
        name: "Alex",
        phoneNumber: null,
        email: "alex@example.com",
        journalingGoals: [],
        avatarColor: "#8E4636",
        profileSetupCompleted: true,
        onboardingCompleted: true,
        profilePic: null,
        aiOptIn: true,
      })),
      updateProfile: jest.fn(),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    await act(async () => {
      await freshStore.getState().bootstrapAuthGate();
    });

    expect(freshStore.getState().hasBootstrappedAuthGate).toBe(true);
    expect(freshStore.getState().stage).toBe("main-app");
    expect(freshStore.getState().session?.user.email).toBe("alex@example.com");
  });

  it("marks existing installs as already having seen the post-auth paywall", async () => {
    jest.resetModules();

    const savePostAuthPaywallSeen = jest.fn(async () => undefined);

    jest.doMock("../src/utils/tokenStorage", () => ({
      clearOnboardingCompleted: jest.fn(async () => undefined),
      clearPostAuthPaywallSeen: jest.fn(async () => undefined),
      clearTokens: jest.fn(async () => undefined),
      getAccessToken: jest.fn(async () => "access-token"),
      getOnboardingCompleted: jest.fn(async () => false),
      getPostAuthPaywallSeen: jest.fn(async () => null),
      hasSeenInstall: jest.fn(async () => true),
      getTokens: jest.fn(async () => ({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      })),
      markInstallSeen: jest.fn(async () => undefined),
      saveOnboardingCompleted: jest.fn(async () => undefined),
      savePostAuthPaywallSeen,
      saveTokens: jest.fn(async () => undefined),
    }));
    jest.doMock("../src/services/userService", () => ({
      getProfile: jest.fn(async () => ({
        userId: "user-123",
        name: "Alex",
        phoneNumber: null,
        email: "alex@example.com",
        journalingGoals: [],
        avatarColor: "#8E4636",
        profileSetupCompleted: true,
        onboardingCompleted: true,
        profilePic: null,
        aiOptIn: true,
      })),
      updateProfile: jest.fn(),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    await act(async () => {
      await freshStore.getState().bootstrapAuthGate();
    });

    expect(savePostAuthPaywallSeen).toHaveBeenCalledWith(true);
    expect(freshStore.getState().stage).toBe("main-app");
  });

  it("boots into onboarding on a fresh install even if keychain still has a token", async () => {
    jest.resetModules();

    const clearTokens = jest.fn(async () => undefined);

    jest.doMock("../src/utils/tokenStorage", () => ({
      clearOnboardingCompleted: jest.fn(async () => undefined),
      clearPostAuthPaywallSeen: jest.fn(async () => undefined),
      clearTokens,
      getAccessToken: jest.fn(async () => "stale-access-token"),
      getOnboardingCompleted: jest.fn(async () => false),
      getPostAuthPaywallSeen: jest.fn(async () => null),
      hasSeenInstall: jest.fn(async () => false),
      getTokens: jest.fn(async () => ({
        accessToken: "stale-access-token",
        refreshToken: "stale-refresh-token",
      })),
      markInstallSeen: jest.fn(async () => undefined),
      saveOnboardingCompleted: jest.fn(async () => undefined),
      savePostAuthPaywallSeen: jest.fn(async () => undefined),
      saveTokens: jest.fn(async () => undefined),
    }));
    jest.doMock("../src/services/userService", () => ({
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    await act(async () => {
      await freshStore.getState().bootstrapAuthGate();
    });

    expect(clearTokens).toHaveBeenCalled();
    expect(freshStore.getState().hasBootstrappedAuthGate).toBe(true);
    expect(freshStore.getState().stage).toBe("onboarding");
  });

  it("clears invalid persisted tokens and returns to auth on the same install", async () => {
    jest.resetModules();

    const clearTokens = jest.fn(async () => undefined);

    jest.doMock("../src/utils/tokenStorage", () => ({
      clearOnboardingCompleted: jest.fn(async () => undefined),
      clearPostAuthPaywallSeen: jest.fn(async () => undefined),
      clearTokens,
      getAccessToken: jest.fn(async () => "stale-access-token"),
      getOnboardingCompleted: jest.fn(async () => true),
      getPostAuthPaywallSeen: jest.fn(async () => true),
      hasSeenInstall: jest.fn(async () => true),
      getTokens: jest.fn(async () => ({
        accessToken: "stale-access-token",
        refreshToken: "stale-refresh-token",
      })),
      markInstallSeen: jest.fn(async () => undefined),
      saveOnboardingCompleted: jest.fn(async () => undefined),
      savePostAuthPaywallSeen: jest.fn(async () => undefined),
      saveTokens: jest.fn(async () => undefined),
    }));

    const { ApiError } = require("../src/utils/apiClient");

    jest.doMock("../src/services/userService", () => ({
      getProfile: jest.fn(async () => {
        throw new ApiError("Unauthorized", { status: 401 });
      }),
      updateProfile: jest.fn(),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    await act(async () => {
      await freshStore.getState().bootstrapAuthGate();
    });

    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(freshStore.getState().session).toBeNull();
    expect(freshStore.getState().stage).toBe("auth");
    expect(freshStore.getState().hasBootstrappedAuthGate).toBe(true);
  });

  it("routes verified email users into the one-time paywall before profile setup", async () => {
    jest.resetModules();

    const savePostAuthPaywallSeen = jest.fn(async () => undefined);

    jest.doMock("../src/utils/tokenStorage", () => ({
      clearOnboardingCompleted: jest.fn(async () => undefined),
      clearPostAuthPaywallSeen: jest.fn(async () => undefined),
      clearTokens: jest.fn(async () => undefined),
      getAccessToken: jest.fn(async () => null),
      getOnboardingCompleted: jest.fn(async () => true),
      getPostAuthPaywallSeen: jest.fn(async () => false),
      hasSeenInstall: jest.fn(async () => true),
      getTokens: jest.fn(async () => null),
      markInstallSeen: jest.fn(async () => undefined),
      saveOnboardingCompleted: jest.fn(async () => undefined),
      savePostAuthPaywallSeen,
      saveTokens: jest.fn(async () => undefined),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    act(() => {
      freshStore.setState({
        session: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          user: {
            userId: "user-123",
            name: "Alex",
            phoneNumber: null,
            email: "alex@example.com",
            isPremium: false,
            journalingGoals: [],
            avatarColor: "#8E4636",
            profileSetupCompleted: false,
            onboardingCompleted: true,
            profilePic: null,
            aiOptIn: true,
          },
        },
      });
    });

    await act(async () => {
      await freshStore.getState().finishEmailVerification();
    });

    expect(savePostAuthPaywallSeen).toHaveBeenCalledWith(true);
    expect(freshStore.getState().stage).toBe("paywall");
    expect(freshStore.getState().paywallReturnStage).toBe("profile");
  });

  it("persists the onboarding flag returned by sign in", async () => {
    jest.resetModules();

    const saveOnboardingCompleted = jest.fn(async () => undefined);
    const savePostAuthPaywallSeen = jest.fn(async () => undefined);
    const saveTokens = jest.fn(async () => undefined);
    const signInWithEmail = jest.fn(async () => ({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        userId: "user-123",
        name: "Alex",
        phoneNumber: null,
        email: "alex@example.com",
        journalingGoals: [],
        avatarColor: "#8E4636",
        profileSetupCompleted: true,
        onboardingCompleted: true,
        profilePic: null,
        aiOptIn: true,
      },
    }));

    jest.doMock("../src/services/authService", () => ({
      resendEmailVerification: jest.fn(),
      logout: jest.fn(async () => undefined),
      signInWithEmail,
      signInWithGoogle: jest.fn(),
      signUpWithEmail: jest.fn(),
      verifyEmail: jest.fn(),
    }));
    jest.doMock("../src/utils/tokenStorage", () => ({
      clearOnboardingCompleted: jest.fn(async () => undefined),
      clearPostAuthPaywallSeen: jest.fn(async () => undefined),
      clearTokens: jest.fn(async () => undefined),
      getAccessToken: jest.fn(async () => null),
      getOnboardingCompleted: jest.fn(async () => true),
      getPostAuthPaywallSeen: jest.fn(async () => false),
      hasSeenInstall: jest.fn(async () => true),
      getTokens: jest.fn(async () => null),
      markInstallSeen: jest.fn(async () => undefined),
      saveOnboardingCompleted,
      savePostAuthPaywallSeen,
      saveTokens,
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    await act(async () => {
      await freshStore.getState().signIn({
        email: "alex@example.com",
        password: "password123",
      });
    });

    expect(signInWithEmail).toHaveBeenCalledWith({
      email: "alex@example.com",
      password: "password123",
      onboardingCompleted: true,
    });
    expect(saveOnboardingCompleted).toHaveBeenCalledWith(true);
    expect(savePostAuthPaywallSeen).toHaveBeenCalledWith(true);
    expect(freshStore.getState().stage).toBe("paywall");
    expect(freshStore.getState().paywallReturnStage).toBe("main-app");
  });

  it("continues with Google using the shared session persistence flow", async () => {
    jest.resetModules();

    const getGoogleIdToken = jest.fn(async () => "google-id-token");
    const saveOnboardingCompleted = jest.fn(async () => undefined);
    const savePostAuthPaywallSeen = jest.fn(async () => undefined);
    const saveTokens = jest.fn(async () => undefined);
    const signInWithGoogle = jest.fn(async () => ({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        userId: "user-123",
        name: "Alex",
        phoneNumber: null,
        email: "alex@example.com",
        journalingGoals: [],
        avatarColor: null,
        profileSetupCompleted: false,
        onboardingCompleted: true,
        profilePic: "https://example.com/avatar.png",
        aiOptIn: false,
      },
    }));

    jest.doMock("../src/config/googleSignIn", () => ({
      getGoogleIdToken,
    }));
    jest.doMock("../src/services/authService", () => ({
      resendEmailVerification: jest.fn(),
      logout: jest.fn(async () => undefined),
      signInWithEmail: jest.fn(),
      signInWithGoogle,
      signUpWithEmail: jest.fn(),
      verifyEmail: jest.fn(),
    }));
    jest.doMock("../src/utils/tokenStorage", () => ({
      clearOnboardingCompleted: jest.fn(async () => undefined),
      clearPostAuthPaywallSeen: jest.fn(async () => undefined),
      clearTokens: jest.fn(async () => undefined),
      getAccessToken: jest.fn(async () => null),
      getOnboardingCompleted: jest.fn(async () => true),
      getPostAuthPaywallSeen: jest.fn(async () => false),
      hasSeenInstall: jest.fn(async () => true),
      getTokens: jest.fn(async () => null),
      markInstallSeen: jest.fn(async () => undefined),
      saveOnboardingCompleted,
      savePostAuthPaywallSeen,
      saveTokens,
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    act(() => {
      freshStore.setState({
        onboardingData: {
          ...onboardingData,
          aiComfort: false,
        },
      });
    });

    await act(async () => {
      await freshStore.getState().continueWithGoogle();
    });

    expect(getGoogleIdToken).toHaveBeenCalledTimes(1);
    expect(signInWithGoogle).toHaveBeenCalledWith({
      idToken: "google-id-token",
      onboardingContext: {
        ageRange: "25-34",
        journalingExperience: "Occasional journaler",
        goals: ["Daily Reflection", "Personal Growth"],
        supportFocus: ["Stress", "Sleep"],
        reminderPreference: "Evening",
        aiOptIn: false,
        privacyConsentAccepted: true,
      },
      onboardingCompleted: true,
    });
    expect(saveTokens).toHaveBeenCalledWith({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    expect(saveOnboardingCompleted).toHaveBeenCalledWith(true);
    expect(savePostAuthPaywallSeen).toHaveBeenCalledWith(true);
    expect(freshStore.getState().authSource).toBe("google");
    expect(freshStore.getState().stage).toBe("paywall");
    expect(freshStore.getState().paywallReturnStage).toBe("profile");
  });

  it("signs out through the backend and clears the local session state", async () => {
    jest.resetModules();

    const logout = jest.fn(async () => undefined);

    jest.doMock("../src/services/authService", () => ({
      logout,
      resendEmailVerification: jest.fn(),
      signInWithEmail: jest.fn(),
      signInWithGoogle: jest.fn(),
      signUpWithEmail: jest.fn(),
      verifyEmail: jest.fn(),
    }));
    jest.doMock("../src/utils/tokenStorage", () => ({
      clearOnboardingCompleted: jest.fn(async () => undefined),
      clearPostAuthPaywallSeen: jest.fn(async () => undefined),
      clearTokens: jest.fn(async () => undefined),
      getAccessToken: jest.fn(async () => "access-token"),
      getOnboardingCompleted: jest.fn(async () => true),
      getPostAuthPaywallSeen: jest.fn(async () => true),
      hasSeenInstall: jest.fn(async () => true),
      getTokens: jest.fn(async () => ({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      })),
      markInstallSeen: jest.fn(async () => undefined),
      saveOnboardingCompleted: jest.fn(async () => undefined),
      savePostAuthPaywallSeen: jest.fn(async () => undefined),
      saveTokens: jest.fn(async () => undefined),
    }));
    jest.doMock("../src/services/userService", () => ({
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    await act(async () => {
      await freshStore.getState().signOut();
    });

    expect(logout).toHaveBeenCalledTimes(1);
    expect(freshStore.getState().session).toBeNull();
    expect(freshStore.getState().stage).toBe("auth");
    expect(freshStore.getState().activeTab).toBe("home");
  });
});
