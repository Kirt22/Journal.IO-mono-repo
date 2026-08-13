import { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Keychain from "react-native-keychain";
import { resetAppStore, useAppStore } from "../src/store/appStore";
import {
  cancelFreeTrialEndingReminder,
  getDefaultReminderTimezone,
  getReminderPermissionGranted,
  syncOnboardingReminderPreference,
  syncReminderNotifications,
  syncStoredDailyReminderNotifications,
} from "../src/services/reminderNotificationsService";
import { syncOnboardingReminderRecordPreference } from "../src/services/remindersService";
import { completeOnboarding as completeOnboardingRequest } from "../src/services/onboardingService";
import {
  getCurrentRootRouteName,
  goBackOrFallback,
  navigateRoot,
  resetRoot,
} from "../src/navigation/navigation";
import * as userService from "../src/services/userService";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock("../src/services/reminderNotificationsService", () => ({
  cancelFreeTrialEndingReminder: jest.fn(async () => undefined),
  cancelReminderNotifications: jest.fn(async () => undefined),
  getDefaultReminderTimezone: jest.fn(() => "Asia/Kolkata"),
  getReminderPermissionGranted: jest.fn(async () => true),
  syncOnboardingReminderPreference: jest.fn(async () => undefined),
  syncReminderNotifications: jest.fn(async () => undefined),
  syncStoredDailyReminderNotifications: jest.fn(async () => null),
}));

jest.mock("../src/services/remindersService", () => ({
  syncOnboardingReminderRecordPreference: jest.fn(async () => ({
    reminderId: "reminder-1",
    type: "daily_journal",
    enabled: true,
    time: "20:00",
    timezone: "Asia/Kolkata",
    skipIfCompletedToday: true,
    includeWeekends: true,
    streakWarnings: true,
    createdAt: "2026-04-03T10:00:00.000Z",
    updatedAt: "2026-04-03T10:00:00.000Z",
  })),
}));

jest.mock("../src/services/onboardingService", () => ({
  completeOnboarding: jest.fn(async () => ({
    userId: "user-123",
    name: "Alex",
    phoneNumber: null,
    email: "alex@example.com",
    isPremium: false,
    journalingGoals: ["Daily Reflection", "Personal Growth"],
    avatarColor: "#8E4636",
    profileSetupCompleted: false,
    onboardingCompleted: true,
    onboardingVersion: 2,
    onboardingCompletedAt: "2026-06-26T10:00:00.000Z",
    hasJournalEntries: false,
    journalCount: 0,
    profilePic: null,
  })),
}));

jest.mock("../src/navigation/navigation", () => ({
  __esModule: true,
  getCurrentRootRouteName: jest.fn(() => null),
  goBackOrFallback: jest.fn((fallback: () => void) => fallback()),
  navigateMainApp: jest.fn(),
  navigateRoot: jest.fn(),
  replaceMainApp: jest.fn(),
  resetRoot: jest.fn(),
}));

const onboardingData = {
  ageRange: "25-34",
  journalingExperience: "Occasional journaler",
  goals: ["Daily Reflection", "Personal Growth"],
  supportFocusAreas: ["Stress", "Sleep"],
  reminderPreference: "Evening",
  privacyConsent: true,
};

describe("appStore", () => {
  beforeEach(() => {
    resetAppStore();
    jest.useFakeTimers();
    (AsyncStorage.getItem as jest.Mock).mockReset();
    (AsyncStorage.setItem as jest.Mock).mockReset();
    (AsyncStorage.removeItem as jest.Mock).mockReset();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (cancelFreeTrialEndingReminder as jest.Mock).mockClear();
    (getDefaultReminderTimezone as jest.Mock).mockClear();
    (getReminderPermissionGranted as jest.Mock).mockClear();
    (syncOnboardingReminderPreference as jest.Mock).mockClear();
    (syncOnboardingReminderRecordPreference as jest.Mock).mockClear();
    (syncReminderNotifications as jest.Mock).mockClear();
    (syncStoredDailyReminderNotifications as jest.Mock).mockClear();
    (completeOnboardingRequest as jest.Mock).mockClear();
    (navigateRoot as jest.Mock).mockClear();
    (resetRoot as jest.Mock).mockClear();
    (goBackOrFallback as jest.Mock).mockClear();
    (getCurrentRootRouteName as jest.Mock).mockReset();
    (getCurrentRootRouteName as jest.Mock).mockReturnValue(null);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.dontMock("../src/services/authService");
    jest.dontMock("../src/services/userService");
    jest.dontMock("../src/config/env");
    jest.dontMock("../src/services/biometricLockService");
    jest.dontMock("../src/services/widgetService");
    jest.dontMock("../src/utils/tokenStorage");
    resetAppStore();
  });

  it("queues a widget action until it is prepared and consumed by Home", () => {
    const store = useAppStore;

    act(() => {
      store.getState().queueWidgetAction({
        type: "mood",
        mood: "good",
      });
    });

    const queuedAction = store.getState().pendingWidgetAction;
    expect(queuedAction).toEqual(
      expect.objectContaining({
        action: { type: "mood", mood: "good" },
        isReadyForHome: false,
      }),
    );

    act(() => {
      store.getState().preparePendingWidgetActionForHome();
    });

    expect(store.getState().stage).toBe("main-app");
    expect(store.getState().activeTab).toBe("home");
    expect(store.getState().pendingWidgetAction?.isReadyForHome).toBe(true);
    expect(resetRoot).toHaveBeenCalledWith("MainApp", { screen: "Home" });

    act(() => {
      store
        .getState()
        .consumePendingWidgetAction((queuedAction?.requestId ?? 0) + 1);
    });
    expect(store.getState().pendingWidgetAction).not.toBeNull();

    act(() => {
      store
        .getState()
        .consumePendingWidgetAction(queuedAction?.requestId ?? 0);
    });
    expect(store.getState().pendingWidgetAction).toBeNull();
  });

  it("ignores a duplicate delivery of a widget action that is still pending", () => {
    const store = useAppStore;

    act(() => {
      store.getState().queueWidgetAction({ type: "quick-thought" });
    });

    const firstRequestId = store.getState().pendingWidgetAction?.requestId;

    act(() => {
      store.getState().preparePendingWidgetActionForHome();
    });

    expect(store.getState().pendingWidgetAction?.isReadyForHome).toBe(true);
    expect(resetRoot).toHaveBeenCalledTimes(1);

    // The same tap arriving a second time must not rewind isReadyForHome or reset the
    // navigation root again, which would tear down the screen Home just opened.
    act(() => {
      store.getState().queueWidgetAction({ type: "quick-thought" });
    });

    expect(store.getState().pendingWidgetAction?.requestId).toBe(firstRequestId);
    expect(store.getState().pendingWidgetAction?.isReadyForHome).toBe(true);
    expect(resetRoot).toHaveBeenCalledTimes(1);
  });

  it("queues a widget action again once the previous one has been consumed", () => {
    const store = useAppStore;

    act(() => {
      store.getState().queueWidgetAction({ type: "quick-thought" });
    });

    const firstRequestId = store.getState().pendingWidgetAction?.requestId ?? 0;

    act(() => {
      store.getState().consumePendingWidgetAction(firstRequestId);
      store.getState().queueWidgetAction({ type: "quick-thought" });
    });

    expect(store.getState().pendingWidgetAction?.requestId).toBeGreaterThan(
      firstRequestId,
    );
  });

  it("replaces a pending widget action when a different mood is tapped", () => {
    const store = useAppStore;

    act(() => {
      store.getState().queueWidgetAction({ type: "mood", mood: "good" });
    });

    const firstRequestId = store.getState().pendingWidgetAction?.requestId ?? 0;

    act(() => {
      store.getState().queueWidgetAction({ type: "mood", mood: "bad" });
    });

    expect(store.getState().pendingWidgetAction?.action).toEqual({
      type: "mood",
      mood: "bad",
    });
    expect(store.getState().pendingWidgetAction?.requestId).toBeGreaterThan(
      firstRequestId,
    );
  });

  it("routes unauthenticated onboarding completion back to auth without saving completion", async () => {
    const store = useAppStore;

    await act(async () => {
      await store.getState().completeOnboarding(onboardingData);
    });

    expect(store.getState().isCompletingOnboarding).toBe(false);
    expect(store.getState().stage).toBe("auth");
    expect(completeOnboardingRequest).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
      "journalio.onboardingCompleted",
      "true"
    );
    expect(syncOnboardingReminderPreference).not.toHaveBeenCalled();
  });

  it("completes authenticated onboarding through the backend before post-auth paywall routing", async () => {
    const store = useAppStore;

    act(() => {
      store.setState({
        stage: "onboarding",
        authSource: "email",
        pendingEmail: "alex@example.com",
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
            onboardingCompleted: false,
            onboardingVersion: null,
            hasJournalEntries: false,
            profilePic: null,
          },
        },
      });
    });

    await act(async () => {
      const transition = store.getState().completeOnboarding(onboardingData);

      expect(store.getState().isCompletingOnboarding).toBe(true);
      expect(store.getState().onboardingData).toEqual(onboardingData);

      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(220);
      await transition;
    });

    expect(completeOnboardingRequest).toHaveBeenCalledWith(onboardingData);
    expect(store.getState().isCompletingOnboarding).toBe(false);
    expect(store.getState().stage).toBe("paywall");
    expect(store.getState().paywallReturnStage).toBe("main-app");
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      "secure",
      JSON.stringify(onboardingData),
      expect.objectContaining({
        service: "journalio.onboardingData.secure",
      })
    );
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "journalio.onboardingData"
    );
    expect(syncOnboardingReminderPreference).toHaveBeenCalledWith("Evening");
    expect(syncOnboardingReminderRecordPreference).toHaveBeenCalledWith(
      "Evening",
      {
        enabled: true,
        timezone: "Asia/Kolkata",
      }
    );
  });

  it("finishes the V2 onboarding journey through profile completion and the post-auth paywall", async () => {
    const store = useAppStore;
    const updatedProfile = {
      userId: "user-123",
      name: "Alex",
      phoneNumber: null,
      email: "alex@example.com",
      isPremium: false,
      journalingGoals: [],
      avatarColor: "#8E4636",
      profileSetupCompleted: true,
      onboardingCompleted: true,
      onboardingVersion: null,
      hasJournalEntries: true,
      journalCount: 1,
      profilePic: null,
    };
    const updateProfileSpy = jest
      .spyOn(userService, "updateProfile")
      .mockResolvedValue(updatedProfile);

    act(() => {
      store.setState({
        stage: "onboarding",
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
            onboardingCompleted: false,
            onboardingVersion: null,
            hasJournalEntries: false,
            journalCount: 0,
            profilePic: null,
          },
        },
      });
    });

    await act(async () => {
      await store.getState().finishOnboardingV2Journey("Avery");
    });

    // No draft was carried through this route, so there is nothing to persist.
    expect(completeOnboardingRequest).not.toHaveBeenCalled();
    expect(updateProfileSpy).toHaveBeenCalledWith({
      name: "Avery",
      avatarColor: "#8E4636",
    });
    expect(store.getState().stage).toBe("paywall");
    expect(store.getState().session?.user.hasJournalEntries).toBe(true);
    expect(store.getState().session?.user.journalCount).toBe(1);
    expect(store.getState().session?.user.profileSetupCompleted).toBe(true);
    expect(store.getState().activePaywallPlacementKey).toBe("post_auth");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "journalio.onboardingCompleted",
      "true"
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "journalio.postAuthPaywallSeen",
      "true"
    );
    expect(resetRoot).toHaveBeenCalledWith("Paywall");
    updateProfileSpy.mockRestore();
  });

  it.each([
    ["persists", undefined],
    ["completes the journey even when persistence fails", new Error("offline")],
  ])(
    "%s the V2 onboarding answers before updating the profile",
    async (_label, requestError) => {
      const store = useAppStore;
      const updatedProfile = {
        userId: "user-123",
        name: "Avery",
        phoneNumber: null,
        email: "alex@example.com",
        isPremium: true,
        journalingGoals: [],
        avatarColor: "#8E4636",
        profileSetupCompleted: true,
        onboardingCompleted: true,
        onboardingVersion: 2,
        hasJournalEntries: true,
        journalCount: 1,
        profilePic: null,
      };
      const updateProfileSpy = jest
        .spyOn(userService, "updateProfile")
        .mockResolvedValue(updatedProfile);

      if (requestError) {
        (completeOnboardingRequest as jest.Mock).mockRejectedValueOnce(
          requestError
        );
      }

      act(() => {
        store.setState({
          stage: "onboarding",
          session: {
            accessToken: "access-token",
            refreshToken: "refresh-token",
            user: {
              userId: "user-123",
              name: "Alex",
              phoneNumber: null,
              email: "alex@example.com",
              isPremium: true,
              journalingGoals: [],
              avatarColor: "#8E4636",
              profileSetupCompleted: false,
              onboardingCompleted: false,
              onboardingVersion: null,
              hasJournalEntries: false,
              journalCount: 0,
              profilePic: null,
            },
          },
        });
      });

      await act(async () => {
        await store.getState().finishOnboardingV2Journey("Avery", {
          version: 2,
          displayName: "Avery",
          referralSource: "tiktok",
          ageRange: "25_34",
          primaryContext: "founder_builder",
          reflectionTone: ["direct"],
          supportFocusAreas: ["overthinking", "focus"],
          primarySupportFocus: "overthinking",
          preferredTheme: "midnight_calm",
          privacyConsent: true,
        });
      });

      expect(completeOnboardingRequest).toHaveBeenCalledWith({
        ageRange: "25_34",
        primaryContext: "founder_builder",
        reflectionTone: ["direct"],
        supportFocusAreas: ["overthinking", "focus"],
        whatBringsYouHere: undefined,
        preferredTheme: "midnight_calm",
        privacyConsent: true,
        referralSource: "tiktok",
        referralSourceOther: undefined,
      });
      // A failed save must never strand the user on the last onboarding screen.
      expect(updateProfileSpy).toHaveBeenCalledWith({
        name: "Avery",
        avatarColor: "#8E4636",
      });
      expect(store.getState().stage).toBe("main-app");

      updateProfileSpy.mockRestore();
    }
  );

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

  it("routes contextual locked-feature paywalls into the custom P1 surface", () => {
    const store = useAppStore;

    act(() => {
      useAppStore.setState({ stage: "main-app" });
      store.getState().openPaywallForPlacement({
        placementKey: "home_ai_card_locked",
        returnStage: "main-app",
        screenKey: "home",
      });
    });

    // Every in-app gate now opens the custom P1 paywall (with per-feature copy),
    // not the hosted RevenueCat surface.
    expect(store.getState().activePaywallPlacementKey).toBe("home_ai_card_locked");
    expect(store.getState().activePaywallScreenKey).toBe("home");
    expect(store.getState().activeHostedPaywallTarget).toBeNull();

    // It is stacked on top of the caller rather than replacing the root, so the
    // screen that opened it stays mounted and `stage` keeps pointing at it.
    expect(store.getState().isPaywallOverlay).toBe(true);
    expect(store.getState().stage).toBe("main-app");
    expect(navigateRoot).toHaveBeenCalledWith("Paywall");
    expect(resetRoot).not.toHaveBeenCalledWith("Paywall");

    act(() => {
      store.getState().continueFromPaywall();
    });

    expect(store.getState().activePaywallPlacementKey).toBeNull();
    expect(store.getState().activePaywallScreenKey).toBeNull();
    expect(store.getState().activeHostedPaywallTarget).toBeNull();
    expect(store.getState().isPaywallOverlay).toBe(false);
    expect(goBackOrFallback).toHaveBeenCalled();
  });

  it("does not stack a second paywall when one is already open", () => {
    const store = useAppStore;
    (getCurrentRootRouteName as jest.Mock).mockReturnValue("Paywall");

    act(() => {
      useAppStore.setState({ stage: "main-app" });
      store.getState().openPaywallForPlacement({
        placementKey: "home_ai_card_locked",
        returnStage: "main-app",
      });
    });

    expect(navigateRoot).not.toHaveBeenCalledWith("Paywall");
    expect(store.getState().activePaywallPlacementKey).toBe("home_ai_card_locked");
  });

  it("opens the dedicated lifetime offer flow from the profile upgrade entry", () => {
    const store = useAppStore;

    act(() => {
      useAppStore.setState({ stage: "main-app" });
      store.getState().openLifetimeOffer({
        returnStage: "main-app",
        screenKey: "profile",
      });
    });

    expect(store.getState().stage).toBe("lifetime-offer");
    expect(store.getState().paywallReturnStage).toBe("main-app");
    expect(store.getState().activePaywallPlacementKey).toBe(
      "profile_upgrade_banner"
    );
    expect(store.getState().activePaywallScreenKey).toBe("profile");

    act(() => {
      store.getState().continueFromLifetimeOffer();
    });

    expect(store.getState().stage).toBe("main-app");
    expect(store.getState().paywallReturnStage).toBeNull();
    expect(store.getState().activePaywallPlacementKey).toBeNull();
    expect(store.getState().activePaywallScreenKey).toBeNull();
  });

  it("opens and closes the in-app legal browser state", () => {
    const store = useAppStore;

    act(() => {
      store.getState().openLegalBrowser({
        url: "https://api.journalio.app/privacy",
        title: "Privacy Policy",
      });
    });

    expect(store.getState().legalBrowserUrl).toBe("https://api.journalio.app/privacy");
    expect(store.getState().legalBrowserTitle).toBe("Privacy Policy");

    act(() => {
      store.getState().closeLegalBrowser();
    });

    expect(store.getState().legalBrowserUrl).toBeNull();
    expect(store.getState().legalBrowserTitle).toBeNull();
  });

  it("resets the stack when returning to sign in from auth recovery screens", () => {
    const store = useAppStore;

    act(() => {
      useAppStore.setState({ stage: "reset-password" });
      store.getState().goToSignIn();
    });

    expect(store.getState().stage).toBe("sign-in");
    expect(resetRoot).toHaveBeenCalledWith("SignIn");
    expect(navigateRoot).not.toHaveBeenCalledWith("SignIn");
  });

  it("opens reset password as a stack reset without making reset-password the sticky app stage", () => {
    const store = useAppStore;

    act(() => {
      useAppStore.setState({ stage: "forgot-password" });
      store.getState().goToResetPassword("token-123");
    });

    expect(store.getState().stage).toBe("forgot-password");
    expect(resetRoot).toHaveBeenCalledWith("ResetPassword", {
      token: "token-123",
    });
  });

  it("continues from a dismissed hosted main paywall to the return stage", () => {
    const store = useAppStore;

    act(() => {
      useAppStore.setState({
        stage: "hosted-paywall",
        activeHostedPaywallTarget: "main",
        activePaywallPlacementKey: "post_auth",
        activePaywallScreenKey: "auth",
        paywallReturnStage: "main-app",
      });

      store.getState().continueFromHostedPaywall("dismiss");
    });

    expect(store.getState().stage).toBe("main-app");
    expect(store.getState().activeHostedPaywallTarget).toBeNull();
  });

  it("opens the hosted exit paywall directly with exit placement context", () => {
    const store = useAppStore;

    act(() => {
      useAppStore.setState({
        stage: "main-app",
      });

      store.getState().openHostedPaywall("exit");
    });

    expect(store.getState().stage).toBe("hosted-paywall");
    expect(store.getState().activeHostedPaywallTarget).toBe("exit");
    expect(store.getState().activePaywallPlacementKey).toBe(
      "post_auth_exit_offer"
    );
    expect(store.getState().activePaywallScreenKey).toBe("home");
  });

  it("preserves post-auth contextual state when opening the hosted main paywall", () => {
    const store = useAppStore;

    act(() => {
      useAppStore.setState({
        stage: "paywall",
        activePaywallPlacementKey: "post_auth",
        activePaywallScreenKey: "auth",
        activePaywallTriggerMode: "contextual",
      });

      store.getState().openHostedPaywall("main");
    });

    expect(store.getState().stage).toBe("hosted-paywall");
    expect(store.getState().activeHostedPaywallTarget).toBe("main");
    expect(store.getState().activePaywallPlacementKey).toBe("post_auth");
    expect(store.getState().activePaywallScreenKey).toBe("auth");
    expect(store.getState().activePaywallTriggerMode).toBe("contextual");
  });

  it("falls back from a hosted main paywall into the local purchase step", () => {
    const store = useAppStore;

    act(() => {
      useAppStore.setState({
        stage: "hosted-paywall",
        activeHostedPaywallTarget: "main",
        activePaywallPlacementKey: "post_auth",
      });

      store.getState().fallbackFromHostedPaywall();
    });

    expect(store.getState().stage).toBe("paywall");
    expect(store.getState().postAuthPaywallStepOverride).toBe("purchase");
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
        },
      })),
      signInWithApple: jest.fn(),
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

  it("routes unverified email sign-ins to the verification screen", async () => {
    jest.resetModules();

    const resendEmailVerification = jest.fn(async () => ({
      email: "alex@example.com",
      verificationRequired: true,
      expiresInSeconds: 1800,
    }));

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

    jest.doMock("../src/services/authService", () => {
      const { ApiError } = require("../src/utils/apiClient");

      return {
        resendEmailVerification,
        logout: jest.fn(async () => undefined),
        signInWithEmail: jest.fn(async () => {
          throw new ApiError("Please verify your email before signing in.", {
            status: 403,
            code: "EMAIL_NOT_VERIFIED",
          });
        }),
        signInWithApple: jest.fn(),
        signInWithGoogle: jest.fn(),
        signUpWithEmail: jest.fn(),
        verifyEmail: jest.fn(),
      };
    });

    const { useAppStore: freshStore } = require("../src/store/appStore");

    await act(async () => {
      await freshStore.getState().signIn({
        email: " alex@example.com ",
        password: "password-123",
      });
    });

    expect(freshStore.getState().stage).toBe("verify-email");
    expect(freshStore.getState().pendingEmail).toBe("alex@example.com");
    expect(freshStore.getState().authSource).toBe("email");
    expect(resendEmailVerification).toHaveBeenCalledWith({
      email: "alex@example.com",
    });
  });

  it("clears local reminders when onboarding selects no reminders", async () => {
    const store = useAppStore;

    act(() => {
      store.setState({
        stage: "onboarding",
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
            onboardingCompleted: false,
            onboardingVersion: null,
            hasJournalEntries: false,
            profilePic: null,
          },
        },
      });
    });

    await act(async () => {
      const transition = store.getState().completeOnboarding({
        ...onboardingData,
        reminderPreference: "none",
      });

      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(220);
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

  it("ignores invalid prompt payloads when opening a new entry", () => {
    const store = useAppStore;

    act(() => {
      (
        store.getState().openNewEntry as (options?: {
          initialPrompt?: unknown;
        }) => void
      )({
        initialPrompt: { source: "press-event" },
      });
    });

    expect(store.getState().stage).toBe("new-entry");
    expect(store.getState().pendingNewEntryPrompt).toBeNull();
  });

  it("clears journal flow state when returning home after saving", () => {
    const store = useAppStore;

    act(() => {
      store.setState({
        activeTab: "calendar",
        selectedJournalEntryId: "mar-15",
        pendingNewEntryPrompt: "A prompt",
        stage: "journal-edit",
      });
      store.getState().returnHomeFromJournalFlow();
    });

    expect(store.getState().stage).toBe("main-app");
    expect(store.getState().activeTab).toBe("home");
    expect(store.getState().selectedJournalEntryId).toBeNull();
    expect(store.getState().pendingNewEntryPrompt).toBeNull();
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
    const storage = require("@react-native-async-storage/async-storage").default;
    const navigation = require("../src/navigation/navigation");

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

    expect(freshStore.getState().stage).toBe("auth");

    await act(async () => {
      await freshStore.getState().bootstrapAuthGate();
    });

    expect(freshStore.getState().hasBootstrappedAuthGate).toBe(true);
    expect(freshStore.getState().stage).toBe("auth");
    expect(freshStore.getState().session).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith("journalio.auth.user");
    expect(navigation.resetRoot).toHaveBeenCalledWith("AuthChoice");
  });

  it("restores completed onboarding answers when reopening at auth", async () => {
    jest.resetModules();

    const storage = require("@react-native-async-storage/async-storage").default;
    storage.getItem.mockImplementation(async (key: string) => {
      if (key === "journalio.onboardingData") {
        return JSON.stringify(onboardingData);
      }

      return null;
    });

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
    expect(freshStore.getState().session).toBeNull();
    expect(freshStore.getState().onboardingData).toEqual(onboardingData);
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

  it("boots into home from the cached verified profile when offline", async () => {
    jest.resetModules();

    const cachedUser = {
      userId: "user-123",
      name: "Alex",
      phoneNumber: null,
      email: "alex@example.com",
      isPremium: true,
      premiumPlanKey: "yearly",
      premiumActivatedAt: "2026-06-20T10:00:00.000Z",
      premiumProductId: "app.journalio.premium.yearly",
      premiumExpiresAt: "2026-06-27T10:00:00.000Z",
      premiumWillRenew: true,
      premiumVerifiedAt: "2026-06-22T10:00:00.000Z",
      premiumRevenueCatRequestDate: "2026-06-22T10:00:00.000Z",
      revenueCatAppUserId: "user-123",
      premiumSource: "revenuecat_verified",
      journalingGoals: ["growth"],
      avatarColor: "#8E4636",
      profileSetupCompleted: true,
      onboardingCompleted: true,
      profilePic: null,
    };
    const storage = require("@react-native-async-storage/async-storage").default;

    storage.getItem.mockImplementation(async (key: string) =>
      key === "journalio.auth.user" ? JSON.stringify(cachedUser) : null
    );

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

    const { ApiError } = require("../src/utils/apiClient");

    const getProfile = jest.fn();
    getProfile.mockRejectedValueOnce(
      new ApiError("Network unavailable", { isNetworkError: true })
    );

    jest.doMock("../src/services/userService", () => ({
      getProfile,
      updateProfile: jest.fn(),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    await act(async () => {
      await freshStore.getState().bootstrapAuthGate();
    });

    expect(freshStore.getState().hasBootstrappedAuthGate).toBe(true);
    expect(freshStore.getState().stage).toBe("main-app");
    expect(freshStore.getState().session).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: cachedUser,
    });
    expect(freshStore.getState().sessionValidationState).toBe("cached");

    getProfile.mockResolvedValueOnce({
      ...cachedUser,
      name: "Alex Verified",
    });

    await act(async () => {
      await freshStore.getState().revalidateCachedSession();
    });

    expect(freshStore.getState().sessionValidationState).toBe("verified");
    expect(freshStore.getState().session?.user.name).toBe("Alex Verified");
  });

  it("keeps bootstrap pending when tokens have no cached profile and the backend is offline", async () => {
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

    const { ApiError } = require("../src/utils/apiClient");
    jest.doMock("../src/services/userService", () => ({
      getProfile: jest.fn(async () => {
        throw new ApiError("Network unavailable", { isNetworkError: true });
      }),
      updateProfile: jest.fn(),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    await act(async () => {
      await freshStore.getState().bootstrapAuthGate();
    });

    expect(freshStore.getState().hasBootstrappedAuthGate).toBe(false);
    expect(freshStore.getState().session).toBeNull();
    expect(freshStore.getState().stage).toBe("auth");
  });

  it("removes legacy mock sessions instead of opening the authenticated app", async () => {
    jest.resetModules();

    const clearTokens = jest.fn(async () => undefined);
    const getProfile = jest.fn();
    const storage = require("@react-native-async-storage/async-storage").default;

    jest.doMock("../src/utils/tokenStorage", () => ({
      clearOnboardingCompleted: jest.fn(async () => undefined),
      clearPostAuthPaywallSeen: jest.fn(async () => undefined),
      clearTokens,
      getAccessToken: jest.fn(async () => "mock-access-alex"),
      getOnboardingCompleted: jest.fn(async () => true),
      getPostAuthPaywallSeen: jest.fn(async () => true),
      hasSeenInstall: jest.fn(async () => true),
      getTokens: jest.fn(async () => ({
        accessToken: "mock-access-alex",
        refreshToken: "mock-refresh-alex",
      })),
      markInstallSeen: jest.fn(async () => undefined),
      saveOnboardingCompleted: jest.fn(async () => undefined),
      savePostAuthPaywallSeen: jest.fn(async () => undefined),
      saveTokens: jest.fn(async () => undefined),
    }));
    jest.doMock("../src/services/userService", () => ({
      getProfile,
      updateProfile: jest.fn(),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    await act(async () => {
      await freshStore.getState().bootstrapAuthGate();
    });

    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledWith("journalio.auth.user");
    expect(getProfile).not.toHaveBeenCalled();
    expect(freshStore.getState().session).toBeNull();
    expect(freshStore.getState().stage).toBe("auth");
  });

  it("clears a cached offline session when reconnect validation is unauthorized", async () => {
    jest.resetModules();

    const clearTokens = jest.fn(async () => undefined);
    const storage = require("@react-native-async-storage/async-storage").default;
    const navigation = require("../src/navigation/navigation");
    const { ApiError } = require("../src/utils/apiClient");

    jest.doMock("../src/utils/tokenStorage", () => ({
      clearOnboardingCompleted: jest.fn(async () => undefined),
      clearPostAuthPaywallSeen: jest.fn(async () => undefined),
      clearTokens,
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
      getProfile: jest.fn(async () => {
        throw new ApiError("Unauthorized", { status: 401 });
      }),
      updateProfile: jest.fn(),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");
    freshStore.setState({
      hasBootstrappedAuthGate: true,
      sessionValidationState: "cached",
      stage: "main-app",
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
        },
      },
    });

    await act(async () => {
      await freshStore.getState().revalidateCachedSession();
    });

    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledWith("journalio.auth.user");
    expect(freshStore.getState().session).toBeNull();
    expect(freshStore.getState().sessionValidationState).toBe("none");
    expect(freshStore.getState().stage).toBe("auth");
    expect(navigation.resetRoot).toHaveBeenCalledWith("AuthChoice");
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

  it("clears residual secure credentials before routing a fresh install to Auth", async () => {
    jest.resetModules();

    const clearTokens = jest.fn(async () => undefined);
    const getTokens = jest.fn(async () => ({
      accessToken: "stale-access-token",
      refreshToken: "stale-refresh-token",
    }));
    const markInstallSeen = jest.fn(async () => undefined);
    const clearMoodWidgetSessionLocal = jest.fn(async () => undefined);
    const disableBiometricLock = jest.fn(async () => ({
      availability: {},
      status: "disabled",
    }));
    const getProfile = jest.fn();
    const storage = require("@react-native-async-storage/async-storage").default;

    jest.doMock("../src/utils/tokenStorage", () => ({
      clearOnboardingCompleted: jest.fn(async () => undefined),
      clearPostAuthPaywallSeen: jest.fn(async () => undefined),
      clearTokens,
      getAccessToken: jest.fn(async () => "stale-access-token"),
      getOnboardingCompleted: jest.fn(async () => false),
      getPostAuthPaywallSeen: jest.fn(async () => null),
      hasSeenInstall: jest.fn(async () => false),
      getTokens,
      markInstallSeen,
      saveOnboardingCompleted: jest.fn(async () => undefined),
      savePostAuthPaywallSeen: jest.fn(async () => undefined),
      saveTokens: jest.fn(async () => undefined),
    }));
    jest.doMock("../src/services/userService", () => ({
      getProfile,
      updateProfile: jest.fn(),
    }));
    jest.doMock("../src/services/widgetService", () => ({
      clearMoodWidgetSessionLocal,
    }));
    jest.doMock("../src/services/biometricLockService", () => ({
      authenticateBiometricLock: jest.fn(),
      canAccessBiometricLock: jest.fn(() => false),
      disableBiometricLock,
      enableBiometricLock: jest.fn(),
      getBiometricLockAvailability: jest.fn(async () => ({
        biometryType: null,
        isAvailable: false,
        isSupported: false,
      })),
      readBiometricLockPreference: jest.fn(async () => false),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    await act(async () => {
      await freshStore.getState().bootstrapAuthGate();
    });

    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(getTokens).not.toHaveBeenCalled();
    expect(getProfile).not.toHaveBeenCalled();
    expect(markInstallSeen).toHaveBeenCalledTimes(1);
    expect(disableBiometricLock).toHaveBeenCalledTimes(1);
    expect(clearMoodWidgetSessionLocal).toHaveBeenCalledTimes(2);
    expect(storage.removeItem).toHaveBeenCalledWith("journalio.auth.user");
    expect(storage.removeItem).toHaveBeenCalledWith("journalio.onboardingData");
    expect(freshStore.getState().hasBootstrappedAuthGate).toBe(true);
    expect(freshStore.getState().stage).toBe("auth");
  });

  it("keeps the reinstall marker unset when secure-token cleanup fails", async () => {
    jest.resetModules();

    const clearTokens = jest.fn(async () => {
      throw new Error("Keychain unavailable");
    });
    const getTokens = jest.fn(async () => ({
      accessToken: "stale-access-token",
      refreshToken: "stale-refresh-token",
    }));
    const markInstallSeen = jest.fn(async () => undefined);
    const getProfile = jest.fn();

    jest.doMock("../src/utils/tokenStorage", () => ({
      clearOnboardingCompleted: jest.fn(async () => undefined),
      clearPostAuthPaywallSeen: jest.fn(async () => undefined),
      clearTokens,
      getAccessToken: jest.fn(async () => "stale-access-token"),
      getOnboardingCompleted: jest.fn(async () => false),
      getPostAuthPaywallSeen: jest.fn(async () => null),
      hasSeenInstall: jest.fn(async () => false),
      getTokens,
      markInstallSeen,
      saveOnboardingCompleted: jest.fn(async () => undefined),
      savePostAuthPaywallSeen: jest.fn(async () => undefined),
      saveTokens: jest.fn(async () => undefined),
    }));
    jest.doMock("../src/services/userService", () => ({
      getProfile,
      updateProfile: jest.fn(),
    }));
    jest.doMock("../src/services/widgetService", () => ({
      clearMoodWidgetSessionLocal: jest.fn(async () => undefined),
    }));
    jest.doMock("../src/services/biometricLockService", () => ({
      authenticateBiometricLock: jest.fn(),
      canAccessBiometricLock: jest.fn(() => false),
      disableBiometricLock: jest.fn(async () => ({
        availability: {},
        status: "disabled",
      })),
      enableBiometricLock: jest.fn(),
      getBiometricLockAvailability: jest.fn(async () => ({
        biometryType: null,
        isAvailable: false,
        isSupported: false,
      })),
      readBiometricLockPreference: jest.fn(async () => false),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    await act(async () => {
      await freshStore.getState().bootstrapAuthGate();
    });

    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(markInstallSeen).not.toHaveBeenCalled();
    expect(getTokens).not.toHaveBeenCalled();
    expect(getProfile).not.toHaveBeenCalled();
    expect(freshStore.getState().stage).toBe("auth");
  });

  it("clears invalid persisted tokens and returns to auth on the same install", async () => {
    jest.resetModules();

    const clearTokens = jest.fn(async () => undefined);
    const storage = require("@react-native-async-storage/async-storage").default;

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
    expect(storage.removeItem).toHaveBeenCalledWith("journalio.auth.user");
    expect(freshStore.getState().session).toBeNull();
    expect(freshStore.getState().stage).toBe("auth");
    expect(freshStore.getState().hasBootstrappedAuthGate).toBe(true);
  });

  it("routes verified email users into the one-time paywall before the main app", async () => {
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
          },
        },
      });
    });

    await act(async () => {
      await freshStore.getState().finishEmailVerification();
    });

    expect(savePostAuthPaywallSeen).toHaveBeenCalledWith(true);
    expect(freshStore.getState().stage).toBe("paywall");
    expect(freshStore.getState().paywallReturnStage).toBe("main-app");
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
      },
    }));

    jest.doMock("../src/services/authService", () => ({
      resendEmailVerification: jest.fn(),
      logout: jest.fn(async () => undefined),
      signInWithEmail,
      signInWithApple: jest.fn(),
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
    });
    expect(saveOnboardingCompleted).toHaveBeenCalledWith(true);
    expect(savePostAuthPaywallSeen).toHaveBeenCalledWith(true);
    expect(freshStore.getState().stage).toBe("paywall");
    expect(freshStore.getState().paywallReturnStage).toBe("main-app");
  });

  it("does not overwrite reminders from stale local onboarding data after sign in", async () => {
    jest.resetModules();

    const savedReminder = {
      reminderId: "reminder-1",
      type: "daily_journal",
      enabled: true,
      time: "20:00",
      timezone: "Asia/Kolkata",
      skipIfCompletedToday: true,
      includeWeekends: true,
      streakWarnings: true,
      createdAt: "2026-04-03T10:00:00.000Z",
      updatedAt: "2026-04-03T10:00:00.000Z",
    };
    const syncReminderRecordMock = jest.fn(async () => savedReminder);
    const syncReminderNotificationsMock = jest.fn(async () => undefined);
    const syncStoredDailyReminderNotificationsMock = jest.fn(async () => null);

    jest.doMock("../src/services/remindersService", () => ({
      syncOnboardingReminderRecordPreference: syncReminderRecordMock,
    }));
    jest.doMock("../src/services/reminderNotificationsService", () => ({
      cancelFreeTrialEndingReminder: jest.fn(async () => undefined),
      cancelReminderNotifications: jest.fn(async () => undefined),
      getDefaultReminderTimezone: jest.fn(() => "Asia/Kolkata"),
      getReminderPermissionGranted: jest.fn(async () => true),
      syncOnboardingReminderPreference: jest.fn(async () => undefined),
      syncReminderNotifications: syncReminderNotificationsMock,
      syncStoredDailyReminderNotifications: syncStoredDailyReminderNotificationsMock,
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
          journalingGoals: [],
          avatarColor: "#8E4636",
          profileSetupCompleted: true,
          onboardingCompleted: true,
          profilePic: null,
        },
      })),
      signInWithApple: jest.fn(),
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
      getPostAuthPaywallSeen: jest.fn(async () => true),
      hasSeenInstall: jest.fn(async () => true),
      getTokens: jest.fn(async () => null),
      markInstallSeen: jest.fn(async () => undefined),
      saveOnboardingCompleted: jest.fn(async () => undefined),
      savePostAuthPaywallSeen: jest.fn(async () => undefined),
      saveTokens: jest.fn(async () => undefined),
    }));
    jest.doMock("../src/services/userService", () => ({
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      updatePremiumStatus: jest.fn(),
    }));

    const { useAppStore: freshStore } = require("../src/store/appStore");

    act(() => {
      freshStore.setState({ onboardingData });
    });

    await act(async () => {
      await freshStore.getState().signIn({
        email: "alex@example.com",
        password: "password123",
      });
    });

    expect(syncReminderRecordMock).not.toHaveBeenCalled();
    expect(syncReminderNotificationsMock).not.toHaveBeenCalledWith(savedReminder);
    expect(syncStoredDailyReminderNotificationsMock).toHaveBeenCalledTimes(1);
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
      },
    }));

    jest.doMock("../src/config/googleSignIn", () => ({
      getGoogleIdToken,
    }));
    jest.doMock("../src/services/authService", () => ({
      resendEmailVerification: jest.fn(),
      logout: jest.fn(async () => undefined),
      signInWithEmail: jest.fn(),
      signInWithApple: jest.fn(),
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
        },
      });
    });

    await act(async () => {
      await freshStore.getState().continueWithGoogle();
    });

    expect(getGoogleIdToken).toHaveBeenCalledTimes(1);
    expect(signInWithGoogle).toHaveBeenCalledWith({
      idToken: "google-id-token",
    });
    expect(saveTokens).toHaveBeenCalledWith({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    expect(saveOnboardingCompleted).toHaveBeenCalledWith(true);
    expect(savePostAuthPaywallSeen).toHaveBeenCalledWith(true);
    expect(freshStore.getState().authSource).toBe("google");
    expect(freshStore.getState().stage).toBe("paywall");
    expect(freshStore.getState().paywallReturnStage).toBe("main-app");
  });

  it("continues with Apple using the shared session persistence flow", async () => {
    jest.resetModules();

    const getAppleSignInCredential = jest.fn(async () => ({
      identityToken: "apple-identity-token",
      nonce: "raw-apple-nonce-value",
      email: "alex@example.com",
      fullName: {
        givenName: "Alex",
        familyName: "Appleseed",
        nickname: null,
      },
    }));
    const saveOnboardingCompleted = jest.fn(async () => undefined);
    const savePostAuthPaywallSeen = jest.fn(async () => undefined);
    const saveTokens = jest.fn(async () => undefined);
    const signInWithApple = jest.fn(async () => ({
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
        profilePic: null,
      },
    }));

    jest.doMock("../src/config/appleSignIn", () => ({
      getAppleSignInCredential,
    }));
    jest.doMock("../src/services/authService", () => ({
      resendEmailVerification: jest.fn(),
      logout: jest.fn(async () => undefined),
      signInWithApple,
      signInWithEmail: jest.fn(),
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

    act(() => {
      freshStore.setState({
        onboardingData: {
          ...onboardingData,
        },
      });
    });

    await act(async () => {
      await freshStore.getState().continueWithApple();
    });

    expect(getAppleSignInCredential).toHaveBeenCalledTimes(1);
    expect(signInWithApple).toHaveBeenCalledWith({
      identityToken: "apple-identity-token",
      nonce: "raw-apple-nonce-value",
      email: "alex@example.com",
      fullName: {
        givenName: "Alex",
        familyName: "Appleseed",
        nickname: null,
      },
    });
    expect(saveTokens).toHaveBeenCalledWith({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    expect(saveOnboardingCompleted).toHaveBeenCalledWith(true);
    expect(savePostAuthPaywallSeen).toHaveBeenCalledWith(true);
    expect(freshStore.getState().authSource).toBe("apple");
    expect(freshStore.getState().stage).toBe("paywall");
    expect(freshStore.getState().paywallReturnStage).toBe("main-app");
  });

  it("continues with Apple without sending null profile fields", async () => {
    jest.resetModules();

    const getAppleSignInCredential = jest.fn(async () => ({
      identityToken: "apple-identity-token",
      nonce: "raw-apple-nonce-value",
      email: null,
      fullName: null,
    }));
    const signInWithApple = jest.fn(async () => ({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        userId: "user-123",
        name: "Journal User",
        phoneNumber: null,
        email: null,
        journalingGoals: [],
        avatarColor: null,
        profileSetupCompleted: false,
        onboardingCompleted: true,
        profilePic: null,
        isPremium: true,
      },
    }));

    jest.doMock("../src/config/appleSignIn", () => ({
      getAppleSignInCredential,
    }));
    jest.doMock("../src/services/authService", () => ({
      resendEmailVerification: jest.fn(),
      logout: jest.fn(async () => undefined),
      signInWithApple,
      signInWithEmail: jest.fn(),
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
      await freshStore.getState().continueWithApple();
    });

    expect(signInWithApple).toHaveBeenCalledWith({
      identityToken: "apple-identity-token",
      nonce: "raw-apple-nonce-value",
    });
  });

  it("signs out through the backend and clears the local session state", async () => {
    jest.resetModules();

    const logout = jest.fn(async () => undefined);
    const cancelTrialReminderMock = jest.fn(async () => undefined);

    jest.doMock("../src/services/authService", () => ({
      logout,
      resendEmailVerification: jest.fn(),
      signInWithEmail: jest.fn(),
      signInWithApple: jest.fn(),
      signInWithGoogle: jest.fn(),
      signUpWithEmail: jest.fn(),
      verifyEmail: jest.fn(),
    }));
    jest.doMock("../src/services/reminderNotificationsService", () => ({
      cancelFreeTrialEndingReminder: cancelTrialReminderMock,
      syncOnboardingReminderPreference: jest.fn(async () => undefined),
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
    expect(cancelTrialReminderMock).toHaveBeenCalledTimes(1);
    expect(freshStore.getState().session).toBeNull();
    expect(freshStore.getState().stage).toBe("auth");
    expect(freshStore.getState().activeTab).toBe("home");
  });
});
