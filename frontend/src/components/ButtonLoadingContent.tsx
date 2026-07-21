import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type ButtonLoadingContentProps = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  loader?: ReactNode;
  loaderColor: ColorValue;
  loaderSize?: 'small' | 'large' | number;
  loading: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Keeps an action's bounds stable while its content folds away before its
 * progress indicator becomes visible.
 */
export default function ButtonLoadingContent({
  children,
  contentStyle,
  loader,
  loaderColor,
  loaderSize = 'small',
  loading,
  style,
}: ButtonLoadingContentProps) {
  const progress = useRef(new Animated.Value(loading ? 1 : 0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let isActive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (isActive) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    progress.stopAnimation();

    if (reduceMotion) {
      progress.setValue(loading ? 1 : 0);
      return undefined;
    }

    const animation = Animated.timing(progress, {
      toValue: loading ? 1 : 0,
      duration: loading ? 160 : 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [loading, progress, reduceMotion]);

  const contentAnimatedStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 0.62, 1],
      outputRange: [1, 0, 0],
    }),
    transform: [
      {
        scaleX: progress.interpolate({
          inputRange: [0, 0.62, 1],
          outputRange: [1, 0.01, 0.01],
        }),
      },
    ],
  };
  const loaderAnimatedStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 0.62, 1],
      outputRange: [0, 0, 1],
    }),
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 0.62, 1],
          outputRange: [0.72, 0.72, 1],
        }),
      },
    ],
  };

  return (
    <View style={[styles.root, style]}>
      <Animated.View style={[contentStyle, contentAnimatedStyle]}>
        {children}
      </Animated.View>
      <Animated.View
        accessible={false}
        pointerEvents="none"
        style={[styles.loader, loaderAnimatedStyle]}
      >
        {loader ?? <ActivityIndicator color={loaderColor} size={loaderSize} />}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
