import { useState, type ComponentProps } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  AppFlowRoutes,
  type AuthEntrySource,
  type FlowStage,
} from "./navigation/routes";
import ScreenTransitionHost from "./components/ScreenTransition";
import type { BottomNavKey } from "./components/BottomNav";
import {
  resendEmailVerification,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  verifyEmail,
  type AuthSession,
  type AuthUser,
  type AuthOnboardingContext,
} from "./services/authService";
import { updateProfile } from "./services/userService";
import type { OnboardingCompletionData } from "./screens/onboarding/OnboardingScreen";
import { ThemeProvider, useTheme } from "./theme/provider";
import type { ThemeMode } from "./theme/theme";
import { saveTokens } from "./utils/tokenStorage";
import devLaunchConfig from "./utils/devLaunchConfig.json";

const FALLBACK_EMAIL_VERIFICATION_CODE = "123456";

function buildOnboardingContext(
  data: OnboardingCompletionData | null
): AuthOnboardingContext | undefined {
  if (!data) {
    return undefined;
  }

  return {
    ageRange: data.ageRange,
    journalingExperience: data.journalingExperience,
    goals: data.goals,
    supportFocus: data.supportFocusAreas,
    reminderPreference: data.reminderPreference,
    aiOptIn: data.aiComfort,
    privacyConsentAccepted: data.privacyConsent,
  };
}

function AppContent() {
  const theme = useTheme();
  const launchStage = __DEV__ ? devLaunchConfig.stage : undefined;
  const isFlowStage = (value: string): value is FlowStage =>
    value === "onboarding" ||
    value === "auth" ||
    value === "sign-in" ||
    value === "create-account" ||
    value === "verify-email" ||
    value === "profile" ||
    value === "main-app" ||
    value === "new-entry" ||
    value === "complete";
  const initialStage: FlowStage =
    launchStage === "home" ||
    launchStage === "calendar" ||
    launchStage === "insights"
      ? "main-app"
      : launchStage && isFlowStage(launchStage)
        ? launchStage
        : "onboarding";
  const initialTab: BottomNavKey =
    __DEV__ &&
    (launchStage === "calendar" || devLaunchConfig.activeTab === "calendar")
      ? "calendar"
      : launchStage === "insights" ||
          devLaunchConfig.activeTab === "insights"
        ? "insights"
        : "home";
  const [stage, setStage] = useState<FlowStage>(initialStage);
  const [activeTab, setActiveTab] = useState<BottomNavKey>(initialTab);
  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingCompletionData | null>(null);
  const [pendingEmail, setPendingEmail] = useState(
    __DEV__ && devLaunchConfig.stage === "profile" ? devLaunchConfig.email || "debug@example.com" : ""
  );
  const [pendingVerificationCode, setPendingVerificationCode] = useState(FALLBACK_EMAIL_VERIFICATION_CODE);
  const [authSource, setAuthSource] = useState<AuthEntrySource | null>(
    __DEV__ && devLaunchConfig.stage === "profile" ? "email" : null
  );
  const [session, setSession] = useState<AuthSession | null>(null);
  const [initialProfileName, setInitialProfileName] = useState("");
  const [themeModeOverride, setThemeModeOverride] = useState<ThemeMode | null>(null);
  const selectedGoals = onboardingData?.goals || [];

  const enterHomeWithProfile = (updatedProfile: AuthUser) => {
    if (session) {
      setSession({
        ...session,
        user: updatedProfile,
      });
    }

    setInitialProfileName(updatedProfile.name);
    setActiveTab("home");
    setStage("main-app");
  };

  const buildLocalProfile = (name: string, avatarColor: string): AuthUser => ({
    userId: session?.user.userId || "debug-user",
    name,
    phoneNumber: null,
    email: session?.user.email || pendingEmail || null,
    journalingGoals: selectedGoals,
    avatarColor,
    profileSetupCompleted: true,
    profilePic: session?.user.profilePic || null,
  });

  const handleOnboardingContinue = (data: OnboardingCompletionData) => {
    setIsCompletingOnboarding(true);
    setOnboardingData(data);

    setTimeout(() => {
      setIsCompletingOnboarding(false);
      setStage("auth");
    }, 220);
  };

  const handleContinueWithEmail = async () => {
    setAuthSource("email");
    setStage("create-account");
  };

  const handleContinueWithGoogle = async () => {
    const response = await signInWithGoogle({
      googleIdToken: "mock-google-token",
      email: "alex.rivera@example.com",
      name: "Alex Rivera",
    });

    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    setAuthSource("google");
    setPendingEmail(response.user.email || "alex.rivera@example.com");
    setPendingVerificationCode(FALLBACK_EMAIL_VERIFICATION_CODE);
    setSession(response);
    setInitialProfileName(response.user.name || "Alex Rivera");
    setStage("profile");
  };

  const handleGoToSignIn = () => {
    setStage("sign-in");
  };

  const handleGoToCreateAccount = () => {
    setStage("create-account");
  };

  const handleSkipToHome = () => {
    setActiveTab("home");
    setStage("main-app");
  };

  const handleCreateAccount = async (payload: { email: string; password: string }) => {
    const normalizedEmail = payload.email.trim();

    setAuthSource("email");
    setPendingEmail(normalizedEmail);
    setPendingVerificationCode(FALLBACK_EMAIL_VERIFICATION_CODE);

    const response = await signUpWithEmail({
      email: normalizedEmail,
      password: payload.password,
      onboardingContext: buildOnboardingContext(onboardingData),
    });

    setPendingEmail(response.email);
    setPendingVerificationCode(response.verificationCode || FALLBACK_EMAIL_VERIFICATION_CODE);
  };

  const handleCreateAccountSuccess = () => {
    setStage("verify-email");
  };

  const handleResendCode = async () => {
    if (!pendingEmail) {
      throw new Error("Please create an account first.");
    }

    const response = await resendEmailVerification({
      email: pendingEmail,
    });

    setPendingVerificationCode(
      response.verificationCode || FALLBACK_EMAIL_VERIFICATION_CODE
    );
  };

  const handleVerifyEmail = async (code: string) => {
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
          onboardingData?.goals?.length ? onboardingData.goals : response.user.journalingGoals,
      },
    };

    await saveTokens({
      accessToken: updatedSession.accessToken,
      refreshToken: updatedSession.refreshToken,
    });

    setSession(updatedSession);
    setInitialProfileName(updatedSession.user.name === "Journal User" ? "" : updatedSession.user.name);
  };

  const handleVerificationSuccess = () => {
    setStage("profile");
  };

  const handleSignIn = async (payload: { email: string; password: string }) => {
    const response = await signInWithEmail(payload);

    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    setSession(response);
    setPendingEmail(response.user.email || payload.email);
    setAuthSource("email");

    if (response.user.profileSetupCompleted) {
      setActiveTab("home");
      setStage("main-app");
      return;
    }

    setInitialProfileName(response.user.name === "Journal User" ? "" : response.user.name);
    setStage("profile");
  };

  const handleProfileComplete = async (payload: {
    name: string;
    avatarColor: string;
  }) => {
    if (__DEV__) {
      enterHomeWithProfile(buildLocalProfile(payload.name, payload.avatarColor));
      return;
    }

    try {
      const updatedProfile = await updateProfile({
        name: payload.name,
        avatarColor: payload.avatarColor,
        goals: selectedGoals,
      });

      enterHomeWithProfile(updatedProfile);
    } catch {
      enterHomeWithProfile(buildLocalProfile(payload.name, payload.avatarColor));
    }
  };

  const handleSkipProfile = async () => {
    const fallbackName = initialProfileName || session?.user.name || "Journal User";
    const avatarColor = session?.user.avatarColor || "#8E4636";

    if (__DEV__) {
      enterHomeWithProfile(buildLocalProfile(fallbackName, avatarColor));
      return;
    }

    try {
      const updatedProfile = await updateProfile({
        name: fallbackName,
        avatarColor,
        goals: selectedGoals,
      });

      enterHomeWithProfile(updatedProfile);
    } catch {
      enterHomeWithProfile(buildLocalProfile(fallbackName, avatarColor));
    }
  };

  const handleRestart = () => {
    setStage("onboarding");
    setActiveTab("home");
    setPendingEmail("");
    setPendingVerificationCode(FALLBACK_EMAIL_VERIFICATION_CODE);
    setAuthSource(null);
    setOnboardingData(null);
    setSession(null);
    setInitialProfileName("");
    setThemeModeOverride(null);
  };

  const handleTabChange = (nextTab: BottomNavKey) => {
    setActiveTab(nextTab);
  };

  const handleOpenNewEntry = () => {
    setStage("new-entry");
  };

  const handleCloseNewEntry = () => {
    setStage("main-app");
  };

  const routeProps = {
    isCompletingOnboarding,
    onboardingData,
    pendingEmail,
    pendingVerificationCode,
    authSource,
    session,
    initialProfileName,
    onboardingGoals: selectedGoals,
    onOnboardingContinue: handleOnboardingContinue,
    onContinueWithEmail: handleContinueWithEmail,
    onContinueWithGoogle: handleContinueWithGoogle,
    onGoToSignIn: handleGoToSignIn,
    onSkipToHome: handleSkipToHome,
    onGoToCreateAccount: handleGoToCreateAccount,
    onSignIn: handleSignIn,
    onCreateAccount: handleCreateAccount,
    onCreateAccountSuccess: handleCreateAccountSuccess,
    onVerifyEmail: handleVerifyEmail,
    onVerificationSuccess: handleVerificationSuccess,
    onResendCode: handleResendCode,
    onBackToAuth: () => setStage("auth"),
    onBackToCreateAccount: () => setStage("create-account"),
    onProfileComplete: handleProfileComplete,
    onBackToVerifyEmail: () =>
      setStage(authSource === "google" ? "auth" : "verify-email"),
    onSkipProfile: handleSkipProfile,
    onRestart: handleRestart,
    activeTab,
    onTabChange: handleTabChange,
    onOpenNewEntry: handleOpenNewEntry,
    onCloseNewEntry: handleCloseNewEntry,
    onToggleTheme: (nextMode: ThemeMode) => {
      setThemeModeOverride(nextMode);
    },
  } satisfies Omit<ComponentProps<typeof AppFlowRoutes>, "stage">;

  return (
    <ThemeProvider modeOverride={themeModeOverride}>
      <View style={[appStyles.appRoot, { backgroundColor: theme.colors.background }]}>
        <SafeAreaProvider>
          <StatusBar
            barStyle={theme.mode === "dark" ? "light-content" : "dark-content"}
            backgroundColor={theme.colors.background}
          />

          <View
            style={[
              appStyles.stageContainer,
              { backgroundColor: theme.colors.background },
            ]}
          >
            <ScreenTransitionHost
              activeKey={stage}
              renderContent={currentStage => (
                <AppFlowRoutes
                  stage={currentStage}
                  {...routeProps}
                />
              )}
            />
          </View>
        </SafeAreaProvider>
      </View>
    </ThemeProvider>
  );
}

const appStyles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  stageContainer: {
    flex: 1,
    overflow: "hidden",
  },
});

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
