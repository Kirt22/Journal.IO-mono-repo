# Phase 2 Onboarding V2 Shell Report

Date: 2026-06-26

## Summary

Phase 2 adds a premium, mascot-free onboarding v2 shell after auth, guarded by a frontend feature flag. Phase 2.2 refines that shell into a faster, compact, auto-advancing personalization setup. The shell collects local personalization draft state, shows an AI/privacy disclaimer as a bottom sheet, and hands off to a temporary first-reflection placeholder without completing onboarding or starting payment.

Figma note: the fixed Figma Make source is the design source of truth, but no Figma MCP/tooling was available in this Codex session. Implementation used the Phase 2 product requirements, existing Journal.IO theme tokens, and current React Native patterns.

## Files Changed

- `frontend/src/config/onboarding.ts`
- `frontend/src/types/onboarding.ts`
- `frontend/src/navigation/AppNavigator.tsx`
- `frontend/src/screens/onboarding/OnboardingV2Screen.tsx`
- `frontend/src/screens/onboarding/onboardingV2.constants.ts`
- `frontend/src/hooks/useOnboardingV2State.ts`
- `frontend/src/services/hapticsService.ts`
- `frontend/src/components/OnboardingProgressDots.tsx`
- `frontend/src/components/OnboardingOptionCard.tsx`
- `frontend/src/components/OnboardingHero.tsx`
- `frontend/src/components/OnboardingBottomSheet.tsx`
- `frontend/src/components/ThemePreviewCard.tsx`
- `frontend/src/components/CelebrationSparkles.tsx`
- `docs/SCREEN_IMPLEMENTATION_STATUS.md`
- `docs/AI_UI_UX_CONTEXT.md`
- `docs/phase-2-onboarding-v2-shell-report.md`
- `docs/onboarding-v2-copy-and-question-spec.md`

## Feature Flag

Added `ENABLE_ONBOARDING_V2` in `frontend/src/config/onboarding.ts`.

- Current value: `__DEV__`
- Development builds can enter onboarding v2 after auth when backend profile state says onboarding is still needed.
- Production builds keep the existing onboarding fallback by default, which avoids exposing the incomplete Phase 2 placeholder to production users.
- `REQUIRE_ONBOARDING_V2_PRIVACY_CONSENT` is also defined and currently true to match existing onboarding consent behavior.

## Phase 2.2 Interaction Refinement

Phase 2.2 changes the v2 shell from a large questionnaire-style flow into a minimal, fast setup:

- Occupation and AI tone remain single-select with auto-advance after a short selected-state delay.
- Support focus is now multi-select with a persistent `Skip` action below a reserved button area and a conditional `Continue` button that pops in only when the first selection makes it appear.
- Theme selection now stays on-screen with an explicit `Continue` button and bottom helper text so users can preview and apply the app theme before moving on.
- Continue buttons were removed from the fast single-select option screens.
- A small back arrow appears on every screen after the intro and preserves local draft state.
- The intro uses the app icon/logo asset with subtle float only; orbit dots, "hi" text, and normal-screen heroes were removed.
- The ready screen uses the provided congratulations icon, a short haptic-backed shake animation, compact one-line title copy, and three slow-staggered theme-aware next-entry cards with provided icons instead of a large book hero.
- The ready screen is treated as the final visible onboarding personalization progress step; its `Continue` button appears only after the cards finish animating and then gently pulses.
- Option cards and theme cards are smaller, lighter, and use subtle fill/check states instead of heavy outlines.
- Theme selection now shows one primary color swatch per option and applies the chosen theme across the onboarding shell and global app theme tokens.
- Haptic calls run through the Pulsar-backed wrapper only for direct user interactions such as option taps, theme taps, back, CTAs, bottom sheet actions, and legal links. Screen-transition and animation-cue haptics were removed to avoid stacked machine-gun feedback, Pulsar sound playback is disabled through `Settings.enableSound(false)`, and all events now use the lighter selection preset instead of notification-style feedback.

## New Components Created Or Updated

- `OnboardingV2Screen`: v2 flow coordinator and local draft state wiring.
- `useOnboardingV2State`: local-only v2 draft updates.
- `OnboardingProgressDots`: subtle progress dots without "Step X of Y" copy.
- `OnboardingOptionCard`: compact selectable cards with selected-state scale.
- `OnboardingHero`: minimal app-logo intro hero with subtle float; variant support remains for future use.
- `OnboardingBottomSheet`: AI/privacy disclaimer modal sheet.
- `ThemePreviewCard`: visual theme swatch selector.
- `CelebrationSparkles`: lightweight animated particles for welcome/complete moments.
- `hapticsService`: centralized Pulsar-backed haptics wrapper using the `react-native-pulsar` selection preset with sound disabled and a short throttle to prevent stacked feedback.

## Onboarding V2 Screen Order

1. Intro / hi screen
2. How did you hear about us?
3. Personalization start + age
4. Occupation
5. AI tone
6. What are you dealing with lately?
7. Theme selector
8. Reflection ready screen
9. AI/privacy disclaimer bottom sheet
10. First reflection placeholder handoff

Removed from the v2 flow:

- Old separate "What brings you here?" screen.
- Old separate large support focus grid.
- Old long day-to-day context screen.
- Old large multi-color theme palette UI.

## Mascot Replacement

The v2 shell does not import or render the existing mascot PNG/SVG. Phase 2.2 uses the real app icon/logo on the intro screen and compact feature cards on the ready screen. Normal option screens intentionally avoid large hero artwork so the setup feels fast and premium.

## Animation And Haptics

- Screen transitions use React Native `Animated` fade/slide.
- Intro logo uses a subtle float only.
- Option and theme cards now reveal only on forward screen transitions with a soft staggered fade/slide/scale before preserving selected-scale feedback and auto-advance.
- Ready screen feature cards reveal with a lightweight stagger.
- Bottom sheet slides up with an animated scrim.
- Haptics are called for direct taps only, including intro/ready/placeholder CTAs, option selected, theme selected, back, skip, consent toggle, legal links, and first-reflection start through `hapticsService`; animation and screen-transition haptics are intentionally disabled.
- `react-native-pulsar` and compatible `react-native-worklets@0.8.3` are installed; `react-native-worklets/plugin` is configured in Babel, and iOS pods were installed so Pulsar/Worklets are native-linked.

## Bottom Sheet Disclaimer Behavior

- The disclaimer appears after tapping `Continue` on the reflection ready screen.
- It is a bottom sheet, not a full screen.
- It animates in and out with a scrim fade plus sheet slide.
- It supports interactive drag control with expanded and half-dismissed snap points; a stronger downward drag or scrim tap dismisses it when safe. The close X and `Not now` text action were removed.
- It uses the `You're in control.` title, concise AI/privacy/user-control points, and the `Begin my first reflection` CTA.
- The title is centered, the agreement checkbox has a small pop animation, and enabling the CTA triggers a subtle button highlight sweep.
- Privacy Policy and Terms links live inside the agreement sentence, reset/close the bottom sheet before opening the existing in-app legal browser route, and allow the sheet to open again cleanly after legal content is dismissed.
- Privacy consent is a hard gate while `REQUIRE_ONBOARDING_V2_PRIVACY_CONSENT` is true.
- Continuing routes only to the Phase 2 placeholder.

## Intentionally Left For Phase 3

- No first guided reflection engine.
- No first entry creation.
- No first analysis screens.
- No Mind Map backend or screens.
- No Home redesign.
- No bottom navigation redesign.
- No paywall route before real onboarding completion.
- No `/onboarding/complete` call from the v2 shell.
- No RevenueCat product/offering/entitlement/API key or purchase logic changes.
- No writes to existing user, journal, reminder, or subscription data.

## Manual Test Checklist

1. Existing user still goes to Home.
2. Fresh user still goes Auth first.
3. New user after auth enters onboarding v2 only when flag is enabled.
4. V2 welcome animation works.
5. Referral option auto-advances.
6. Back arrow returns to the previous screen and preserves draft state.
7. Age option auto-advances.
8. Occupation option auto-advances.
9. AI tone stores `[toneId]`.
10. Dealing-with-lately stores a multi-select `supportFocusAreas` array.
11. Theme stores `preferredTheme`, shows one color per theme, and applies the selected theme live.
12. Ready screen feature cards animate in.
13. Ready screen opens privacy bottom sheet.
14. Not now dismisses sheet and preserves draft.
15. Privacy consent hard gate works if enabled.
16. Start first reflection routes only to placeholder.
17. Placeholder does not call onboarding complete.
18. Paywall does not show before real onboarding completion.
19. Old onboarding fallback still works if v2 flag is disabled.

## Verification

- Phase 2.2: `npm run lint` from `frontend`: passed with inline-style warnings in onboarding UI files.
- Phase 2.2: `npx tsc --noEmit` from `frontend`: passed.
- Phase 2.2: `npm test -- --runInBand` from `frontend`: failed in `__tests__/apiClient.test.ts` because current local API URL resolution returned `https://api.journalio.app/api/v1` and `http://192.168.1.24:3001/api/v1` where the tests expected `http://127.0.0.1:5050/api/v1` and `http://192.168.1.24:3000/api/v1`. This appears tied to local API environment/debug URL configuration, not onboarding v2 behavior.
- Original Phase 2 run: `npm test -- --runInBand` from `frontend` passed, 37 test suites and 160 tests.

## Risks And Open Questions

- The v2 shell is dev-enabled by default and production-disabled by default. Product should decide when to switch the flag for a production rollout.
- Since no Figma MCP was available, a later visual QA pass against the fixed Figma Make source is still recommended.
- Theme picker now applies one of the supported global app theme preferences live; persistence remains tied to the current client store behavior until Phase 3 finalizes onboarding draft persistence.
- Pulsar is a native haptics dependency, so local iOS/Android builds need a native rebuild after install; a Metro-only refresh is not enough.
