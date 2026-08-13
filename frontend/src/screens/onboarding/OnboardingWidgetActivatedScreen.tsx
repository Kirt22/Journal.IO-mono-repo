import HapticPressable from '../../components/HapticPressable';
import { useEffect,
  useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import {
  SafeAreaView } from 'react-native-safe-area-context';
import AddWidgetDemoPhone from '../../components/AddWidgetDemoPhone';
import { Text,
} from '../../infrastructure/reactNative';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { triggerHaptic } from '../../services/hapticsService';
import { useTheme } from '../../theme/provider';

type Props = {
  didEnableWidget: boolean;
  onContinue: () => void;
};

export default function OnboardingWidgetActivatedScreen({
  didEnableWidget,
  onContinue,
}: Props) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();

  const titleAnim = useRef(new Animated.Value(0)).current;
  const frameAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let entrance: Animated.CompositeAnimation | null = null;

    if (reduceMotion) {
      [titleAnim, frameAnim, footerAnim].forEach(value => value.setValue(1));
      return;
    }

    [titleAnim, frameAnim, footerAnim].forEach(value => value.setValue(0));

    const reveal = (value: Animated.Value, duration: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    entrance = Animated.sequence([
      Animated.delay(160),
      reveal(titleAnim, 420),
      reveal(frameAnim, 480),
      reveal(footerAnim, 420),
    ]);

    entrance.start();

    return () => entrance?.stop();
  }, [footerAnim, frameAnim, reduceMotion, titleAnim]);

  const handleContinue = () => {
    triggerHaptic('primaryAction').catch(() => undefined);
    onContinue();
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.screen}>
        <Animated.View
          style={[
            styles.header,
            {
              opacity: titleAnim,
              transform: [
                {
                  translateY: titleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.colors.foreground }]}>
            {/* Never claim "active" when the widget could not be enabled. */}
            {didEnableWidget
              ? 'Your streak widget is active'
              : 'Add your streak widget'}
          </Text>
          <Text
            style={[styles.subtitle, { color: theme.colors.mutedForeground }]}
          >
            Here's how to put it on your Home Screen.
          </Text>
        </Animated.View>

        <View style={styles.frameZone}>
          <Animated.View
            style={[
              styles.frameWrap,
              {
                opacity: frameAnim,
                transform: [
                  {
                    translateY: frameAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                  {
                    scale: frameAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.97, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <AddWidgetDemoPhone />
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.footer,
            {
              opacity: footerAnim,
              transform: [
                {
                  translateY: footerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <HapticPressable
            accessibilityLabel="Continue"
            accessibilityRole="button"
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueButton,
              { backgroundColor: theme.colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.continueButtonText,
                { color: theme.colors.primaryForeground },
              ]}
            >
              Continue
            </Text>
          </HapticPressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  continueButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 56,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footer: {
    paddingBottom: 18,
    paddingTop: 12,
  },
  frameWrap: {
    alignItems: 'center',
    flex: 1,
  },
  frameZone: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  pressed: {
    opacity: 0.9,
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 30,
    textAlign: 'center',
  },
});
