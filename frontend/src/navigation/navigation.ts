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
import type { GuidedReflectionSessionAnalysisResponse } from '../services/guidedReflectionService';
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
  AskJade: { sessionId?: string } | undefined;
  // `sessionAnalysis` is fetched inline while the entry saves, so this screen
  // opens with its data already in hand and plays its reveal immediately.
  EntrySessionAnalysis: {
    journalId: string;
    sessionAnalysis?: GuidedReflectionSessionAnalysisResponse;
  };
  EntryMindMap: {
    journalId: string;
    sessionAnalysis?: GuidedReflectionSessionAnalysisResponse;
  };
  NewEntry: { initialPrompt?: string | null } | undefined;
  GuidedEntry: undefined;
  QuickThought: undefined;
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
  Widgets: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  FirstGuidedReflection: { draft: OnboardingV2Draft };
  FirstReflectionAnalysis: FirstReflectionAnalysisPayload;
  FirstReflectionGoals: FirstReflectionGoalsPayload;
  FirstReflectionMindMapLoading: FirstReflectionStreakPayload;
  FirstReflectionMindMap: FirstReflectionStreakPayload;
  FirstReflectionRating: FirstReflectionStreakPayload;
  FirstReflectionStreak: FirstReflectionStreakPayload;
  // `draft` rides through to the final step so the onboarding answers can be
  // persisted when the journey completes, not just the display name.
  OnboardingReminders: { displayName?: string; draft?: OnboardingV2Draft };
  // The widget and commitment steps close out the V2 journey. `draft` keeps
  // riding along so the commitment step can fold its signed timestamp in before
  // the answers are persisted on the final screen.
  OnboardingWidgetSetup: { displayName?: string; draft?: OnboardingV2Draft };
  OnboardingWidgetActivated: {
    displayName?: string;
    draft?: OnboardingV2Draft;
    didEnableWidget: boolean;
  };
  OnboardingCommitment: { displayName?: string; draft?: OnboardingV2Draft };
  OnboardingTrialIntro: { displayName?: string; draft?: OnboardingV2Draft };
  OnboardingTrialTimeline: { displayName?: string; draft?: OnboardingV2Draft };
  AuthChoice: undefined;
  SignIn: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
  CreateAccount: undefined;
  VerifyEmail: undefined;
  Paywall: undefined;
  HostedPaywall: undefined;
  LifetimeOffer: undefined;
  Complete: undefined;
  MainApp: NavigatorScreenParams<MainAppStackParamList> | undefined;
  LegalBrowserModal: undefined;
  ProfileModal: NavigatorScreenParams<ProfileModalStackParamList> | undefined;
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

/** Name of the route currently on top of the ROOT stack, if any. */
export function getCurrentRootRouteName() {
  if (!navigationRef.isReady()) {
    return null;
  }

  return navigationRef.getCurrentRoute()?.name ?? null;
}

export function goBackOrFallback(fallback: () => void) {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
    return;
  }

  fallback();
}
