import { create } from "zustand";
import type { BottomNavKey } from "../components/BottomNav";
import type { AuthEntrySource, FlowStage } from "../navigation/appFlow";
import type { OnboardingCompletionData } from "../screens/onboarding/OnboardingScreen";
import {
  resendEmailVerification,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  verifyEmail,
  type AuthOnboardingContext,
  type AuthSession,
} from "../services/authService";
import { updateProfile } from "../services/userService";
import type { ThemeMode } from "../theme/theme";
import { saveTokens } from "../utils/tokenStorage";
import devLaunchConfig from "../utils/devLaunchConfig.json";
import { calendarSampleJournalEntries } from "../models/calendarModels";
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
  isCompletingOnboarding: boolean;
  onboardingData: OnboardingCompletionData | null;
  pendingEmail: string;
  pendingVerificationCode: string;
  authSource: AuthEntrySource | null;
  session: AuthSession | null;
  initialProfileName: string;
  themeModeOverride: ThemeMode | null;
  selectedJournalEntryId: string | null;
} & JournalSliceState & {
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
  goBackToAuth: () => void;
  goBackToCreateAccount: () => void;
  goBackFromProfile: () => void;
  skipProfileSetup: () => Promise<void>;
  restartFlow: () => void;
  setActiveTab: (nextTab: BottomNavKey) => void;
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
  | "isCompletingOnboarding"
  | "onboardingData"
  | "pendingEmail"
  | "pendingVerificationCode"
  | "authSource"
  | "session"
  | "initialProfileName"
  | "themeModeOverride"
  | "selectedJournalEntryId"
  | "recentJournalEntries"
>;

const createInitialSnapshot = (): AppStoreSnapshot => ({
  stage: getInitialStage(),
  activeTab: getInitialTab(),
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
  ...createInitialJournalSliceState(calendarSampleJournalEntries),
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

export const useAppStore = create<AppStoreState>((set, get) => ({
  ...createInitialSnapshot(),
  ...createJournalSlice(
    set as Parameters<typeof createJournalSlice>[0],
    calendarSampleJournalEntries
  ),
  completeOnboarding: async data => {
    set({
      isCompletingOnboarding: true,
      onboardingData: data,
    });

    await wait(ONBOARDING_EXIT_DELAY_MS);

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
    const response = await signInWithGoogle({
      googleIdToken: "mock-google-token",
      email: "alex.rivera@example.com",
      name: "Alex Rivera",
    });

    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    set({
      authSource: "google",
      pendingEmail: response.user.email || "alex.rivera@example.com",
      pendingVerificationCode: "",
      session: response,
      initialProfileName: response.user.name || "Alex Rivera",
      stage: "profile",
    });
  },
  goToSignIn: () => {
    set({ stage: "sign-in" });
  },
  skipToHome: () => {
    set({
      activeTab: "home",
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

    set({
      session: updatedSession,
      initialProfileName: updatedSession.user.name,
    });
  },
  finishEmailVerification: () => {
    set({ stage: "profile" });
  },
  signIn: async payload => {
    const response = await signInWithEmail(payload);

    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    if (response.user.profileSetupCompleted) {
      set({
        session: response,
        pendingEmail: response.user.email || payload.email,
        authSource: "email",
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

    enterHomeWithProfile(set, get, updatedProfile);
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

    enterHomeWithProfile(set, get, updatedProfile);
  },
  restartFlow: () => {
    set(createInitialSnapshot());
  },
  setActiveTab: nextTab => {
    set({ activeTab: nextTab });
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
