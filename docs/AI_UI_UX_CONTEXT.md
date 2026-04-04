# Journal.IO UI / UX Context

This document defines the current design direction for Journal.IO mobile implementation.

It is intended for React Native + TypeScript implementation in this repository.

---

# 1) Experience Goals

The app should feel:

- calm
- private
- reflective
- supportive
- modern without being noisy

The interface should never feel clinical, gamified, or visually overwhelming.

---

# 2) Screen Flow (Current Design Context)

The current design flow is:

1. Onboarding (8 steps)
2. Auth entry (email or Google)
3. Create account (email path)
4. Verify email (email path)
5. Sign in (returning users)
6. Profile setup
7. Home dashboard
8. Supporting flows:
   - new entry
   - entry detail
   - journal edit
   - calendar/history
   - search
   - insights
   - streaks
   - reminders
   - paywall
   - profile
   - settings
   - privacy

---

# 3) Onboarding Experience

The onboarding sequence now uses 8 steps:

1. Value introduction:
   - AI-powered insights
   - track your journey
   - private and secure
2. Age range selection:
   - collect a broad age band for personalization
3. Journaling experience:
   - new to journaling
   - occasional journaler
   - regular journaler
   - daily journaler
4. Goal selection:
   - daily reflection
   - mindfulness practice
   - personal growth
   - gratitude journaling
   - mental-health-adjacent support goals framed in non-clinical language
   - habit tracking
5. Support focus areas:
   - stress
   - anxiety / worry phrased supportively
   - sleep
   - focus
   - relationships
   - self-awareness
6. Reminder preference:
   - morning
   - afternoon
   - evening
   - no reminders
7. AI comfort and feature explanation:
   - explain AI-assisted prompts, summaries, and insight generation
   - allow opt-in / opt-out posture without pressure
8. Privacy and trust:
   - user data control
   - no data selling
   - export/delete controls
   - explicit agreement checkbox

Implementation notes:

- use a clear progress indicator
- keep each step focused on one decision or concept
- keep content readable and lightweight despite the deeper flow
- include back/continue actions where appropriate
- preserve any collected onboarding answers through auth and profile setup handoff
- persist onboarding completion so returning launches can begin at auth instead of replaying onboarding
- treat onboarding completion as device-scoped state so a reinstall restarts the onboarding flow

---

# 4) Authentication and Setup UX

Auth should prioritize low-friction entry:

- auth landing screen with a primary `Continue with Email` CTA
- email create-account flow with:
  - email
  - password
  - confirm password
- verify-email flow with:
  - email confirmation state
  - 6-digit verification code entry
  - resend action with cooldown
  - clear success transition into profile setup
- dedicated sign-in screen for returning email users
- Google sign-in path
- onboarding goals should remain available as hidden flow context during auth and setup steps
- on app launch, a valid stored session should go directly to home before any onboarding/auth screens render
- once onboarding has been completed, future app launches should begin at auth unless the user is already signed in
- the auth screen is a one-way entry point from onboarding and does not show a back affordance
- signed-in session state should be install-scoped so deleting and reinstalling the app returns to onboarding or auth instead of home

Post-auth setup:

- display name entry
- avatar color selection
- optional lightweight profile customization
- authenticated profile setup should persist the user’s name, avatar color, and selected onboarding context where applicable
- setup should support users arriving from email verification or Google sign-in

Behavioral requirements:

- clear form validation
- loading states on async actions
- recoverable error states
- no dead-end screens

---

# 5) Paywall UX

The premium paywall is now part of the design flow as a dedicated upsell surface.

Paywall expectations:

- feel calm, premium, and trustworthy rather than aggressive
- explain premium value with concise feature copy
- support plan selection, upgrade CTA, restore purchases, and dismiss
- use the mascot subtly in the hero area or brand moments
- preserve the existing app aesthetic rather than introducing a separate monetization style

---

# 6) Home Dashboard UX

Home should support quick daily engagement:

- greeting + date context
- streak summary
- quick daily mood tracker with a once-per-day guard
- quick note capture
- AI insight card (short and actionable)
- daily prompt card
- recent entries preview
- recent entries should open a detail screen when tapped, with a separate edit screen for changes
- the Home AI insight card should reuse the same backend `AI Analysis` data shown on the Insights screen, but present it as short rotating snippets rather than full cards
- the Home AI insight card should auto-advance through multiple snippets, keep a small manual next control in the top-right, and open the full `AI Analysis` tab when tapped
- the Home AI insight card should animate smoothly when the snippet changes
- the Home AI insight card should keep the copy compact and should fold supporting labels into the title/body instead of rendering standalone tag chips
- the rotating Home AI insight snippets may change icon and CTA copy per card when that improves scanability without changing the card shell
- AI surfaces should be premium-gated: non-premium users should see locked placeholders for the Home AI insight card and the Insights `AI Analysis` tab, with a clear upgrade handoff
- the Home current-streak card should be API-backed and should use the lightweight `currentStreak` value returned by `GET /mood/today` rather than calling the full streak summary endpoints

Shared journal-card rule:

- Home recent entries and Calendar history cards should use the same entry presentation
- show the emoji and date on the left, keep the favorite star on the right, then the title, compact content preview, and tags
- the favorite star is tappable and updates the saved favorite state
- quick thoughts should display a dedicated quick-thought title and thought emoji
- if a journal entry has no explicit mood selection, use a placeholder journal emoji
- strip `mood:` tags from the visible tag chips
- keep the Home preview slightly shorter than Calendar
- do not seed Home or Calendar with fake journal entries at runtime; empty states should render until real local or backend-backed entries exist
- entry detail and edit screens should show a stored `aiPrompt` prompt-used card when the journal record includes one

The first screen after setup should make journaling and check-in easy within one scroll.

Mood tracker copy should feel direct and calm, using "How are you feeling today?" for the prompt and clearly indicating when today's check-in is already logged.

Insights screen expectations:

- fetch the screen data from backend APIs rather than local placeholder constants
- overview should show:
  - total entries
  - current streak
  - average words
  - total favorites
  - 7-day activity graph
  - mood distribution from saved home mood check-ins
  - popular topics derived from the most-used non-`mood:` journal tags
- analysis content may be derived from stored insight aggregates, but should remain supportive and non-clinical
- the `AI Analysis` tab should load from a dedicated backend route instead of reusing overview placeholder text
- the Insights screen should call only the overview API on initial page load; the `AI Analysis` API should be requested only after the user switches to that tab
- the analysis tab should present structured, scan-friendly cards rather than a single text block
- for non-premium users, keep the `AI Analysis` tab visible but locked, with a premium explainer instead of AI content
- keep AI-analysis copy concise and easy to skim; prefer a few strong signals over dense paragraphs
- include visual pattern cues such as trait bars, supportive watchpoint meters, and tag-style chips when they help readability without making the screen noisy
- any Big Five or dark-triad-adjacent language must be framed as weekly signals, not diagnoses or fixed identity labels
- dark-triad content must stay emotionally safe: direct but non-shaming, with a balancing explanation and a gentle counter-step
- actionable steps should feel lightweight and achievable within the existing journaling habit
- include a card that explains how Journal.IO features can help the user work with the surfaced patterns over time
- include loading and recoverable error states when insight data cannot be fetched

Streaks screen expectations:

- keep the existing Make design intact; replace only the placeholder values with backend data
- load the screen from backend APIs rather than hardcoded constants
- show:
  - current streak
  - best streak
  - this month entries
  - total entries
  - 30-day activity
  - achievements
- the 30-day activity grid should render directly from a backend day-by-day history response
- achievements should come from backend milestone data so the screen does not duplicate unlock logic
- include loading and recoverable error states without redesigning the streak layout

Reminders screen expectations:

- open from the Home header bell inside the main shell so the bottom nav stays visible
- mirror the Make layout with:
  - daily reminder enable card
  - time selector
  - notification preview card
  - smart reminder toggles
  - device-permission helper copy
- load the current reminder from backend reminders CRUD instead of hardcoded local defaults once a reminder exists
- enabling reminders must request system notification permission and then schedule local device notifications with Notifee
- changing time, weekday coverage, or streak-warning behavior must re-sync the local notification schedule
- skip-on-entry behavior should suppress the current day's reminder after a journal entry is saved when that toggle is enabled
- include loading and recoverable error states without replacing the core Make structure

---

# 7) Visual System

Use a warm, low-contrast-safe palette aligned with current design direction.

Core surface tokens:

- `bg.primary`: `#F6F7F2`
- `bg.surface`: `#FFFFFF`
- `text.primary`: `#1C221B`
- `text.secondary`: `#556055`

Semantic accents:

- growth/success: `#2F7A5D`
- alert/destructive: `#C05A4A`
- info: `#2D6FA3`
- primary CTA accent (current design direction): warm coral/peach family

Rules:

- keep accent usage intentional
- avoid overly saturated highlight combinations
- preserve readability over style density
- keep mascot-led illustration moments integrated into the current design language instead of letting them dominate layouts

Theme mode rule:

- the app must support both light and dark themes via system theme detection by default
- use centralized theme tokens (background, foreground, card, accent, border, semantic colors) instead of per-screen ad hoc color definitions

Brand expression rule:

- the mascot/logo asset is now a recurring brand element across onboarding, auth, verify email, paywall, and selected emotional-feedback states
- mascot usage should feel supportive, polished, and premium
- avoid making the app feel childish, noisy, or overly gamified

---

# 8) Typography and Rhythm

Preferred type direction:

- headline: Manrope Semibold
- body: DM Sans Regular

Spacing rhythm:

- 4, 8, 12, 16, 20, 24, 32, 40

Border radius guidance:

- controls: 10-12
- cards: 16-20
- pill elements: full round

---

# 9) Interaction Guidelines

- keep animations subtle and meaningful
- use short transitions for taps, selection, and step changes
- prioritize touch clarity over visual flair
- provide immediate feedback for save, verify, and submit actions
- richer motion is now expected on onboarding, auth, verify-email, and paywall surfaces
- preferred motion patterns include soft floating mascot moments, gentle glow, small scale feedback, and staggered content reveals
- avoid flashy, game-like, or hyperactive motion

Required state handling:

- loading
- success
- empty
- validation error
- network/server error

---

# 10) Reusable Component Expectations

Preferred reusable components include:

- primary and secondary button
- text field / input controls
- onboarding progress indicator
- verification code / segmented code input
- mood selector / mood check-in card
- entry preview card
- insight card
- action list item
- section header row
- paywall plan selector / feature list rows where reuse becomes practical

Implementation rule:

- put reusable components in `frontend/src/components`
- keep screen composition in `frontend/src/screens`
- keep API requests in `frontend/src/services`

---

# 11) Content Tone Rules

All emotionally sensitive content must remain:

- non-clinical
- uncertainty-aware
- behavior-focused

Avoid diagnostic wording or medical claims in UI text and insights.

---

# 12) Accessibility and Usability

Minimum expectations:

- clear text contrast
- readable input labels
- touch targets sized for mobile interaction
- safe-area-aware layouts
- keyboard-safe behavior for forms
- no critical information hidden behind animation timing

Responsive implementation expectations:

- every screen should adapt to compact (`320-359`), standard (`360-429`), and large (`430+`) phone widths
- scale horizontal padding, major title sizing, and key control dimensions by width class
- cap content with a reasonable max width on large phones to preserve readability
- avoid hardcoding one-device-only spacing assumptions

---

# 13) Design-to-Code Guardrails

When converting Figma to code:

1. Implement the smallest complete slice first.
2. Reuse existing repo components and patterns.
3. Do not import a parallel web UI architecture.
4. Match the screen hierarchy and states before polishing visuals.
5. Keep behavior aligned with API contracts and existing backend capabilities.
