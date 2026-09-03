import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { Text } from '../infrastructure/reactNative';

const WAVE_DELAY_MS = 220;
const WAVE_OUT_DURATION_MS = 520;
const WAVE_RETURN_DURATION_MS = 420;
const EMPHASIS_SETTLE_DURATION_MS = 380;
const DEFAULT_PEAK_SCALE = 1.22;

type WavingHandIconProps = {
  size?: number;
  testID?: string;
  /**
   * Grows the hand while it waves and settles it back to its resting size once
   * the wave finishes. Opt-in so inline usages stay a plain rotation.
   */
  emphasizeOnMount?: boolean;
  peakScale?: number;
};

export default function WavingHandIcon({
  size = 24,
  testID,
  emphasizeOnMount = false,
  peakScale = DEFAULT_PEAK_SCALE,
}: WavingHandIconProps) {
  const handWave = useRef(new Animated.Value(0)).current;
  const handScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let isActive = true;
    let animation: Animated.CompositeAnimation | null = null;
    let runtimeReduceMotionPreference: boolean | null = null;

    const settleStatic = () => {
      animation?.stop();
      animation = null;
      handWave.setValue(0);
      handScale.setValue(1);
    };

    const playWave = () => {
      if (!isActive || animation) {
        return;
      }

      handWave.setValue(0);
      const waveSequence = Animated.sequence([
        Animated.delay(WAVE_DELAY_MS),
        Animated.timing(handWave, {
          toValue: 1,
          duration: WAVE_OUT_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(handWave, {
          toValue: 0,
          duration: WAVE_RETURN_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

      if (!emphasizeOnMount) {
        animation = waveSequence;
      } else {
        handScale.setValue(1);
        animation = Animated.parallel([
          waveSequence,
          // Swells as the hand swings out, holds through the swing back, then
          // eases down to the resting size the moment the wave is done.
          Animated.sequence([
            Animated.delay(WAVE_DELAY_MS),
            Animated.timing(handScale, {
              toValue: peakScale,
              duration: WAVE_OUT_DURATION_MS,
              easing: Easing.out(Easing.back(1.4)),
              useNativeDriver: true,
            }),
            Animated.delay(WAVE_RETURN_DURATION_MS),
            Animated.timing(handScale, {
              toValue: 1,
              duration: EMPHASIS_SETTLE_DURATION_MS,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ]);
      }

      animation.start(() => {
        animation = null;
      });
    };

    const handleReduceMotionChange = (enabled: boolean) => {
      runtimeReduceMotionPreference = enabled;
      if (enabled) {
        settleStatic();
      } else {
        playWave();
      }
    };

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      handleReduceMotionChange,
    );

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (!isActive) {
          return;
        }

        const shouldReduceMotion = runtimeReduceMotionPreference ?? enabled;
        if (shouldReduceMotion) {
          settleStatic();
        } else {
          playWave();
        }
      })
      .catch(() => {
        if (runtimeReduceMotionPreference !== true) {
          playWave();
        }
      });

    return () => {
      isActive = false;
      subscription.remove();
      animation?.stop();
    };
  }, [emphasizeOnMount, handScale, handWave, peakScale]);

  return (
    <Animated.View
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={[
        styles.handWave,
        {
          transform: [
            {
              rotate: handWave.interpolate({
                inputRange: [0, 0.35, 0.7, 1],
                outputRange: ['0deg', '-18deg', '16deg', '0deg'],
              }),
            },
            { scale: handScale },
          ],
        },
      ]}
    >
      <Text
        style={[
          styles.handEmoji,
          { fontSize: size, lineHeight: Math.round(size * 1.17) },
        ]}
      >
        👋
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  handWave: {
    transformOrigin: '80% 80%',
  },
  handEmoji: {
    textAlign: 'center',
  },
});
