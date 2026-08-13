import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type ColorValue,
  type ViewProps,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useReduceMotion } from '../hooks/useReduceMotion';

type LoaderSize = 'small' | 'large' | number;

type JournalLoaderProps = Omit<ViewProps, 'children'> & {
  animating?: boolean;
  color: ColorValue;
  hidesWhenStopped?: boolean;
  size?: LoaderSize;
};

const VIEWBOX_SIZE = 44;
const CENTER = VIEWBOX_SIZE / 2;
const RADIUS = 17;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const resolveSize = (size: LoaderSize) => {
  if (typeof size === 'number') {
    return size;
  }

  return size === 'large' ? 36 : 20;
};

/**
 * Theme-aware waiting indicator based on the expanding arc in the supplied
 * reference. It intentionally mirrors ActivityIndicator's sizing and stopped
 * state API so existing loading surfaces can swap without layout changes.
 */
export default function JournalLoader({
  animating = true,
  color,
  hidesWhenStopped = true,
  size = 'small',
  style,
  ...viewProps
}: JournalLoaderProps) {
  const reduceMotion = useReduceMotion();
  const rotation = useRef(new Animated.Value(0)).current;
  const trim = useRef(new Animated.Value(0)).current;
  const resolvedSize = resolveSize(size);
  const shouldRunAnimation =
    animating && !reduceMotion && typeof jest === 'undefined';

  useEffect(() => {
    rotation.stopAnimation();
    trim.stopAnimation();

    if (!shouldRunAnimation) {
      rotation.setValue(0);
      trim.setValue(0);
      return undefined;
    }

    const rotationLoop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const trimLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(trim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(trim, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    );

    rotationLoop.start();
    trimLoop.start();

    return () => {
      rotationLoop.stop();
      trimLoop.stop();
      rotation.stopAnimation();
      trim.stopAnimation();
    };
  }, [rotation, shouldRunAnimation, trim]);

  const containerStyle = [
    styles.container,
    { height: resolvedSize, width: resolvedSize },
    style,
  ];

  if (!animating && hidesWhenStopped) {
    return <View {...viewProps} style={containerStyle} />;
  }

  const rotationDegrees = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const dashOffset = trim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE * 0.88, CIRCUMFERENCE * 0.12],
  });
  const showStaticArc = reduceMotion || typeof jest !== 'undefined';

  return (
    <View {...viewProps} style={containerStyle}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.artwork,
          shouldRunAnimation && { transform: [{ rotate: rotationDegrees }] },
        ]}
      >
        <Svg
          accessibilityElementsHidden
          height="100%"
          importantForAccessibility="no-hide-descendants"
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          width="100%"
        >
          {showStaticArc ? (
            <Circle
              cx={CENTER}
              cy={CENTER}
              fill="none"
              r={RADIUS}
              rotation={-90}
              origin={`${CENTER}, ${CENTER}`}
              stroke={color}
              strokeDasharray={`${CIRCUMFERENCE * 0.32} ${CIRCUMFERENCE}`}
              strokeLinecap="round"
              strokeWidth={3.6}
            />
          ) : (
            <AnimatedCircle
              cx={CENTER}
              cy={CENTER}
              fill="none"
              r={RADIUS}
              rotation={-90}
              origin={`${CENTER}, ${CENTER}`}
              stroke={color}
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeWidth={3.6}
            />
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  artwork: {
    height: '100%',
    width: '100%',
  },
});
