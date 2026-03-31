import { StyleSheet, View } from "react-native";
import { useState } from "react";
import BottomNav, { type BottomNavKey } from "../../components/BottomNav";
import ScreenTransitionHost from "../../components/ScreenTransition";
import HomeScreen from "../HomeScreen";
import CalendarScreen from "../calendar/CalendarScreen";
import InsightsScreen from "../InsightsScreen";
import StreaksScreen from "../StreaksScreen";
import ProfileScreen from "../profile/ProfileScreen";
import { useTheme } from "../../theme/provider";
import type { ThemeMode } from "../../theme/theme";
import { useAppStore } from "../../store/appStore";

type MainAppShellProps = {
  onToggleTheme: (nextMode: ThemeMode) => void;
};

const IMPLEMENTED_TABS: BottomNavKey[] = ["home", "calendar", "insights", "profile"];

export default function MainAppShell({
  onToggleTheme,
}: MainAppShellProps) {
  const theme = useTheme();
  const activeTab = useAppStore(state => state.activeTab);
  const onTabChange = useAppStore(state => state.setActiveTab);
  const onOpenNewEntry = useAppStore(state => state.openNewEntry);
  const session = useAppStore(state => state.session);
  const onboardingGoals = useAppStore(state => state.onboardingData?.goals || []);
  const [isStreaksViewVisible, setIsStreaksViewVisible] = useState(false);

  const handleTabPress = (nextTab: BottomNavKey) => {
    if (nextTab === "new") {
      setIsStreaksViewVisible(false);
      onOpenNewEntry();
      return;
    }

    if (!IMPLEMENTED_TABS.includes(nextTab)) {
      return;
    }

    setIsStreaksViewVisible(false);
    onTabChange(nextTab);
  };

  const handleOpenStreaks = () => {
    onTabChange("home");
    setIsStreaksViewVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenTransitionHost
        activeKey={isStreaksViewVisible ? "streaks" : activeTab}
        containerStyle={styles.tabViewport}
        renderContent={currentTab => {
          if (currentTab === "streaks") {
            return <StreaksScreen />;
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
                  onOpenStreaks={handleOpenStreaks}
                />
              );
            case "home":
            default:
              return (
                <HomeScreen
                  userName={session?.user.name || "Journal User"}
                  onOpenNewEntry={onOpenNewEntry}
                  onOpenStreaks={handleOpenStreaks}
                  onToggleTheme={onToggleTheme}
                />
              );
          }
        }}
      />

      <BottomNav activeKey={activeTab} onPress={handleTabPress} />
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
