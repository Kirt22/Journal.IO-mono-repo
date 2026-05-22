import { useCallback } from "react";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
  type NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import BottomNav, { type BottomNavKey } from "../../components/BottomNav";
import HomeScreen from "../HomeScreen";
import CalendarScreen from "../calendar/CalendarScreen";
import InsightsScreen from "../InsightsScreen";
import SearchScreen from "../search/SearchScreen";
import RemindersScreen from "../reminders/RemindersScreen";
import StreaksScreen from "../StreaksScreen";
import ProfileScreen from "../profile/ProfileScreen";
import SettingsScreen from "../profile/SettingsScreen";
import PrivacyScreen from "../profile/PrivacyScreen";
import SubscriptionScreen from "../profile/SubscriptionScreen";
import NewEntryScreen from "../NewEntryScreen";
import EntryDetailScreen from "../journal/EntryDetailScreen";
import EditEntryScreen from "../journal/EditEntryScreen";
import { useAppStore } from "../../store/appStore";
import { RootStackParamList, MainAppStackParamList } from "../../navigation/navigation";

const MainAppStack = createNativeStackNavigator<MainAppStackParamList>();
const EMPTY_GOALS: string[] = [];
export const BACK_SWIPE_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  gestureEnabled: true,
  animation: "slide_from_right",
  animationMatchesGesture: true,
};

function getTabRouteName(value: string | undefined) {
  if (value === "calendar" || value === "Calendar") {
    return "Calendar";
  }

  if (value === "insights" || value === "Insights") {
    return "Insights";
  }

  if (value === "profile" || value === "Profile") {
    return "Profile";
  }

  return "Home";
}

function useBottomNavPress(activeKey: BottomNavKey) {
  const navigation = useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const openNewEntry = useAppStore(state => state.openNewEntry);

  return useCallback(
    (nextTab: BottomNavKey) => {
      if (nextTab === activeKey) {
        return;
      }

      if (nextTab === "new") {
        openNewEntry();
        return;
      }

      navigation.replace(
        nextTab === "home"
          ? "Home"
          : nextTab === "calendar"
            ? "Calendar"
            : nextTab === "insights"
              ? "Insights"
              : "Profile"
      );
    },
    [activeKey, navigation, openNewEntry]
  );
}

function TabFrame({
  activeKey,
  children,
}: {
  activeKey: BottomNavKey;
  children: ReactNode;
}) {
  const handleBottomNavPress = useBottomNavPress(activeKey);

  return (
    <View style={mainAppShellStyles.root}>
      <View style={mainAppShellStyles.content}>{children}</View>
      <BottomNav activeKey={activeKey} onPress={handleBottomNavPress} />
    </View>
  );
}

function useTabFocus(tab: "home" | "calendar" | "insights" | "profile") {
  const setActiveTabState = useAppStore(state => state.setActiveTabState);

  useFocusEffect(
    useCallback(() => {
      setActiveTabState(tab);
    }, [setActiveTabState, tab])
  );
}

function HomeRoute() {
  const navigation = useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const session = useAppStore(state => state.session);
  const onboardingGoals = useAppStore(
    state => state.onboardingData?.goals ?? EMPTY_GOALS
  );
  const openNewEntry = useAppStore(state => state.openNewEntry);
  const setThemeModeOverride = useAppStore(state => state.setThemeModeOverride);

  useTabFocus("home");

  return (
    <TabFrame activeKey="home">
      <HomeScreen
        userName={session?.user.name || "Journal User"}
        userEmail={session?.user.email}
        fallbackEmail={session?.user.email}
        userGoals={session?.user.journalingGoals}
        onboardingGoals={onboardingGoals}
        userAvatarColor={session?.user.avatarColor}
        userProfilePic={session?.user.profilePic}
        isPremium={Boolean(session?.user.isPremium)}
        onOpenStreaks={() => navigation.navigate("Streaks")}
        onOpenSearch={() => navigation.navigate("Search")}
        onOpenReminders={() => navigation.navigate("Reminders")}
        onOpenNewEntry={initialPrompt =>
          openNewEntry(initialPrompt ? { initialPrompt } : undefined)
        }
        onToggleTheme={setThemeModeOverride}
      />
    </TabFrame>
  );
}

function CalendarRoute() {
  useTabFocus("calendar");
  return (
    <TabFrame activeKey="calendar">
      <CalendarScreen />
    </TabFrame>
  );
}

function InsightsRoute() {
  useTabFocus("insights");
  return (
    <TabFrame activeKey="insights">
      <InsightsScreen />
    </TabFrame>
  );
}

function ProfileRoute() {
  const navigation = useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const session = useAppStore(state => state.session);
  const onboardingGoals = useAppStore(
    state => state.onboardingData?.goals ?? EMPTY_GOALS
  );
  const openPaywallForPlacement = useAppStore(state => state.openPaywallForPlacement);
  const openLifetimeOffer = useAppStore(state => state.openLifetimeOffer);

  useTabFocus("profile");

  return (
    <TabFrame activeKey="profile">
      <ProfileScreen
        userName={session?.user.name || "Journal User"}
        userEmail={session?.user.email}
        fallbackEmail={session?.user.email}
        userGoals={session?.user.journalingGoals}
        onboardingGoals={onboardingGoals}
        userAvatarColor={session?.user.avatarColor}
        userProfilePic={session?.user.profilePic}
        isPremium={Boolean(session?.user.isPremium)}
        onOpenStreaks={() => navigation.navigate("Streaks")}
        onOpenSettings={() => navigation.navigate("Settings")}
        onOpenSubscription={() => {
          if (session?.user.isPremium) {
            navigation.navigate("Subscription");
            return;
          }

          openPaywallForPlacement({
            placementKey: "subscription_screen",
            returnStage: "main-app",
            screenKey: "profile",
          });
        }}
        onOpenPrivacy={() => navigation.navigate("Privacy")}
        onOpenPaywall={() => {
          openLifetimeOffer({
            returnStage: "main-app",
            screenKey: "profile",
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
  const navigation = useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();

  return <SearchScreen onBack={() => navigation.goBack()} />;
}

function RemindersRoute() {
  const navigation = useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();

  return <RemindersScreen onBack={() => navigation.goBack()} />;
}

function SettingsRoute() {
  const navigation = useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const themeModeOverride = useAppStore(state => state.themeModeOverride);
  const signOut = useAppStore(state => state.signOut);
  const setThemeModeOverride = useAppStore(
    state => state.setThemeModeOverride
  );
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement
  );

  return (
    <SettingsScreen
      onBack={() => navigation.goBack()}
      onOpenPrivacy={() => navigation.navigate("Privacy")}
      onOpenPrivacyModePaywall={() =>
        openPaywallForPlacement({
          placementKey: "settings_privacy_mode_locked",
          returnStage: "main-app",
          screenKey: "settings",
        })
      }
      onOpenHidePreviewsPaywall={() =>
        openPaywallForPlacement({
          placementKey: "settings_hide_previews_locked",
          returnStage: "main-app",
          screenKey: "settings",
        })
      }
      onSignOut={signOut}
      currentThemePreference={themeModeOverride ?? "system"}
      onToggleTheme={setThemeModeOverride}
    />
  );
}

function PrivacyRoute() {
  const navigation = useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const signOut = useAppStore(state => state.signOut);
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement
  );

  return (
    <PrivacyScreen
      onBack={() => navigation.goBack()}
      onOpenExportPaywall={() =>
        openPaywallForPlacement({
          placementKey: "privacy_export_locked",
          returnStage: "main-app",
          screenKey: "privacy",
        })
      }
      onSignOut={signOut}
    />
  );
}

function SubscriptionRoute() {
  const navigation = useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const session = useAppStore(state => state.session);

  return (
    <SubscriptionScreen
      onBack={() => navigation.goBack()}
      currentPlanKey={session?.user.premiumPlanKey}
    />
  );
}

export function NewEntryRoute() {
  const closeNewEntry = useAppStore(state => state.closeNewEntry);
  const pendingNewEntryPrompt = useAppStore(
    state => state.pendingNewEntryPrompt
  );

  return (
    <NewEntryScreen
      onBack={closeNewEntry}
      initialPrompt={pendingNewEntryPrompt}
    />
  );
}

function MainAppShell() {
  const route = useRoute<RouteProp<RootStackParamList, "MainApp">>();
  const activeTab = useAppStore(state => state.activeTab);
  const initialRouteName = getTabRouteName(
    route.params?.screen || activeTab || undefined
  );

  return (
    <MainAppStack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: "fade",
        animationTypeForReplace: "push",
      }}
    >
      <MainAppStack.Screen name="Home" component={HomeRoute} />
      <MainAppStack.Screen name="Calendar" component={CalendarRoute} />
      <MainAppStack.Screen name="Insights" component={InsightsRoute} />
      <MainAppStack.Screen name="Profile" component={ProfileRoute} />
      <MainAppStack.Group screenOptions={BACK_SWIPE_SCREEN_OPTIONS}>
        <MainAppStack.Screen name="Search" component={SearchRoute} />
        <MainAppStack.Screen name="Reminders" component={RemindersRoute} />
        <MainAppStack.Screen name="Streaks" component={StreaksRoute} />
        <MainAppStack.Screen name="Settings" component={SettingsRoute} />
        <MainAppStack.Screen name="Privacy" component={PrivacyRoute} />
        <MainAppStack.Screen name="Subscription" component={SubscriptionRoute} />
        <MainAppStack.Screen name="NewEntry" component={NewEntryRoute} />
        <MainAppStack.Screen name="EntryDetail" component={EntryDetailScreen} />
        <MainAppStack.Screen name="EditEntry" component={EditEntryScreen} />
      </MainAppStack.Group>
    </MainAppStack.Navigator>
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
