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

- Last synced from Figma Make routes: `2026-03-20`
- Source used: `src/styles/theme.css`, `src/app/screens/SetupProfile.tsx`, `src/app/screens/Home.tsx`

---

## Screen Tracker

| Screen | Figma Route | Planned React Native Target | Status | Notes | Last Updated |
| --- | --- | --- | --- | --- | --- |
| Onboarding | `/onboarding` | `frontend/src/screens/onboarding/OnboardingScreen.tsx` | implemented | 3-step onboarding remains in place and now forwards the selected goals into the auth flow; responsive width scaling now adjusts paddings, title sizing, and max content width for compact and large phones; screen now uses centralized theme tokens for system light/dark behavior. | 2026-03-20 |
| Auth | `/auth` | `frontend/src/screens/auth/EnterPhoneScreen.tsx` | in_progress | Phone auth screen now follows the fixed Figma layout more closely, removes the onboarding back path and visible goals, uses the open page layout instead of a white card, shows phone/Google icons in the primary actions, and now makes the Terms and Privacy text tappable; responsive sizing now adapts spacing and input-row width across compact/large devices; screen now uses centralized theme tokens for system light/dark behavior; Google auth is still a placeholder slice. | 2026-03-20 |
| Verify OTP | `/verify-otp` | `frontend/src/screens/auth/VerifyOtpScreen.tsx` | implemented | Screen now matches the Figma Verify OTP structure more closely: top change-number action, centered icon/title/subtitle, direct 6-digit input row, CTA, and centered resend state; includes Figma-like success behavior (logo transitions to green check) and frontend resend flow wired to `/auth/resend_otp` with temporary fallback to `send_otp`; screen now uses centralized theme tokens for system light/dark behavior. | 2026-03-20 |
| Setup Profile | `/setup-profile` | `frontend/src/screens/profile/SetupProfileScreen.tsx` | implemented | Screen matches the Figma setup-profile composition closely: back/header, avatar preview with camera icon anchored at bottom-right, centered avatar color selector with selected check state, display-name field with character count and inline validation, light accent phone-verified row with icons, Start Journaling CTA icon treatment, and skip action; avatar/camera tap opens photo library selection using `react-native-image-picker`; screen now uses centralized theme tokens for system light/dark behavior. | 2026-03-20 |
| Home | `/` | `frontend/src/screens/HomeScreen.tsx` | implemented | Home dashboard now mirrors the Make source structure: greeting/date header, current streak card, quick mood check-in, quick note composer, AI insight tip card, today prompt card, quick actions grid, recent entries empty state, and the fixed bottom navigation bar with Home/Calendar/New/Insights/Profile. Theme toggle is wired through the existing theme provider override so the header control works in the app shell. | 2026-03-20 |
| New Entry | `/new-entry` | `frontend/src/screens/NewEntryScreen.tsx` | not_started | Planned journaling screen. | 2026-03-17 |
| Entry Detail | `/entry/:id` | `frontend/src/screens/EntryDetailScreen.tsx` | not_started | Planned detail screen for one journal entry. | 2026-03-17 |
| Calendar | `/calendar` | `frontend/src/screens/CalendarScreen.tsx` | not_started | Planned history/calendar surface. | 2026-03-17 |
| Search | `/search` | `frontend/src/screens/SearchScreen.tsx` | not_started | Planned search/filter surface. | 2026-03-17 |
| Insights | `/insights` | `frontend/src/screens/InsightsScreen.tsx` | not_started | Planned insights dashboard. | 2026-03-17 |
| Streaks | `/streaks` | `frontend/src/screens/StreaksScreen.tsx` | not_started | Planned streak detail screen. | 2026-03-17 |
| Reminders | `/reminders` | `frontend/src/screens/RemindersScreen.tsx` | not_started | Planned reminders management screen. | 2026-03-17 |
| Community | `/community` | `frontend/src/screens/CommunityScreen.tsx` | not_started | Present in Figma Make routes; verify product scope before implementation. | 2026-03-17 |
| Subscription | `/subscription` | `frontend/src/screens/SubscriptionScreen.tsx` | not_started | Present in Figma Make routes; verify MVP need before implementation. | 2026-03-17 |
| Profile | `/profile` | `frontend/src/screens/ProfileScreen.tsx` | not_started | Planned profile surface. | 2026-03-17 |
| Settings | `/settings` | `frontend/src/screens/SettingsScreen.tsx` | not_started | Planned settings surface. | 2026-03-17 |
| Privacy | `/privacy` | `frontend/src/screens/PrivacyScreen.tsx` | not_started | Planned privacy controls screen. | 2026-03-17 |
| Not Found | `*` | `frontend/src/screens/NotFoundScreen.tsx` | n_a | Web-style route fallback from Figma Make; not a primary mobile implementation target. | 2026-03-17 |
