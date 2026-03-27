import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BOTTOM_NAV_CONTENT_PADDING } from "./BottomNav";

type TabScreenLayoutProps = {
  backgroundColor: string;
  children: ReactNode;
  horizontalPadding: number;
  layoutMaxWidth: number;
  scrollContentStyle?: StyleProp<ViewStyle>;
  shellStyle?: StyleProp<ViewStyle>;
};

export default function TabScreenLayout({
  backgroundColor,
  children,
  horizontalPadding,
  layoutMaxWidth,
  scrollContentStyle,
  shellStyle,
}: TabScreenLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor }]}
    >
      <View style={[styles.container, { backgroundColor }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: insets.bottom + BOTTOM_NAV_CONTENT_PADDING,
              backgroundColor,
            },
            scrollContentStyle,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.shell, { maxWidth: layoutMaxWidth }, shellStyle]}>
            {children}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
  },
  shell: {
    width: "100%",
    alignSelf: "center",
  },
});
