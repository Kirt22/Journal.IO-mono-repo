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

type WavingHandIconProps = {
  size?: number;
  testID?: string;
};

export default function WavingHandIcon({
  size = 24,
  testID,
}: WavingHandIconProps) {
  const handWave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isActive = true;
    let animation: Animated.CompositeAnimation | null = null;
    let runtimeReduceMotionPreference: boolean | null = null;

    const settleStatic = () => {
      animation?.stop();
      animation = null;
      handWave.setValue(0);
    };

    const playWave = () => {
      if (!isActive || animation) {
        return;
      }

      handWave.setValue(0);
      animation = Animated.sequence([
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
  }, [handWave]);

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
