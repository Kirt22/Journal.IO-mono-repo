# AI Architecture

## 1) Overview

Journal.IO uses a modular backend + mobile frontend architecture:

- Backend: Node.js, Express, MongoDB (Mongoose)
- Frontend: React Native + TypeScript
- AI Layer: OpenAI-driven asynchronous analysis jobs

The architecture is intentionally MVP-friendly: simple services, clear contracts, and vertical feature slices.

---

## 2) Backend Module Structure

`backend/src`:

- `config`
- `helpers`
- `middleware`
- `routes`
- `schema`
- `types`
- `services/{feature}`

Expected feature services:

- `auth`
- `user`
- `journal`
- `prompts`
- `insights`
- `plans`
- `safety`
- `reminders`
- `streaks`
- `privacy`
- `admin`

Service file pattern:

- `feature.routes.ts`
- `feature.controllers.ts`
- `feature.validators.ts`
- `feature.service.ts` (when business logic is non-trivial)

---

## 3) Request Lifecycle

Request flow:

1. Route
2. Validator middleware
3. Controller
4. Service orchestration
5. Database interaction
6. Standard response formatting

Controllers remain thin. Services contain domain logic.

---

## 4) Frontend Architecture Context

Current design flow represented in architecture decisions:

1. Onboarding
2. Auth (email / Google, with legacy phone OTP still available on the backend)
3. OTP verification
4. Profile setup
5. Home dashboard
6. Core journaling and insights surfaces

Frontend structure:

- `frontend/src/screens`
- `frontend/src/screens/{flow}`
- `frontend/src/components`
- `frontend/src/utils`
- `frontend/src/services`
- `frontend/src/hooks`
- `frontend/src/store`
- `frontend/src/navigation`

Frontend architectural pattern: MVVM.

- View: screens and reusable UI components
- ViewModel: hooks/store state and UI orchestration
- Model: service-layer data access and feature/domain data structures

API calls must remain in `frontend/src/services`.
Low-level shared helpers like API clients and secure token storage belong in `frontend/src/utils`.
Future global state should live in `frontend/src/store` and be organized by feature slice or flow when introduced.
Auth tokens are stored in secure device storage on the mobile client and attached to authenticated requests through the service layer.
For Google mobile sign-in, the device only forwards the Google `idToken`; the backend verifies it with Google and then issues the normal Journal.IO access and refresh tokens.

Home-screen lightweight data note:

- the Home current-streak card does not call the full streak summary endpoint
- the existing `GET /mood/today` response includes a lightweight `currentStreak` field for the Home bootstrap path
- the full streaks screen still reads the dedicated streak endpoints for the richer streak surface

Frontend state management split:

- server state: TanStack Query
- app/client global state: Zustand

Redux/Redux Toolkit is not part of the default frontend architecture.

---

## 5) AI Processing Architecture

Journal analysis is asynchronous and non-blocking:

1. User submits journal entry.
2. Journal entry is persisted immediately.
3. Analysis job is queued/triggered.
4. OpenAI extracts structured behavioral features.
5. Structured output is validated.
6. Features are persisted.
7. Insights and weekly plans aggregate from stored feature data.

Primary flow must not fail if AI analysis fails.

---

## 6) AI Output Contracts

AI outputs should be:

- structured
- deterministic in shape
- parseable
- safe and non-clinical

Typical extracted fields:

- sentiment
- primary emotions
- themes
- stress indicators
- behavior markers
- social context

---

## 7) Safety and Privacy Architecture

Safety and general insights must remain separated in logic and presentation.

Core requirements:

- never diagnose or label users with psychiatric conditions
- route elevated-risk signals through dedicated safety handling
- preserve user dignity in all messaging
- enforce auth and data ownership checks
- avoid logging secrets or sensitive raw journal text

---

## 8) Current vs Target Surface

Current implemented backend modules are centered around:

- `auth`
- `user`
- `journal`
- `mood`
- `insights`
- `privacy`
- `reminders`
- `streaks`

Design-aligned target modules include:

- prompts
- plans
- streaks

Architecture should evolve incrementally through vertical slices, not broad refactors.

Current insights overview architecture:

- the mobile Insights screen reads from `GET /insights/overview`
- the mobile `AI Analysis` tab reads from `GET /insights/ai-analysis`
- the Home AI insight card also reuses `GET /insights/ai-analysis`, but only surfaces short rotating snippets instead of the full weekly card stack
- the `AI Analysis` tab and Home AI card are gated by the user's stored `aiOptIn` onboarding/privacy preference
- backend stores a per-user cached `insights` document for fast read access
- the cache keeps lightweight aggregate counters and maps derived from:
  - journal entries
  - favorite state
  - journal tags
  - home mood check-ins
- journal and mood write paths incrementally maintain the cache
- if the cache is missing, the backend rebuilds it from journals and mood check-ins
- the same `insights` document also stores a weekly AI-analysis cache plus staleness metadata
- if a user opts out of AI analysis, the backend rejects `GET /insights/ai-analysis` and clears the cached weekly AI-analysis payload
- weekly AI-analysis is recomputed on demand from recent journal text, recent tags, and recent mood check-ins only when the cache is stale or the rolling week changes
- AI-analysis output is structured for the mobile screen into:
  - weekly summary metadata
  - pattern tags
  - Big Five-style trait signals
  - supportive dark-triad watchpoints
  - actionable steps
  - app-guidance cards

Current streaks architecture:

- the mobile Streaks screen reads from `GET /streaks/current` and `GET /streaks/history?days=30`
- journals remain the source of truth; streaks are derived from grouped journal-entry calendar dates rather than stored as a separate mutable streak counter
- backend streak aggregation computes:
  - current streak
  - best streak
  - current-month entry total
  - lifetime entry total
  - 30-day activity presence
  - milestone achievements
- the frontend keeps the existing Make layout and only swaps in the API-backed values

---

## 9) Non-Goals for MVP

Not required for current MVP:

- vector databases
- RAG orchestration
- complex multi-model infrastructure
- premature microservices
