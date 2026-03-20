import { Pressable, StyleSheet, Text, View } from "react-native";
import EnterPhoneScreen from "../screens/auth/EnterPhoneScreen";
import HomeScreen from "../screens/HomeScreen";
import VerifyOtpScreen from "../screens/auth/VerifyOtpScreen";
import { OnboardingScreen } from "../screens/onboarding/OnboardingScreen";
import SetupProfileScreen from "../screens/profile/SetupProfileScreen";
import { useTheme } from "../theme/provider";
import type { ThemeMode } from "../theme/theme";
import type { AuthSession } from "../services/authService";

export type FlowStage = "onboarding" | "auth" | "otp" | "profile" | "home" | "complete";

type AppFlowRoutesProps = {
  stage: FlowStage;
  isCompletingOnboarding: boolean;
  selectedGoals: string[];
  phoneNumber: string;
  debugOtp: string | null;
  isResendingCode: boolean;
  session: AuthSession | null;
  initialProfileName: string;
  onOnboardingContinue: (goals: string[]) => void;
  onGooglePress: () => void;
  onSendCode: (submittedPhoneNumber: string) => Promise<void>;
  onVerifyOtp: (otp: string) => Promise<void>;
  onVerificationSuccess: () => void;
  onResendCode: () => Promise<void>;
  onBackToAuth: () => void;
  onProfileComplete: (payload: { name: string; avatarColor: string }) => Promise<void>;
  onBackToOtp: () => void;
  onSkipProfile: () => Promise<void>;
  onRestart: () => void;
  onToggleTheme: (nextMode: ThemeMode) => void;
};

export function AppFlowRoutes({
  stage,
  isCompletingOnboarding,
  selectedGoals,
  phoneNumber,
  debugOtp,
  isResendingCode,
  session,
  initialProfileName,
  onOnboardingContinue,
  onGooglePress,
  onSendCode,
  onVerifyOtp,
  onVerificationSuccess,
  onResendCode,
  onBackToAuth,
  onProfileComplete,
  onBackToOtp,
  onSkipProfile,
  onRestart,
  onToggleTheme,
}: AppFlowRoutesProps) {
  switch (stage) {
    case "onboarding":
      return (
        <OnboardingScreen
          isCompleting={isCompletingOnboarding}
          onContinue={onOnboardingContinue}
        />
      );
    case "auth":
      return (
        <EnterPhoneScreen
          onSendCode={onSendCode}
          onGooglePress={onGooglePress}
        />
      );
    case "otp":
      return (
        <VerifyOtpScreen
          phoneNumber={phoneNumber}
          debugOtp={debugOtp}
          isResending={isResendingCode}
          onVerifyOtp={onVerifyOtp}
          onVerificationSuccess={onVerificationSuccess}
          onResendCode={onResendCode}
          onBackToAuth={onBackToAuth}
        />
      );
    case "profile":
      return (
        <SetupProfileScreen
          phoneNumber={phoneNumber}
          selectedGoals={selectedGoals}
          initialName={initialProfileName}
          onComplete={onProfileComplete}
          onBack={onBackToOtp}
          onSkip={onSkipProfile}
        />
      );
    case "home":
      return (
        <HomeScreen
          userName={session?.user.name || "Journal User"}
          onToggleTheme={onToggleTheme}
        />
      );
    case "complete":
      return (
        <CompletionScreen
          session={session}
          selectedGoals={selectedGoals}
          onRestart={onRestart}
        />
      );
    default:
      return null;
  }
}

function CompletionScreen({
  session,
  selectedGoals,
  onRestart,
}: {
  session: AuthSession | null;
  selectedGoals: string[];
  onRestart: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={[completeStyles.container, { backgroundColor: theme.colors.background }]}>
      <View
        style={[
          completeStyles.card,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[completeStyles.title, { color: theme.colors.foreground }]}>
          Profile setup complete
        </Text>
        <Text style={[completeStyles.subtitle, { color: theme.colors.mutedForeground }]}>
          Welcome, {session?.user.name || "Journal User"}. Your selected goals
          will help shape the next step of the flow.
        </Text>

        <View style={completeStyles.goalStrip}>
          {(selectedGoals.length ? selectedGoals : ["Personalized setup"]).map(
            goal => (
              <View
                key={goal}
                style={[
                  completeStyles.goalPill,
                  { backgroundColor: theme.colors.accent, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[completeStyles.goalText, { color: theme.colors.mutedForeground }]}>
                  {goal}
                </Text>
              </View>
            )
          )}
        </View>

        <Pressable onPress={onRestart} style={completeStyles.restartButton}>
          <Text style={[completeStyles.restartText, { color: theme.colors.info }]}>
            Start over
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const completeStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  goalStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 18,
    justifyContent: "center",
  },
  goalPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  goalText: {
    fontSize: 12,
    fontWeight: "600",
  },
  restartButton: {
    marginTop: 18,
    alignItems: "center",
  },
  restartText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
