import { Pressable, StyleSheet, Text, View } from "react-native";
import AuthChoiceScreen from "../screens/auth/AuthChoiceScreen";
import SignInScreen from "../screens/auth/SignInScreen";
import CreateAccountScreen from "../screens/auth/CreateAccountScreen";
import VerifyEmailScreen from "../screens/auth/VerifyEmailScreen";
import NewEntryScreen from "../screens/NewEntryScreen";
import {
  OnboardingScreen,
  type OnboardingCompletionData,
} from "../screens/onboarding/OnboardingScreen";
import type { BottomNavKey } from "../components/BottomNav";
import MainAppShell from "../screens/main/MainAppShell";
import SetupProfileScreen from "../screens/profile/SetupProfileScreen";
import { useTheme } from "../theme/provider";
import type { ThemeMode } from "../theme/theme";
import type { AuthSession } from "../services/authService";

export type FlowStage =
  | "onboarding"
  | "auth"
  | "sign-in"
  | "create-account"
  | "verify-email"
  | "profile"
  | "main-app"
  | "new-entry"
  | "complete";

export type AuthEntrySource = "email" | "google";

type AppFlowRoutesProps = {
  stage: FlowStage;
  isCompletingOnboarding: boolean;
  onboardingData: OnboardingCompletionData | null;
  pendingEmail: string;
  pendingVerificationCode: string;
  authSource: AuthEntrySource | null;
  session: AuthSession | null;
  initialProfileName: string;
  onboardingGoals: string[];
  onOnboardingContinue: (data: OnboardingCompletionData) => void;
  onContinueWithEmail: () => Promise<void>;
  onContinueWithGoogle: () => Promise<void>;
  onGoToSignIn: () => void;
  onSkipToHome: () => void;
  onGoToCreateAccount: () => void;
  onSignIn: (payload: { email: string; password: string }) => Promise<void>;
  onCreateAccount: (payload: { email: string; password: string }) => Promise<void>;
  onCreateAccountSuccess: () => void;
  onVerifyEmail: (code: string) => Promise<void>;
  onVerificationSuccess: () => void;
  onResendCode: () => Promise<void>;
  onBackToAuth: () => void;
  onBackToCreateAccount: () => void;
  onProfileComplete: (payload: { name: string; avatarColor: string }) => Promise<void>;
  onBackToVerifyEmail: () => void;
  onSkipProfile: () => Promise<void>;
  onRestart: () => void;
  activeTab: BottomNavKey;
  onTabChange: (nextTab: BottomNavKey) => void;
  onOpenNewEntry: () => void;
  onCloseNewEntry: () => void;
  onToggleTheme: (nextMode: ThemeMode) => void;
};

export function AppFlowRoutes({
  stage,
  isCompletingOnboarding,
  onboardingData,
  pendingEmail,
  pendingVerificationCode,
  authSource,
  session,
  initialProfileName,
  onboardingGoals,
  onOnboardingContinue,
  onContinueWithEmail,
  onContinueWithGoogle,
  onGoToSignIn,
  onSkipToHome,
  onGoToCreateAccount,
  onSignIn,
  onCreateAccount,
  onCreateAccountSuccess,
  onVerifyEmail,
  onVerificationSuccess,
  onResendCode,
  onBackToAuth,
  onBackToCreateAccount,
  onProfileComplete,
  onBackToVerifyEmail,
  onSkipProfile,
  onRestart,
  activeTab,
  onTabChange,
  onOpenNewEntry,
  onCloseNewEntry,
  onToggleTheme,
}: AppFlowRoutesProps) {
  const selectedGoals = onboardingData?.goals || [];

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
        <AuthChoiceScreen
          onContinueWithEmail={onContinueWithEmail}
          onContinueWithGoogle={onContinueWithGoogle}
          onGoToSignIn={onGoToSignIn}
          onSkipToHome={onSkipToHome}
        />
      );
    case "sign-in":
      return (
        <SignInScreen
          onSubmit={onSignIn}
          onBackToAuth={onBackToAuth}
          onGoToCreateAccount={onGoToCreateAccount}
        />
      );
    case "create-account":
      return (
        <CreateAccountScreen
          onSubmit={onCreateAccount}
          onSuccess={onCreateAccountSuccess}
          onBackToAuth={onBackToAuth}
          onGoToSignIn={onGoToSignIn}
        />
      );
    case "verify-email":
      return (
        <VerifyEmailScreen
          email={pendingEmail}
          debugCode={pendingVerificationCode}
          onVerifyEmail={onVerifyEmail}
          onVerificationSuccess={onVerificationSuccess}
          onResendCode={onResendCode}
          onBackToCreateAccount={onBackToCreateAccount}
        />
      );
    case "profile":
      return (
        <SetupProfileScreen
          authEmail={pendingEmail || session?.user.email || ""}
          authSource={authSource || "email"}
          onboardingContext={onboardingData}
          initialName={initialProfileName}
          onComplete={onProfileComplete}
          onBack={onBackToVerifyEmail}
          onSkip={onSkipProfile}
        />
      );
    case "main-app":
      return (
        <MainAppShell
          activeTab={activeTab}
          onTabChange={onTabChange}
          onOpenNewEntry={onOpenNewEntry}
          userName={session?.user.name || "Journal User"}
          userEmail={session?.user.email}
          userGoals={session?.user.journalingGoals}
          onboardingGoals={onboardingGoals}
          userAvatarColor={session?.user.avatarColor}
          userProfilePic={session?.user.profilePic}
          onToggleTheme={onToggleTheme}
        />
      );
    case "new-entry":
      return <NewEntryScreen onBack={onCloseNewEntry} />;
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
