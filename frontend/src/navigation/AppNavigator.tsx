import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import AuthChoiceScreen from "../screens/auth/AuthChoiceScreen";
import SignInScreen from "../screens/auth/SignInScreen";
import CreateAccountScreen from "../screens/auth/CreateAccountScreen";
import VerifyEmailScreen from "../screens/auth/VerifyEmailScreen";
import { OnboardingScreen } from "../screens/onboarding/OnboardingScreen";
import MainAppShell from "../screens/main/MainAppShell";
import SetupProfileScreen from "../screens/profile/SetupProfileScreen";
import PaywallScreen from "../screens/profile/PaywallScreen";
import HostedRevenueCatPaywallScreen from "../screens/profile/HostedRevenueCatPaywallScreen";
import SpinWheelScreen from "../screens/profile/SpinWheelScreen";
import DiscountOfferPaywallScreen from "../screens/profile/DiscountOfferPaywallScreen";
import LifetimeOfferPaywallScreen from "../screens/profile/LifetimeOfferPaywallScreen";
import InAppBrowserModal from "../components/InAppBrowserModal";
import { useAppStore } from "../store/appStore";
import { useTheme } from "../theme/provider";
import { navigationRef, type RootStackParamList } from "./navigation";

const RootStack = createNativeStackNavigator<RootStackParamList>();

function OnboardingRoute() {
  const isCompleting = useAppStore(state => state.isCompletingOnboarding);
  const completeOnboarding = useAppStore(state => state.completeOnboarding);

  return (
    <OnboardingScreen isCompleting={isCompleting} onContinue={completeOnboarding} />
  );
}

function AuthChoiceRoute() {
  const continueWithEmail = useAppStore(state => state.continueWithEmail);
  const continueWithApple = useAppStore(state => state.continueWithApple);
  const continueWithGoogle = useAppStore(state => state.continueWithGoogle);
  const goToSignIn = useAppStore(state => state.goToSignIn);

  return (
    <AuthChoiceScreen
      onContinueWithEmail={continueWithEmail}
      onContinueWithApple={continueWithApple}
      onContinueWithGoogle={continueWithGoogle}
      onGoToSignIn={goToSignIn}
    />
  );
}

function SignInRoute() {
  const signIn = useAppStore(state => state.signIn);
  const goBackToAuth = useAppStore(state => state.goBackToAuth);
  const goToCreateAccount = useAppStore(state => state.goToCreateAccount);

  return (
    <SignInScreen
      onSubmit={signIn}
      onBackToAuth={goBackToAuth}
      onGoToCreateAccount={goToCreateAccount}
    />
  );
}

function CreateAccountRoute() {
  const createAccount = useAppStore(state => state.createAccount);
  const finishCreateAccount = useAppStore(state => state.finishCreateAccount);
  const goBackToAuth = useAppStore(state => state.goBackToAuth);
  const goToSignIn = useAppStore(state => state.goToSignIn);

  return (
    <CreateAccountScreen
      onSubmit={createAccount}
      onSuccess={finishCreateAccount}
      onBackToAuth={goBackToAuth}
      onGoToSignIn={goToSignIn}
    />
  );
}

function VerifyEmailRoute() {
  const pendingEmail = useAppStore(state => state.pendingEmail);
  const verifyPendingEmail = useAppStore(state => state.verifyPendingEmail);
  const finishEmailVerification = useAppStore(
    state => state.finishEmailVerification
  );
  const resendVerificationCode = useAppStore(
    state => state.resendVerificationCode
  );
  const goBackToCreateAccount = useAppStore(
    state => state.goBackToCreateAccount
  );

  return (
    <VerifyEmailScreen
      email={pendingEmail}
      onVerifyEmail={verifyPendingEmail}
      onVerificationSuccess={finishEmailVerification}
      onResendCode={resendVerificationCode}
      onBackToCreateAccount={goBackToCreateAccount}
    />
  );
}

function SetupProfileRoute() {
  const pendingEmail = useAppStore(state => state.pendingEmail);
  const authSource = useAppStore(state => state.authSource);
  const onboardingData = useAppStore(state => state.onboardingData);
  const initialProfileName = useAppStore(state => state.initialProfileName);
  const completeProfile = useAppStore(state => state.completeProfile);
  const skipProfileSetup = useAppStore(state => state.skipProfileSetup);
  const sessionEmail = useAppStore(state => state.session?.user.email || "");

  return (
    <SetupProfileScreen
      authEmail={pendingEmail || sessionEmail}
      authSource={authSource || "email"}
      onboardingContext={onboardingData}
      initialName={initialProfileName}
      onComplete={completeProfile}
      onSkip={skipProfileSetup}
    />
  );
}

function PaywallRoute() {
  const continueFromPaywall = useAppStore(state => state.continueFromPaywall);

  return <PaywallScreen onBack={continueFromPaywall} />;
}

function HostedPaywallRoute() {
  return <HostedRevenueCatPaywallScreen />;
}

function SpinWheelRoute() {
  return <SpinWheelScreen />;
}

function DiscountOfferRoute() {
  const continueFromDiscountOffer = useAppStore(
    state => state.continueFromDiscountOffer
  );

  return <DiscountOfferPaywallScreen onBack={continueFromDiscountOffer} />;
}

function LifetimeOfferRoute() {
  const continueFromLifetimeOffer = useAppStore(
    state => state.continueFromLifetimeOffer
  );

  return <LifetimeOfferPaywallScreen onBack={continueFromLifetimeOffer} />;
}

function CompleteRoute() {
  const restartFlow = useAppStore(state => state.restartFlow);
  const theme = useTheme();

  return (
    <View
      style={[
        appNavigatorStyles.completeRoot,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <Text
        style={[
          appNavigatorStyles.completeTitle,
          { color: theme.colors.foreground },
        ]}
      >
        Setup complete
      </Text>
      <Text
        style={[
          appNavigatorStyles.completeSubtitle,
          { color: theme.colors.mutedForeground },
        ]}
      >
        Your journaling profile is ready.
      </Text>
      <Text
        onPress={restartFlow}
        style={[
          appNavigatorStyles.completeRestart,
          { color: theme.colors.primary },
        ]}
      >
        Start over
      </Text>
    </View>
  );
}

export function getInitialRouteName(stage: string) {
  switch (stage) {
    case "onboarding":
      return "Onboarding";
    case "auth":
      return "AuthChoice";
    case "sign-in":
      return "SignIn";
    case "create-account":
      return "CreateAccount";
    case "verify-email":
      return "VerifyEmail";
    case "profile":
      return "SetupProfile";
    case "paywall":
      return "Paywall";
    case "hosted-paywall":
      return "HostedPaywall";
    case "spin-wheel":
      return "SpinWheel";
    case "discount-offer":
      return "DiscountOffer";
    case "lifetime-offer":
      return "LifetimeOffer";
    case "complete":
      return "Complete";
    case "main-app":
    default:
      return "MainApp";
  }
}

function getMainAppInitialParams(stage: string) {
  switch (stage) {
    case "new-entry":
      return { screen: "NewEntry" as const };
    case "journal-detail":
      return { screen: "EntryDetail" as const };
    case "journal-edit":
      return { screen: "EditEntry" as const };
    case "main-app":
    default:
      return undefined;
  }
}

export default function AppNavigator() {
  const theme = useTheme();
  const hasBootstrappedAuthGate = useAppStore(
    state => state.hasBootstrappedAuthGate
  );
  const stage = useAppStore(state => state.stage);
  const activeTab = useAppStore(state => state.activeTab);

  if (!hasBootstrappedAuthGate) {
    return (
      <View
        style={[
          appNavigatorStyles.loadingRoot,
          { backgroundColor: theme.colors.background },
        ]}
      />
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator
        initialRouteName={getInitialRouteName(stage)}
        screenOptions={{ headerShown: false }}
      >
        <RootStack.Screen name="Onboarding" component={OnboardingRoute} />
        <RootStack.Screen name="AuthChoice" component={AuthChoiceRoute} />
        <RootStack.Screen name="SignIn" component={SignInRoute} />
        <RootStack.Screen name="CreateAccount" component={CreateAccountRoute} />
        <RootStack.Screen name="VerifyEmail" component={VerifyEmailRoute} />
        <RootStack.Screen name="SetupProfile" component={SetupProfileRoute} />
        <RootStack.Screen name="Paywall" component={PaywallRoute} />
        <RootStack.Screen name="HostedPaywall" component={HostedPaywallRoute} />
        <RootStack.Screen name="SpinWheel" component={SpinWheelRoute} />
        <RootStack.Screen name="DiscountOffer" component={DiscountOfferRoute} />
        <RootStack.Screen name="LifetimeOffer" component={LifetimeOfferRoute} />
        <RootStack.Screen name="Complete" component={CompleteRoute} />
        <RootStack.Screen
          name="MainApp"
          component={MainAppShell}
          initialParams={getMainAppInitialParams(stage) || { screen: activeTab === "calendar" ? "Calendar" : activeTab === "insights" ? "Insights" : activeTab === "profile" ? "Profile" : "Home" }}
        />
        <RootStack.Group
          screenOptions={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        >
          <RootStack.Screen name="LegalBrowserModal" component={InAppBrowserModal} />
        </RootStack.Group>
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const appNavigatorStyles = StyleSheet.create({
  completeRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: "600",
  },
  completeSubtitle: {
    marginTop: 8,
    textAlign: "center",
  },
  completeRestart: {
    marginTop: 16,
    fontWeight: "600",
  },
  loadingRoot: {
    flex: 1,
  },
});
