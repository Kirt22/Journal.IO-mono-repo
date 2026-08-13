import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type ShimmerBlockProps = {
  /** Runs the sweep. Set false to leave a flat placeholder bar. */
  active?: boolean;
  baseColor: string;
  highlightColor: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A placeholder bar with a sweeping highlight, for content that is still
 * loading. Unlike the Mind Map's local copy this owns its own loop, so callers
 * only pass colours and a flag.
 */
export default function ShimmerBlock({
  active = true,
  baseColor,
  highlightColor,
  style,
}: ShimmerBlockProps) {
  const progress = useRef(new Animated.Value(-1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => mounted && setReduceMotion(enabled))
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!active || reduceMotion) {
      progress.stopAnimation();
      progress.setValue(-1);
      return undefined;
    }

    progress.setValue(-1);
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1120,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );

    animation.start();

    return () => {
      animation.stop();
      progress.stopAnimation();
    };
  }, [active, progress, reduceMotion]);

  return (
    <View style={[styles.block, { backgroundColor: baseColor }, style]}>
      {reduceMotion ? null : (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sheen,
            {
              backgroundColor: highlightColor,
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [-1, 1],
                    outputRange: [-168, 264],
                  }),
                },
              ],
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 92,
    opacity: 0.82,
  },
});
