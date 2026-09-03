import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { getCachedFreeTrialDays } from '../../services/revenueCatService';
import { useTheme } from '../../theme/provider';
import { fontFamilies } from '../../theme/typography';

type Props = {
  onContinue: () => void;
};

// The first line has to land and sit long enough that the user believes
// onboarding is over — the interrupt only works against that expectation.
const FIRST_BEAT_HOLD_MS = 1000;
const SECOND_BEAT_HOLD_MS = 1400;
const REDUCED_MOTION_HOLD_MS = 1400;
const giftIcon = require('../../assets/png/onboarding/icons8-gift-64.png');

export default function OnboardingTrialIntroScreen({ onContinue }: Props) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();

  // Synchronous read of the value primed back on the widget step, so this
  // screen's number cannot disagree with the timeline's on the next screen.
  const [trialDays] = useState(() => getCachedFreeTrialDays());

  const iconAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const offerAnim = useRef(new Animated.Value(0)).current;
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAdvancedRef = useRef(false);

  useEffect(() => {
    const advance = () => {
      if (hasAdvancedRef.current) {
        return;
      }

      hasAdvancedRef.current = true;
      onContinue();
    };

    let entrance: Animated.CompositeAnimation | null = null;

    if (reduceMotion) {
      [iconAnim, titleAnim, offerAnim].forEach(value => value.setValue(1));
      advanceTimerRef.current = setTimeout(advance, REDUCED_MOTION_HOLD_MS);
    } else {
      [iconAnim, titleAnim, offerAnim].forEach(value => value.setValue(0));

      const reveal = (value: Animated.Value, duration: number) =>
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });

      entrance = Animated.sequence([
        Animated.delay(120),
        reveal(iconAnim, 360),
        reveal(titleAnim, 320),
        Animated.delay(FIRST_BEAT_HOLD_MS),
        reveal(offerAnim, 400),
      ]);

      entrance.start(({ finished }) => {
        if (finished) {
          advanceTimerRef.current = setTimeout(advance, SECOND_BEAT_HOLD_MS);
        }
      });
    }

    return () => {
      entrance?.stop();
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, [iconAnim, offerAnim, onContinue, reduceMotion, titleAnim]);

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.screen}>
        <Animated.View
          style={[
            styles.iconBadge,
            {
              backgroundColor: theme.colors.primary + '1F',
              opacity: iconAnim,
              transform: [
                {
                  scale: iconAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                },
                {
                  translateY: iconAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={giftIcon}
            style={styles.iconImage}
          />
        </Animated.View>

        <Animated.Text
          style={[
            styles.title,
            {
              color: theme.colors.foreground,
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
          Ready to start your journey?
        </Animated.Text>

        <Animated.Text
          style={[
            styles.offer,
            {
              color: theme.colors.primary,
              opacity: offerAnim,
              transform: [
                {
                  translateY: offerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          But wait — your first {trialDays} days are free.
        </Animated.Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  iconBadge: {
    alignItems: 'center',
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    marginBottom: 24,
    width: 56,
  },
  iconImage: {
    height: 30,
    width: 30,
  },
  offer: {
    fontFamily: fontFamilies.ui.bold,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 26,
    marginTop: 20,
    textAlign: 'center',
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: fontFamilies.display.bold,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 33,
    textAlign: 'center',
  },
});
