import { useCallback, useRef, useState } from 'react';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import BottomNav, { type BottomNavKey } from '../../components/BottomNav';
import NewEntryChoiceSheet, {
  type NewEntryChoice,
} from '../../components/NewEntryChoiceSheet';
import OfflineBanner from '../../components/OfflineBanner';
import FirstGuidedReflectionScreen, {
  type FirstReflectionAnalysisPayload,
  type FirstReflectionGoalsPayload,
} from '../onboarding/FirstGuidedReflectionScreen';
import HomeScreen from '../HomeScreen';
import CalendarScreen from '../calendar/CalendarScreen';
import InsightsScreen from '../InsightsScreen';
import SearchScreen from '../search/SearchScreen';
import RemindersScreen from '../reminders/RemindersScreen';
import StreaksScreen from '../StreaksScreen';
import ProfileScreen from '../profile/ProfileScreen';
import AboutYouScreen from '../profile/AboutYouScreen';
import SettingsScreen from '../profile/SettingsScreen';
import AccountScreen from '../profile/AccountScreen';
import BiometricLockScreen from '../profile/BiometricLockScreen';
import ThemeSettingsScreen from '../profile/ThemeSettingsScreen';
import PrivacyScreen from '../profile/PrivacyScreen';
import SubscriptionScreen from '../profile/SubscriptionScreen';
import GoalsScreen from '../goals/GoalsScreen';
import AskJadeScreen from '../jade/AskJadeScreen';
import NewEntryScreen from '../NewEntryScreen';
import QuickThoughtScreen from '../QuickThoughtScreen';
import EntryDetailScreen from '../journal/EntryDetailScreen';
import EditEntryScreen from '../journal/EditEntryScreen';
import MindMapScreen from '../insights/MindMapScreen';
import EntrySessionMindMapScreen from '../insights/EntrySessionMindMapScreen';
import EntrySessionAnalysisScreen from '../journal/EntrySessionAnalysisScreen';
import { useAppStore } from '../../store/appStore';
import {
  navigateRoot,
  RootStackParamList,
  MainAppStackParamList,
} from '../../navigation/navigation';
import type { OnboardingV2Draft } from '../../types/onboarding';
import { type GoalDraft } from '../../services/goalsService';
import { saveGoalDrafts } from '../../utils/saveGoalDrafts';
import type { GuidedReflectionSessionAnalysisResponse } from '../../services/guidedReflectionService';

const MainAppStack = createNativeStackNavigator<MainAppStackParamList>();
const EMPTY_GOALS: string[] = [];
export const BACK_SWIPE_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  gestureEnabled: true,
  animation: 'slide_from_right',
  animationMatchesGesture: true,
};

export const getGuidedEntryMindMapParams = (
  payload: FirstReflectionGoalsPayload | null,
) =>
  payload?.journalId
    ? {
        journalId: payload.journalId,
        sessionAnalysis: payload.sessionAnalysis,
      }
    : null;

function getTabRouteName(value: string | undefined) {
  if (value === 'calendar' || value === 'Calendar') {
    return 'Calendar';
  }

  if (value === 'insights' || value === 'Insights') {
    return 'Insights';
  }

  if (value === 'profile' || value === 'Profile') {
    return 'Profile';
  }

  if (value === 'mindmap' || value === 'MindMap') {
    return 'MindMap';
  }

  return 'Home';
}

function useBottomNavPress(activeKey: BottomNavKey, onNewPress: () => void) {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();

  return useCallback(
    (nextTab: BottomNavKey) => {
      if (nextTab === activeKey) {
        return;
      }

      if (nextTab === 'new') {
        onNewPress();
        return;
      }

      navigation.replace(
        nextTab === 'home'
          ? 'Home'
          : nextTab === 'calendar'
          ? 'Calendar'
          : nextTab === 'insights'
          ? 'Insights'
          : nextTab === 'mindmap'
          ? 'MindMap'
          : 'Profile',
      );
    },
    [activeKey, navigation, onNewPress],
  );
}

export function TabFrame({
  activeKey,
  children,
}: {
  activeKey: BottomNavKey;
  children: ReactNode;
}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const openNewEntry = useAppStore(state => state.openNewEntry);
  const isPremiumUser = useAppStore(state =>
    Boolean(state.session?.user.isPremium),
  );
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement,
  );
  const hasSeenHomeEntrance = useAppStore(state => state.hasSeenHomeEntrance);
  // Shared rather than local: Home's streak nudge raises the same chooser.
  const choiceVisible = useAppStore(state => state.isNewEntryChoiceVisible);
  const openNewEntryChoice = useAppStore(state => state.openNewEntryChoice);
  const closeNewEntryChoice = useAppStore(state => state.closeNewEntryChoice);
  const shouldOpenGuidedPaywallRef = useRef(false);

  const handleBottomNavPress = useBottomNavPress(activeKey, openNewEntryChoice);

  const openGuidedPaywall = useCallback(() => {
    shouldOpenGuidedPaywallRef.current = true;
    closeNewEntryChoice();
  }, [closeNewEntryChoice]);

  const handleChoiceSheetDismissed = useCallback(() => {
    if (!shouldOpenGuidedPaywallRef.current) {
      return;
    }

    shouldOpenGuidedPaywallRef.current = false;
    openPaywallForPlacement({
      placementKey: 'new_entry_guided_locked',
      returnStage: 'main-app',
      screenKey: 'new_entry_choice',
    });
  }, [openPaywallForPlacement]);

  const handleChoice = useCallback(
    (choice: NewEntryChoice) => {
      if (choice === 'guided') {
        if (!isPremiumUser) {
          openGuidedPaywall();
          return;
        }

        closeNewEntryChoice();
        navigation.navigate('GuidedEntry');
      } else {
        closeNewEntryChoice();
        openNewEntry();
      }
    },
    [
      closeNewEntryChoice,
      isPremiumUser,
      navigation,
      openGuidedPaywall,
      openNewEntry,
    ],
  );

  const handleGuidedLockedPress = openGuidedPaywall;

  return (
    <View style={mainAppShellStyles.root}>
      <View style={mainAppShellStyles.content}>{children}</View>
      <BottomNav
        activeKey={activeKey}
        onPress={handleBottomNavPress}
        shouldAnimateEntrance={activeKey === 'home' && !hasSeenHomeEntrance}
      />
      <NewEntryChoiceSheet
        visible={choiceVisible}
        isGuidedLocked={!isPremiumUser}
        onSelect={handleChoice}
        onGuidedLockedPress={handleGuidedLockedPress}
        onClose={closeNewEntryChoice}
        onDismissComplete={handleChoiceSheetDismissed}
      />
    </View>
  );
}

function useTabFocus(
  tab: 'home' | 'calendar' | 'insights' | 'mindmap' | 'profile',
) {
  const setActiveTabState = useAppStore(state => state.setActiveTabState);

  useFocusEffect(
    useCallback(() => {
      setActiveTabState(tab);
    }, [setActiveTabState, tab]),
  );
}

function HomeRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const session = useAppStore(state => state.session);
  const onboardingGoals = useAppStore(
    state => state.onboardingData?.goals ?? EMPTY_GOALS,
  );
  const openNewEntry = useAppStore(state => state.openNewEntry);
  const setThemeModeOverride = useAppStore(state => state.setThemeModeOverride);

  useTabFocus('home');

  return (
    <TabFrame activeKey="home">
      <HomeScreen
        userName={session?.user.name || 'Journal User'}
        userEmail={session?.user.email}
        fallbackEmail={session?.user.email}
        userGoals={session?.user.journalingGoals}
        onboardingGoals={onboardingGoals}
        userAvatarColor={session?.user.avatarColor}
        userProfilePic={session?.user.profilePic}
        isPremium={Boolean(session?.user.isPremium)}
        onOpenStreaks={() => navigation.navigate('Streaks')}
        onOpenSearch={() => navigation.navigate('Search')}
        onOpenReminders={() => navigation.navigate('Reminders')}
        onOpenSettings={() => navigateRoot('ProfileModal')}
        onOpenGoals={() => navigation.navigate('Goals')}
        onOpenNewEntry={initialPrompt =>
          openNewEntry(initialPrompt ? { initialPrompt } : undefined)
        }
        onToggleTheme={setThemeModeOverride}
      />
    </TabFrame>
  );
}

function CalendarRoute() {
  useTabFocus('calendar');
  return (
    <TabFrame activeKey="calendar">
      <CalendarScreen />
    </TabFrame>
  );
}

function InsightsRoute() {
  useTabFocus('insights');
  return (
    <TabFrame activeKey="insights">
      <InsightsScreen />
    </TabFrame>
  );
}

function ProfileRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const session = useAppStore(state => state.session);
  const onboardingGoals = useAppStore(
    state => state.onboardingData?.goals ?? EMPTY_GOALS,
  );
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement,
  );
  const openLifetimeOffer = useAppStore(state => state.openLifetimeOffer);

  useTabFocus('profile');

  return (
    <TabFrame activeKey="profile">
      <ProfileScreen
        userName={session?.user.name || 'Journal User'}
        userEmail={session?.user.email}
        fallbackEmail={session?.user.email}
        userGoals={session?.user.journalingGoals}
        onboardingGoals={onboardingGoals}
        userAvatarColor={session?.user.avatarColor}
        userProfilePic={session?.user.profilePic}
        isPremium={Boolean(session?.user.isPremium)}
        onOpenStreaks={() => navigation.navigate('Streaks')}
        onOpenSettings={() => navigation.navigate('Settings')}
        onOpenSubscription={() => {
          if (session?.user.isPremium) {
            navigation.navigate('Subscription');
            return;
          }

          openPaywallForPlacement({
            placementKey: 'subscription_screen',
            returnStage: 'main-app',
            screenKey: 'profile',
          });
        }}
        onOpenPrivacy={() => navigation.navigate('Privacy')}
        onOpenPaywall={() => {
          openLifetimeOffer({
            returnStage: 'main-app',
            screenKey: 'profile',
          });
        }}
      />
    </TabFrame>
  );
}

function StreaksRoute() {
  const activeTab = useAppStore(state => state.activeTab);

  return (
    <TabFrame activeKey={activeTab}>
      <StreaksScreen />
    </TabFrame>
  );
}

function SearchRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();

  return <SearchScreen onBack={() => navigation.goBack()} />;
}

function RemindersRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();

  return <RemindersScreen onBack={() => navigation.goBack()} />;
}

function SettingsRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const themeModeOverride = useAppStore(state => state.themeModeOverride);
  const signOut = useAppStore(state => state.signOut);
  const setThemeModeOverride = useAppStore(state => state.setThemeModeOverride);
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement,
  );

  return (
    <SettingsScreen
      onBack={() => navigation.goBack()}
      onOpenAboutYou={() => navigation.navigate('AboutYou')}
      onOpenManageAccount={() => navigation.navigate('Account')}
      onOpenNotifications={() => navigation.navigate('Reminders')}
      onOpenPrivacy={() => navigation.navigate('Privacy')}
      onOpenHidePreviewsPaywall={() =>
        openPaywallForPlacement({
          placementKey: 'settings_hide_previews_locked',
          returnStage: 'main-app',
          screenKey: 'settings',
        })
      }
      onOpenBiometricLock={() => navigation.navigate('BiometricLock')}
      onOpenBiometricLockPaywall={() =>
        openPaywallForPlacement({
          placementKey: 'settings_biometric_lock_locked',
          returnStage: 'main-app',
          screenKey: 'settings',
        })
      }
      onOpenSubscription={() => navigation.navigate('Subscription')}
      onOpenTheme={() => navigation.navigate('ThemeSettings')}
      onSignOut={signOut}
      currentThemePreference={themeModeOverride ?? 'system'}
      onToggleTheme={setThemeModeOverride}
    />
  );
}

function AccountRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const signOut = useAppStore(state => state.signOut);

  return (
    <AccountScreen onBack={() => navigation.goBack()} onSignOut={signOut} />
  );
}

function AboutYouRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();

  return <AboutYouScreen onBack={() => navigation.goBack()} />;
}

function BiometricLockRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement,
  );

  return (
    <BiometricLockScreen
      onBack={() => navigation.goBack()}
      onOpenPremium={() =>
        openPaywallForPlacement({
          placementKey: 'settings_biometric_lock_locked',
          returnStage: 'main-app',
          screenKey: 'biometric_lock',
        })
      }
    />
  );
}

function ThemeSettingsRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const themeModeOverride = useAppStore(state => state.themeModeOverride);
  const setThemeModeOverride = useAppStore(state => state.setThemeModeOverride);

  return (
    <ThemeSettingsScreen
      currentThemePreference={themeModeOverride ?? 'system'}
      onBack={() => navigation.goBack()}
      onToggleTheme={setThemeModeOverride}
    />
  );
}

function PrivacyRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();

  return <PrivacyScreen onBack={() => navigation.goBack()} />;
}

function SubscriptionRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const session = useAppStore(state => state.session);

  return (
    <SubscriptionScreen
      onBack={() => navigation.goBack()}
      currentPlanKey={session?.user.premiumPlanKey}
    />
  );
}

function MindMapRoute() {
  useTabFocus('mindmap');

  // Full-screen presentation (no bottom nav) with its own back button so the
  // Mind Map reads as a focused, information-dense destination.
  return <MindMapScreen showBackButton />;
}

function GoalsRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();

  return <GoalsScreen onBack={() => navigation.goBack()} />;
}

function AskJadeRoute() {
  const closeAskJade = useAppStore(state => state.closeAskJade);
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement,
  );
  const isPremium = useAppStore(state => Boolean(state.session?.user.isPremium));

  return (
    <AskJadeScreen
      isPremium={isPremium}
      onBack={closeAskJade}
      onUpgrade={() =>
        openPaywallForPlacement({
          placementKey: 'ask_jade_locked',
          returnStage: 'main-app',
          screenKey: 'ask_jade',
        })
      }
    />
  );
}

function EntryMindMapRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const route = useRoute<RouteProp<MainAppStackParamList, 'EntryMindMap'>>();
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement,
  );

  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.replace('Home');
  };

  return (
    <EntrySessionMindMapScreen
      initialSessionAnalysis={route.params.sessionAnalysis}
      journalId={route.params.journalId}
      onBack={handleClose}
      onContinue={() => navigation.replace('Home')}
      onUpgrade={() =>
        openPaywallForPlacement({
          placementKey: 'entry_mind_map_locked',
          returnStage: 'main-app',
          screenKey: 'entry_mind_map',
        })
      }
    />
  );
}

// Post-save for an open-ended entry mirrors GuidedEntryRoute below: analysis and
// goals are two modes of the same screen, swapped in place, so neither stage
// gets a loading screen between it and the reveal that follows.
function EntrySessionAnalysisRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const route =
    useRoute<RouteProp<MainAppStackParamList, 'EntrySessionAnalysis'>>();
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement,
  );
  const [goalsPayload, setGoalsPayload] =
    useState<FirstReflectionGoalsPayload | null>(null);

  const journalId = route.params.journalId;

  const openMindMap = useCallback(
    (sessionAnalysis?: GuidedReflectionSessionAnalysisResponse) => {
      navigation.replace('EntryMindMap', {
        journalId,
        sessionAnalysis: sessionAnalysis ?? route.params.sessionAnalysis,
      });
    },
    [journalId, navigation, route.params.sessionAnalysis],
  );

  if (goalsPayload) {
    return (
      <FirstGuidedReflectionScreen
        key="entry-analysis-goals"
        draft={goalsPayload.draft}
        initialGoalsPayload={goalsPayload}
        onBackToReady={() => navigation.replace('Home')}
        onGoalsSaved={async goalDrafts => {
          await saveGoalDrafts(goalDrafts);
          openMindMap(goalsPayload.sessionAnalysis);
        }}
      />
    );
  }

  return (
    <EntrySessionAnalysisScreen
      key="entry-analysis"
      initialAnalysis={route.params.sessionAnalysis}
      journalId={journalId}
      onContinue={openMindMap}
      onExit={() => navigation.replace('Home')}
      onGoalsReady={setGoalsPayload}
      onUpgrade={() =>
        openPaywallForPlacement({
          placementKey: 'entry_session_analysis_locked',
          returnStage: 'main-app',
          screenKey: 'entry_session_analysis',
        })
      }
    />
  );
}

export function NewEntryRoute() {
  const closeNewEntry = useAppStore(state => state.closeNewEntry);
  const pendingNewEntryPrompt = useAppStore(
    state => state.pendingNewEntryPrompt,
  );

  return (
    <NewEntryScreen
      onBack={closeNewEntry}
      initialPrompt={pendingNewEntryPrompt}
    />
  );
}

// Main-app guided reflection reuses the onboarding engine while keeping its
// post-save analysis and goal acceptance inside the authenticated stack.
function GuidedEntryRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const displayName = useAppStore(
    state => state.session?.user.name ?? undefined,
  );
  const onboardingData = useAppStore(state => state.onboardingData);
  const [analysisPayload, setAnalysisPayload] =
    useState<FirstReflectionAnalysisPayload | null>(null);
  const [goalsPayload, setGoalsPayload] =
    useState<FirstReflectionGoalsPayload | null>(null);

  const draft: OnboardingV2Draft = {
    version: 2,
    displayName,
    ...(onboardingData?.supportFocusAreas
      ? { supportFocusAreas: onboardingData.supportFocusAreas }
      : {}),
  };

  const returnHome = useCallback(() => {
    navigation.replace('Home');
  }, [navigation]);

  const saveGoalsAndOpenMindMap = useCallback(
    async (goalDrafts: GoalDraft[]) => {
      await saveGoalDrafts(goalDrafts);
      const mindMapParams = getGuidedEntryMindMapParams(goalsPayload);

      if (mindMapParams) {
        navigation.replace('EntryMindMap', mindMapParams);
        return;
      }

      returnHome();
    },
    [goalsPayload, navigation, returnHome],
  );

  if (Platform.OS !== 'ios') {
    return (
      <FirstGuidedReflectionScreen
        draft={draft}
        onBackToReady={returnHome}
        onAnalysisReady={returnHome}
      />
    );
  }

  if (goalsPayload) {
    return (
      <FirstGuidedReflectionScreen
        key="guided-entry-goals"
        draft={draft}
        initialGoalsPayload={goalsPayload}
        onBackToReady={returnHome}
        onGoalsSaved={saveGoalsAndOpenMindMap}
      />
    );
  }

  if (analysisPayload) {
    return (
      <FirstGuidedReflectionScreen
        key="guided-entry-analysis"
        draft={draft}
        initialAnalysisPayload={analysisPayload}
        onBackToReady={returnHome}
        onGoalsReady={setGoalsPayload}
      />
    );
  }

  return (
    <FirstGuidedReflectionScreen
      key="guided-entry-reflection"
      draft={draft}
      onBackToReady={returnHome}
      onAnalysisReady={setAnalysisPayload}
    />
  );
}

function QuickThoughtRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();

  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.replace('Home');
  };

  return <QuickThoughtScreen onClose={handleClose} />;
}

function MainAppShell() {
  const route = useRoute<RouteProp<RootStackParamList, 'MainApp'>>();
  const activeTab = useAppStore(state => state.activeTab);
  const initialRouteName = getTabRouteName(
    route.params?.screen || activeTab || undefined,
  );

  return (
    <View style={mainAppShellStyles.root}>
      <MainAppStack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationTypeForReplace: 'push',
        }}
      >
        <MainAppStack.Screen name="Home" component={HomeRoute} />
        <MainAppStack.Screen name="Calendar" component={CalendarRoute} />
        <MainAppStack.Screen name="Insights" component={InsightsRoute} />
        <MainAppStack.Screen name="Profile" component={ProfileRoute} />
        {Platform.OS === 'ios' ? (
          <MainAppStack.Screen name="MindMap" component={MindMapRoute} />
        ) : null}
        <MainAppStack.Group screenOptions={BACK_SWIPE_SCREEN_OPTIONS}>
          <MainAppStack.Screen name="Search" component={SearchRoute} />
          <MainAppStack.Screen name="Reminders" component={RemindersRoute} />
          <MainAppStack.Screen name="Streaks" component={StreaksRoute} />
          <MainAppStack.Screen name="Settings" component={SettingsRoute} />
          <MainAppStack.Screen name="Account" component={AccountRoute} />
          <MainAppStack.Screen
            name="BiometricLock"
            component={BiometricLockRoute}
          />
          <MainAppStack.Screen name="AboutYou" component={AboutYouRoute} />
          <MainAppStack.Screen
            name="ThemeSettings"
            component={ThemeSettingsRoute}
          />
          <MainAppStack.Screen name="Privacy" component={PrivacyRoute} />
          <MainAppStack.Screen
            name="Subscription"
            component={SubscriptionRoute}
          />
          <MainAppStack.Screen name="Goals" component={GoalsRoute} />
          <MainAppStack.Screen name="AskJade" component={AskJadeRoute} />
          {Platform.OS === 'ios' ? (
            <>
              <MainAppStack.Screen
                name="EntrySessionAnalysis"
                component={EntrySessionAnalysisRoute}
              />
              <MainAppStack.Screen
                name="EntryMindMap"
                component={EntryMindMapRoute}
              />
            </>
          ) : null}
          <MainAppStack.Screen name="NewEntry" component={NewEntryRoute} />
          <MainAppStack.Screen
            name="GuidedEntry"
            component={GuidedEntryRoute}
          />
          <MainAppStack.Screen
            name="QuickThought"
            component={QuickThoughtRoute}
          />
          <MainAppStack.Screen
            name="EntryDetail"
            component={EntryDetailScreen}
          />
          <MainAppStack.Screen name="EditEntry" component={EditEntryScreen} />
        </MainAppStack.Group>
      </MainAppStack.Navigator>
      <OfflineBanner />
    </View>
  );
}

export default MainAppShell;

const mainAppShellStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
