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
2. Auth (phone / Google)
3. OTP verification
4. Profile setup
5. Home dashboard
6. Core journaling and insights surfaces

Frontend structure:

- `frontend/src/screens`
- `frontend/src/components`
- `frontend/src/services`
- `frontend/src/hooks`
- `frontend/src/store`
- `frontend/src/navigation`

Frontend architectural pattern: MVVM.

- View: screens and reusable UI components
- ViewModel: hooks/store state and UI orchestration
- Model: service-layer data access and feature/domain data structures

API calls must remain in `frontend/src/services`.

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
- `journal`

Design-aligned target modules include:

- prompts
- insights
- plans
- reminders
- streaks
- privacy

Architecture should evolve incrementally through vertical slices, not broad refactors.

---

## 9) Non-Goals for MVP

Not required for current MVP:

- vector databases
- RAG orchestration
- complex multi-model infrastructure
- premature microservices
