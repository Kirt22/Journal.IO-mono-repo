import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../../infrastructure/reactNative';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/provider';
import JournalLoader from '../../components/JournalLoader';
import { fontFamilies } from '../../theme/typography';

type Props = {
  onComplete: () => void;
  variant?: 'first' | 'session';
};

const LOADER_COPY = [
  'Gathering the moments you shared',
  'Finding the signals that matter',
  'Connecting what you noticed',
];
const LOADER_DURATION_MS = 3200;
const COPY_ROTATION_MS = 1400;

export default function OnboardingMindMapLoaderScreen({
  onComplete,
  variant = 'first',
}: Props) {
  const theme = useTheme();
  const [copyIndex, setCopyIndex] = useState(0);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const copyOpacity = useRef(new Animated.Value(1)).current;
  const didComplete = useRef(false);

  useEffect(() => {
    let isActive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => {
        if (isActive) {
          setReduceMotionEnabled(value);
        }
      })
      .catch(() => {
        if (isActive) {
          setReduceMotionEnabled(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const completionTimer = setTimeout(() => {
      if (didComplete.current) {
        return;
      }

      didComplete.current = true;
      onComplete();
    }, LOADER_DURATION_MS);

    if (reduceMotionEnabled) {
      return () => clearTimeout(completionTimer);
    }

    const rotationTimer = setInterval(() => {
      Animated.timing(copyOpacity, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          return;
        }

        setCopyIndex(current => (current + 1) % LOADER_COPY.length);
        Animated.timing(copyOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    }, COPY_ROTATION_MS);

    return () => {
      clearTimeout(completionTimer);
      clearInterval(rotationTimer);
      copyOpacity.stopAnimation();
    };
  }, [copyOpacity, onComplete, reduceMotionEnabled]);

  const copy = reduceMotionEnabled ? LOADER_COPY[0] : LOADER_COPY[copyIndex];
  const isSessionMap = variant === 'session';
  const title = isSessionMap
    ? 'Building your session Mind Map'
    : 'Building your first Mind Map';

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.content}>
        <View
          style={[styles.orb, { backgroundColor: `${theme.colors.primary}1A` }]}
        >
          <JournalLoader
            accessibilityLabel={title}
            color={theme.colors.primary}
            size="large"
          />
        </View>
        <Text style={[styles.title, { color: theme.colors.foreground }]}>
          {title}
        </Text>
        <Animated.Text
          accessibilityLiveRegion="polite"
          style={[
            styles.copy,
            { color: theme.colors.mutedForeground, opacity: copyOpacity },
          ]}
        >
          {copy}
        </Animated.Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  orb: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  copy: {
    fontFamily: fontFamilies.ui.regular,
    marginTop: 14,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});
