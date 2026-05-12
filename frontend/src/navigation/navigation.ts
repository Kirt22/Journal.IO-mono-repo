import {
  CommonActions,
  createNavigationContainerRef,
  type NavigatorScreenParams,
  StackActions,
} from "@react-navigation/native";

export type MainAppStackParamList = {
  Home: undefined;
  Calendar: undefined;
  Insights: undefined;
  Profile: undefined;
  Search: undefined;
  Reminders: undefined;
  Streaks: undefined;
  Settings: undefined;
  Privacy: undefined;
  Subscription: undefined;
  NewEntry: { initialPrompt?: string | null } | undefined;
  EntryDetail: { entryId?: string | null } | undefined;
  EditEntry: { entryId?: string | null } | undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  AuthChoice: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  VerifyEmail: undefined;
  SetupProfile: undefined;
  Paywall: undefined;
  HostedPaywall: undefined;
  SpinWheel: undefined;
  DiscountOffer: undefined;
  LifetimeOffer: undefined;
  Complete: undefined;
  MainApp: NavigatorScreenParams<MainAppStackParamList> | undefined;
  LegalBrowserModal: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateRoot<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName]
) {
  if (!navigationRef.isReady()) {
    return;
  }

  navigationRef.dispatch(
    CommonActions.navigate({
      name: name as string,
      params,
    })
  );
}

export function navigateMainApp<RouteName extends keyof MainAppStackParamList>(
  name: RouteName,
  params?: MainAppStackParamList[RouteName]
) {
  if (!navigationRef.isReady()) {
    return;
  }

  navigationRef.navigate("MainApp", {
    screen: name,
    params,
  } as NavigatorScreenParams<MainAppStackParamList>);
}

export function replaceMainApp<RouteName extends keyof MainAppStackParamList>(
  name: RouteName,
  params?: MainAppStackParamList[RouteName]
) {
  if (!navigationRef.isReady()) {
    return;
  }

  navigationRef.dispatch(StackActions.replace(name, params as never));
}

export function resetRoot<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName]
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
    })
  );
}

export function goBackOrFallback(fallback: () => void) {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
    return;
  }

  fallback();
}
