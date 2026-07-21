import {
  NavigationContainer,
  useNavigation,
  useRoute,
  type LinkingOptions,
  type RouteProp,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import AuthChoiceScreen from '../screens/auth/AuthChoiceScreen';
import SignInScreen from '../screens/auth/SignInScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import CreateAccountScreen from '../screens/auth/CreateAccountScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import OnboardingV2Screen from '../screens/onboarding/OnboardingV2Screen';
import FirstGuidedReflectionScreen from '../screens/onboarding/FirstGuidedReflectionScreen';
import MainAppShell from '../screens/main/MainAppShell';
import SetupProfileScreen from '../screens/profile/SetupProfileScreen';
import PaywallScreen from '../screens/profile/PaywallScreen';
import HostedRevenueCatPaywallScreen from '../screens/profile/HostedRevenueCatPaywallScreen';
import LifetimeOfferPaywallScreen from '../screens/profile/LifetimeOfferPaywallScreen';
import AboutYouScreen from '../screens/profile/AboutYouScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import PrivacyScreen from '../screens/profile/PrivacyScreen';
import BiometricLockScreen from '../screens/profile/BiometricLockScreen';
import AccountScreen from '../screens/profile/AccountScreen';
import {
  SettingsAccountSection,
  SettingsMoreSection,
  SettingsPersonalizationSection,
  SettingsPrivacyDataSection,
  SettingsSignOutSection,
  SettingsSupportSection,
} from '../screens/profile/SettingsScreen';
import SubscriptionScreen from '../screens/profile/SubscriptionScreen';
import ThemeSettingsScreen from '../screens/profile/ThemeSettingsScreen';
import RemindersScreen from '../screens/reminders/RemindersScreen';
import InAppBrowserModal from '../components/InAppBrowserModal';
import { ENABLE_ONBOARDING_V2 } from '../config/onboarding';
import { useAppStore } from '../store/appStore';
import { ThemeTransitionOverlay, useTheme } from '../theme/provider';
import {
  navigateMainApp,
  navigationRef,
  type MainAppStackParamList,
  type ProfileModalStackParamList,
  type RootStackParamList,
} from './navigation';
import { requestPasswordReset, resetPassword } from '../services/authService';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const ProfileModalStack = createNativeStackNavigator<ProfileModalStackParamList>();

const rootLinkingConfig: LinkingOptions<RootStackParamList> = {
  prefixes: ['journalio://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
    },
  },
};

function OnboardingRoute() {
  const isCompleting = useAppStore(state => state.isCompletingOnboarding);
  const completeOnboarding = useAppStore(state => state.completeOnboarding);

  if (ENABLE_ONBOARDING_V2) {
    return <OnboardingV2Screen />;
  }

  return (
    <OnboardingScreen
      isCompleting={isCompleting}
      onContinue={completeOnboarding}
    />
  );
}

function FirstGuidedReflectionRoute() {
  const navigation = useNavigation<
    NativeStackNavigationProp<RootStackParamList, 'FirstGuidedReflection'>
  >();
  const route = useRoute<
    RouteProp<RootStackParamList, 'FirstGuidedReflection'>
  >();

  return (
    <FirstGuidedReflectionScreen
      draft={route.params.draft}
      onAnalysisReady={payload =>
        navigation.replace('FirstReflectionAnalysis', payload)
      }
      onBackToReady={() => navigation.goBack()}
    />
  );
}

function FirstReflectionAnalysisRoute() {
  const navigation = useNavigation<
    NativeStackNavigationProp<RootStackParamList, 'FirstReflectionAnalysis'>
  >();
  const route = useRoute<
    RouteProp<RootStackParamList, 'FirstReflectionAnalysis'>
  >();

  return (
    <FirstGuidedReflectionScreen
      draft={route.params.draft}
      initialAnalysisPayload={route.params}
      onGoalsReady={payload => navigation.replace('FirstReflectionGoals', payload)}
      onBackToReady={() => navigation.goBack()}
    />
  );
}

function FirstReflectionGoalsRoute() {
  const navigation = useNavigation<
    NativeStackNavigationProp<RootStackParamList, 'FirstReflectionGoals'>
  >();
  const route = useRoute<
    RouteProp<RootStackParamList, 'FirstReflectionGoals'>
  >();

  return (
    <FirstGuidedReflectionScreen
      draft={route.params.draft}
      initialGoalsPayload={route.params}
      onStreakReady={payload => navigation.replace('FirstReflectionStreak', payload)}
      onBackToReady={() => navigation.goBack()}
    />
  );
}

function FirstReflectionStreakRoute() {
  const navigation = useNavigation<
    NativeStackNavigationProp<RootStackParamList, 'FirstReflectionStreak'>
  >();
  const route = useRoute<
    RouteProp<RootStackParamList, 'FirstReflectionStreak'>
  >();

  return (
    <FirstGuidedReflectionScreen
      draft={route.params.draft}
      initialStreakPayload={route.params}
      onBackToReady={() => navigation.goBack()}
    />
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
  const goToForgotPassword = useAppStore(state => state.goToForgotPassword);

  return (
    <SignInScreen
      onSubmit={signIn}
      onBackToAuth={goBackToAuth}
      onGoToCreateAccount={goToCreateAccount}
      onForgotPassword={goToForgotPassword}
    />
  );
}

function ForgotPasswordRoute() {
  const goToSignIn = useAppStore(state => state.goToSignIn);

  return (
    <ForgotPasswordScreen
      onSubmit={requestPasswordReset}
      onBackToSignIn={goToSignIn}
    />
  );
}

function ResetPasswordRoute() {
  const route = useRoute<RouteProp<RootStackParamList, 'ResetPassword'>>();
  const goToSignIn = useAppStore(state => state.goToSignIn);

  return (
    <ResetPasswordScreen
      token={route.params?.token || ''}
      onSubmit={resetPassword}
      onBackToSignIn={goToSignIn}
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
    state => state.finishEmailVerification,
  );
  const resendVerificationCode = useAppStore(
    state => state.resendVerificationCode,
  );
  const goBackToCreateAccount = useAppStore(
    state => state.goBackToCreateAccount,
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
  const sessionEmail = useAppStore(state => state.session?.user.email || '');

  return (
    <SetupProfileScreen
      authEmail={pendingEmail || sessionEmail}
      authSource={authSource || 'email'}
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

function LifetimeOfferRoute() {
  const continueFromLifetimeOffer = useAppStore(
    state => state.continueFromLifetimeOffer,
  );

  return <LifetimeOfferPaywallScreen onBack={continueFromLifetimeOffer} />;
}

const EMPTY_GOALS: string[] = [];

const getRootModalNavigation = (
  navigation: NativeStackNavigationProp<ProfileModalStackParamList>,
) => navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();

function ProfileHubRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProfileModalStackParamList>>();
  const rootNavigation = getRootModalNavigation(navigation);
  const session = useAppStore(state => state.session);
  const onboardingGoals = useAppStore(
    state => state.onboardingData?.goals ?? EMPTY_GOALS,
  );
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement,
  );
  const openLifetimeOffer = useAppStore(state => state.openLifetimeOffer);
  const signOut = useAppStore(state => state.signOut);
  const themeModeOverride = useAppStore(state => state.themeModeOverride);

  const dismissAndOpen = (screen: keyof MainAppStackParamList) => {
    rootNavigation?.goBack();
    setTimeout(() => navigateMainApp(screen), 0);
  };

  const openPaywallFromModal = (placementKey: string, screenKey: string) => {
    rootNavigation?.goBack();
    setTimeout(() => {
      openPaywallForPlacement({
        placementKey,
        returnStage: 'main-app',
        screenKey,
      });
    }, 0);
  };

  return (
    <ProfileScreen
      userName={session?.user.name || 'Journal User'}
      userEmail={session?.user.email}
      fallbackEmail={session?.user.email}
      userGoals={session?.user.journalingGoals}
      onboardingGoals={onboardingGoals}
      userAvatarColor={session?.user.avatarColor}
      userProfilePic={session?.user.profilePic}
      isPremium={Boolean(session?.user.isPremium)}
      showProfileSummary={false}
      onClose={() => rootNavigation?.goBack()}
      onOpenStreaks={() => dismissAndOpen('Streaks')}
      onOpenSubscription={() => {
        if (session?.user.isPremium) {
          navigation.navigate('Subscription');
          return;
        }

        openPaywallFromModal('subscription_screen', 'profile');
      }}
      onOpenPrivacy={() => navigation.navigate('Privacy')}
      onOpenPaywall={() => {
        rootNavigation?.goBack();
        setTimeout(() => {
          openLifetimeOffer({
            returnStage: 'main-app',
            screenKey: 'profile',
          });
        }, 0);
      }}
      settingsContent={
        <>
          <SettingsAccountSection
            onOpenManageAccount={() => navigation.navigate('ManageAccount')}
            onOpenSubscription={() => navigation.navigate('Subscription')}
          />
          <SettingsPersonalizationSection
            currentThemePreference={themeModeOverride ?? 'system'}
            onOpenAboutYou={() => navigation.navigate('AboutYou')}
            onOpenNotifications={() => navigation.navigate('Reminders')}
            onOpenTheme={() => navigation.navigate('Theme')}
          />
          <SettingsPrivacyDataSection
            onOpenExport={() => navigation.navigate('Privacy')}
            onOpenBiometricLock={() => navigation.navigate('BiometricLock')}
            onOpenHidePreviewsPaywall={() =>
              openPaywallFromModal('settings_hide_previews_locked', 'settings')
            }
            onOpenPrivacyModePaywall={() =>
              openPaywallFromModal('settings_privacy_mode_locked', 'settings')
            }
          />
          <SettingsMoreSection />
          <SettingsSupportSection />
          <SettingsSignOutSection onSignOut={signOut} />
        </>
      }
    />
  );
}

function AboutYouModalRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProfileModalStackParamList>>();

  return <AboutYouScreen onBack={() => navigation.goBack()} />;
}

function ManageAccountModalRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProfileModalStackParamList>>();
  const signOut = useAppStore(state => state.signOut);

  return (
    <AccountScreen onBack={() => navigation.goBack()} onSignOut={signOut} />
  );
}

function SubscriptionModalRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProfileModalStackParamList>>();
  const currentPlanKey = useAppStore(
    state => state.session?.user.premiumPlanKey,
  );

  return (
    <SubscriptionScreen
      onBack={() => navigation.goBack()}
      currentPlanKey={currentPlanKey}
    />
  );
}

function PrivacyModalRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProfileModalStackParamList>>();

  return <PrivacyScreen onBack={() => navigation.goBack()} />;
}

function BiometricLockModalRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProfileModalStackParamList>>();
  const rootNavigation = getRootModalNavigation(navigation);
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement,
  );

  return (
    <BiometricLockScreen
      onBack={() => navigation.goBack()}
      onOpenPremium={() => {
        rootNavigation?.goBack();
        setTimeout(() => {
          openPaywallForPlacement({
            placementKey: 'settings_biometric_lock_locked',
            returnStage: 'main-app',
            screenKey: 'biometric_lock',
          });
        }, 0);
      }}
    />
  );
}

function RemindersModalRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProfileModalStackParamList>>();

  return <RemindersScreen onBack={() => navigation.goBack()} />;
}

function ThemeModalRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProfileModalStackParamList>>();
  const currentThemePreference = useAppStore(
    state => state.themeModeOverride ?? 'system',
  );
  const setThemeModeOverride = useAppStore(
    state => state.setThemeModeOverride,
  );

  return (
    <ThemeSettingsScreen
      currentThemePreference={currentThemePreference}
      onBack={() => navigation.goBack()}
      onToggleTheme={setThemeModeOverride}
    />
  );
}

function ProfileModalRoute() {
  const theme = useTheme();

  return (
    <View style={appNavigatorStyles.profileModalRoot}>
      <ProfileModalStack.Navigator
        initialRouteName="ProfileHub"
        screenOptions={{
          animation: 'fade',
          animationDuration: 200,
          contentStyle: { backgroundColor: theme.colors.card },
          headerShown: false,
          statusBarStyle: theme.mode === 'dark' ? 'light' : 'dark',
        }}
      >
        <ProfileModalStack.Screen
          name="ProfileHub"
          component={ProfileHubRoute}
        />
        <ProfileModalStack.Screen
          name="AboutYou"
          component={AboutYouModalRoute}
        />
        <ProfileModalStack.Screen
          name="ManageAccount"
          component={ManageAccountModalRoute}
        />
        <ProfileModalStack.Screen
          name="Subscription"
          component={SubscriptionModalRoute}
        />
        <ProfileModalStack.Screen
          name="Privacy"
          component={PrivacyModalRoute}
        />
        <ProfileModalStack.Screen
          name="BiometricLock"
          component={BiometricLockModalRoute}
        />
        <ProfileModalStack.Screen
          name="Reminders"
          component={RemindersModalRoute}
        />
        <ProfileModalStack.Screen name="Theme" component={ThemeModalRoute} />
      </ProfileModalStack.Navigator>
      <ThemeTransitionOverlay />
    </View>
  );
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
    case 'onboarding':
      return 'Onboarding';
    case 'auth':
      return 'AuthChoice';
    case 'sign-in':
      return 'SignIn';
    case 'forgot-password':
      return 'ForgotPassword';
    case 'reset-password':
      return 'ResetPassword';
    case 'create-account':
      return 'CreateAccount';
    case 'verify-email':
      return 'VerifyEmail';
    case 'profile':
      return 'SetupProfile';
    case 'paywall':
      return 'Paywall';
    case 'hosted-paywall':
      return 'HostedPaywall';
    case 'lifetime-offer':
      return 'LifetimeOffer';
    case 'complete':
      return 'Complete';
    case 'main-app':
    default:
      return 'MainApp';
  }
}

function getMainAppInitialParams(stage: string) {
  switch (stage) {
    case 'new-entry':
      return { screen: 'NewEntry' as const };
    case 'journal-detail':
      return { screen: 'EntryDetail' as const };
    case 'journal-edit':
      return { screen: 'EditEntry' as const };
    case 'main-app':
    default:
      return undefined;
  }
}

export default function AppNavigator() {
  const theme = useTheme();
  const hasBootstrappedAuthGate = useAppStore(
    state => state.hasBootstrappedAuthGate,
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
    <NavigationContainer ref={navigationRef} linking={rootLinkingConfig}>
      <RootStack.Navigator
        initialRouteName={getInitialRouteName(stage)}
        screenOptions={{ headerShown: false }}
      >
        <RootStack.Screen name="Onboarding" component={OnboardingRoute} />
        <RootStack.Screen
          name="FirstGuidedReflection"
          component={FirstGuidedReflectionRoute}
          options={{ animation: 'fade_from_bottom', animationDuration: 280 }}
        />
        <RootStack.Screen
          name="FirstReflectionAnalysis"
          component={FirstReflectionAnalysisRoute}
          options={{ animation: 'fade_from_bottom', animationDuration: 280 }}
        />
        <RootStack.Screen
          name="FirstReflectionGoals"
          component={FirstReflectionGoalsRoute}
          options={{ animation: 'fade_from_bottom', animationDuration: 280 }}
        />
        <RootStack.Screen
          name="FirstReflectionStreak"
          component={FirstReflectionStreakRoute}
          options={{ animation: 'fade_from_bottom', animationDuration: 280 }}
        />
        <RootStack.Screen name="AuthChoice" component={AuthChoiceRoute} />
        <RootStack.Screen name="SignIn" component={SignInRoute} />
        <RootStack.Screen
          name="ForgotPassword"
          component={ForgotPasswordRoute}
        />
        <RootStack.Screen name="ResetPassword" component={ResetPasswordRoute} />
        <RootStack.Screen name="CreateAccount" component={CreateAccountRoute} />
        <RootStack.Screen name="VerifyEmail" component={VerifyEmailRoute} />
        <RootStack.Screen name="SetupProfile" component={SetupProfileRoute} />
        <RootStack.Screen name="Paywall" component={PaywallRoute} />
        <RootStack.Screen name="HostedPaywall" component={HostedPaywallRoute} />
        <RootStack.Screen name="LifetimeOffer" component={LifetimeOfferRoute} />
        <RootStack.Screen name="Complete" component={CompleteRoute} />
        <RootStack.Screen
          name="MainApp"
          component={MainAppShell}
          initialParams={
            getMainAppInitialParams(stage) || {
              screen:
                activeTab === 'calendar'
                  ? 'Calendar'
                  : activeTab === 'insights'
                  ? 'Insights'
                  : activeTab === 'profile'
                  ? 'Profile'
                  : 'Home',
            }
          }
        />
        <RootStack.Group
          screenOptions={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        >
          <RootStack.Screen
            name="LegalBrowserModal"
            component={InAppBrowserModal}
          />
          <RootStack.Screen
            name="ProfileModal"
            component={ProfileModalRoute}
            options={{
              contentStyle: {
                backgroundColor: theme.colors.card,
              },
              statusBarStyle: theme.mode === 'dark' ? 'light' : 'dark',
            }}
          />
        </RootStack.Group>
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const appNavigatorStyles = StyleSheet.create({
  profileModalRoot: {
    flex: 1,
    position: 'relative',
  },
  completeRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  completeSubtitle: {
    marginTop: 8,
    textAlign: 'center',
  },
  completeRestart: {
    marginTop: 16,
    fontWeight: '600',
  },
  loadingRoot: {
    flex: 1,
  },
});
