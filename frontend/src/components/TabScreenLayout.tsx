import type { ReactNode, RefObject } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { BOTTOM_NAV_CONTENT_PADDING } from './BottomNav';

type TabScreenLayoutProps = {
  backgroundColor: string;
  safeAreaBackgroundColor?: string;
  children: ReactNode;
  header?: ReactNode;
  horizontalPadding: number;
  layoutMaxWidth: number;
  bottomPadding?: number;
  scrollContentStyle?: StyleProp<ViewStyle>;
  scrollViewRef?: RefObject<ScrollView | null>;
  onScroll?: ScrollViewProps['onScroll'];
  scrollEventThrottle?: number;
  shellStyle?: StyleProp<ViewStyle>;
  /**
   * Renders the list through `Animated.ScrollView` so an `Animated.event`
   * passed to `onScroll` can run on the native driver.
   */
  useAnimatedScroll?: boolean;
};

export default function TabScreenLayout({
  backgroundColor,
  safeAreaBackgroundColor,
  children,
  header,
  horizontalPadding,
  layoutMaxWidth,
  bottomPadding = BOTTOM_NAV_CONTENT_PADDING,
  scrollContentStyle,
  scrollViewRef,
  onScroll,
  scrollEventThrottle,
  shellStyle,
  useAnimatedScroll = false,
}: TabScreenLayoutProps) {
  const insets = useSafeAreaInsets();
  const ScrollContainer = (
    useAnimatedScroll ? Animated.ScrollView : ScrollView
  ) as typeof ScrollView;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[
        styles.safeArea,
        { backgroundColor: safeAreaBackgroundColor || backgroundColor },
      ]}
    >
      <View style={[styles.container, { backgroundColor }]}>
        {header}
        <ScrollContainer
          ref={scrollViewRef}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: insets.bottom + bottomPadding,
              backgroundColor,
            },
            scrollContentStyle,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[styles.shell, { maxWidth: layoutMaxWidth }, shellStyle]}
          >
            {children}
          </View>
        </ScrollContainer>
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
    alignItems: 'center',
  },
  shell: {
    width: '100%',
    alignSelf: 'center',
  },
});
