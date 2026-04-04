import { create } from "zustand";
import type { BottomNavKey } from "../components/BottomNav";
import type { AuthEntrySource, FlowStage } from "../navigation/appFlow";
import type { OnboardingCompletionData } from "../screens/onboarding/OnboardingScreen";
import {
  resendEmailVerification,
  logout,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  verifyEmail,
  type AuthOnboardingContext,
  type AuthSession,
} from "../services/authService";
import { getGoogleIdToken } from "../config/googleSignIn";
import { getProfile, updateProfile } from "../services/userService";
import type { ThemeMode } from "../theme/theme";
import { ApiError } from "../utils/apiClient";
import {
  clearTokens,
  getOnboardingCompleted,
  hasSeenInstall,
  getTokens,
  markInstallSeen,
  saveOnboardingCompleted,
  saveTokens,
} from "../utils/tokenStorage";
import devLaunchConfig from "../utils/devLaunchConfig.json";
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

const normalizeOptionalValue = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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

type AppStoreState = {
  stage: FlowStage;
  activeTab: BottomNavKey;
  preferredInsightsTab: "overview" | "analysis" | null;
  isCompletingOnboarding: boolean;
  onboardingData: OnboardingCompletionData | null;
  pendingEmail: string;
  pendingVerificationCode: string;
  authSource: AuthEntrySource | null;
  session: AuthSession | null;
  initialProfileName: string;
  themeModeOverride: ThemeMode | null;
  selectedJournalEntryId: string | null;
  hasBootstrappedAuthGate: boolean;
} & JournalSliceState & {
  bootstrapAuthGate: () => Promise<void>;
  completeOnboarding: (data: OnboardingCompletionData) => Promise<void>;
  continueWithEmail: () => Promise<void>;
  continueWithGoogle: () => Promise<void>;
  goToSignIn: () => void;
  skipToHome: () => void;
  goToCreateAccount: () => void;
  createAccount: (payload: {
    email: string;
    password: string;
  }) => Promise<void>;
  finishCreateAccount: () => void;
  resendVerificationCode: () => Promise<void>;
  verifyPendingEmail: (code: string) => Promise<void>;
  finishEmailVerification: () => void;
  signIn: (payload: { email: string; password: string }) => Promise<void>;
  completeProfile: (payload: {
    name: string;
    avatarColor: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  goBackToAuth: () => void;
  goBackToCreateAccount: () => void;
  goBackFromProfile: () => void;
  skipProfileSetup: () => Promise<void>;
  restartFlow: () => void;
  setActiveTab: (nextTab: BottomNavKey) => void;
  openInsightsTab: (nextTab?: "overview" | "analysis") => void;
  clearPreferredInsightsTab: () => void;
  openNewEntry: () => void;
  closeNewEntry: () => void;
  openJournalEntry: (entryId: string) => void;
  openJournalEditor: (entryId: string) => void;
  closeJournalEntry: () => void;
  closeJournalEditor: () => void;
  setThemeModeOverride: (nextMode: ThemeMode | null) => void;
};

type AppStoreSnapshot = Pick<
  AppStoreState,
  | "stage"
  | "activeTab"
  | "preferredInsightsTab"
  | "isCompletingOnboarding"
  | "onboardingData"
  | "pendingEmail"
  | "pendingVerificationCode"
  | "authSource"
  | "session"
  | "initialProfileName"
  | "themeModeOverride"
  | "selectedJournalEntryId"
  | "hasBootstrappedAuthGate"
  | "recentJournalEntries"
>;

const createInitialSnapshot = (): AppStoreSnapshot => ({
  stage: getInitialStage(),
  activeTab: getInitialTab(),
  preferredInsightsTab: null,
  isCompletingOnboarding: false,
  onboardingData: null,
  pendingEmail:
    __DEV__ && devLaunchConfig.stage === "profile"
      ? devLaunchConfig.email || "debug@example.com"
      : "",
  pendingVerificationCode: "",
  authSource: __DEV__ && devLaunchConfig.stage === "profile" ? "email" : null,
  session: null,
  initialProfileName: "",
  themeModeOverride: null,
  selectedJournalEntryId: null,
  hasBootstrappedAuthGate: false,
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
};

const getSelectedGoals = (state: Pick<AppStoreState, "onboardingData">) =>
  state.onboardingData?.goals || [];

const isUnauthorizedProfileError = (error: unknown) =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

export const useAppStore = create<AppStoreState>((set, get) => ({
  ...createInitialSnapshot(),
  ...createJournalSlice(
    set as Parameters<typeof createJournalSlice>[0]
  ),
  bootstrapAuthGate: async () => {
    if (get().hasBootstrappedAuthGate) {
      return;
    }

    if (__DEV__ && devLaunchConfig.stage && devLaunchConfig.stage !== "onboarding") {
      set({ hasBootstrappedAuthGate: true });
      return;
    }

    const installSeen = await hasSeenInstall();

    if (!installSeen) {
      await markInstallSeen();
      await clearTokens();
      await saveOnboardingCompleted(false);

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

        set({
          hasBootstrappedAuthGate: true,
          session: hydratedSession,
          initialProfileName: profile.name,
          authSource: profile.email ? "email" : null,
          pendingEmail: profile.email || "",
          pendingVerificationCode: "",
          preferredInsightsTab: null,
          activeTab: "home",
          stage: "main-app",
        });
        return;
      } catch (error) {
        if (isUnauthorizedProfileError(error)) {
          await clearTokens();
        }

        const onboardingCompleted = await getOnboardingCompleted();

        set({
          hasBootstrappedAuthGate: true,
          session: null,
          initialProfileName: "",
          authSource: null,
          pendingEmail: "",
          pendingVerificationCode: "",
          preferredInsightsTab: null,
          activeTab: "home",
          stage: onboardingCompleted ? "auth" : "onboarding",
        });
        return;
      }
    }

    const onboardingCompleted = await getOnboardingCompleted();

    set({
      hasBootstrappedAuthGate: true,
      stage: onboardingCompleted ? "auth" : "onboarding",
    });
  },
  completeOnboarding: async data => {
    set({
      isCompletingOnboarding: true,
      onboardingData: data,
    });

    const saveOnboardingCompletedPromise = saveOnboardingCompleted(true);
    await wait(ONBOARDING_EXIT_DELAY_MS);
    await saveOnboardingCompletedPromise;

    set({
      isCompletingOnboarding: false,
      stage: "auth",
    });
  },
  continueWithEmail: async () => {
    set({
      authSource: "email",
      stage: "create-account",
    });
  },
  continueWithGoogle: async () => {
    const idToken = await getGoogleIdToken();

    if (!idToken) {
      return;
    }

    const response = await signInWithGoogle({
      idToken,
      onboardingCompleted: true,
    });

    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });
    await saveOnboardingCompleted(Boolean(response.user.onboardingCompleted));

    set({
      authSource: "google",
      pendingEmail: response.user.email || "",
      pendingVerificationCode: "",
      session: response,
      initialProfileName: response.user.name || "Journal User",
      preferredInsightsTab: null,
      activeTab: "home",
      stage: response.user.profileSetupCompleted ? "main-app" : "profile",
    });
  },
  goToSignIn: () => {
    set({ stage: "sign-in" });
  },
  skipToHome: () => {
    set({
      activeTab: "home",
      preferredInsightsTab: null,
      stage: "main-app",
    });
  },
  goToCreateAccount: () => {
    set({ stage: "create-account" });
  },
  createAccount: async payload => {
    const normalizedEmail = payload.email.trim();

    set({
      authSource: "email",
      pendingEmail: normalizedEmail,
      pendingVerificationCode: "",
    });

    const response = await signUpWithEmail({
      email: normalizedEmail,
      password: payload.password,
      onboardingContext: buildOnboardingContext(get().onboardingData),
      onboardingCompleted: true,
    });

    set({
      pendingEmail: response.email,
      pendingVerificationCode: response.verificationCode || "",
    });
  },
  finishCreateAccount: () => {
    set({ stage: "verify-email" });
  },
  resendVerificationCode: async () => {
    const { pendingEmail } = get();

    if (!pendingEmail) {
      throw new Error("Please create an account first.");
    }

    const response = await resendEmailVerification({
      email: pendingEmail,
    });

    set({
      pendingVerificationCode: response.verificationCode || "",
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
        onboardingCompleted: true,
      }
    );

    const updatedSession: AuthSession = {
      ...response,
      user: {
        ...response.user,
        journalingGoals:
          onboardingData?.goals?.length
            ? onboardingData.goals
            : response.user.journalingGoals,
      },
    };

    await saveTokens({
      accessToken: updatedSession.accessToken,
      refreshToken: updatedSession.refreshToken,
    });
    await saveOnboardingCompleted(true);

    set({
      session: updatedSession,
      initialProfileName: updatedSession.user.name,
    });
  },
  finishEmailVerification: () => {
    set({ stage: "profile" });
  },
  signIn: async payload => {
    const response = await signInWithEmail({
      ...payload,
      onboardingCompleted: true,
    });

    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });
    await saveOnboardingCompleted(Boolean(response.user.onboardingCompleted));

    if (response.user.profileSetupCompleted) {
      set({
        session: response,
        pendingEmail: response.user.email || payload.email,
        authSource: "email",
        preferredInsightsTab: null,
        activeTab: "home",
        stage: "main-app",
      });
      return;
    }

    set({
      session: response,
      pendingEmail: response.user.email || payload.email,
      authSource: "email",
      initialProfileName: response.user.name,
      stage: "profile",
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

    await clearTokens();

    set({
      ...createInitialJournalSliceState(),
      stage: "auth",
      activeTab: "home",
      preferredInsightsTab: null,
      isCompletingOnboarding: false,
      onboardingData: null,
      pendingEmail: "",
      pendingVerificationCode: "",
      authSource: null,
      session: null,
      initialProfileName: "",
      selectedJournalEntryId: null,
    });
  },
  goBackToAuth: () => {
    set({ stage: "auth" });
  },
  goBackToCreateAccount: () => {
    set({ stage: "create-account" });
  },
  goBackFromProfile: () => {
    set({
      stage: get().authSource === "google" ? "auth" : "verify-email",
    });
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
  },
  setActiveTab: nextTab => {
    set({
      activeTab: nextTab,
      preferredInsightsTab: nextTab === "insights" ? get().preferredInsightsTab : null,
    });
  },
  openInsightsTab: (nextTab = "overview") => {
    set({
      activeTab: "insights",
      preferredInsightsTab: nextTab,
      stage: "main-app",
    });
  },
  clearPreferredInsightsTab: () => {
    set({ preferredInsightsTab: null });
  },
  openNewEntry: () => {
    set({ stage: "new-entry" });
  },
  closeNewEntry: () => {
    set({ stage: "main-app" });
  },
  openJournalEntry: entryId => {
    set({
      selectedJournalEntryId: entryId,
      stage: "journal-detail",
    });
  },
  openJournalEditor: entryId => {
    set({
      selectedJournalEntryId: entryId,
      stage: "journal-edit",
    });
  },
  closeJournalEntry: () => {
    set({
      selectedJournalEntryId: null,
      stage: "main-app",
    });
  },
  closeJournalEditor: () => {
    set(state => ({
      stage: state.selectedJournalEntryId ? "journal-detail" : "main-app",
    }));
  },
  setThemeModeOverride: nextMode => {
    set({ themeModeOverride: nextMode });
  },
}));

export const resetAppStore = () => {
  useAppStore.setState(createInitialSnapshot());
};
