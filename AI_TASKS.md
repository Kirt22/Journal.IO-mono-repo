# Feature Development Roadmap

This roadmap is aligned to the current design flow and MVP priorities.

Implement features sequentially as complete vertical slices.

---

# 1) Onboarding and Trust Setup

Scope:

- multi-step onboarding
- goal selection capture
- privacy agreement capture

Includes:

- frontend onboarding screens
- backend persistence for onboarding preferences (if required)
- validation and tests

---

# 2) Authentication Flow (Phone + Google)

Scope:

- phone OTP request
- OTP verification
- Google OAuth registration/login
- token refresh and logout

Includes:

- auth routes/controllers/validators/services
- auth frontend service integration
- auth UI states and error handling

---

# 3) Profile Setup Flow

Scope:

- post-auth display name setup
- optional avatar/profile preferences
- profile fetch/update support

Includes:

- profile endpoints
- profile screen integration
- validation and ownership checks

---

# 4) Home Dashboard Slice

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

# 5) Journal Lifecycle

Scope:

- create entry
- list entries
- view detail
- edit entry
- delete entry
- tagging support

---

# 6) Insights and Trends

Scope:

- insights overview
- trends
- recurring patterns
- explanation drill-down

Depends on:

- stable AI extraction + aggregation pipeline

---

# 7) Weekly Action Plans

Scope:

- weekly plan generation
- plan retrieval/update
- completion tracking

---

# 8) Reminders and Streaks

Scope:

- reminders CRUD
- streak calculations
- streak history surfaces

---

# 9) Privacy and Safety

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
