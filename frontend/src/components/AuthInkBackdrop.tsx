import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Defs, Path, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';
import { useTheme } from '../theme/provider';

export type AuthInkBackdropProps = {
  animateWaves?: boolean;
  progress?: Animated.Value;
};

const UPPER_WAVE_CYCLE_DURATION = 7600;
const MIDDLE_WAVE_CYCLE_DURATION = 9200;
const LOWER_WAVE_CYCLE_DURATION = 10800;

function createWaveLoop(value: Animated.Value, duration: number) {
  const easing = Easing.inOut(Easing.sin);

  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, {
        toValue: 1,
        duration: duration * 0.25,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 0,
        duration: duration * 0.5,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 0.5,
        duration: duration * 0.25,
        easing,
        useNativeDriver: true,
      }),
    ]),
  );
}

export default function AuthInkBackdrop({
  animateWaves = typeof jest === 'undefined',
  progress,
}: AuthInkBackdropProps) {
  const theme = useTheme();
  const { height, width } = useWindowDimensions();
  const settledProgress = useRef(new Animated.Value(1)).current;
  const entranceProgress = progress ?? settledProgress;
  const upperWavePhase = useRef(new Animated.Value(0.5)).current;
  const middleWavePhase = useRef(new Animated.Value(0.5)).current;
  const lowerWavePhase = useRef(new Animated.Value(0.5)).current;
  const longestEdge = Math.max(width, height);
  const primaryWashRadius = longestEdge * 0.62;
  const secondaryWashRadius = longestEdge * 0.68;

  const upperContour = [
    `M ${-width * 0.16} ${height * 0.24}`,
    `C ${width * 0.12} ${height * 0.13}, ${width * 0.31} ${height * 0.35}, ${
      width * 0.57
    } ${height * 0.25}`,
    `S ${width * 0.98} ${height * 0.13}, ${width * 1.16} ${height * 0.3}`,
  ].join(' ');
  const middleContour = [
    `M ${-width * 0.18} ${height * 0.53}`,
    `C ${width * 0.12} ${height * 0.42}, ${width * 0.34} ${height * 0.63}, ${
      width * 0.62
    } ${height * 0.5}`,
    `S ${width * 1.02} ${height * 0.38}, ${width * 1.18} ${height * 0.57}`,
  ].join(' ');
  const lowerContour = [
    `M ${-width * 0.14} ${height * 0.79}`,
    `C ${width * 0.17} ${height * 0.67}, ${width * 0.39} ${height * 0.88}, ${
      width * 0.67
    } ${height * 0.74}`,
    `S ${width * 1.01} ${height * 0.66}, ${width * 1.14} ${height * 0.84}`,
  ].join(' ');

  useEffect(() => {
    if (!animateWaves) {
      return;
    }

    let isActive = true;
    let animations: Animated.CompositeAnimation[] = [];
    let runtimeReduceMotionPreference: boolean | null = null;
    const phases = [upperWavePhase, middleWavePhase, lowerWavePhase];

    const stopAnimations = () => {
      animations.forEach(animation => animation.stop());
      animations = [];
      phases.forEach(phase => phase.setValue(0.5));
    };

    const startAnimations = () => {
      if (!isActive || animations.length > 0) {
        return;
      }

      phases.forEach(phase => phase.setValue(0.5));
      animations = [
        createWaveLoop(upperWavePhase, UPPER_WAVE_CYCLE_DURATION),
        createWaveLoop(middleWavePhase, MIDDLE_WAVE_CYCLE_DURATION),
        createWaveLoop(lowerWavePhase, LOWER_WAVE_CYCLE_DURATION),
      ];
      animations.forEach(animation => animation.start());
    };

    const handleReduceMotionChange = (enabled: boolean) => {
      runtimeReduceMotionPreference = enabled;
      if (enabled) {
        stopAnimations();
      } else {
        startAnimations();
      }
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (!isActive) {
          return;
        }

        const shouldReduceMotion = runtimeReduceMotionPreference ?? enabled;
        if (shouldReduceMotion) {
          stopAnimations();
        } else {
          startAnimations();
        }
      })
      .catch(() => {
        if (runtimeReduceMotionPreference !== true) {
          startAnimations();
        }
      });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      handleReduceMotionChange,
    );

    return () => {
      isActive = false;
      subscription.remove();
      stopAnimations();
    };
  }, [animateWaves, lowerWavePhase, middleWavePhase, upperWavePhase]);

  const entranceStyle = {
    opacity: entranceProgress.interpolate({
      inputRange: [0, 0.24, 1],
      outputRange: [0, 0.42, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: entranceProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [28, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: entranceProgress.interpolate({
          inputRange: [0, 0.72, 1],
          outputRange: [1.06, 1.012, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  } as const;
  const upperWaveStyle = {
    transform: [
      {
        translateX: upperWavePhase.interpolate({
          inputRange: [0, 1],
          outputRange: [-12, 12],
        }),
      },
      {
        translateY: upperWavePhase.interpolate({
          inputRange: [0, 1],
          outputRange: [3, -3],
        }),
      },
      {
        scaleX: upperWavePhase.interpolate({
          inputRange: [0, 1],
          outputRange: [0.994, 1.012],
        }),
      },
    ],
  } as const;
  const middleWaveStyle = {
    transform: [
      {
        translateX: middleWavePhase.interpolate({
          inputRange: [0, 1],
          outputRange: [9, -9],
        }),
      },
      {
        translateY: middleWavePhase.interpolate({
          inputRange: [0, 1],
          outputRange: [-4, 4],
        }),
      },
      {
        scaleX: middleWavePhase.interpolate({
          inputRange: [0, 1],
          outputRange: [1.01, 0.996],
        }),
      },
    ],
  } as const;
  const lowerWaveStyle = {
    transform: [
      {
        translateX: lowerWavePhase.interpolate({
          inputRange: [0, 1],
          outputRange: [-7, 7],
        }),
      },
      {
        translateY: lowerWavePhase.interpolate({
          inputRange: [0, 1],
          outputRange: [3, -3],
        }),
      },
      {
        scaleX: lowerWavePhase.interpolate({
          inputRange: [0, 1],
          outputRange: [0.997, 1.008],
        }),
      },
    ],
  } as const;

  return (
    <Animated.View
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="auth-ink-backdrop"
      style={[styles.backdrop, { height, width }, entranceStyle]}
    >
      <Svg
        accessible={false}
        height={height}
        pointerEvents="none"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <Defs>
          <RadialGradient
            id="authInkPrimaryWash"
            cx={width * 0.12}
            cy={height * 0.16}
            gradientUnits="userSpaceOnUse"
            r={primaryWashRadius}
          >
            <Stop
              offset="0"
              stopColor={theme.colors.primary}
              stopOpacity={0.17}
            />
            <Stop
              offset="0.5"
              stopColor={theme.colors.primary}
              stopOpacity={0.055}
            />
            <Stop offset="1" stopColor={theme.colors.primary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient
            id="authInkSecondaryWash"
            cx={width * 0.9}
            cy={height * 0.76}
            gradientUnits="userSpaceOnUse"
            r={secondaryWashRadius}
          >
            <Stop
              offset="0"
              stopColor={theme.colors.accent}
              stopOpacity={0.42}
            />
            <Stop
              offset="0.54"
              stopColor={theme.colors.accent}
              stopOpacity={0.13}
            />
            <Stop offset="1" stopColor={theme.colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect fill="url(#authInkPrimaryWash)" height={height} width={width} />
        <Rect fill="url(#authInkSecondaryWash)" height={height} width={width} />
      </Svg>

      <Animated.View
        pointerEvents="none"
        testID="auth-ink-upper-wave"
        style={[styles.contourLayer, { height, width }, upperWaveStyle]}
      >
        <Svg height={height} pointerEvents="none" width={width}>
          <Path
            d={upperContour}
            fill="none"
            opacity={0.13}
            stroke={theme.colors.primary}
            strokeLinecap="round"
            strokeWidth={1.2}
          />
        </Svg>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        testID="auth-ink-middle-wave"
        style={[styles.contourLayer, { height, width }, middleWaveStyle]}
      >
        <Svg height={height} pointerEvents="none" width={width}>
          <Path
            d={middleContour}
            fill="none"
            opacity={0.09}
            stroke={theme.colors.mutedForeground}
            strokeLinecap="round"
            strokeWidth={1}
          />
        </Svg>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        testID="auth-ink-lower-wave"
        style={[styles.contourLayer, { height, width }, lowerWaveStyle]}
      >
        <Svg height={height} pointerEvents="none" width={width}>
          <Path
            d={lowerContour}
            fill="none"
            opacity={0.055}
            stroke={theme.colors.foreground}
            strokeLinecap="round"
            strokeWidth={0.9}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  contourLayer: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
});
