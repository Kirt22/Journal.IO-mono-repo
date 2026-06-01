import { create } from "zustand";
import type { BottomNavKey } from "../components/BottomNav";
import type { AuthEntrySource, FlowStage } from "../navigation/appFlow";
import type { PaywallTriggerMode } from "../services/paywallService";
import {
  resendEmailVerification,
  logout,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  verifyEmail,
  type AuthOnboardingContext,
  type AuthSession,
} from "../services/authService";
import { getAppleSignInCredential } from "../config/appleSignIn";
import { getGoogleIdToken } from "../config/googleSignIn";
import { getProfile, updatePremiumStatus, updateProfile } from "../services/userService";
import {
  cancelFreeTrialEndingReminder,
  cancelReminderNotifications,
  getDefaultReminderTimezone,
  getReminderPermissionGranted,
  syncOnboardingReminderPreference,
  syncReminderNotifications,
  syncStoredDailyReminderNotifications,
} from "../services/reminderNotificationsService";
import { syncOnboardingReminderRecordPreference } from "../services/remindersService";
import type { ThemeMode } from "../theme/theme";
import { ApiError } from "../utils/apiClient";
import {
  clearTokens,
  getOnboardingCompleted,
  hasSeenInstall,
  getTokens,
  markInstallSeen,
  saveOnboardingCompleted,
  savePostAuthPaywallSeen,
  saveTokens,
} from "../utils/tokenStorage";
import {
  clearStoredOnboardingData,
  getHideJournalPreviews,
  getStoredOnboardingData,
  saveHideJournalPreviews,
  saveStoredOnboardingData,
} from "../utils/appStorage";
import type { OnboardingCompletionData } from "../types/onboarding";
import devLaunchConfig from "../utils/devLaunchConfig.json";
import {
  goBackOrFallback,
  navigateMainApp,
  navigateRoot,
  replaceMainApp,
  resetRoot,
} from "../navigation/navigation";
import {
  createInitialJournalSliceState,
  createJournalSlice,
  type JournalSliceState,
} from "./slices/journalSlice";

const ONBOARDING_EXIT_DELAY_MS = 220;

const wait = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

const isFlowStage = (value: string): value is FlowStage =>
  value === "onboarding" ||
  value === "paywall" ||
  value === "hosted-paywall" ||
  value === "spin-wheel" ||
  value === "discount-offer" ||
  value === "lifetime-offer" ||
  value === "auth" ||
  value === "sign-in" ||
  value === "create-account" ||
  value === "verify-email" ||
  value === "profile" ||
  value === "main-app" ||
  value === "new-entry" ||
  value === "journal-detail" ||
  value === "journal-edit" ||
  value === "complete";

const getInitialStage = (): FlowStage => {
  const launchStage = __DEV__ ? devLaunchConfig.stage : undefined;

  if (
    launchStage === "home" ||
    launchStage === "calendar" ||
    launchStage === "insights"
  ) {
    return "main-app";
  }

  if (launchStage && isFlowStage(launchStage)) {
    return launchStage;
  }

  return "onboarding";
};

const getInitialTab = (): BottomNavKey => {
  const launchStage = __DEV__ ? devLaunchConfig.stage : undefined;

  if (
    __DEV__ &&
    (launchStage === "calendar" || devLaunchConfig.activeTab === "calendar")
  ) {
    return "calendar";
  }

  if (
    launchStage === "insights" ||
    devLaunchConfig.activeTab === "insights"
  ) {
    return "insights";
  }

  return "home";
};

const shouldBypassAuthGateForDevLaunch = () => {
  if (!__DEV__ || !devLaunchConfig.stage) {
    return false;
  }

  return ![
    "onboarding",
    "auth",
    "sign-in",
    "create-account",
    "verify-email",
  ].includes(devLaunchConfig.stage);
};

const normalizeOptionalValue = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeNewEntryPrompt = (value?: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeSelections = (values?: string[]) =>
  Array.from(new Set((values || []).map(value => value.trim()).filter(Boolean)));

function buildOnboardingContext(
  data: OnboardingCompletionData | null
): AuthOnboardingContext | undefined {
  if (!data) {
    return undefined;
  }

  return {
    ageRange: normalizeOptionalValue(data.ageRange),
    journalingExperience: normalizeOptionalValue(data.journalingExperience),
    goals: normalizeSelections(data.goals),
    supportFocus: normalizeSelections(data.supportFocusAreas),
    reminderPreference: normalizeOptionalValue(data.reminderPreference),
    aiOptIn: data.aiComfort,
    privacyConsentAccepted: data.privacyConsent,
  };
}

const logReminderSyncWarning = (error: unknown) => {
  if (!__DEV__) {
    return;
  }

  console.warn(
    `[Reminders] Unable to sync reminder state after auth ${
      error instanceof Error ? error.message : "Unknown reminder sync failure"
    }`
  );
};

const syncReminderStateAfterAuth = async (
  onboardingData: OnboardingCompletionData | null
) => {
  try {
    if (!onboardingData?.reminderPreference) {
      await syncStoredDailyReminderNotifications();
      return;
    }

    const preference = onboardingData.reminderPreference;
    const normalizedPreference = preference.trim().toLowerCase();
    const permissionGranted = await getReminderPermissionGranted();
    const savedReminder = await syncOnboardingReminderRecordPreference(preference, {
      enabled:
        Boolean(normalizedPreference) &&
        normalizedPreference !== "none" &&
        permissionGranted,
      timezone: getDefaultReminderTimezone(),
    });

    if (!savedReminder || !savedReminder.enabled) {
      await cancelReminderNotifications();
      return;
    }

    await syncReminderNotifications(savedReminder);
  } catch (error) {
    logReminderSyncWarning(error);
  }
};

type AppStoreState = {
  stage: FlowStage;
  paywallReturnStage: PaywallExitStage | null;
  activePaywallPlacementKey: string | null;
  activePaywallScreenKey: string | null;
  activePaywallTriggerMode: PaywallTriggerMode;
  activeHostedPaywallTarget: HostedPaywallTarget | null;
  postAuthPaywallStepOverride: PostAuthPaywallStep | null;
  pendingPostAuthDiscountOffer: boolean;
  activeTab: BottomNavKey;
  preferredInsightsTab: "overview" | "analysis" | null;
  isCompletingOnboarding: boolean;
  onboardingData: OnboardingCompletionData | null;
  pendingEmail: string;
  authSource: AuthEntrySource | null;
  session: AuthSession | null;
  initialProfileName: string;
  themeModeOverride: ThemeMode | null;
  selectedJournalEntryId: string | null;
  pendingNewEntryPrompt: string | null;
  pendingPremiumActivation: boolean;
  hasBootstrappedAuthGate: boolean;
  hideJournalPreviews: boolean;
  legalBrowserUrl: string | null;
  legalBrowserTitle: string | null;
} & JournalSliceState & {
  bootstrapAuthGate: () => Promise<void>;
  completeOnboarding: (data: OnboardingCompletionData) => Promise<void>;
  continueFromPaywall: (reason?: "dismiss" | "continue") => void;
  openHostedPaywall: (target: HostedPaywallTarget) => void;
  continueFromHostedPaywall: (reason?: "dismiss" | "continue") => void;
  fallbackFromHostedPaywall: () => void;
  continueFromSpinWheel: () => void;
  fallbackFromSpinWheel: () => void;
  continueFromDiscountOffer: () => void;
  continueFromLifetimeOffer: () => void;
  openLifetimeOffer: (options?: {
    returnStage?: FlowStage;
    screenKey?: string | null;
    triggerMode?: PaywallTriggerMode;
  }) => void;
  openPaywall: (returnStage?: FlowStage) => void;
  openPaywallForPlacement: (options: {
    placementKey: string;
    returnStage?: FlowStage;
    screenKey?: string | null;
    triggerMode?: PaywallTriggerMode;
    enablePostAuthDiscountOffer?: boolean;
  }) => void;
  setPaywallContext: (context: {
    placementKey: string | null;
    screenKey?: string | null;
    triggerMode?: PaywallTriggerMode;
  }) => void;
  clearPaywallContext: () => void;
  continueWithEmail: () => Promise<void>;
  continueWithApple: () => Promise<void>;
  continueWithGoogle: () => Promise<void>;
  goToSignIn: () => void;
  goToCreateAccount: () => void;
  createAccount: (payload: {
    email: string;
    password: string;
  }) => Promise<void>;
  finishCreateAccount: () => void;
  resendVerificationCode: () => Promise<void>;
  verifyPendingEmail: (code: string) => Promise<void>;
  finishEmailVerification: () => Promise<void>;
  signIn: (payload: { email: string; password: string }) => Promise<void>;
  completeProfile: (payload: {
    name: string;
    avatarColor: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  goBackToAuth: () => void;
  goBackToCreateAccount: () => void;
  skipProfileSetup: () => Promise<void>;
  restartFlow: () => void;
  setActiveTabState: (nextTab: BottomNavKey) => void;
  setActiveTab: (nextTab: BottomNavKey) => void;
  openInsightsTab: (nextTab?: "overview" | "analysis") => void;
  clearPreferredInsightsTab: () => void;
  openNewEntry: (options?: { initialPrompt?: string | null }) => void;
  closeNewEntry: () => void;
  openJournalEntry: (entryId: string) => void;
  openJournalEditor: (entryId: string) => void;
  closeJournalEntry: () => void;
  closeJournalEditor: () => void;
  returnHomeFromJournalFlow: () => void;
  setThemeModeOverride: (nextMode: ThemeMode | null) => void;
  setHideJournalPreviews: (nextValue: boolean) => Promise<void>;
  openLegalBrowser: (payload: { url: string; title?: string | null }) => void;
  closeLegalBrowser: () => void;
  setSessionAiOptIn: (nextValue: boolean) => void;
  setSessionPremiumStatus: (nextValue: boolean) => Promise<void>;
  setSessionUserProfile: (nextProfile: AuthSession["user"]) => void;
};

type AppStoreSnapshot = Pick<
  AppStoreState,
  | "stage"
  | "paywallReturnStage"
  | "activePaywallPlacementKey"
  | "activePaywallScreenKey"
  | "activePaywallTriggerMode"
  | "activeHostedPaywallTarget"
  | "postAuthPaywallStepOverride"
  | "pendingPostAuthDiscountOffer"
  | "activeTab"
  | "preferredInsightsTab"
  | "isCompletingOnboarding"
  | "onboardingData"
  | "pendingEmail"
  | "authSource"
  | "session"
  | "initialProfileName"
  | "themeModeOverride"
  | "selectedJournalEntryId"
  | "pendingNewEntryPrompt"
  | "pendingPremiumActivation"
  | "hasBootstrappedAuthGate"
  | "hideJournalPreviews"
  | "legalBrowserUrl"
  | "legalBrowserTitle"
  | "recentJournalEntries"
>;

const createInitialSnapshot = (): AppStoreSnapshot => ({
  stage: getInitialStage(),
  paywallReturnStage: null,
  activePaywallPlacementKey: null,
  activePaywallScreenKey: null,
  activePaywallTriggerMode: "contextual",
  activeHostedPaywallTarget: null,
  postAuthPaywallStepOverride: null,
  pendingPostAuthDiscountOffer: false,
  activeTab: getInitialTab(),
  preferredInsightsTab: null,
  isCompletingOnboarding: false,
  onboardingData: null,
  pendingEmail:
    __DEV__ && devLaunchConfig.stage === "profile"
      ? devLaunchConfig.email || "debug@example.com"
      : "",
  authSource: __DEV__ && devLaunchConfig.stage === "profile" ? "email" : null,
  session: null,
  initialProfileName: "",
  themeModeOverride: null,
  selectedJournalEntryId: null,
  pendingNewEntryPrompt: null,
  pendingPremiumActivation: false,
  hasBootstrappedAuthGate: false,
  hideJournalPreviews: false,
  legalBrowserUrl: null,
  legalBrowserTitle: null,
  ...createInitialJournalSliceState(),
});

const enterHomeWithProfile = (
  set: (partial: Partial<AppStoreState>) => void,
  get: () => AppStoreState,
  updatedProfile: AuthSession["user"]
) => {
  const currentSession = get().session;

  set({
    session: currentSession
      ? {
          ...currentSession,
          user: updatedProfile,
        }
      : null,
    initialProfileName: updatedProfile.name,
    activeTab: "home",
    stage: "main-app",
  });

  resetRoot("MainApp", {
    screen: "Home",
  });
};

const getSelectedGoals = (state: Pick<AppStoreState, "onboardingData">) =>
  state.onboardingData?.goals || [];

const isUnauthorizedProfileError = (error: unknown) =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

const syncPendingPremiumIfNeeded = async (
  session: AuthSession,
  pendingPremiumActivation: boolean
) => {
  if (!pendingPremiumActivation) {
    return session;
  }

  const updatedProfile = await updatePremiumStatus({ isPremium: true });

  return {
    ...session,
    user: updatedProfile,
  };
};

const getPostAuthDestinationStage = (
  session: AuthSession | null
): PaywallExitStage => {
  if (!session) {
    return "auth";
  }

  return session.user.profileSetupCompleted ? "main-app" : "profile";
};

const shouldShowPostAuthPaywall = (session: AuthSession | null) =>
  Boolean(session && !session.user.isPremium);

const resolvePaywallExitStage = (
  state: Pick<AppStoreState, "session" | "paywallReturnStage">
): PaywallExitStage => {
  if (state.paywallReturnStage) {
    return state.paywallReturnStage;
  }

  return getPostAuthDestinationStage(state.session);
};

const navigateToResolvedStage = (
  state: Pick<
    AppStoreState,
    "session" | "paywallReturnStage" | "activeTab" | "stage" | "setActiveTabState"
  >
) => {
  const nextStage = resolvePaywallExitStage(state);

  switch (nextStage) {
    case "onboarding":
      resetToOnboarding();
      return;
    case "auth":
      resetToAuthChoice();
      return;
    case "sign-in":
      resetRoot("SignIn");
      return;
    case "create-account":
      resetRoot("CreateAccount");
      return;
    case "verify-email":
      resetRoot("VerifyEmail");
      return;
    case "profile":
      resetToProfileSetup();
      return;
    case "new-entry":
      resetRoot("MainApp", {
        screen: "NewEntry",
      });
      return;
    case "journal-detail":
      resetRoot("MainApp", {
        screen: "EntryDetail",
      });
      return;
    case "journal-edit":
      resetRoot("MainApp", {
        screen: "EditEntry",
      });
      return;
    case "complete":
      resetRoot("Complete");
      return;
    case "main-app":
    default:
      resetToMainApp(state.setActiveTabState, state.activeTab);
  }
};

type PaywallExitStage = Exclude<
  FlowStage,
  "paywall" | "hosted-paywall" | "spin-wheel" | "discount-offer" | "lifetime-offer"
>;

type HostedPaywallTarget = "main" | "exit";
type PostAuthPaywallStep = "trial" | "reminder" | "purchase";

const shouldUseHostedPaywallForPlacement = (placementKey: string) =>
  placementKey !== "profile_upgrade_banner" &&
  placementKey !== "post_auth" &&
  placementKey !== "post_auth_exit_offer";

const getMainAppRouteForTab = (tab: BottomNavKey) => {
  switch (tab) {
    case "calendar":
      return "Calendar";
    case "insights":
      return "Insights";
    case "profile":
      return "Profile";
    case "home":
    default:
      return "Home";
  }
};

const resetToMainApp = (
  setActiveTabState: AppStoreState["setActiveTabState"],
  tab: BottomNavKey = "home"
) => {
  const nextRoute = getMainAppRouteForTab(tab);

  resetRoot("MainApp", {
    screen: nextRoute,
  });

  setActiveTabState(tab);
};

const resetToAuthChoice = () => {
  resetRoot("AuthChoice");
};

const resetToOnboarding = () => {
  resetRoot("Onboarding");
};

const resetToProfileSetup = () => {
  resetRoot("SetupProfile");
};

export const useAppStore = create<AppStoreState>((set, get) => ({
  ...createInitialSnapshot(),
  ...createJournalSlice(
    set as Parameters<typeof createJournalSlice>[0]
  ),
  bootstrapAuthGate: async () => {
    if (get().hasBootstrappedAuthGate) {
      return;
    }

    const hideJournalPreviews = await getHideJournalPreviews().catch(
      () => false
    );

    set({ hideJournalPreviews });

    if (shouldBypassAuthGateForDevLaunch()) {
      set({ hasBootstrappedAuthGate: true });
      return;
    }

    const installSeen = await hasSeenInstall();

    if (!installSeen) {
      await markInstallSeen();
      await clearTokens();
      await saveOnboardingCompleted(false);
      await clearStoredOnboardingData();
      await savePostAuthPaywallSeen(false);

      set({
        hasBootstrappedAuthGate: true,
        stage: "onboarding",
      });
      return;
    }

    const tokens = await getTokens();
    if (tokens) {
      try {
        const profile = await getProfile();
        const hydratedSession: AuthSession = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: profile,
        };

        await saveOnboardingCompleted(Boolean(profile.onboardingCompleted));
        await savePostAuthPaywallSeen(true);
        await syncReminderStateAfterAuth(null);

        set({
          hasBootstrappedAuthGate: true,
          session: hydratedSession,
          onboardingData: null,
          initialProfileName: profile.name,
          authSource: profile.email ? "email" : null,
          pendingEmail: profile.email || "",
          paywallReturnStage: null,
          activePaywallPlacementKey: null,
          activePaywallScreenKey: null,
          activePaywallTriggerMode: "contextual",
          activeHostedPaywallTarget: null,
          postAuthPaywallStepOverride: null,
          pendingPostAuthDiscountOffer: false,
          preferredInsightsTab: null,
          pendingPremiumActivation: false,
          activeTab: "home",
          stage: "main-app",
        });
        return;
      } catch (error) {
        if (isUnauthorizedProfileError(error)) {
          await clearTokens();
        }

        const onboardingCompleted = await getOnboardingCompleted();
        const storedOnboardingData = onboardingCompleted
          ? await getStoredOnboardingData()
          : null;

        set({
          hasBootstrappedAuthGate: true,
          session: null,
          onboardingData: storedOnboardingData,
          initialProfileName: "",
          authSource: null,
          pendingEmail: "",
          paywallReturnStage: null,
          activePaywallPlacementKey: null,
          activePaywallScreenKey: null,
          activePaywallTriggerMode: "contextual",
          activeHostedPaywallTarget: null,
          postAuthPaywallStepOverride: null,
          pendingPostAuthDiscountOffer: false,
          preferredInsightsTab: null,
          activeTab: "home",
          stage: onboardingCompleted ? "auth" : "onboarding",
        });
        return;
      }
    }

    const onboardingCompleted = await getOnboardingCompleted();
    const storedOnboardingData = onboardingCompleted
      ? await getStoredOnboardingData()
      : null;

    set({
      hasBootstrappedAuthGate: true,
      session: null,
      onboardingData: storedOnboardingData,
      initialProfileName: "",
      authSource: null,
      pendingEmail: "",
      paywallReturnStage: null,
      activePaywallPlacementKey: null,
      activePaywallScreenKey: null,
      activePaywallTriggerMode: "contextual",
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      pendingPostAuthDiscountOffer: false,
      preferredInsightsTab: null,
      activeTab: "home",
      stage: onboardingCompleted ? "auth" : "onboarding",
    });
  },
  completeOnboarding: async data => {
    set({
      isCompletingOnboarding: true,
      onboardingData: data,
    });

    const saveOnboardingCompletedPromise = saveOnboardingCompleted(true);
    const saveStoredOnboardingDataPromise = saveStoredOnboardingData(data);
    const syncOnboardingReminderPromise = syncOnboardingReminderPreference(
      data.reminderPreference
    ).catch(() => undefined);
    await wait(ONBOARDING_EXIT_DELAY_MS);
    await Promise.all([
      saveOnboardingCompletedPromise,
      saveStoredOnboardingDataPromise,
      syncOnboardingReminderPromise,
    ]);

    set({
      isCompletingOnboarding: false,
      pendingPremiumActivation: false,
      paywallReturnStage: null,
      activePaywallPlacementKey: null,
      activePaywallScreenKey: null,
      activePaywallTriggerMode: "contextual",
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      pendingPostAuthDiscountOffer: false,
      stage: "auth",
    });

    resetToAuthChoice();
  },
  continueFromPaywall: (reason = "continue") => {
    const state = get();
    const shouldOpenDiscountOffer =
      reason === "dismiss" &&
      state.activePaywallPlacementKey === "post_auth" &&
      state.pendingPostAuthDiscountOffer;

    set(currentState => {
      if (shouldOpenDiscountOffer) {
        return {
          activePaywallPlacementKey: "post_auth_exit_offer",
          activePaywallScreenKey: currentState.activePaywallScreenKey,
          activePaywallTriggerMode: "contextual",
          activeHostedPaywallTarget: null,
          postAuthPaywallStepOverride: null,
          pendingPostAuthDiscountOffer: false,
          stage: "discount-offer" as FlowStage,
        };
      }

      return {
        paywallReturnStage: null,
        activePaywallPlacementKey: null,
        activePaywallScreenKey: null,
        activePaywallTriggerMode: "contextual",
        activeHostedPaywallTarget: null,
        postAuthPaywallStepOverride: null,
        pendingPostAuthDiscountOffer: false,
        stage: resolvePaywallExitStage(currentState),
      };
    });

    if (shouldOpenDiscountOffer) {
      resetRoot("DiscountOffer");
      return;
    }

    navigateToResolvedStage({
      ...state,
      setActiveTabState: get().setActiveTabState,
    });
  },
  openHostedPaywall: target => {
    set({
      activeHostedPaywallTarget: target,
      stage: "hosted-paywall",
    });

    resetRoot("HostedPaywall");
  },
  continueFromHostedPaywall: (reason = "continue") => {
    const state = get();
    const shouldOpenSpinWheel =
      reason === "dismiss" &&
      state.activeHostedPaywallTarget === "main" &&
      state.activePaywallPlacementKey === "post_auth" &&
      state.pendingPostAuthDiscountOffer;

    set(currentState => {
      if (shouldOpenSpinWheel) {
        return {
          activeHostedPaywallTarget: null,
          postAuthPaywallStepOverride: null,
          pendingPostAuthDiscountOffer: false,
          stage: "spin-wheel" as FlowStage,
        };
      }

      return {
        paywallReturnStage: null,
        activePaywallPlacementKey: null,
        activePaywallScreenKey: null,
        activePaywallTriggerMode: "contextual",
        activeHostedPaywallTarget: null,
        postAuthPaywallStepOverride: null,
        pendingPostAuthDiscountOffer: false,
        stage: resolvePaywallExitStage(currentState),
      };
    });

    if (shouldOpenSpinWheel) {
      resetRoot("SpinWheel");
      return;
    }

    navigateToResolvedStage({
      ...state,
      setActiveTabState: get().setActiveTabState,
    });
  },
  fallbackFromHostedPaywall: () => {
    const state = get();

    set(currentState => {
      if (currentState.activeHostedPaywallTarget === "exit") {
        return {
          activeHostedPaywallTarget: null,
          postAuthPaywallStepOverride: null,
          stage: "discount-offer" as FlowStage,
        };
      }

      return {
        activeHostedPaywallTarget: null,
        postAuthPaywallStepOverride: "purchase" as PostAuthPaywallStep,
        stage: "paywall" as FlowStage,
      };
    });

    resetRoot(state.activeHostedPaywallTarget === "exit" ? "DiscountOffer" : "Paywall");
  },
  continueFromSpinWheel: () => {
    set({
      activePaywallPlacementKey: "post_auth_exit_offer",
      activePaywallTriggerMode: "contextual",
      activeHostedPaywallTarget: "exit",
      postAuthPaywallStepOverride: null,
      stage: "hosted-paywall",
    });

    resetRoot("HostedPaywall");
  },
  fallbackFromSpinWheel: () => {
    set({
      activePaywallPlacementKey: "post_auth_exit_offer",
      activePaywallTriggerMode: "contextual",
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      stage: "discount-offer",
    });

    resetRoot("DiscountOffer");
  },
  continueFromDiscountOffer: () => {
    const state = get();

    set(currentState => ({
      paywallReturnStage: null,
      activePaywallPlacementKey: null,
      activePaywallScreenKey: null,
      activePaywallTriggerMode: "contextual",
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      pendingPostAuthDiscountOffer: false,
      stage: resolvePaywallExitStage(currentState),
    }));

    navigateToResolvedStage({
      ...state,
      setActiveTabState: get().setActiveTabState,
    });
  },
  continueFromLifetimeOffer: () => {
    const state = get();

    set(currentState => ({
      paywallReturnStage: null,
      activePaywallPlacementKey: null,
      activePaywallScreenKey: null,
      activePaywallTriggerMode: "contextual",
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      pendingPostAuthDiscountOffer: false,
      stage: resolvePaywallExitStage(currentState),
    }));

    navigateToResolvedStage({
      ...state,
      setActiveTabState: get().setActiveTabState,
    });
  },
  openLifetimeOffer: ({
    returnStage,
    screenKey = null,
    triggerMode = "contextual",
  } = {}) => {
    const currentStage = get().stage;
    const fallbackStage: PaywallExitStage =
      currentStage === "paywall" ||
      currentStage === "hosted-paywall" ||
      currentStage === "spin-wheel" ||
      currentStage === "discount-offer" ||
      currentStage === "lifetime-offer"
        ? getPostAuthDestinationStage(get().session)
        : (currentStage as PaywallExitStage);
    const nextReturnStage: PaywallExitStage =
      returnStage &&
      returnStage !== "paywall" &&
      returnStage !== "hosted-paywall" &&
      returnStage !== "spin-wheel" &&
      returnStage !== "discount-offer" &&
      returnStage !== "lifetime-offer"
        ? (returnStage as PaywallExitStage)
        : fallbackStage;

    set({
      paywallReturnStage: nextReturnStage,
      activePaywallPlacementKey: "profile_upgrade_banner",
      activePaywallScreenKey: screenKey,
      activePaywallTriggerMode: triggerMode,
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      pendingPostAuthDiscountOffer: false,
      stage: "lifetime-offer",
    });

    resetRoot("LifetimeOffer");
  },
  openPaywall: returnStage => {
    const currentStage = get().stage;
    const fallbackStage: PaywallExitStage =
      currentStage === "paywall" ||
      currentStage === "hosted-paywall" ||
      currentStage === "spin-wheel" ||
      currentStage === "discount-offer" ||
      currentStage === "lifetime-offer"
        ? getPostAuthDestinationStage(get().session)
        : (currentStage as PaywallExitStage);
    const nextReturnStage: PaywallExitStage =
      returnStage &&
      returnStage !== "paywall" &&
      returnStage !== "hosted-paywall" &&
      returnStage !== "spin-wheel" &&
      returnStage !== "discount-offer" &&
      returnStage !== "lifetime-offer"
        ? (returnStage as PaywallExitStage)
        : fallbackStage;

    set({
      paywallReturnStage: nextReturnStage,
      activePaywallPlacementKey: null,
      activePaywallScreenKey: null,
      activePaywallTriggerMode: "contextual",
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      pendingPostAuthDiscountOffer: false,
      stage: "paywall",
    });

    resetRoot("Paywall");
  },
  openPaywallForPlacement: ({
    placementKey,
    returnStage,
    screenKey = null,
    triggerMode = "contextual",
    enablePostAuthDiscountOffer = false,
  }) => {
    const shouldUseHostedPaywall = shouldUseHostedPaywallForPlacement(placementKey);
    const currentStage = get().stage;
    const fallbackStage: PaywallExitStage =
      currentStage === "paywall" ||
      currentStage === "hosted-paywall" ||
      currentStage === "spin-wheel" ||
      currentStage === "discount-offer" ||
      currentStage === "lifetime-offer"
        ? getPostAuthDestinationStage(get().session)
        : (currentStage as PaywallExitStage);
    const nextReturnStage: PaywallExitStage =
      returnStage &&
      returnStage !== "paywall" &&
      returnStage !== "hosted-paywall" &&
      returnStage !== "spin-wheel" &&
      returnStage !== "discount-offer" &&
      returnStage !== "lifetime-offer"
        ? (returnStage as PaywallExitStage)
        : fallbackStage;

    set({
      paywallReturnStage: nextReturnStage,
      activePaywallPlacementKey: placementKey,
      activePaywallScreenKey: screenKey,
      activePaywallTriggerMode: triggerMode,
      activeHostedPaywallTarget: shouldUseHostedPaywall ? "main" : null,
      postAuthPaywallStepOverride: null,
      pendingPostAuthDiscountOffer: enablePostAuthDiscountOffer,
      stage: shouldUseHostedPaywall ? "hosted-paywall" : "paywall",
    });

    resetRoot(shouldUseHostedPaywall ? "HostedPaywall" : "Paywall");
  },
  setPaywallContext: ({ placementKey, screenKey = null, triggerMode = "contextual" }) => {
    set({
      activePaywallPlacementKey: placementKey,
      activePaywallScreenKey: screenKey,
      activePaywallTriggerMode: triggerMode,
    });
  },
  clearPaywallContext: () => {
    set({
      activePaywallPlacementKey: null,
      activePaywallScreenKey: null,
      activePaywallTriggerMode: "contextual",
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      pendingPostAuthDiscountOffer: false,
    });
  },
  continueWithEmail: async () => {
    set({
      authSource: "email",
      stage: "create-account",
    });

    navigateRoot("CreateAccount");
  },
  continueWithApple: async () => {
    const credential = await getAppleSignInCredential();

    if (!credential) {
      return;
    }

    const onboardingData = get().onboardingData;
    const onboardingContext = buildOnboardingContext(onboardingData);

    const response = await signInWithApple({
      identityToken: credential.identityToken,
      nonce: credential.nonce,
      ...(credential.email ? { email: credential.email } : {}),
      ...(credential.fullName ? { fullName: credential.fullName } : {}),
      ...(onboardingContext ? { onboardingContext } : {}),
      onboardingCompleted: true,
    });

    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    const syncedSession = await syncPendingPremiumIfNeeded(
      response,
      get().pendingPremiumActivation
    );

    await saveOnboardingCompleted(Boolean(syncedSession.user.onboardingCompleted));
    await syncReminderStateAfterAuth(onboardingData);
    const nextStage = getPostAuthDestinationStage(syncedSession);
    const showPaywall = shouldShowPostAuthPaywall(syncedSession);

    if (showPaywall) {
      await savePostAuthPaywallSeen(true);
    }

    set({
      authSource: "apple",
      pendingEmail: syncedSession.user.email || "",
      paywallReturnStage: showPaywall ? nextStage : null,
      activePaywallPlacementKey: showPaywall ? "post_auth" : null,
      activePaywallScreenKey: showPaywall ? "auth" : null,
      activePaywallTriggerMode: "contextual",
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      pendingPostAuthDiscountOffer: showPaywall,
      session: syncedSession,
      initialProfileName: syncedSession.user.name || "Journal User",
      pendingPremiumActivation: false,
      preferredInsightsTab: null,
      activeTab: "home",
      stage: showPaywall ? "paywall" : nextStage,
    });

    if (showPaywall) {
      resetRoot("Paywall");
      return;
    }

    if (nextStage === "profile") {
      resetToProfileSetup();
      return;
    }

    resetRoot("MainApp", {
      screen: "Home",
    });
  },
  continueWithGoogle: async () => {
    const idToken = await getGoogleIdToken();

    if (!idToken) {
      return;
    }

    const onboardingData = get().onboardingData;
    const onboardingContext = buildOnboardingContext(onboardingData);

    const response = await signInWithGoogle({
      idToken,
      ...(onboardingContext ? { onboardingContext } : {}),
      onboardingCompleted: true,
    });

    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    const syncedSession = await syncPendingPremiumIfNeeded(
      response,
      get().pendingPremiumActivation
    );

    await saveOnboardingCompleted(Boolean(syncedSession.user.onboardingCompleted));
    await syncReminderStateAfterAuth(onboardingData);
    const nextStage = getPostAuthDestinationStage(syncedSession);
    const showPaywall = shouldShowPostAuthPaywall(syncedSession);

    if (showPaywall) {
      await savePostAuthPaywallSeen(true);
    }

    set({
      authSource: "google",
      pendingEmail: syncedSession.user.email || "",
      paywallReturnStage: showPaywall ? nextStage : null,
      activePaywallPlacementKey: showPaywall ? "post_auth" : null,
      activePaywallScreenKey: showPaywall ? "auth" : null,
      activePaywallTriggerMode: "contextual",
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      pendingPostAuthDiscountOffer: showPaywall,
      session: syncedSession,
      initialProfileName: syncedSession.user.name || "Journal User",
      pendingPremiumActivation: false,
      preferredInsightsTab: null,
      activeTab: "home",
      stage: showPaywall ? "paywall" : nextStage,
    });

    if (showPaywall) {
      resetRoot("Paywall");
      return;
    }

    if (nextStage === "profile") {
      resetToProfileSetup();
      return;
    }

    resetRoot("MainApp", {
      screen: "Home",
    });
  },
  goToSignIn: () => {
    set({ stage: "sign-in" });

    navigateRoot("SignIn");
  },
  goToCreateAccount: () => {
    set({ stage: "create-account" });

    navigateRoot("CreateAccount");
  },
  createAccount: async payload => {
    const normalizedEmail = payload.email.trim();

    set({
      authSource: "email",
      pendingEmail: normalizedEmail,
    });

    const response = await signUpWithEmail({
      email: normalizedEmail,
      password: payload.password,
      onboardingContext: buildOnboardingContext(get().onboardingData),
      onboardingCompleted: true,
    });

    set({
      pendingEmail: response.email,
    });
  },
  finishCreateAccount: () => {
    set({ stage: "verify-email" });

    navigateRoot("VerifyEmail");
  },
  resendVerificationCode: async () => {
    const { pendingEmail } = get();

    if (!pendingEmail) {
      throw new Error("Please create an account first.");
    }

    await resendEmailVerification({
      email: pendingEmail,
    });
  },
  verifyPendingEmail: async code => {
    const { onboardingData, pendingEmail } = get();

    if (!pendingEmail) {
      throw new Error("Please create an account first.");
    }

    const response = await verifyEmail(
      {
        email: pendingEmail,
        code,
      },
      {
        onboardingGoals: onboardingData?.goals,
        onboardingAiOptIn: onboardingData?.aiComfort,
        onboardingCompleted: true,
      }
    );

    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    const syncedSession = await syncPendingPremiumIfNeeded(
      response,
      get().pendingPremiumActivation
    );

    const updatedSession: AuthSession = {
      ...syncedSession,
      user: {
        ...syncedSession.user,
        journalingGoals:
          onboardingData?.goals?.length
            ? onboardingData.goals
            : syncedSession.user.journalingGoals,
      },
    };

    await saveOnboardingCompleted(true);
    await syncReminderStateAfterAuth(onboardingData);

    set({
      session: updatedSession,
      initialProfileName: updatedSession.user.name,
      pendingPremiumActivation: false,
    });
  },
  finishEmailVerification: async () => {
    const state = get();
    const nextStage = getPostAuthDestinationStage(state.session);
    const showPaywall = shouldShowPostAuthPaywall(state.session);

    if (showPaywall) {
      await savePostAuthPaywallSeen(true);
    }

    set({
      paywallReturnStage: showPaywall ? nextStage : null,
      activePaywallPlacementKey: showPaywall ? "post_auth" : null,
      activePaywallScreenKey: showPaywall ? "verify-email" : null,
      activePaywallTriggerMode: "contextual",
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      pendingPostAuthDiscountOffer: showPaywall,
      stage: showPaywall ? "paywall" : nextStage,
    });

    if (showPaywall) {
      resetRoot("Paywall");
      return;
    }

    if (nextStage === "profile") {
      resetToProfileSetup();
      return;
    }

    resetRoot("MainApp", {
      screen: "Home",
    });
  },
  signIn: async payload => {
    let response: AuthSession;
    const onboardingData = get().onboardingData;
    const onboardingContext = buildOnboardingContext(onboardingData);

    try {
      response = await signInWithEmail({
        ...payload,
        ...(onboardingContext ? { onboardingContext } : {}),
        onboardingCompleted: true,
      });
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "EMAIL_NOT_VERIFIED") {
        throw error;
      }

      const pendingEmail = payload.email.trim();

      set({
        authSource: "email",
        pendingEmail,
        stage: "verify-email",
      });

      navigateRoot("VerifyEmail");

      await resendEmailVerification({
        email: pendingEmail,
      }).catch(resendError => {
        if (__DEV__) {
          console.warn(
            `[Auth] Unable to resend verification code after sign-in ${JSON.stringify({
              email: pendingEmail,
              message:
              resendError instanceof Error
                ? resendError.message
                : "Unknown resend failure",
            })}`
          );
        }
      });

      return;
    }

    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    const syncedSession = await syncPendingPremiumIfNeeded(
      response,
      get().pendingPremiumActivation
    );

    await saveOnboardingCompleted(Boolean(syncedSession.user.onboardingCompleted));
    await syncReminderStateAfterAuth(onboardingData);
    const nextStage = getPostAuthDestinationStage(syncedSession);
    const showPaywall = shouldShowPostAuthPaywall(syncedSession);

    if (showPaywall) {
      await savePostAuthPaywallSeen(true);
    }

    set({
      session: syncedSession,
      pendingEmail: syncedSession.user.email || payload.email,
      authSource: "email",
      initialProfileName: syncedSession.user.name,
      paywallReturnStage: showPaywall ? nextStage : null,
      activePaywallPlacementKey: showPaywall ? "post_auth" : null,
      activePaywallScreenKey: showPaywall ? "auth" : null,
      activePaywallTriggerMode: "contextual",
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      pendingPostAuthDiscountOffer: showPaywall,
      pendingPremiumActivation: false,
      preferredInsightsTab: null,
      activeTab: "home",
      stage: showPaywall ? "paywall" : nextStage,
    });

    if (showPaywall) {
      resetRoot("Paywall");
      return;
    }

    if (nextStage === "profile") {
      resetToProfileSetup();
      return;
    }

    resetRoot("MainApp", {
      screen: "Home",
    });
  },
  completeProfile: async payload => {
    const updatedProfile = await updateProfile({
      name: payload.name,
      avatarColor: payload.avatarColor,
      goals: getSelectedGoals(get()),
    });

    await saveOnboardingCompleted(true);

    enterHomeWithProfile(set, get, updatedProfile);
  },
  signOut: async () => {
    try {
      await logout();
    } catch {
      // Sign-out must still complete locally even if the backend session is already gone.
    }

    await cancelFreeTrialEndingReminder().catch(() => undefined);
    await clearTokens();
    await clearStoredOnboardingData();

    set({
      ...createInitialJournalSliceState(),
      stage: "auth",
      activeTab: "home",
      paywallReturnStage: null,
      activePaywallPlacementKey: null,
      activePaywallScreenKey: null,
      activePaywallTriggerMode: "contextual",
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      pendingPostAuthDiscountOffer: false,
      preferredInsightsTab: null,
      isCompletingOnboarding: false,
      onboardingData: null,
      pendingEmail: "",
      authSource: null,
      session: null,
      initialProfileName: "",
      selectedJournalEntryId: null,
      pendingNewEntryPrompt: null,
      pendingPremiumActivation: false,
    });

    resetRoot("AuthChoice");
  },
  goBackToAuth: () => {
    set({ stage: "auth" });

    goBackOrFallback(() => resetRoot("AuthChoice"));
  },
  goBackToCreateAccount: () => {
    set({ stage: "create-account" });

    goBackOrFallback(() => resetRoot("CreateAccount"));
  },
  skipProfileSetup: async () => {
    const state = get();
    const fallbackName =
      state.initialProfileName || state.session?.user.name || "Journal User";
    const avatarColor = state.session?.user.avatarColor || "#8E4636";

    const updatedProfile = await updateProfile({
      name: fallbackName,
      avatarColor,
      goals: getSelectedGoals(state),
    });

    await saveOnboardingCompleted(true);

    enterHomeWithProfile(set, get, updatedProfile);
  },
  restartFlow: () => {
    set(createInitialSnapshot());

    resetRoot("Onboarding");
  },
  setActiveTabState: nextTab => {
    set({
      activeTab: nextTab,
      preferredInsightsTab: nextTab === "insights" ? get().preferredInsightsTab : null,
    });
  },
  setActiveTab: nextTab => {
    set({
      activeTab: nextTab,
      preferredInsightsTab: nextTab === "insights" ? get().preferredInsightsTab : null,
    });

    replaceMainApp(getMainAppRouteForTab(nextTab));
  },
  openInsightsTab: (nextTab = "overview") => {
    set({
      activeTab: "insights",
      preferredInsightsTab: nextTab,
      stage: "main-app",
    });

    replaceMainApp("Insights");
  },
  clearPreferredInsightsTab: () => {
    set({ preferredInsightsTab: null });
  },
  openNewEntry: options => {
    set({
      stage: "new-entry",
      pendingNewEntryPrompt: normalizeNewEntryPrompt(options?.initialPrompt),
    });

    navigateMainApp("NewEntry", {
      initialPrompt: normalizeNewEntryPrompt(options?.initialPrompt),
    });
  },
  closeNewEntry: () => {
    set({ stage: "main-app", pendingNewEntryPrompt: null });

    goBackOrFallback(() =>
      resetRoot("MainApp", {
        screen: getMainAppRouteForTab(get().activeTab),
      })
    );
  },
  openJournalEntry: entryId => {
    set({
      selectedJournalEntryId: entryId,
      pendingNewEntryPrompt: null,
      stage: "journal-detail",
    });

    navigateMainApp("EntryDetail", {
      entryId,
    });
  },
  openJournalEditor: entryId => {
    set({
      selectedJournalEntryId: entryId,
      pendingNewEntryPrompt: null,
      stage: "journal-edit",
    });

    navigateMainApp("EditEntry", {
      entryId,
    });
  },
  closeJournalEntry: () => {
    const nextTab = get().activeTab;

    set({
      selectedJournalEntryId: null,
      pendingNewEntryPrompt: null,
      stage: "main-app",
    });

    goBackOrFallback(() =>
      resetRoot("MainApp", {
        screen: getMainAppRouteForTab(nextTab),
      })
    );
  },
  closeJournalEditor: () => {
    const hasEntry = Boolean(get().selectedJournalEntryId);

    set(state => ({
      pendingNewEntryPrompt: null,
      stage: state.selectedJournalEntryId ? "journal-detail" : "main-app",
    }));

    goBackOrFallback(() =>
      resetRoot("MainApp", {
        screen: hasEntry ? "EntryDetail" : getMainAppRouteForTab(get().activeTab),
      })
    );
  },
  returnHomeFromJournalFlow: () => {
    set({
      activeTab: "home",
      preferredInsightsTab: null,
      selectedJournalEntryId: null,
      pendingNewEntryPrompt: null,
      stage: "main-app",
    });

    resetRoot("MainApp", {
      screen: "Home",
    });
  },
  setThemeModeOverride: nextMode => {
    set({ themeModeOverride: nextMode });
  },
  setHideJournalPreviews: async nextValue => {
    await saveHideJournalPreviews(nextValue);
    set({ hideJournalPreviews: nextValue });
  },
  openLegalBrowser: ({ url, title = null }) => {
    set({
      legalBrowserUrl: url,
      legalBrowserTitle: title,
    });

    navigateRoot("LegalBrowserModal");
  },
  closeLegalBrowser: () => {
    set({
      legalBrowserUrl: null,
      legalBrowserTitle: null,
    });

    goBackOrFallback(() => undefined);
  },
  setSessionAiOptIn: nextValue => {
    const currentSession = get().session;

    if (!currentSession) {
      return;
    }

    set({
      session: {
        ...currentSession,
        user: {
          ...currentSession.user,
          aiOptIn: nextValue,
        },
      },
    });
  },
  setSessionPremiumStatus: async nextValue => {
    const currentSession = get().session;

    if (!currentSession) {
      set({ pendingPremiumActivation: nextValue });
      return;
    }

    if (currentSession.user.isPremium === nextValue) {
      set({ pendingPremiumActivation: false });
      return;
    }

    const updatedProfile = await updatePremiumStatus({ isPremium: nextValue });

    if (!nextValue) {
      cancelFreeTrialEndingReminder().catch(() => undefined);
    }

    set({
      pendingPremiumActivation: false,
      session: {
        ...currentSession,
        user: {
          ...updatedProfile,
        },
      },
      initialProfileName: updatedProfile.name,
    });
  },
  setSessionUserProfile: nextProfile => {
    const currentSession = get().session;

    if (!currentSession) {
      return;
    }

    set({
      session: {
        ...currentSession,
        user: nextProfile,
      },
      initialProfileName: nextProfile.name,
      pendingPremiumActivation: false,
    });
  },
}));

export const resetAppStore = () => {
  useAppStore.setState(createInitialSnapshot());
};
