import type { Animated } from 'react-native';

/**
 * The Home hero is the orb plus the greeting block beneath it, and the two have
 * to dissolve as one unit as the cards scroll over them. Both read their
 * transform from here so the curve can only ever be defined once — tuning it in
 * one place moves both.
 */

/** Pulling up past the top grows the hero slightly instead of clamping flat. */
export const HERO_OVERSCROLL_RANGE = 120;

/** How far the user scrolls before the hero is fully gone. */
export function getHeroFadeDistance(size: number) {
  return Math.max(140, size * 0.7);
}

type HeroFadeOptions = {
  /**
   * Scale reads well on the orb but visibly resamples text, so the greeting
   * takes opacity and translation only.
   */
  withScale?: boolean;
};

export function createHeroFadeStyle(
  scrollY: Animated.Value,
  fadeDistance: number,
  { withScale = false }: HeroFadeOptions = {},
) {
  const transform: Animated.WithAnimatedArray<
    { translateY: Animated.AnimatedInterpolation<number> } | {
      scale: Animated.AnimatedInterpolation<number>;
    }
  > = [
    {
      // Trails the content rather than scrolling with it one-for-one.
      translateY: scrollY.interpolate({
        inputRange: [0, fadeDistance],
        outputRange: [0, fadeDistance * 0.42],
        extrapolate: 'clamp',
      }),
    },
  ];

  if (withScale) {
    transform.push({
      scale: scrollY.interpolate({
        inputRange: [-HERO_OVERSCROLL_RANGE, 0, fadeDistance],
        outputRange: [1.04, 1, 0.9],
        extrapolate: 'clamp',
      }),
    });
  }

  return {
    opacity: scrollY.interpolate({
      inputRange: [0, fadeDistance * 0.55, fadeDistance],
      outputRange: [1, 0.55, 0],
      extrapolate: 'clamp',
    }),
    transform,
  };
}
