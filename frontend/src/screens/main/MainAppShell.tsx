import { StyleSheet, View } from "react-native";
import { useState } from "react";
import BottomNav, { type BottomNavKey } from "../../components/BottomNav";
import ScreenTransitionHost from "../../components/ScreenTransition";
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
import PaywallScreen from "../profile/PaywallScreen";
import LifetimeOfferPaywallScreen from "../profile/LifetimeOfferPaywallScreen";
import { useTheme } from "../../theme/provider";
import type { ThemeMode } from "../../theme/theme";
import { useAppStore } from "../../store/appStore";

type MainAppShellProps = {
  onToggleTheme: (nextMode: ThemeMode | null) => void;
};

const IMPLEMENTED_TABS: BottomNavKey[] = ["home", "calendar", "insights", "profile"];
const EMPTY_GOALS: string[] = [];
type ProfileSectionRoute =
  | "settings"
  | "privacy"
  | "subscription"
  | "paywall"
  | "lifetime-offer";

export default function MainAppShell({
  onToggleTheme,
}: MainAppShellProps) {
  const theme = useTheme();
  const activeTab = useAppStore(state => state.activeTab);
  const onTabChange = useAppStore(state => state.setActiveTab);
  const openNewEntry = useAppStore(state => state.openNewEntry);
  const session = useAppStore(state => state.session);
  const themeModeOverride = useAppStore(state => state.themeModeOverride);
  const signOut = useAppStore(state => state.signOut);
  const setPaywallContext = useAppStore(state => state.setPaywallContext);
  const clearPaywallContext = useAppStore(state => state.clearPaywallContext);
  const onboardingGoals = useAppStore(
    state => state.onboardingData?.goals ?? EMPTY_GOALS
  );
  const [isSearchViewVisible, setIsSearchViewVisible] = useState(false);
  const [isRemindersViewVisible, setIsRemindersViewVisible] = useState(false);
  const [isStreaksViewVisible, setIsStreaksViewVisible] = useState(false);
  const [profileSectionStack, setProfileSectionStack] = useState<ProfileSectionRoute[]>([]);

  const resetProfileSectionStack = () => {
    setProfileSectionStack([]);
  };

  const closeTransientViews = () => {
    setIsSearchViewVisible(false);
    setIsRemindersViewVisible(false);
    setIsStreaksViewVisible(false);
    resetProfileSectionStack();
  };

  const handleOpenNewEntry = (initialPrompt?: string) => {
    openNewEntry(
      initialPrompt
        ? {
            initialPrompt,
          }
        : undefined
    );
  };

  const openProfileSection = (route: ProfileSectionRoute) => {
    setIsSearchViewVisible(false);
    setIsRemindersViewVisible(false);
    setIsStreaksViewVisible(false);
    setProfileSectionStack(previous => [...previous, route]);
  };

  const closeProfileSection = () => {
    setProfileSectionStack(previous => previous.slice(0, -1));
  };

  const openInAppPaywall = (placementKey: string, screenKey: string) => {
    setPaywallContext({
      placementKey,
      screenKey,
      triggerMode: "contextual",
    });
    openProfileSection("paywall");
  };

  const openProfileSubscriptionPaywall = () => {
    openInAppPaywall("subscription_screen", "profile");
  };

  const closeProfilePaywallFlow = () => {
    clearPaywallContext();
    closeProfileSection();
  };

  const openSearch = () => {
    setIsRemindersViewVisible(false);
    setIsStreaksViewVisible(false);
    resetProfileSectionStack();
    onTabChange("home");
    setIsSearchViewVisible(true);
  };

  const closeSearch = () => {
    setIsSearchViewVisible(false);
  };

  const openReminders = () => {
    setIsSearchViewVisible(false);
    setIsStreaksViewVisible(false);
    resetProfileSectionStack();
    onTabChange("home");
    setIsRemindersViewVisible(true);
  };

  const closeReminders = () => {
    setIsRemindersViewVisible(false);
  };

  const handleTabPress = (nextTab: BottomNavKey) => {
    if (nextTab === "new") {
      closeTransientViews();
      handleOpenNewEntry();
      return;
    }

    if (!IMPLEMENTED_TABS.includes(nextTab)) {
      return;
    }

    closeTransientViews();
    onTabChange(nextTab);
  };

  const handleOpenStreaks = () => {
    setIsSearchViewVisible(false);
    setIsRemindersViewVisible(false);
    onTabChange("home");
    resetProfileSectionStack();
    setIsStreaksViewVisible(true);
  };

  const shellViewKey = isSearchViewVisible
    ? "search"
    : isRemindersViewVisible
    ? "reminders"
    : isStreaksViewVisible
    ? "streaks"
    : profileSectionStack.length > 0
      ? `profile:${profileSectionStack[profileSectionStack.length - 1]}`
      : activeTab;
  const shouldShowBottomNav =
    shellViewKey !== "profile:paywall" &&
    shellViewKey !== "profile:lifetime-offer";

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenTransitionHost
        activeKey={shellViewKey}
        containerStyle={styles.tabViewport}
        renderContent={currentTab => {
          if (currentTab === "search") {
            return <SearchScreen onBack={closeSearch} />;
          }

          if (currentTab === "reminders") {
            return <RemindersScreen onBack={closeReminders} />;
          }

          if (currentTab === "streaks") {
            return <StreaksScreen />;
          }

          if (currentTab.startsWith("profile:")) {
            const currentSection = currentTab.slice("profile:".length) as ProfileSectionRoute;

            switch (currentSection) {
              case "settings":
                return (
                  <SettingsScreen
                    onBack={closeProfileSection}
                    onOpenPrivacy={() => openProfileSection("privacy")}
                    onOpenPrivacyModePaywall={() =>
                      openInAppPaywall("settings_privacy_mode_locked", "settings")
                    }
                    onOpenHidePreviewsPaywall={() =>
                      openInAppPaywall("settings_hide_previews_locked", "settings")
                    }
                    onSignOut={signOut}
                    currentThemePreference={themeModeOverride ?? "system"}
                    onToggleTheme={onToggleTheme}
                  />
                );
              case "privacy":
                return (
                  <PrivacyScreen
                    onBack={closeProfileSection}
                    onOpenExportPaywall={() =>
                      openInAppPaywall("privacy_export_locked", "privacy")
                    }
                    onSignOut={signOut}
                  />
                );
              case "subscription":
                return (
                  <SubscriptionScreen
                    onBack={closeProfileSection}
                    currentPlanKey={session?.user.premiumPlanKey}
                  />
                );
              case "paywall":
                return (
                  <PaywallScreen
                    onBack={() => {
                      closeProfilePaywallFlow();
                    }}
                  />
                );
              case "lifetime-offer":
                return (
                  <LifetimeOfferPaywallScreen
                    onBack={closeProfilePaywallFlow}
                    currentPlanKey={session?.user.premiumPlanKey}
                  />
                );
              default:
                return null;
            }
          }

          switch (currentTab) {
            case "calendar":
              return <CalendarScreen />;
            case "insights":
              return <InsightsScreen />;
            case "profile":
              return (
                <ProfileScreen
                  userName={session?.user.name || "Journal User"}
                  userEmail={session?.user.email}
                  fallbackEmail={session?.user.email}
                  userGoals={session?.user.journalingGoals}
                  onboardingGoals={onboardingGoals}
                  userAvatarColor={session?.user.avatarColor}
                  userProfilePic={session?.user.profilePic}
                  isPremium={Boolean(session?.user.isPremium)}
                  onOpenStreaks={handleOpenStreaks}
                  onOpenSettings={() => openProfileSection("settings")}
                  onOpenSubscription={() => {
                    if (session?.user.isPremium) {
                      openProfileSection("subscription");
                      return;
                    }

                    openProfileSubscriptionPaywall();
                  }}
                  onOpenPrivacy={() => openProfileSection("privacy")}
                  onOpenPaywall={() => openProfileSection("lifetime-offer")}
                />
              );
            case "home":
            default:
              return (
                <HomeScreen
                  userName={session?.user.name || "Journal User"}
                  onOpenNewEntry={handleOpenNewEntry}
                  onOpenStreaks={handleOpenStreaks}
                  onOpenSearch={openSearch}
                  onOpenReminders={openReminders}
                  onToggleTheme={onToggleTheme}
                />
              );
          }
        }}
      />

      {shouldShowBottomNav ? (
        <BottomNav activeKey={activeTab} onPress={handleTabPress} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabViewport: {
    flex: 1,
  },
});
