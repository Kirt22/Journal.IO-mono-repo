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

- Last synced from Figma Make routes: `2026-04-03`
- Source used: `src/app/routes.tsx`, `src/app/screens/Root.tsx`, `src/app/screens/Home.tsx`, `src/app/screens/NewEntry.tsx`, `src/app/screens/EntryDetail.tsx`, `src/app/screens/Streaks.tsx`, `src/app/screens/Onboarding.tsx`, `src/app/screens/Auth.tsx`, `src/app/screens/CreateAccount.tsx`, `src/app/screens/VerifyEmail.tsx`, `src/app/screens/SignIn.tsx`, `src/app/screens/Paywall.tsx`, `src/app/screens/SetupProfile.tsx`, `src/app/screens/Profile.tsx`, `src/app/screens/Settings.tsx`, `src/app/screens/Privacy.tsx`, `src/app/screens/Subscription.tsx`

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
| Home | `/` | `frontend/src/screens/HomeScreen.tsx` | implemented | Home dashboard now mirrors the Make source structure: greeting/date header, current streak card, standalone daily mood tracker with once-per-day locking, quick note composer, an API-backed rotating AI insight card, today prompt card, quick actions grid, recent entries preview, and the fixed bottom navigation bar with Home/Calendar/New/Insights/Profile. The Home AI insight card now reuses `GET /insights/ai-analysis`, rotates through concise weekly-analysis snippets automatically, animates when the snippet changes, supports manual next from the top-right control, opens the full `AI Analysis` tab when tapped, folds secondary labels into the main copy instead of rendering standalone meta tags, and rotates card-specific icons/CTA copy for better scanability. For non-premium users the Home AI card stays visible but locked and routes users toward subscription/profile instead of showing AI data. The Home streak card is now API-backed through the lightweight `currentStreak` value returned by `GET /mood/today`, so Home does not need to call the full streak summary endpoints. The mood card now uses the "How are you feeling today?" prompt and shows today's logged mood instead of allowing repeat submissions. Recent entries now use the shared journal-card presentation with the emoji/date row on the left, a tappable favorite star on the right, quick-thought title handling, mood-tag filtering, and a shorter content preview than Calendar, and the app no longer seeds fake journal entries into Home at runtime. The Calendar shortcut still navigates to the calendar tab. | 2026-04-02 |
| New Entry | `/new-entry` | `frontend/src/screens/NewEntryScreen.tsx` | implemented | Full journaling composer is implemented with mood check-in, prompt insertion, manual tags, and quick save into the shared journal entry store. The screen currently keeps the AI assist widgets visible in the create flow. | 2026-03-30 |
| Entry Detail | `/entry/:id` | `frontend/src/screens/journal/EntryDetailScreen.tsx` | implemented | Updated to mirror the current Make `/entry/1` layout more closely: icon-only header actions, date row with mood indicator, large single-column title/content block, filtered visible tags, and a backend-backed prompt-used card when the journal record includes `aiPrompt`. The screen still refreshes from the backend on open, keeps favorite/edit/delete actions, and syncs changes back into the shared recent-entry store. | 2026-04-02 |
| Journal Edit | `/entry/:id/edit` | `frontend/src/screens/journal/EditEntryScreen.tsx` | implemented | Updated to match the Make edit surface with the same persistent bottom nav shell, icon/text cancel affordance, orange save pill, date row, large editable title/content fields, filtered visible tags, and the backend-backed prompt-used card when the record includes `aiPrompt`. The editor now hydrates from the backend when the local cache is empty and preserves hidden mood tags on save. | 2026-04-02 |
| Calendar | `/calendar` | `frontend/src/screens/calendar/CalendarScreen.tsx` | implemented | Calendar/history screen now matches the Make flow with a top-right list/calendar segmented toggle, three summary cards, and a responsive month grid in calendar mode. The list and selected-day cards now share the same journal-card presentation as Home, including the left-aligned emoji/date row, tappable favorite star, mood-aware title handling, mood-tag filtering, and the longer content preview. The screen keeps the shared calm theme tokens, supports compact and wide phone widths, only shows selected-date entries after a day is tapped, no longer depends on seeded runtime sample journals, and now shows a Home-style create-entry placeholder when the user has no entries. | 2026-04-02 |
| Search | `/search` | `frontend/src/screens/search/SearchScreen.tsx` | implemented | Search surface now mirrors the Make layout with the sticky back/search header, sharp filter card, tag chips, favorites-only filter, live result counts, empty-state mascot, and journal-card results. The filter area now uses a slightly warmer app-toned card treatment with stronger edges and subtle lift, and the spacing above the card has been loosened so it sits cleanly below the header line. It opens from the Home header search icon inside the main shell so the bottom nav stays visible while users search entries. | 2026-04-03 |
| Insights | `/insights` | `frontend/src/screens/InsightsScreen.tsx` | implemented | Insights screen now loads its overview content from `GET /insights/overview` and requests `GET /insights/ai-analysis` only after the user switches to the `AI Analysis` tab. The overview tab keeps the backend-driven total entries, current streak, average words, total favorites, 7-day activity graph, mood distribution, and popular topics. The analysis tab now renders a concise weekly analysis surface with summary chips, top Big Five-style trait bars, supportive dark-triad watchpoints, trimmed actionable steps, and a Journal.IO support card. Backend reads stay fast through the per-user cached `insights` document, while journal and mood writes mark the weekly AI-analysis cache stale for on-demand recompute. The original animated segmented control, `AI Analysis` labeling, subtitle, donut layout, and legacy overview presentation remain intact, with the weekly summary and action-step cards tightened for cleaner spacing and left-aligned focus tags. For non-premium users, the `AI Analysis` tab remains visible but locked and shows a premium unlock surface instead of AI content. | 2026-04-01 |
| Streaks | `/streaks` | `frontend/src/screens/StreaksScreen.tsx` | implemented | The streaks screen now keeps the existing Make design while loading live data from `GET /streaks/current` and `GET /streaks/history?days=30`. The hero card, best-streak/this-month/total metrics, 30-day activity grid, and achievement list are API-backed, with loading and retry states added without changing the underlying layout structure. In the RN shell it still opens from the Home and Profile entry points while keeping the bottom nav visible, which matches the route-based Make shell more closely than replacing the entire app stage. | 2026-04-01 |
| Reminders | `/reminders` | `frontend/src/screens/reminders/RemindersScreen.tsx` | implemented | Reminders now open from the Home header bell inside the main shell and follow the Make structure with the daily-enable card, time selector, preview card, smart reminder toggles, and permission helper. The screen loads and saves the backend `daily_journal` reminder via `/reminders`, schedules local device notifications through Notifee, re-syncs the current day's reminder after a journal entry is saved when `skipIfCompletedToday` is enabled, and now includes a manual test-notification action in the preview card for instant local delivery checks. | 2026-04-04 |
| Community | `/community` | `frontend/src/screens/CommunityScreen.tsx` | not_started | Present in Figma Make routes; verify product scope before implementation. | 2026-03-17 |
| Subscription | `/subscription` | `frontend/src/screens/profile/SubscriptionScreen.tsx` | implemented | Subscription screen now mirrors the Make plan-selection surface with free/premium/lifetime cards, calm hero messaging, FAQ content, the tighter palette/spacing treatment used across the updated profile screens, and a direct preview entry point into the paywall. | 2026-04-03 |
| Paywall | `/paywall` | `frontend/src/screens/profile/PaywallScreen.tsx` | implemented | Paywall now follows the latest screenshot-led direction more closely with a centered mascot hero, direct `Get Journal.IO Premium` positioning, a compact premium preview card, and a footer-led purchase section where the smaller weekly/yearly selector sits directly above the main CTA using the real Journal.IO pricing (`$7.99/week`, `$299.99/year`). The preview card rotates through premium feature showcases using the same style of timed content transition as the Home AI insight card, while the purchase-complete state has been shortened further into a minimal animated confirmation with just the floating mascot hero, membership copy, a compact plan row, and tiny premium tags instead of any large detail card. The CTA footer remains a separate bottom purchase block, and the bottom spacing under that block has been tightened to remove the extra empty gap near the home indicator area. | 2026-04-06 |
| Profile | `/profile` | `frontend/src/screens/profile/ProfileScreen.tsx` | implemented | Profile screen now matches the Make surface with live streak stats, premium state handling, onboarding goal chips, premium upgrade banner, settings/subscription/privacy navigation, recent achievement cards, and emergency support contacts. The emergency contact rows now launch the device phone dialer directly from the profile screen, while the section cards open the new in-shell profile stack so the bottom nav stays visible while users move through the profile area. | 2026-04-03 |
| Settings | `/settings` | `frontend/src/screens/profile/SettingsScreen.tsx` | implemented | Settings screen now uses the inline dropdown-style theme selector with animated open/close states, a lighter warm background tint, larger section subtitles, tighter privacy/data action sizing, and the spacing/alignment adjustments from the Figma Make design, all inside the profile section shell. The `Privacy Mode` toggle is now wired to the backend AI opt-out preference so Home and Insights AI surfaces react immediately after a change, and the second privacy row now persists a device-level `Hide Journal Previews` setting that masks journal card titles, body text, and tags across list surfaces. The data-management export action now hits the backend privacy export route and opens the shared sheet with a real JSON payload. | 2026-04-05 |
| Privacy | `/privacy` | `frontend/src/screens/profile/PrivacyScreen.tsx` | implemented | Privacy & Data screen now mirrors the Make copy and card order more closely with the privacy commitment card, export section, detailed policy sections, delete-account confirmation flow, and support card aligned to the current screenshots. Export and delete actions are backed by the privacy API, and delete now clears the server session before resetting the app locally. | 2026-04-03 |
| Not Found | `*` | `frontend/src/screens/NotFoundScreen.tsx` | n_a | Web-style route fallback from Figma Make; not a primary mobile implementation target. | 2026-03-17 |
