import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { BOTTOM_NAV_CONTENT_PADDING } from "../../components/BottomNav";
import { useTheme } from "../../theme/provider";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type ProfileSectionLayoutProps = {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
  backgroundTintColor?: string | null;
};

export function ProfileSectionLayout({
  title,
  subtitle,
  onBack,
  children,
  footer,
  backgroundTintColor = null,
}: ProfileSectionLayoutProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 24;
  const layoutMaxWidth = isWide ? 460 : 420;

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {backgroundTintColor ? (
          <View
            pointerEvents="none"
            style={[
              styles.backgroundTint,
              {
                backgroundColor: backgroundTintColor,
              },
            ]}
          />
        ) : null}
        <View
          style={[
            styles.headerShell,
            {
              backgroundColor: theme.colors.background,
              borderBottomColor: theme.colors.border,
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
          <View style={[styles.header, { maxWidth: layoutMaxWidth }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={onBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <ArrowLeft size={19} color={theme.colors.foreground} />
            </Pressable>

            <View style={styles.headerTextWrap}>
              <Text style={[styles.title, { color: theme.colors.foreground }]}>
                {title}
              </Text>
              {subtitle ? (
                <Text
                  style={[
                    styles.subtitle,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: insets.bottom + BOTTOM_NAV_CONTENT_PADDING,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.shell, { maxWidth: layoutMaxWidth }]}>
            <View style={styles.body}>{children}</View>

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

type SectionCardProps = {
  children: ReactNode;
  borderColor?: string;
  backgroundColor?: string;
  style?: ViewStyle;
};

export function SectionCard({
  children,
  borderColor,
  backgroundColor,
  style,
}: SectionCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: backgroundColor || theme.colors.card,
          borderColor: borderColor || theme.colors.border,
          shadowColor: theme.colors.foreground,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  backgroundTint: {
    ...StyleSheet.absoluteFillObject,
  },
  headerShell: {
    borderBottomWidth: 1,
    paddingTop: 12,
    paddingBottom: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    alignSelf: "center",
    width: "100%",
  },
  shell: {
    alignSelf: "center",
    width: "100%",
    paddingTop: 20,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backButton: {
    padding: 0,
  },
  pressed: {
    opacity: 0.8,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 20,
  },
  body: {
    gap: 16,
  },
  footer: {
    marginTop: 20,
  },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 1,
  },
});
