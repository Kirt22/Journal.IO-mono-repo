import {
  CommonActions,
  createNavigationContainerRef,
  type NavigatorScreenParams,
  StackActions,
} from '@react-navigation/native';
import type {
  FirstReflectionAnalysisPayload,
  FirstReflectionGoalsPayload,
  FirstReflectionStreakPayload,
} from '../screens/onboarding/FirstGuidedReflectionScreen';
import type { OnboardingV2Draft } from '../types/onboarding';

export type MainAppStackParamList = {
  Home: undefined;
  Calendar: undefined;
  Insights: undefined;
  Profile: undefined;
  Search: undefined;
  Reminders: undefined;
  Streaks: undefined;
  Settings: undefined;
  Account: undefined;
  BiometricLock: undefined;
  AboutYou: undefined;
  ThemeSettings: undefined;
  Privacy: undefined;
  Subscription: undefined;
  Goals: undefined;
  MindMap: undefined;
  NewEntry: { initialPrompt?: string | null } | undefined;
  EntryDetail: { entryId?: string | null } | undefined;
  EditEntry: { entryId?: string | null } | undefined;
};

export type ProfileModalStackParamList = {
  ProfileHub: undefined;
  AboutYou: undefined;
  ManageAccount: undefined;
  Subscription: undefined;
  Privacy: undefined;
  BiometricLock: undefined;
  Reminders: undefined;
  Theme: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  FirstGuidedReflection: { draft: OnboardingV2Draft };
  FirstReflectionAnalysis: FirstReflectionAnalysisPayload;
  FirstReflectionGoals: FirstReflectionGoalsPayload;
  FirstReflectionStreak: FirstReflectionStreakPayload;
  AuthChoice: undefined;
  SignIn: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
  CreateAccount: undefined;
  VerifyEmail: undefined;
  SetupProfile: undefined;
  Paywall: undefined;
  HostedPaywall: undefined;
  LifetimeOffer: undefined;
  Complete: undefined;
  MainApp: NavigatorScreenParams<MainAppStackParamList> | undefined;
  LegalBrowserModal: undefined;
  ProfileModal: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateRoot<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName],
) {
  if (!navigationRef.isReady()) {
    return;
  }

  navigationRef.dispatch(
    CommonActions.navigate({
      name: name as string,
      params,
    }),
  );
}

export function navigateMainApp<RouteName extends keyof MainAppStackParamList>(
  name: RouteName,
  params?: MainAppStackParamList[RouteName],
) {
  if (!navigationRef.isReady()) {
    return;
  }

  navigationRef.navigate('MainApp', {
    screen: name,
    params,
  } as NavigatorScreenParams<MainAppStackParamList>);
}

export function replaceMainApp<RouteName extends keyof MainAppStackParamList>(
  name: RouteName,
  params?: MainAppStackParamList[RouteName],
) {
  if (!navigationRef.isReady()) {
    return;
  }

  navigationRef.dispatch(StackActions.replace(name, params as never));
}

export function resetRoot<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName],
) {
  if (!navigationRef.isReady()) {
    return;
  }

  navigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [
        {
          name,
          params,
        } as never,
      ],
    }),
  );
}

export function goBackOrFallback(fallback: () => void) {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
    return;
  }

  fallback();
}
