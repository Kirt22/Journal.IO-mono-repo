import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/provider';

/**
 * Full-screen pulse that covers the widget step once the user has held the
 * widget long enough to activate it, then dissolves into the next screen.
 *
 * Deliberately not the shared theme ripple: `startThemeTransition` is a theme
 * API (it resolves the next palette and commits it), and its opacity curve
 * flashes in and recedes again. Here the cover has to stay opaque through the
 * route change. The geometry is copied from the ripple on purpose so the two
 * read as the same motion language.
 */

const PULSE_BASE_SIZE = 28;
const PULSE_GLOW_SIZE = 48;

type PulseGeometry = {
  origin: { x: number; y: number };
  targetScale: number;
};

type OnboardingPulseOverlayProps = {
  /** 0 -> 1, owned and driven by the screen. */
  progress: Animated.Value;
  geometry: PulseGeometry | null;
};

/** Reach needed for a circle at `origin` to cover a `width` x `height` screen. */
const resolvePulseGeometry = (
  origin: { x: number; y: number },
  width: number,
  height: number,
): PulseGeometry => {
  const maxHorizontal = Math.max(origin.x, width - origin.x);
  const maxVertical = Math.max(origin.y, height - origin.y);
  const maxDistance = Math.sqrt(maxHorizontal ** 2 + maxVertical ** 2);

  return {
    origin,
    targetScale: Math.max(maxDistance / (PULSE_BASE_SIZE / 2), 1),
  };
};

function OnboardingPulseOverlay({
  progress,
  geometry,
}: OnboardingPulseOverlayProps) {
  const theme = useTheme();

  if (!geometry) {
    return null;
  }

  const { origin, targetScale } = geometry;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Leading coral edge — this is what makes it read as a pulse and not a
          curtain, so it outruns the cover and fades at the end. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: theme.colors.primary + '2E',
            left: origin.x - PULSE_GLOW_SIZE / 2,
            top: origin.y - PULSE_GLOW_SIZE / 2,
            opacity: progress.interpolate({
              inputRange: [0, 0.2, 0.75, 1],
              outputRange: [0, 0.55, 0.3, 0],
            }),
            transform: [
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, targetScale * 1.1],
                }),
              },
            ],
          },
        ]}
      />
      {/* Background token, not primary: the next screen shares this token, so
          the cover dissolves into it instead of flashing a saturated colour. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.cover,
          {
            backgroundColor: theme.colors.background,
            shadowColor: theme.colors.primary,
            left: origin.x - PULSE_BASE_SIZE / 2,
            top: origin.y - PULSE_BASE_SIZE / 2,
            opacity: progress.interpolate({
              inputRange: [0, 0.18, 1],
              outputRange: [0, 1, 1],
            }),
            transform: [
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.01, targetScale],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    borderRadius: PULSE_BASE_SIZE / 2,
    height: PULSE_BASE_SIZE,
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    width: PULSE_BASE_SIZE,
  },
  glow: {
    borderRadius: PULSE_GLOW_SIZE / 2,
    height: PULSE_GLOW_SIZE,
    position: 'absolute',
    width: PULSE_GLOW_SIZE,
  },
});

export default OnboardingPulseOverlay;
export { resolvePulseGeometry, type PulseGeometry };
