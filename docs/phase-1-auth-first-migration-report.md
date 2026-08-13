# Phase 1 Auth-First Migration Report

Date: 2026-06-26

## Files Changed

- Backend schema/config: `backend/src/schema/user.schema.ts`, `backend/src/config/onboarding.config.ts`
- Backend services/routes: `backend/src/services/user/user.service.ts`, `backend/src/services/auth/auth.service.ts`, `backend/src/services/onboarding/onboarding.service.ts`, `backend/src/services/onboarding/onboarding.controllers.ts`, `backend/src/services/onboarding/onboarding.routes.ts`, `backend/src/services/onboarding/onboarding.validators.ts`, `backend/src/services/revenuecat/revenuecat.service.ts`
- Frontend flow/services: `frontend/src/store/appStore.ts`, `frontend/src/services/authService.ts`, `frontend/src/services/onboardingService.ts`, `frontend/src/utils/authSessionCache.ts`, `frontend/src/config/onboarding.ts`, `frontend/src/screens/onboarding/OnboardingScreen.tsx`, `frontend/src/navigation/routes.tsx`
- Tests: `backend/src/services/user/user.service.test.ts`, `backend/src/services/auth/auth.service.test.ts`, `backend/src/services/onboarding/onboarding.service.test.ts`, `frontend/__tests__/appStore.test.ts`
- Docs: `docs/AI_API_SPEC.md`, `docs/AI_ARCHITECTURE.md`, `docs/AI_UI_UX_CONTEXT.md`, `docs/AI_PRODUCT.md`, `docs/AI_INSIGHTS_PIPELINE.md`, `docs/SECURITY_MODEL.md`, `docs/phase-1-auth-first-migration-report.md`

## Backend Schema Fields Added

The user schema now keeps legacy `onboardingContext` and adds optional onboarding v2 fields:

- `onboardingVersion?: number`
- `onboardingCompletedAt?: Date`
- `onboardingPayload?: { version, whatBringsYouHere, supportFocusAreas, primaryContext, ageRange, reflectionTone, preferredTheme, reminderPreference, privacyConsent, firstReflectionId, firstReflectionSummary, personalGoals, migratedFromLegacy }`

## Endpoint Added

`POST /api/v1/onboarding/complete`

- Requires auth.
- Validates the request body with Zod.
- Stores a sanitized v2 onboarding payload on the authenticated user.
- Sets `onboardingCompleted: true`, `onboardingVersion: 2`, and `onboardingCompletedAt`.
- Preserves legacy `onboardingContext` compatibility for existing profile personalization logic.
- Does not touch journals, subscription records, RevenueCat fields, or reminder records.
- Returns the updated safe user profile payload.

## Routing Decision Tree

Actual active routing lives in `frontend/src/store/appStore.ts` and `frontend/src/navigation/AppNavigator.tsx`.

```ts
if (bootstrapping) {
  return loading;
}

if (!isAuthenticated) {
  return auth;
}

if (isAuthenticated && !isOnboardingCompleteForCurrentVersion(user)) {
  return onboarding;
}

if (needsProfileSetup(user)) {
  return profile;
}

if (shouldShowPaywall(user)) {
  return paywall;
}

return mainApp;
```

Launch bootstrap intentionally skips paywall/profile interruption for already signed-in, migrated users and sends them to the main app. Post-auth sign-in/sign-up flows reuse the existing paywall/profile/main routing after onboarding is complete.

## Existing-User Migration Logic

The backend lazily treats a user as existing if any of these signals are true:

- `onboardingCompleted === true`
- `onboardingVersion >= 2`
- user has journal entries, checked by metadata only
- user is premium
- user has legacy `onboardingContext`
- user was created before `ONBOARDING_V2_RELEASE_CUTOFF`, defaulting to `2026-06-26T00:00:00.000Z`
- user has an existing reminder record

When a clearly existing user lacks current onboarding v2 fields, profile building idempotently sets:

- `onboardingCompleted = true`
- `onboardingVersion = 2`
- `onboardingCompletedAt = existing onboardingCompletedAt || updatedAt || createdAt || now`
- `onboardingPayload.migratedFromLegacy = true`

This is lazy and non-destructive; no migration script is run.

## New-User Routing

- Fresh/no-token launch starts at Auth.
- New users authenticate first.
- If the backend profile is not onboarding v2 complete, the app routes to current onboarding UI.
- Onboarding completion calls `POST /onboarding/complete`.
- After completion, non-premium users reuse the existing post-auth paywall logic; premium users continue toward home/profile as before.

## Existing-User Protection

- Existing signed-in users fetch profile and are lazily migrated by the backend before frontend routing.
- Existing signed-out users are decided by backend profile after sign-in, not old local onboarding flags.
- Cached offline fallback avoids forcing ambiguous legacy cached users into onboarding.
- Keychain tokens are not cleared during normal first-install marker handling; they are cleared only on logout or unauthorized profile responses.
- Journal entries are never fetched for profile migration; only existence/count metadata is used.

## Reminder Preservation

- Existing reminder records are not deleted or overwritten by migration.
- On normal sign-in, the app resyncs existing stored reminder notifications instead of applying stale local onboarding answers.
- New onboarding completion may store `reminderPreference` in `onboardingPayload` and then uses the existing reminder sync path.

## Paywall Preservation

- RevenueCat product IDs, offering IDs, entitlement IDs, API keys, hosted paywall routing, purchase logic, and copy were not changed.
- Paywall is not shown before onboarding for genuinely new users.
- Premium users remain eligible to continue into the main app without being blocked by onboarding.

## Manual Test Checklist

- Scenario A: Fresh install, no tokens. Expected: app starts at Auth, not onboarding.
- Scenario B: New user signs up. Expected: app routes to onboarding after auth.
- Scenario C: New user completes onboarding. Expected: backend marks onboarding v2 complete, then app routes to paywall/home using existing logic.
- Scenario D: Existing signed-in user with `onboardingCompleted: true`. Expected: app goes to Home/Main App.
- Scenario E: Existing user with journal entries but missing `onboardingVersion`. Expected: backend lazily migrates user as onboarded; app goes to Home/Main App.
- Scenario F: Existing premium user. Expected: app goes to Home/Main App and premium remains active.
- Scenario G: Existing reminder user. Expected: reminder settings remain intact.
- Scenario H: Logout. Expected: app returns to Auth, backend data is not deleted.
- Scenario I: Sign back in. Expected: app routes based on backend profile, not stale local-only onboarding flags.
- Scenario J: Network failure during bootstrap. Expected: existing cached user fallback does not incorrectly force onboarding.

## Known Risks

- `frontend/src/navigation/routes.tsx` is stale relative to the active `AppNavigator.tsx`; only its onboarding callback type was updated to avoid TypeScript drift.
- The default release cutoff is code-defined for safety and can be overridden with `ONBOARDING_V2_RELEASE_CUTOFF`; production should confirm the exact release timestamp before rollout.
- Manual device verification is still needed for real Keychain, RevenueCat, and local notification behavior.

## Open Questions

- Confirm the production `ONBOARDING_V2_RELEASE_CUTOFF` value before release if it differs from `2026-06-26T00:00:00.000Z`.
- Decide in a later phase where the native review prompt should move, since Phase 1 disables it during onboarding.
