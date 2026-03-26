import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StatusBar, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  AppFlowRoutes,
  type AuthEntrySource,
  type FlowStage,
} from "./navigation/routes";
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

const SCREEN_TRANSITION_OUT_MS = 130;
const SCREEN_TRANSITION_IN_MS = 240;
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
  const initialStage: FlowStage =
    __DEV__ && devLaunchConfig.stage ? devLaunchConfig.stage : "onboarding";
  const [stage, setStage] = useState<FlowStage>(initialStage);
  const [displayStage, setDisplayStage] = useState<FlowStage>(initialStage);
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
  const transitionOpacity = useRef(new Animated.Value(1)).current;
  const transitionTranslateY = useRef(new Animated.Value(0)).current;

  const selectedGoals = onboardingData?.goals || [];

  const enterHomeWithProfile = (updatedProfile: AuthUser) => {
    if (session) {
      setSession({
        ...session,
        user: updatedProfile,
      });
    }

    setInitialProfileName(updatedProfile.name);
    setStage("home");
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

  useEffect(() => {
    if (stage === displayStage) {
      return;
    }

    Animated.parallel([
      Animated.timing(transitionOpacity, {
        toValue: 0,
        duration: SCREEN_TRANSITION_OUT_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(transitionTranslateY, {
        toValue: -6,
        duration: SCREEN_TRANSITION_OUT_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        return;
      }

      setDisplayStage(stage);
      transitionOpacity.setValue(0);
      transitionTranslateY.setValue(12);

      Animated.parallel([
        Animated.timing(transitionOpacity, {
          toValue: 1,
          duration: SCREEN_TRANSITION_IN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(transitionTranslateY, {
          toValue: 0,
          duration: SCREEN_TRANSITION_IN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [displayStage, stage, transitionOpacity, transitionTranslateY]);

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
      setStage("home");
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
    setPendingEmail("");
    setPendingVerificationCode(FALLBACK_EMAIL_VERIFICATION_CODE);
    setAuthSource(null);
    setOnboardingData(null);
    setSession(null);
    setInitialProfileName("");
    setThemeModeOverride(null);
  };

  const handleNavigate = (nextStage: Extract<FlowStage, "home" | "calendar">) => {
    setStage(nextStage);
  };

  return (
    <ThemeProvider modeOverride={themeModeOverride}>
      <SafeAreaProvider>
        <StatusBar
          barStyle={theme.mode === "dark" ? "light-content" : "dark-content"}
          backgroundColor={theme.colors.background}
        />

        <Animated.View
          style={[
            appStyles.stageContainer,
            {
              opacity: transitionOpacity,
              transform: [{ translateY: transitionTranslateY }],
            },
          ]}
        >
        <AppFlowRoutes
          stage={displayStage}
          isCompletingOnboarding={isCompletingOnboarding}
          onboardingData={onboardingData}
          pendingEmail={pendingEmail}
          pendingVerificationCode={pendingVerificationCode}
          authSource={authSource}
          session={session}
          initialProfileName={initialProfileName}
          onOnboardingContinue={handleOnboardingContinue}
          onContinueWithEmail={handleContinueWithEmail}
          onContinueWithGoogle={handleContinueWithGoogle}
          onGoToSignIn={handleGoToSignIn}
          onGoToCreateAccount={handleGoToCreateAccount}
          onSignIn={handleSignIn}
          onCreateAccount={handleCreateAccount}
          onCreateAccountSuccess={handleCreateAccountSuccess}
          onVerifyEmail={handleVerifyEmail}
            onVerificationSuccess={handleVerificationSuccess}
            onResendCode={handleResendCode}
            onBackToAuth={() => setStage("auth")}
            onBackToCreateAccount={() => setStage("create-account")}
            onProfileComplete={handleProfileComplete}
            onBackToVerifyEmail={() =>
              setStage(authSource === "google" ? "auth" : "verify-email")
            }
          onSkipProfile={handleSkipProfile}
          onRestart={handleRestart}
          onNavigate={handleNavigate}
          onToggleTheme={nextMode => {
            setThemeModeOverride(nextMode);
          }}
          />
        </Animated.View>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const appStyles = StyleSheet.create({
  stageContainer: {
    flex: 1,
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
