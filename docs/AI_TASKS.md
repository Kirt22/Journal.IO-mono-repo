# Feature Development Roadmap

This roadmap is aligned to the current design flow and MVP priorities.

Implement features sequentially as complete vertical slices.

---

# 1) Onboarding and Trust Setup

Scope:

- multi-step onboarding
- 8-screen personalization flow
- age range capture
- journaling experience capture
- goal selection capture
- support-focus capture
- reminder preference capture
- AI comfort / opt-in explanation
- privacy agreement capture

Includes:

- frontend onboarding screens
- backend persistence for onboarding preferences (if required)
- validation and tests

Current slice note:

- latest design expects an 8-step onboarding flow whose collected preferences carry forward into auth and profile setup

---

# 2) Authentication Flow (Email + Google)

Scope:

- auth landing screen with `Continue with Email`
- email create-account
- email verification
- email sign-in
- Google OAuth registration/login
- token refresh and logout

Includes:

- auth routes/controllers/validators/services
- auth frontend service integration
- auth UI states and error handling

Current slice note:

- email auth and Google auth are now the active auth paths; continue refining auth/create-account/verify-email/sign-in slices plus onboarding context handoff as needed

---

# 3) Profile Setup Flow

Scope:

- post-auth display name setup
- optional avatar/profile preferences
- profile fetch/update support
- verified account summary for email or Google auth origin

Includes:

- profile endpoints
- profile screen integration
- validation and ownership checks

Current slice note:

- profile setup remains implemented through `PATCH /users/profile`; next design-aligned pass must replace phone-first assumptions with email/google-aware entry states

---

# 4) Paywall and Monetization Entry

Scope:

- premium paywall screen
- plan selection UI
- restore purchases action
- dismiss / close handling
- premium feature messaging aligned to the current calm visual system

Includes:

- frontend paywall screen and navigation entry points
- purchase-state loading / error handling
- follow-up billing integration planning where needed

---

# 5) Home Dashboard Slice

Scope:

- greeting and date context
- streak summary
- quick mood check-in
- quick note capture
- short AI insight card
- recent entries preview

Includes:

- backend support for summary payloads where needed
- frontend loading/empty/error states

---

# 6) Journal Lifecycle

Scope:

- create entry
- list entries
- view detail
- edit entry
- delete entry
- tagging support

---

# 7) Insights and Trends

Scope:

- insights overview
- trends
- recurring patterns
- explanation drill-down

Depends on:

- stable AI extraction + aggregation pipeline

---

# 8) Weekly Action Plans

Scope:

- weekly plan generation
- plan retrieval/update
- completion tracking

---

# 9) Reminders and Streaks

Scope:

- reminders CRUD
- streak calculations
- streak history surfaces

---

# 10) Privacy and Safety

Scope:

- data export
- delete request
- AI opt-out
- safety escalation pathways

---

# Execution Rule

Do not start the next item until the current item is fully integrated:

- backend
- frontend
- validation
- tests
- verification notes

---

# Publish Readiness Tracking

For App Store launch readiness and final go-live status, use:

- `docs/PUBLISH_READINESS_CHECKLIST.md`

That checklist should be kept current as features move from implemented to fully production-ready.
