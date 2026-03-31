import { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Calendar,
  Home,
  PlusCircle,
  TrendingUp,
  User,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/provider";

type BottomNavItem = {
  icon: typeof Home;
  label: string;
  key: "home" | "calendar" | "new" | "insights" | "profile";
  primary?: boolean;
};

export type BottomNavKey = BottomNavItem["key"];

type BottomNavProps = {
  activeKey?: BottomNavKey;
  onPress?: (key: BottomNavKey) => void;
};

const navItems: BottomNavItem[] = [
  { icon: Home, label: "Home", key: "home" },
  { icon: Calendar, label: "Calendar", key: "calendar" },
  { icon: PlusCircle, label: "New", key: "new", primary: true },
  { icon: TrendingUp, label: "Insights", key: "insights" },
  { icon: User, label: "Profile", key: "profile" },
];

export const BOTTOM_NAV_CONTENT_PADDING = 132;
const NAV_INNER_PADDING_BOTTOM = 0;

export default function BottomNav({
  activeKey = "home",
  onPress,
}: BottomNavProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const lastLoggedKeyRef = useRef<BottomNavKey | null>(null);

  const barStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.card,
      borderTopColor: theme.colors.border,
    }),
    [theme.colors.border, theme.colors.card]
  );

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    if (lastLoggedKeyRef.current === activeKey) {
      return;
    }

    lastLoggedKeyRef.current = activeKey;
    console.log("[BottomNav] activeKey changed", activeKey);
  }, [activeKey]);

  const handleLayout = (event: {
    nativeEvent: { layout: { width: number; height: number } };
  }) => {
    if (!__DEV__) {
      return;
    }

    const { width, height } = event.nativeEvent.layout;
    console.log("[BottomNav] container size", { width, height });
  };

  const handlePress = (key: BottomNavKey) => {
    if (__DEV__) {
      console.log("[BottomNav] navigate", { from: activeKey, to: key });
    }

    onPress?.(key);
  };

  return (
    <View
      style={styles.wrapper}
      pointerEvents="box-none"
      onLayout={handleLayout}
    >
      <View style={styles.controlsShell} pointerEvents="box-none">
        {/* <Svg width="100%" height={24} style={styles.fade}>
          <Defs>
            <LinearGradient id="nav-fade" x1="0" y1="0" x2="0" y2="1">
              <Stop
                offset="0%"
                stopColor={theme.colors.background}
                stopOpacity="0"
              />
              <Stop
                offset="100%"
                stopColor={theme.colors.background}
                stopOpacity="1"
              />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="24" fill="url(#nav-fade)" />
        </Svg> */}

        <View style={[styles.bar, barStyle]}>
          <View
            style={[
              styles.inner,
              { paddingBottom: insets.bottom + NAV_INNER_PADDING_BOTTOM },
            ]}
          >
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = item.key === activeKey;

              if (item.primary) {
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    onPress={() => handlePress(item.key)}
                    style={({ pressed }) => [
                      styles.primaryButtonWrap,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.primaryButton,
                        { backgroundColor: theme.colors.primary },
                      ]}
                    >
                      <Icon color={theme.colors.primaryForeground} size={24} />
                    </View>
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => handlePress(item.key)}
                  style={({ pressed }) => [
                    styles.tabButton,
                    pressed && styles.pressed,
                  ]}
                >
                  {isActive ? (
                    <View
                      style={[
                        styles.activePill,
                        { backgroundColor: `${theme.colors.primary}14` },
                      ]}
                    />
                  ) : null}
                  <Icon
                    size={20}
                    color={isActive ? theme.colors.primary : theme.colors.mutedForeground}
                    style={styles.tabIcon}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color: isActive
                          ? theme.colors.primary
                          : theme.colors.mutedForeground,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  controlsShell: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  fade: {
    width: "100%",
    marginBottom: -1,
  },
  bar: {
    borderTopWidth: 1,
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: "hidden",
  },
  activePill: {
    position: "absolute",
    top: 2,
    right: 12,
    bottom: 2,
    left: 12,
    borderRadius: 10,
  },
  tabIcon: {
    position: "relative",
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 10,
    position: "relative",
    zIndex: 1,
  },
  primaryButtonWrap: {
    marginTop: -20,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  pressed: {
    // opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
});
