import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
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
  shellStyle?: StyleProp<ViewStyle>;
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
  shellStyle,
}: TabScreenLayoutProps) {
  const insets = useSafeAreaInsets();

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
        <ScrollView
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
    alignItems: 'center',
  },
  shell: {
    width: '100%',
    alignSelf: 'center',
  },
});
