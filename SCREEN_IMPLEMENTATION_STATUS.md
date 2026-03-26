# Screen Implementation Status

This file tracks the current implementation status of screens against the fixed Journal.IO Figma Make source of truth.

Use this tracker whenever a screen is started, updated, blocked, or completed.

---

## Source Of Truth

Default Figma source for all screen implementation work:

- Figma Make URL: `https://www.figma.com/make/TwIHpnGcuQiWooDwPDbOER/Design-Journal.IO-Mobile-App?p=f&t=g4PDg1lIppYHD3Sh-0`
- Figma Make file key: `TwIHpnGcuQiWooDwPDbOER`

Rule:

- Unless the user explicitly overrides it, all screen fetching and design inspection must use this Figma Make project only.

---

## Update Workflow

For every screen task:

1. Fetch the latest screen list or relevant screen source from the Figma Make file above.
2. Confirm the target screen still exists and whether route/screen scope changed.
3. Implement or update the screen.
4. Update this file:
   - `status`
   - `target files`
   - `notes`
   - `last updated`
5. If the screen change affects product/context docs, also run `context-sync-on-change`.

---

## Status Legend

- `not_started`: No meaningful implementation exists in the React Native app.
- `partial`: Some related UI exists, but it does not yet match the current Figma source.
- `in_progress`: Active implementation work is underway.
- `implemented`: Screen exists and is aligned closely enough to current app expectations.
- `blocked`: Implementation is waiting on dependency, API, or clarification.
- `n_a`: Not applicable to the current React Native app scope.

---

## Latest Figma Inventory Sync

- Last synced from Figma Make routes: `2026-03-25`
- Source used: `src/app/routes.tsx`, `src/app/screens/Onboarding.tsx`, `src/app/screens/Auth.tsx`, `src/app/screens/CreateAccount.tsx`, `src/app/screens/VerifyEmail.tsx`, `src/app/screens/SignIn.tsx`, `src/app/screens/Paywall.tsx`, `src/app/screens/SetupProfile.tsx`

---

## Screen Tracker

| Screen | Figma Route | Planned React Native Target | Status | Notes | Last Updated |
| --- | --- | --- | --- | --- | --- |
| Onboarding | `/onboarding` | `frontend/src/screens/onboarding/OnboardingScreen.tsx` | implemented | React Native onboarding now follows the latest Figma Make 8-step flow: value intro, age range, journaling experience, goals, support focus, reminder preference, AI comfort, and privacy consent. The screen keeps the calm theme, uses the local mascot PNG in the hero, preserves responsive sizing for compact to large phones, and stores the onboarding answers in app state for the later auth/profile handoff. | 2026-03-25 |
| Auth | `/auth` | `frontend/src/screens/auth/EnterPhoneScreen.tsx` | implemented | Email-first landing screen with mascot-led branding, `Continue with Email`, Google secondary action, and a sign-in link. The frontend currently uses a clean local compatibility layer for the email flow because the backend still exposes the older phone OTP contract. | 2026-03-25 |
| Sign In | `/sign-in` | `frontend/src/screens/auth/SignInScreen.tsx` | implemented | Returning-user email sign-in screen with email/password fields, forgot-password affordance, mascot header, validation, loading, and recoverable error handling. | 2026-03-25 |
| Create Account | `/create-account` | `frontend/src/screens/auth/CreateAccountScreen.tsx` | implemented | Email create-account screen with password and confirm-password fields, restored inline validation, a speech-bubble password tip, and a success banner that pauses briefly before handing off to verify-email. | 2026-03-25 |
| Verify Email | `/verify-email` | `frontend/src/screens/auth/VerifyEmailScreen.tsx` | implemented | Email verification screen with 6-digit code entry, resend cooldown, a mascot-free success state, and a brief auto-advance into profile setup after the confirmation card appears. | 2026-03-26 |
| Setup Profile | `/setup-profile` | `frontend/src/screens/profile/SetupProfileScreen.tsx` | implemented | Profile setup now accepts email or Google auth entry, shows a compact onboarding summary carry-forward, and removes the phone-only assumptions from the previous flow. | 2026-03-25 |
| Home | `/` | `frontend/src/screens/HomeScreen.tsx` | implemented | Home dashboard now mirrors the Make source structure: greeting/date header, current streak card, quick mood check-in, quick note composer, AI insight tip card, today prompt card, quick actions grid, recent entries empty state, and the fixed bottom navigation bar with Home/Calendar/New/Insights/Profile. Theme toggle is wired through the existing theme provider override so the header control works in the app shell. | 2026-03-20 |
| New Entry | `/new-entry` | `frontend/src/screens/NewEntryScreen.tsx` | not_started | Planned journaling screen. | 2026-03-17 |
| Entry Detail | `/entry/:id` | `frontend/src/screens/EntryDetailScreen.tsx` | not_started | Planned detail screen for one journal entry. | 2026-03-17 |
| Calendar | `/calendar` | `frontend/src/screens/calendar/CalendarScreen.tsx` | implemented | Calendar/history screen now matches the Make flow with a top-right list/calendar segmented toggle, three summary cards, dummy entry cards in list mode, and a responsive month grid in calendar mode. The screen keeps the shared calm theme tokens, supports compact and wide phone widths, and only shows selected-date entries after a day is tapped. | 2026-03-26 |
| Search | `/search` | `frontend/src/screens/SearchScreen.tsx` | not_started | Planned search/filter surface. | 2026-03-17 |
| Insights | `/insights` | `frontend/src/screens/InsightsScreen.tsx` | not_started | Planned insights dashboard. | 2026-03-17 |
| Streaks | `/streaks` | `frontend/src/screens/StreaksScreen.tsx` | not_started | Planned streak detail screen. | 2026-03-17 |
| Reminders | `/reminders` | `frontend/src/screens/RemindersScreen.tsx` | not_started | Planned reminders management screen. | 2026-03-17 |
| Community | `/community` | `frontend/src/screens/CommunityScreen.tsx` | not_started | Present in Figma Make routes; verify product scope before implementation. | 2026-03-17 |
| Subscription | `/subscription` | `frontend/src/screens/SubscriptionScreen.tsx` | not_started | Still present in the Make routes, but the newer `/paywall` surface appears to be the primary monetization design target. Confirm whether this remains a distinct screen or should merge into the paywall implementation. | 2026-03-25 |
| Paywall | `/paywall` | `frontend/src/screens/PaywallScreen.tsx` | not_started | New premium upsell surface with plan selection, feature list, mascot hero, restore purchases action, dismiss affordance, and a calm premium visual treatment. | 2026-03-25 |
| Profile | `/profile` | `frontend/src/screens/ProfileScreen.tsx` | not_started | Planned profile surface. | 2026-03-17 |
| Settings | `/settings` | `frontend/src/screens/SettingsScreen.tsx` | not_started | Planned settings surface. | 2026-03-17 |
| Privacy | `/privacy` | `frontend/src/screens/PrivacyScreen.tsx` | not_started | Planned privacy controls screen. | 2026-03-17 |
| Not Found | `*` | `frontend/src/screens/NotFoundScreen.tsx` | n_a | Web-style route fallback from Figma Make; not a primary mobile implementation target. | 2026-03-17 |
