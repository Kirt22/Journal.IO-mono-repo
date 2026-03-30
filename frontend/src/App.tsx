import { type ComponentProps } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppFlowRoutes } from "./navigation/routes";
import ScreenTransitionHost from "./components/ScreenTransition";
import { ThemeProvider, useTheme } from "./theme/provider";
import { useAppStore } from "./store/appStore";

function AppContent() {
  const theme = useTheme();
  const stage = useAppStore(state => state.stage);
  const isCompletingOnboarding = useAppStore(
    state => state.isCompletingOnboarding
  );
  const onboardingData = useAppStore(state => state.onboardingData);
  const pendingEmail = useAppStore(state => state.pendingEmail);
  const pendingVerificationCode = useAppStore(
    state => state.pendingVerificationCode
  );
  const authSource = useAppStore(state => state.authSource);
  const session = useAppStore(state => state.session);
  const initialProfileName = useAppStore(state => state.initialProfileName);
  const completeOnboarding = useAppStore(state => state.completeOnboarding);
  const continueWithEmail = useAppStore(state => state.continueWithEmail);
  const continueWithGoogle = useAppStore(state => state.continueWithGoogle);
  const goToSignIn = useAppStore(state => state.goToSignIn);
  const skipToHome = useAppStore(state => state.skipToHome);
  const goToCreateAccount = useAppStore(state => state.goToCreateAccount);
  const signIn = useAppStore(state => state.signIn);
  const createAccount = useAppStore(state => state.createAccount);
  const finishCreateAccount = useAppStore(state => state.finishCreateAccount);
  const verifyPendingEmail = useAppStore(state => state.verifyPendingEmail);
  const finishEmailVerification = useAppStore(
    state => state.finishEmailVerification
  );
  const resendVerificationCode = useAppStore(
    state => state.resendVerificationCode
  );
  const goBackToAuth = useAppStore(state => state.goBackToAuth);
  const goBackToCreateAccount = useAppStore(
    state => state.goBackToCreateAccount
  );
  const completeProfile = useAppStore(state => state.completeProfile);
  const goBackFromProfile = useAppStore(state => state.goBackFromProfile);
  const skipProfileSetup = useAppStore(state => state.skipProfileSetup);
  const restartFlow = useAppStore(state => state.restartFlow);
  const closeNewEntry = useAppStore(state => state.closeNewEntry);
  const setThemeModeOverride = useAppStore(
    state => state.setThemeModeOverride
  );

  const routeProps = {
    isCompletingOnboarding,
    onboardingData,
    pendingEmail,
    pendingVerificationCode,
    authSource,
    session,
    initialProfileName,
    onOnboardingContinue: completeOnboarding,
    onContinueWithEmail: continueWithEmail,
    onContinueWithGoogle: continueWithGoogle,
    onGoToSignIn: goToSignIn,
    onSkipToHome: skipToHome,
    onGoToCreateAccount: goToCreateAccount,
    onSignIn: signIn,
    onCreateAccount: createAccount,
    onCreateAccountSuccess: finishCreateAccount,
    onVerifyEmail: verifyPendingEmail,
    onVerificationSuccess: finishEmailVerification,
    onResendCode: resendVerificationCode,
    onBackToAuth: goBackToAuth,
    onBackToCreateAccount: goBackToCreateAccount,
    onProfileComplete: completeProfile,
    onBackToVerifyEmail: goBackFromProfile,
    onSkipProfile: skipProfileSetup,
    onRestart: restartFlow,
    onCloseNewEntry: closeNewEntry,
    onToggleTheme: setThemeModeOverride,
  } satisfies Omit<ComponentProps<typeof AppFlowRoutes>, "stage">;

  return (
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
  );
}

function App() {
  const themeModeOverride = useAppStore(state => state.themeModeOverride);

  return (
    <ThemeProvider modeOverride={themeModeOverride}>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
const appStyles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  stageContainer: {
    flex: 1,
    overflow: "hidden",
  },
});
