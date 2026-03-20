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

1. Onboarding
2. Auth (phone or Google)
3. OTP verification (phone path)
4. Profile setup
5. Home dashboard
6. Supporting flows:
   - new entry
   - entry detail
   - calendar/history
   - search
   - insights
   - streaks
   - reminders
   - profile
   - settings
   - privacy

---

# 3) Onboarding Experience

The onboarding sequence uses 3 steps:

1. Value introduction:
   - AI-powered insights
   - track your journey
   - private and secure
2. Goal selection:
   - daily reflection
   - mindfulness practice
   - personal growth
   - gratitude journaling
3. Privacy and trust:
   - user data control
   - no data selling
   - export/delete controls
   - explicit agreement checkbox

Implementation notes:

- use a clear progress indicator
- keep content readable and lightweight
- include back/continue actions where appropriate

---

# 4) Authentication and Setup UX

Auth should prioritize low-friction entry:

- phone number + country code
- OTP verification with resend timer
- Google sign-in path
- onboarding goals should remain available as hidden flow context during auth and setup steps
- the auth screen is a one-way entry point from onboarding and does not show a back affordance

Post-auth setup:

- display name entry
- avatar color selection
- optional lightweight profile customization
- authenticated profile setup should persist the user’s name, avatar color, and selected goals

Behavioral requirements:

- clear form validation
- loading states on async actions
- recoverable error states
- no dead-end screens

---

# 5) Home Dashboard UX

Home should support quick daily engagement:

- greeting + date context
- streak summary
- quick mood check-in
- quick note capture
- AI insight card (short and actionable)
- daily prompt card
- recent entries preview

The first screen after setup should make journaling and check-in easy within one scroll.

---

# 6) Visual System

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

Theme mode rule:

- the app must support both light and dark themes via system theme detection by default
- use centralized theme tokens (background, foreground, card, accent, border, semantic colors) instead of per-screen ad hoc color definitions

---

# 7) Typography and Rhythm

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

# 8) Interaction Guidelines

- keep animations subtle and meaningful
- use short transitions for taps, selection, and step changes
- prioritize touch clarity over visual flair
- provide immediate feedback for save, verify, and submit actions

Required state handling:

- loading
- success
- empty
- validation error
- network/server error

---

# 9) Reusable Component Expectations

Preferred reusable components include:

- primary and secondary button
- text field / input controls
- onboarding progress indicator
- mood selector / mood check-in card
- entry preview card
- insight card
- action list item
- section header row

Implementation rule:

- put reusable components in `frontend/src/components`
- keep screen composition in `frontend/src/screens`
- keep API requests in `frontend/src/services`

---

# 10) Content Tone Rules

All emotionally sensitive content must remain:

- non-clinical
- uncertainty-aware
- behavior-focused

Avoid diagnostic wording or medical claims in UI text and insights.

---

# 11) Accessibility and Usability

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

# 12) Design-to-Code Guardrails

When converting Figma to code:

1. Implement the smallest complete slice first.
2. Reuse existing repo components and patterns.
3. Do not import a parallel web UI architecture.
4. Match the screen hierarchy and states before polishing visuals.
5. Keep behavior aligned with API contracts and existing backend capabilities.
