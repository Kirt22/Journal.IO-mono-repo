import HapticPressable from './HapticPressable';
import {
  useEffect,
  useMemo,
  useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import {
  Home,
  PlusCircle,
  User,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/provider';

// The bar is capped so it does not stretch edge to edge on a tablet — the app
// ships for iPhone and iPad alike. On a phone it has to stay full-bleed, and at
// a flat 430 it stopped doing that on the 440pt devices (16/17 Pro Max), which
// showed a strip of background down each side of the bar and a top hairline
// that ended short of both edges. Splitting the two cases at a width no phone
// reaches and no iPad falls below leaves every phone untouched.
const TABLET_MIN_WIDTH = 600;
const TABLET_BAR_MAX_WIDTH = 430;

export function getBottomNavBarMaxWidth(width: number) {
  return width >= TABLET_MIN_WIDTH ? TABLET_BAR_MAX_WIDTH : undefined;
}

const HOME_TAB_ICON = require('../assets/png/navigation/icons8-home-64.png');
const ENTRIES_TAB_ICON = require('../assets/png/navigation/icons8-list-64.png');
const MINDMAP_TAB_ICON = require('../assets/png/navigation/icons8-brain-100.png');
const INSIGHTS_TAB_ICON = require('../assets/png/insights/icons8-combo-chart-100.png');

type BottomNavItem = {
  icon?: typeof Home;
  image?: ImageSourcePropType;
  label: string;
  key: 'home' | 'calendar' | 'new' | 'insights' | 'mindmap' | 'profile';
  primary?: boolean;
};

export type BottomNavKey = BottomNavItem['key'];

type BottomNavProps = {
  activeKey?: BottomNavKey;
  onPress?: (key: BottomNavKey) => void;
  shouldAnimateEntrance?: boolean;
};

const sharedNavItems: BottomNavItem[] = [
  { image: HOME_TAB_ICON, label: 'Home', key: 'home' },
  { image: ENTRIES_TAB_ICON, label: 'Entries', key: 'calendar' },
  { icon: PlusCircle, label: 'New', key: 'new', primary: true },
  { image: INSIGHTS_TAB_ICON, label: 'Insights', key: 'insights' },
];

const navItems: BottomNavItem[] = [
  ...sharedNavItems,
  Platform.OS === 'ios'
    ? { image: MINDMAP_TAB_ICON, label: 'Mind Map', key: 'mindmap' }
    : { icon: User, label: 'Profile', key: 'profile' },
];

export const BOTTOM_NAV_CONTENT_PADDING = 132;
const NAV_INNER_PADDING_BOTTOM = 0;

export default function BottomNav({
  activeKey = 'home',
  onPress,
  shouldAnimateEntrance = false,
}: BottomNavProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const shouldAnimateEntranceOnMount = useRef(shouldAnimateEntrance).current;
  const entranceProgress = useRef(
    new Animated.Value(shouldAnimateEntranceOnMount ? 0 : 1),
  ).current;

  useEffect(() => {
    if (!shouldAnimateEntranceOnMount || typeof jest !== 'undefined') {
      entranceProgress.setValue(1);
      return;
    }

    entranceProgress.setValue(0);

    const animation = Animated.timing(entranceProgress, {
      toValue: 1,
      duration: 360,
      delay: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [entranceProgress, shouldAnimateEntranceOnMount]);

  const { width } = useWindowDimensions();
  const barStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.card,
      borderTopColor: theme.colors.border,
      maxWidth: getBottomNavBarMaxWidth(width),
    }),
    [theme.colors.border, theme.colors.card, width],
  );

  const handlePress = (key: BottomNavKey) => {
    onPress?.(key);
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          opacity: entranceProgress,
          transform: [
            {
              translateY: entranceProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [44, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.controlsShell} pointerEvents="box-none">
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
                  <HapticPressable
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
                      {Icon ? (
                        <Icon
                          color={theme.colors.primaryForeground}
                          size={24}
                        />
                      ) : null}
                    </View>
                  </HapticPressable>
                );
              }

              return (
                <HapticPressable
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
                  {Icon ? (
                    <Icon
                      size={20}
                      color={
                        isActive
                          ? theme.colors.primary
                          : theme.colors.mutedForeground
                      }
                      style={styles.tabIcon}
                    />
                  ) : item.image ? (
                    <Image
                      source={item.image}
                      style={[styles.tabIcon, styles.tabIconImage]}
                    />
                  ) : null}
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
                </HapticPressable>
              );
            })}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  controlsShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  fade: {
    width: '100%',
    marginBottom: -1,
  },
  bar: {
    borderTopWidth: 1,
    width: '100%',
    alignSelf: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
  },
  activePill: {
    position: 'absolute',
    top: 2,
    right: 12,
    bottom: 2,
    left: 12,
    borderRadius: 10,
  },
  tabIcon: {
    position: 'relative',
    zIndex: 1,
  },
  tabIconImage: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  tabLabel: {
    fontSize: 10,
    position: 'relative',
    zIndex: 1,
  },
  primaryButtonWrap: {
    marginTop: -20,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
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
