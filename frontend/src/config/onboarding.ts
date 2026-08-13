export const CURRENT_ONBOARDING_VERSION = 2;

export const ENABLE_ONBOARDING_V2 = __DEV__;

export const REQUIRE_ONBOARDING_V2_PRIVACY_CONSENT = true;

/**
 * Shows the in-flow shortcut that jumps straight to the rating step, skipping
 * the guided reflection, its session analysis, and goal generation.
 *
 * Debug builds only — `__DEV__` is compiled out of release bundles, so the
 * button and its fixture never ship.
 */
export const ENABLE_ONBOARDING_DEV_SHORTCUTS = __DEV__;
