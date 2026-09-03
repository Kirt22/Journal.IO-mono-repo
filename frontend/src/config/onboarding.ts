export const CURRENT_ONBOARDING_VERSION = 2;

/**
 * Mirrors `DEFAULT_ONBOARDING_V2_RELEASE_CUTOFF` in
 * `backend/src/config/onboarding.config.ts`. Accounts older than this predate
 * onboarding v2, so "they have journal entries, they must be done" is a fair
 * guess about them; for anyone newer it is not — the v2 flow itself writes a
 * journal entry at its first guided reflection, two steps in.
 *
 * The server's copy is env-overridable and this one is not. That is deliberate:
 * this is only ever a fallback beneath the server's own `onboardingCompleted` /
 * `onboardingVersion`, so the worst a divergence can do is make the client
 * slightly more conservative.
 */
export const ONBOARDING_V2_RELEASE_CUTOFF = "2026-06-26T00:00:00.000Z";

/**
 * Selects the onboarding flow in `AppNavigator`'s `OnboardingRoute`.
 *
 * Held at `__DEV__` while v2 was a Phase 2 placeholder, which meant every
 * Release bundle silently shipped v1. v2 is complete, so this is now `true` in
 * all builds; flip it back to `false` to fall through to `OnboardingScreen`.
 */
export const ENABLE_ONBOARDING_V2 = true;

export const REQUIRE_ONBOARDING_V2_PRIVACY_CONSENT = true;
