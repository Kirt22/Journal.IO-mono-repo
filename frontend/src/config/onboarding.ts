export const CURRENT_ONBOARDING_VERSION = 2;

/**
 * Selects the onboarding flow in `AppNavigator`'s `OnboardingRoute`.
 *
 * Held at `__DEV__` while v2 was a Phase 2 placeholder, which meant every
 * Release bundle silently shipped v1. v2 is complete, so this is now `true` in
 * all builds; flip it back to `false` to fall through to `OnboardingScreen`.
 */
export const ENABLE_ONBOARDING_V2 = true;

export const REQUIRE_ONBOARDING_V2_PRIVACY_CONSENT = true;

/**
 * Shows the in-flow shortcut that jumps straight to the rating step, skipping
 * the guided reflection, its session analysis, and goal generation.
 *
 * Debug builds only — `__DEV__` is compiled out of release bundles, so the
 * button and its fixture never ship.
 */
export const ENABLE_ONBOARDING_DEV_SHORTCUTS = __DEV__;
