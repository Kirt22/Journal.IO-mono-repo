import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Dimensions,
  StyleSheet,
  View,
  type AppStateStatus,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Blur, Canvas, Circle, Fill, Shader } from '@shopify/react-native-skia';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { normalizeRgb, orbRuntimeEffect } from './orbShader';
import {
  createHeroFadeStyle,
  getHeroFadeDistance,
} from '../../utils/heroScroll';

/**
 * Note: the reference component took a `backgroundColor`. That fed a
 * background-luminance branch in the shader which filled the orb's centre on
 * light backgrounds; it is gone, the centre is always transparent, and the prop
 * would now do nothing — so it is not accepted.
 */
export type OrbProps = {
  size?: number;
  hue?: number;
  idleIntensity?: number;
  activeIntensity?: number;
  /** Peak the ring warps to during `pulse()`. See DEFAULT_PRESS_INTENSITY. */
  pressIntensity?: number;
  rotationSpeed?: number;
  forceActive?: boolean;
  paused?: boolean;
  primaryColor: string;
  secondaryColor: string;
  deepColor: string;
  scrollY?: Animated.Value;
  style?: StyleProp<ViewStyle>;
  /** Overridden where a second orb is on screen, so tests can tell them apart. */
  testID?: string;
};

/**
 * Imperative surface for the press reaction.
 *
 * A ref rather than a prop so a tap costs no re-render: the whole animation
 * runs on the UI thread against a shared value the shader already reads.
 */
export type OrbHandle = {
  pulse: () => void;
};

/** Fast charge, slow release — the ring absorbs the tap instead of bouncing. */
const PULSE_RISE_MS = 140;
const PULSE_SETTLE_MS = 620;

/**
 * Peak charge for a press, deliberately NOT `activeIntensity` (1.3).
 *
 * The warp term bends the ring by `intensity * 0.1 * sin(uv * 10 + iTime)`, and
 * that scales far faster than it looks on paper. Rendering the shader across a
 * sweep: by ~0.7 a six-fold star begins to emerge, and at 1.3 the ring is a
 * flower rather than an orb. 0.6 roughly doubles the resting warp, so the edge
 * visibly undulates while the silhouette stays unmistakably circular.
 */
const DEFAULT_PRESS_INTENSITY = 0.6;

/**
 * The canvas rasterizes at this fraction of its laid-out size and is scaled back
 * up by the view transform, capping effective density near 2x on a 3x screen.
 * The orb is a soft glow, so the upsample is invisible — drop this further if a
 * low-end device turns out to be fill-rate bound.
 */
const RENDER_SCALE = 0.75;
/** Phase used whenever the clock is not running (Reduce Motion, tests). */
const STATIC_TIME = 3.2;
const STATIC_ROT = 0.55;
/** Frames stop once the orb has faded out; the band stops threshold thrashing. */
const VISIBILITY_HYSTERESIS = 48;

function clampSize(value: number) {
  return Math.min(Math.max(Math.round(value), 240), 310);
}

function isBackgroundedState(state: AppStateStatus | null | undefined) {
  return state === 'background' || state === 'inactive';
}

const Orb = forwardRef<OrbHandle, OrbProps>(function Orb(
  {
    size = clampSize(Dimensions.get('window').width * 0.72),
    hue = 0,
    idleIntensity = 0.28,
    activeIntensity = 1.3,
    pressIntensity,
    rotationSpeed = 0.22,
    forceActive = false,
    paused = false,
    primaryColor,
    secondaryColor,
    deepColor,
    scrollY,
    style,
    testID = 'home-orb',
  },
  ref,
) {
  const time = useSharedValue(STATIC_TIME);
  const rot = useSharedValue(STATIC_ROT);
  const speed = useSharedValue(rotationSpeed);
  /** 0 at rest, 1 at the peak of a press. */
  const pulse = useSharedValue(0);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  // `currentState` is null for a moment on iOS launch and undefined under jest,
  // so only an explicitly backgrounded state counts as inactive.
  const [isAppActive, setIsAppActive] = useState(
    () => !isBackgroundedState(AppState.currentState),
  );
  const [isVisible, setIsVisible] = useState(true);
  const isVisibleRef = useRef(true);

  const canvasSize = Math.round(size * RENDER_SCALE);
  const fadeDistance = getHeroFadeDistance(size);
  const baseIntensity = forceActive ? activeIntensity : idleIntensity;
  const peakIntensity = pressIntensity ?? DEFAULT_PRESS_INTENSITY;

  const resolution = useMemo(
    () => [canvasSize, canvasSize] as const,
    [canvasSize],
  );
  const primaryRgb = useMemo(
    () => normalizeRgb(primaryColor),
    [primaryColor],
  );
  const secondaryRgb = useMemo(
    () => normalizeRgb(secondaryColor),
    [secondaryColor],
  );
  const deepRgb = useMemo(() => normalizeRgb(deepColor), [deepColor]);

  useEffect(() => {
    speed.value = rotationSpeed;
  }, [rotationSpeed, speed]);

  // Accumulating the clock ourselves — rather than reading a free-running one —
  // is what lets the orb resume from where it stopped instead of jumping.
  const frameCallback = useFrameCallback(frame => {
    'worklet';
    const deltaMs = frame.timeSincePreviousFrame ?? 16.667;
    const delta = Math.min(deltaMs, 64) / 1000;

    time.value += delta;
    rot.value += delta * speed.value;
  }, false);

  const shouldAnimate =
    Boolean(orbRuntimeEffect) &&
    !paused &&
    !prefersReducedMotion &&
    isAppActive &&
    isVisible;

  useEffect(() => {
    frameCallback.setActive(shouldAnimate);

    return () => {
      frameCallback.setActive(false);
    };
  }, [frameCallback, shouldAnimate]);

  useEffect(() => {
    if (!prefersReducedMotion) {
      return;
    }

    time.value = STATIC_TIME;
    rot.value = STATIC_ROT;
    // A press that landed just before Reduce Motion was switched on would
    // otherwise keep warping the ring after the clock has stopped.
    cancelAnimation(pulse);
    pulse.value = 0;
  }, [prefersReducedMotion, pulse, rot, time]);

  useImperativeHandle(
    ref,
    () => ({
      pulse: () => {
        // Nothing to warp: the fallback path draws two static circles, and
        // Reduce Motion means the orb renders a settled frame on purpose.
        if (prefersReducedMotion || !orbRuntimeEffect) {
          return;
        }

        // Restart rather than queue, so a rapid second tap re-charges from
        // wherever the ring currently is.
        cancelAnimation(pulse);
        pulse.value = withSequence(
          withTiming(1, {
            duration: PULSE_RISE_MS,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(0, {
            duration: PULSE_SETTLE_MS,
            easing: Easing.out(Easing.cubic),
          }),
        );
      },
    }),
    [prefersReducedMotion, pulse],
  );

  useEffect(
    () => () => {
      cancelAnimation(pulse);
    },
    [pulse],
  );

  useEffect(() => {
    let isActive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (isActive) {
          setPrefersReducedMotion(enabled);
        }
      })
      .catch(() => undefined);

    const motionSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setPrefersReducedMotion,
    );
    const appStateSubscription = AppState.addEventListener('change', next => {
      setIsAppActive(!isBackgroundedState(next));
    });

    return () => {
      isActive = false;
      motionSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!scrollY) {
      return;
    }

    const listenerId = scrollY.addListener(({ value }) => {
      const nextVisible = isVisibleRef.current
        ? value < fadeDistance + VISIBILITY_HYSTERESIS
        : value < fadeDistance;

      if (nextVisible === isVisibleRef.current) {
        return;
      }

      isVisibleRef.current = nextVisible;
      setIsVisible(nextVisible);
    });

    return () => {
      scrollY.removeListener(listenerId);
    };
  }, [fadeDistance, scrollY]);

  // The press reaction is the shader's own `intensity` warp, not an overlay:
  // the uniform bends the ring with sin(uv * 10 + iTime), so surging it makes
  // the ring itself liquify and settle. Read inside the worklet so the whole
  // animation stays on the UI thread.
  const uniforms = useDerivedValue(
    () => ({
      iTime: time.value,
      iResolution: resolution,
      hue,
      intensity: baseIntensity + pulse.value * (peakIntensity - baseIntensity),
      rot: rot.value,
      primaryColor: primaryRgb,
      secondaryColor: secondaryRgb,
      deepColor: deepRgb,
    }),
    [
      baseIntensity,
      deepRgb,
      hue,
      peakIntensity,
      primaryRgb,
      resolution,
      secondaryRgb,
    ],
  );

  // Shared with the greeting block so the whole hero dissolves together.
  const scrollStyle = useMemo(
    () =>
      scrollY
        ? createHeroFadeStyle(scrollY, fadeDistance, { withScale: true })
        : null,
    [fadeDistance, scrollY],
  );

  const canvasStyle = useMemo(
    () => ({
      height: canvasSize,
      width: canvasSize,
      transform: [{ scale: 1 / RENDER_SCALE }],
    }),
    [canvasSize],
  );

  return (
    <Animated.View
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={testID}
      style={[
        styles.frame,
        { height: size, width: size },
        scrollStyle,
        style,
      ]}
    >
      <View pointerEvents="none" style={styles.canvasHost}>
        {orbRuntimeEffect ? (
          <Canvas style={canvasStyle}>
            <Fill>
              <Shader source={orbRuntimeEffect} uniforms={uniforms} />
            </Fill>
          </Canvas>
        ) : (
          // Compilation failed on this device. A soft two-tone ring keeps the
          // hero composed; the dotted sphere is deliberately not restored.
          <Canvas style={canvasStyle} testID="home-orb-fallback">
            <Circle
              color={primaryColor}
              cx={canvasSize / 2}
              cy={canvasSize / 2}
              r={canvasSize * 0.34}
              strokeWidth={canvasSize * 0.055}
              style="stroke"
            >
              <Blur blur={canvasSize * 0.05} />
            </Circle>
            <Circle
              color={secondaryColor}
              cx={canvasSize / 2}
              cy={canvasSize / 2}
              r={canvasSize * 0.3}
              strokeWidth={canvasSize * 0.03}
              style="stroke"
            >
              <Blur blur={canvasSize * 0.08} />
            </Circle>
          </Canvas>
        )}
      </View>
    </Animated.View>
  );
});

export default Orb;

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasHost: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
