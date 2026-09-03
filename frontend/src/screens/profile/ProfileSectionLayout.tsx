import HapticPressable from '../../components/HapticPressable';
import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  type ScrollViewProps,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import {
  Text,
} from '../../infrastructure/reactNative';
import { ArrowLeft } from 'lucide-react-native';
import { BOTTOM_NAV_CONTENT_PADDING } from '../../components/BottomNav';
import { useTheme } from '../../theme/provider';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

type ProfileSectionLayoutProps = {
  title: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
  backgroundTintColor?: string | null;
  onScroll?: ScrollViewProps['onScroll'];
  scrollEventThrottle?: number;
};

export function ProfileSectionLayout({
  title,
  onBack,
  children,
  footer,
  backgroundTintColor = null,
  onScroll,
  scrollEventThrottle,
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
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
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
            <HapticPressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={onBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <ArrowLeft size={19} color={theme.colors.foreground} />
            </HapticPressable>

            <View style={styles.headerTextWrap}>
              <Text style={[styles.title, { color: theme.colors.foreground }]}>
                {title}
              </Text>
            </View>
            <View style={styles.headerSideSpacer} />
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
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
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
    paddingBottom: 12,
    paddingTop: 10,
  },
  header: {
    alignItems: 'center',
    gap: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
    width: '100%',
  },
  shell: {
    alignSelf: 'center',
    width: '100%',
    paddingTop: 20,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  pressed: {
    opacity: 0.8,
  },
  headerTextWrap: {
    alignItems: 'center',
    flex: 1,
  },
  headerSideSpacer: {
    height: 38,
    width: 38,
  },
  title: {
    fontSize: 16,
    fontWeight: '400',
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
