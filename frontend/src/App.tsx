import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  StatusBar,
  StyleSheet,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppFlowRoutes, type FlowStage } from "./navigation/routes";
import { resendOtp, sendOtp, verifyOtp } from "./services/authService";
import type { AuthUser } from "./services/authService";
import { updateProfile } from "./services/userService";
import { ThemeProvider, useTheme } from "./theme/provider";
import type { ThemeMode } from "./theme/theme";
import { saveTokens } from "./utils/tokenStorage";
import type { AuthSession } from "./services/authService";

const SCREEN_TRANSITION_OUT_MS = 130;
const SCREEN_TRANSITION_IN_MS = 240;

function AppContent() {
  const theme = useTheme();
  const [stage, setStage] = useState<FlowStage>("onboarding");
  const [displayStage, setDisplayStage] = useState<FlowStage>("onboarding");
  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [initialProfileName, setInitialProfileName] = useState("");
  const [isResendingCode, setIsResendingCode] = useState(false);
  const [themeModeOverride, setThemeModeOverride] = useState<ThemeMode | null>(null);
  const transitionOpacity = useRef(new Animated.Value(1)).current;
  const transitionTranslateY = useRef(new Animated.Value(0)).current;

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
    phoneNumber: session?.user.phoneNumber || phoneNumber || null,
    email: session?.user.email || null,
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

  const handleOnboardingContinue = (goals: string[]) => {
    setIsCompletingOnboarding(true);
    setSelectedGoals(goals);

    setTimeout(() => {
      setIsCompletingOnboarding(false);
      setStage("auth");
    }, 220);
  };

  const handleGooglePress = () => {
    Alert.alert(
      "Google sign-in",
      "Google auth will be added in the next slice."
    );
  };

  const handleSendCode = async (submittedPhoneNumber: string) => {
    const response = await sendOtp({ phoneNumber: submittedPhoneNumber });
    setPhoneNumber(response.phoneNumber);
    setDebugOtp(response.debugOtp || null);
    setStage("otp");
  };

  const handleResendCode = async () => {
    if (!phoneNumber) {
      throw new Error("Please enter a phone number first.");
    }

    setIsResendingCode(true);

    try {
      const response = await resendOtp({ phoneNumber });
      setPhoneNumber(response.phoneNumber);
      setDebugOtp(response.debugOtp || null);
    } finally {
      setIsResendingCode(false);
    }
  };

  const handleVerifyOtp = async (otp: string) => {
    if (__DEV__) {
      setSession({
        accessToken: "debug-access-token",
        refreshToken: "debug-refresh-token",
        user: {
          userId: "debug-user",
          name: "Journal User",
          phoneNumber,
          email: null,
          journalingGoals: selectedGoals,
          avatarColor: "#8E4636",
          profileSetupCompleted: false,
          profilePic: null,
        },
      });
      setInitialProfileName("");
      return;
    }

    const response = await verifyOtp({
      phoneNumber,
      otp,
      // Temporary frontend compatibility for current backend validation.
      name: "Journal User",
      goals: selectedGoals,
    });

    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    setSession(response);
    setInitialProfileName(
      response.user.name === "Journal User" ? "" : response.user.name
    );
  };

  const handleOtpVerificationSuccess = () => {
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
            selectedGoals={selectedGoals}
            phoneNumber={phoneNumber}
            debugOtp={debugOtp}
            isResendingCode={isResendingCode}
            session={session}
            initialProfileName={initialProfileName}
            onOnboardingContinue={handleOnboardingContinue}
            onGooglePress={handleGooglePress}
            onSendCode={handleSendCode}
            onVerifyOtp={handleVerifyOtp}
            onVerificationSuccess={handleOtpVerificationSuccess}
            onResendCode={handleResendCode}
            onBackToAuth={() => setStage("auth")}
            onProfileComplete={handleProfileComplete}
            onBackToOtp={() => setStage("otp")}
            onSkipProfile={handleSkipProfile}
            onRestart={() => {
              setStage("onboarding");
              setPhoneNumber("");
              setDebugOtp(null);
              setSelectedGoals([]);
              setSession(null);
              setInitialProfileName("");
              setThemeModeOverride(null);
            }}
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
