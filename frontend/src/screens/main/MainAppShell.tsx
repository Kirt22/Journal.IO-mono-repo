import { StyleSheet, View } from "react-native";
import BottomNav, { type BottomNavKey } from "../../components/BottomNav";
import ScreenTransitionHost from "../../components/ScreenTransition";
import HomeScreen from "../HomeScreen";
import CalendarScreen from "../calendar/CalendarScreen";
import InsightsScreen from "../InsightsScreen";
import ProfileScreen from "../profile/ProfileScreen";
import { useTheme } from "../../theme/provider";
import type { ThemeMode } from "../../theme/theme";

type MainAppShellProps = {
  activeTab: BottomNavKey;
  onTabChange: (nextTab: BottomNavKey) => void;
  onOpenNewEntry: () => void;
  onToggleTheme: (nextMode: ThemeMode) => void;
  userName?: string;
  userEmail?: string | null;
  userGoals?: string[];
  onboardingGoals?: string[];
  userAvatarColor?: string | null;
  userProfilePic?: string | null;
};

const IMPLEMENTED_TABS: BottomNavKey[] = ["home", "calendar", "insights", "profile"];

export default function MainAppShell({
  activeTab,
  onTabChange,
  onOpenNewEntry,
  onToggleTheme,
  userName,
  userEmail,
  userGoals,
  onboardingGoals,
  userAvatarColor,
  userProfilePic,
}: MainAppShellProps) {
  const theme = useTheme();

  const handleTabPress = (nextTab: BottomNavKey) => {
    if (nextTab === "new") {
      onOpenNewEntry();
      return;
    }

    if (!IMPLEMENTED_TABS.includes(nextTab)) {
      return;
    }

    onTabChange(nextTab);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenTransitionHost
        activeKey={activeTab}
        containerStyle={styles.tabViewport}
        renderContent={currentTab => {
          switch (currentTab) {
            case "calendar":
              return <CalendarScreen />;
            case "insights":
              return <InsightsScreen />;
            case "profile":
              return (
                <ProfileScreen
                  userName={userName}
                  userEmail={userEmail}
                  fallbackEmail={userEmail}
                  userGoals={userGoals}
                  onboardingGoals={onboardingGoals}
                  userAvatarColor={userAvatarColor}
                  userProfilePic={userProfilePic}
                />
              );
            case "home":
            default:
              return (
                <HomeScreen
                  userName={userName}
                  onOpenNewEntry={onOpenNewEntry}
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
