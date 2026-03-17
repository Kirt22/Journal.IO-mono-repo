# AGENTS.md

This repository contains **journal.io**, a behavioral journaling app with AI-powered pattern detection.

This file defines the default instructions Codex must follow when working in this repo.

---

## 1) Mission

Build and maintain a production-quality MVP of **journal.io**.

The product helps users:

- journal daily
- track mood, stress, energy, and sleep
- detect behavioral patterns from journal writing
- view trend insights over time
- receive practical weekly action plans

The product does **not** diagnose mental health conditions.

All insight language must remain:

- non-clinical
- supportive
- behavior-focused
- uncertainty-aware

Use phrases like:

- "may indicate"
- "appears associated with"
- "journal entries suggest"
- "a recurring pattern may be"

Never use phrases that imply diagnosis, certainty, or medical authority.

---

## 2) Operating Rules For Codex

For any non-trivial task, Codex must:

1. understand the requested feature or bug
2. inspect relevant files before changing code
3. produce a brief implementation plan
4. list the files it will create or modify
5. implement the smallest complete vertical slice
6. run relevant validation commands
7. summarize what changed, what was verified, and any remaining gaps

Do not start unrelated refactors.

Do not introduce new frameworks, architectural patterns, or infrastructure unless explicitly asked.

Do not silently change API contracts, schema shapes, naming conventions, or folder structure unless required by the task.

When unclear, prefer the existing repo pattern over inventing a new one.

---

## 3) Product Scope

The MVP includes:

- authentication
- user profile
- journal creation and history
- daily check-in inputs
- AI extraction of structured behavioral features
- insights dashboard
- weekly action plans
- reminders
- streak tracking
- safety monitoring
- privacy controls

The MVP does **not** require:

- vector databases
- retrieval augmented generation
- complex multi-model orchestration
- premature microservices
- end-to-end encryption for AI-enabled mode

Keep implementation simple and shippable.

---

## 4) Development Model

Development follows a **vertical slice** model.

Complete one feature fully before moving to the next.

A feature is only considered complete when it includes, where applicable:

- backend route definitions
- validators
- controllers
- service logic
- database schema updates
- frontend screens
- API integration
- loading states
- empty states
- error states
- basic test coverage
- manual verification notes

Avoid partially implemented features.

Avoid leaving placeholder TODOs for critical logic.

---

## 5) Source Of Truth Documents

When working in this repo, consult these documents when relevant:

- `AI_PRODUCT.md` → product goals, scope, non-goals
- `AI_ARCHITECTURE.md` → backend and AI architecture
- `AI_API_SPEC.md` → API contracts
- `AI_UI_UX_CONTEXT.md` → design system and screen behavior
- `CODING_STANDARDS.md` → conventions and guardrails
- `FEATURE_DEVELOPMENT_WORKFLOW.md` → implementation workflow
- `AI_INSIGHTS_PIPELINE.md` → AI extraction and aggregation flow
- `SECURITY_MODEL.md` → privacy and security rules
- `AI_TASKS.md` → roadmap and feature order

If these docs conflict, use this priority order:

1. `AGENTS.md`
2. `AI_API_SPEC.md`
3. `CODING_STANDARDS.md`
4. `AI_ARCHITECTURE.md`
5. `AI_UI_UX_CONTEXT.md`
6. remaining docs

Do not invent requirements that contradict these files.

---

## 6) Tech Stack

### Frontend
- React Native
- TypeScript
- React Navigation
- TanStack Query
- Zustand

### Backend
- Node.js
- Express
- MongoDB
- Mongoose

### AI Layer
- OpenAI API
- asynchronous background analysis jobs

Use the existing stack only.

Do not introduce Redux Toolkit, GraphQL, Next.js, NestJS, Prisma, or relational databases unless explicitly requested.

---

## 7) Repository Structure

### Backend
Expected structure:

- `backend/src/config`
- `backend/src/helpers`
- `backend/src/middleware`
- `backend/src/routes`
- `backend/src/schema`
- `backend/src/types`
- `backend/src/services/auth`
- `backend/src/services/user`
- `backend/src/services/journal`
- `backend/src/services/prompts`
- `backend/src/services/insights`
- `backend/src/services/plans`
- `backend/src/services/safety`
- `backend/src/services/reminders`
- `backend/src/services/streaks`
- `backend/src/services/privacy`
- `backend/src/services/admin`

Each service module should follow this pattern where applicable:

- `feature.routes.ts`
- `feature.controllers.ts`
- `feature.validators.ts`
- `feature.service.ts` if business logic is non-trivial

### Frontend
Expected structure:

- `frontend/src/screens`
- `frontend/src/components`
- `frontend/src/services`
- `frontend/src/hooks`
- `frontend/src/store`
- `frontend/src/navigation`

Keep files in the correct feature area.

Do not create duplicate parallel architectures.

---

## 8) Backend Conventions

### Request Flow
Use this flow:

client request  
→ route  
→ controller  
→ service  
→ database  
→ response

### Controllers
Controllers must:

- validate input
- call service logic
- format HTTP responses
- avoid heavy business logic

### Services
Services should contain:

- core business logic
- database interaction orchestration
- cross-module coordination
- AI orchestration where relevant

### Validation
All incoming request bodies, params, and query strings must be validated.

Use the existing schema validation library already used in the repo.

Do not skip validation.

### Error Format
All errors should follow the standard repo response contract:

```json
{
  "success": false,
  "message": "Human readable error message",
  "error": {}
}
```

### Success Format

Use:

```json
{
  "success": true,
  "message": "Human readable success message",
  "data": {}
}
```

### Logging

Log important operational failures, especially:

- authentication failures
- permission issues
- AI analysis failures
- job retries and dead-letter scenarios
- safety classification failures
- unexpected server exceptions

Do not log raw secrets or sensitive user journal text unless explicitly required for a safe local debug workflow.

---

## 9) Database Conventions

MongoDB with Mongoose is the persistence layer.

Schemas live in:

- `backend/src/schema`

Use clear schema names such as:

- `user.schema.ts`
- `journal.schema.ts`
- `entry_features.schema.ts`
- `weekly_plan.schema.ts`
- `reminder.schema.ts`

Schema rules:

- timestamps should be enabled where useful
- enums should be explicit
- optional vs required fields must match API contracts
- indexes should be added for clear query patterns only
- avoid premature indexing everywhere

When changing a schema:

- update related types
- update validators
- update affected services
- update API docs if the contract changes

---

## 10) Frontend Conventions

Use React Native with TypeScript.

### Screen Rules

Screens should:

- be focused and not overly large
- delegate reusable UI into components
- handle loading, empty, success, and error states
- avoid embedding raw API details in the JSX layer

### State Rules

Use:

- TanStack Query for server state
- Zustand for app/client state

Do not tightly couple state logic to UI rendering.

### Service Rules

All API requests must live in `frontend/src/services`.

Do not make direct fetch or axios calls from screen files unless the repo already uses that exact pattern consistently.

### Component Rules

Reusable UI components must be placed in `frontend/src/components`.

Prefer small, composable components.

### UX Rules

The app should feel:

- calm
- minimal
- reflective
- emotionally safe

Avoid noisy UI, heavy animation, and gamification overload.

---

## 11) Naming And Code Style

Use existing repo conventions first.

Default rules:

- variables: `camelCase`
- functions: `camelCase`
- React components: `PascalCase`
- files: `feature.type.ts` or `FeatureScreen.tsx`
- constants: `UPPER_SNAKE_CASE` only where appropriate

General code rules:

- prefer small functions
- avoid deeply nested logic
- extract helpers when logic becomes complex
- use descriptive names
- comment only where logic is non-obvious
- avoid broad speculative abstractions

Do not add dead code.

Do not leave commented-out legacy code in commits.

---

## 12) API Contract Rules

`AI_API_SPEC.md` is the contract source of truth.

When implementing endpoints:

- keep request and response shapes aligned with the spec
- do not rename fields casually
- do not change enum values casually
- do not mix snake_case and camelCase inconsistently
- keep pagination consistent across list endpoints
- ensure auth-protected endpoints enforce auth

If the code and spec disagree, either:

- fix code to match spec, or
- update spec and implementation together if the task explicitly changes the contract

Never drift silently.

---

## 13) AI Analysis Rules

AI analysis runs asynchronously after journal submission.

Default flow:

1. user submits journal entry
2. journal entry is saved
3. async analysis job is triggered
4. OpenAI extracts structured features
5. structured features are persisted
6. insights endpoints aggregate from stored features
7. weekly plans use recent trend summaries, not raw ad hoc inference alone

### MVP AI Extraction Scope

AI may extract:

- sentiment
- primary emotions
- themes
- stress level
- behavior markers
- social context

### AI Output Requirements

AI outputs must be:

- structured
- deterministic in shape
- parseable
- safe
- non-clinical

Prefer storing structured feature objects rather than free-form prose blobs.

### Prompting Rules

When implementing prompts:

- keep prompts versioned if prompt logic becomes important
- prefer structured JSON outputs
- validate model output before storing
- handle malformed output safely
- define fallback behavior on parse failure

### Failure Handling

If AI analysis fails:

- the journal entry must still exist
- failure must not block the primary journaling flow
- the system should store analysis status
- retries should be possible
- user-facing messaging should remain calm and non-technical

---

## 14) Safety Rules

This product touches emotionally sensitive content.

Safety behavior is mandatory.

### Never Do

Never:

- diagnose a disorder
- claim medical certainty
- label a user with a psychiatric condition
- provide dangerous self-harm instructions
- overstate model confidence
- present AI output as professional medical advice

### Always Do

Always:

- use soft, non-clinical language
- route elevated-risk cases to the safety flow
- present crisis resources when appropriate
- keep safety messaging supportive and direct
- preserve user dignity and privacy

### Risk Handling

When implementing safety logic:

- separate safety signals from general insight generation
- avoid exposing raw safety classifier internals to end users
- ensure manual check paths are available where designed
- prefer false-positive-tolerant UX over risky silence

---

## 15) Security And Privacy Rules

This app stores sensitive journal data.

Follow these rules strictly:

- enforce authentication on protected endpoints
- validate ownership before returning or mutating user data
- never leak one user’s journals or insights to another user
- never log tokens, passwords, or secrets
- never commit secrets to the repo
- keep environment variables in `.env` files that are ignored by git
- honor privacy controls such as export, deletion, and AI opt-out

The MVP does not use end-to-end encryption for AI-enabled journaling mode.

Do not propose E2EE for the main AI flow unless explicitly asked, because server-side AI processing requires journal text access.

---

## 16) Testing Expectations

Every meaningful code change should include verification.

At minimum, Codex should run the most relevant checks available in the repo, such as:

- backend tests
- frontend tests
- type checking
- linting

If tests do not yet exist for the touched area, add focused tests where reasonable.

Prefer targeted tests over huge speculative suites.

When adding a feature, validate:

- happy path
- validation failure path
- auth or permission path where relevant
- major UI state changes where relevant

Do not claim something is complete if it was not tested or could not be run.

---

## 17) Definition Of Done

A task is done only when all applicable items are true:

- the implementation matches the request
- code follows existing repo structure
- validation is present
- API contracts are respected
- relevant frontend and backend pieces are connected
- loading, error, and empty states are handled
- tests were added or updated where appropriate
- relevant checks were run
- no unrelated files were changed
- no critical TODOs were left behind
- final summary explains what changed and what was verified

If any item is not complete, explicitly say so.

---

## 18) What Codex Should Include In Final Task Summaries

At the end of a task, provide:

1. what was changed
2. which files were added or modified
3. what commands were run
4. what passed or failed
5. any follow-up risks or gaps

Be precise. Do not say "done" without verification details.

---

## 19) Anti-Patterns To Avoid

Do not:

- rewrite the whole app for a small task
- change architecture without request
- mix unrelated refactors into feature work
- add dependencies casually
- invent hidden requirements
- bypass validation
- hardcode secrets
- over-engineer the MVP
- use clinical or diagnostic mental health language
- block core journaling on AI availability
- ship inconsistent API response shapes

---

## 20) Preferred Task Style

For feature work, use this pattern:

- inspect relevant docs and code
- plan briefly
- implement backend first if backend changes are needed
- implement frontend integration next
- add or update tests
- run checks
- summarize verification clearly

For bugs:

- identify root cause first
- fix the smallest responsible surface area
- add regression protection if practical

For refactors:

- preserve behavior unless explicitly asked to change it
- keep diffs focused
- avoid aesthetic-only churn

---

## 21) When To Ask For Clarification

Ask for clarification only when the ambiguity materially blocks correct implementation.

Otherwise, make the most reasonable repo-consistent assumption and state it in the summary.

---

## 22) Guidance Maintenance

If the same mistake happens more than once, update `AGENTS.md` with a concrete rule that would have prevented it.

Keep this file practical, short enough to be usable, and based on real repo needs.

---

## 23) Skills

A skill is a set of local instructions stored in a `SKILL.md` file.

### Available skills

Project-local skills (preferred for this repo):

- `context-sync-on-change`: Keep root context/spec markdown files synchronized with feature/API/UX/security changes. (file: `/Users/kirtansolanki/Desktop/Journal.IO/.agents/skills/context-sync-on-change/SKILL.md`)
- `figma-screen-build`: Translate Figma designs into Journal.IO React Native screens/components aligned with this repo. (file: `/Users/kirtansolanki/Desktop/Journal.IO/.agents/skills/figma-screen-build/SKILL.md`)
- `frontend-feature-implementation`: Implement Journal.IO frontend feature slices under `frontend/src` with proper UI states and service integration. (file: `/Users/kirtansolanki/Desktop/Journal.IO/.agents/skills/frontend-feature-implementation/SKILL.md`)
- `backend-feature-slice`: Implement Journal.IO backend slices under `backend/src` using route/controller/validator/service patterns. (file: `/Users/kirtansolanki/Desktop/Journal.IO/.agents/skills/backend-feature-slice/SKILL.md`)
- `bug-fix-and-verification`: Diagnose root cause and apply minimal, verified fixes across frontend/backend. (file: `/Users/kirtansolanki/Desktop/Journal.IO/.agents/skills/bug-fix-and-verification/SKILL.md`)

Global skills (fallback/utility):

- `figma`: Use Figma MCP tools for design context and implementation support. (file: `/Users/kirtansolanki/.codex/skills/figma/SKILL.md`)
- `skill-creator`: Create or update skills with proper metadata and concise instruction design. (file: `/Users/kirtansolanki/.codex/skills/.system/skill-creator/SKILL.md`)
- `skill-installer`: Install curated skills into Codex global skills. (file: `/Users/kirtansolanki/.codex/skills/.system/skill-installer/SKILL.md`)

### How to use skills

- Trigger by skill name (`$skill-name`) or plain-text mention.
- When both local and global skills overlap, prefer project-local skills for Journal.IO tasks.
- Read only the triggered skill body and any directly needed references.
- Keep skill usage focused; do not load unrelated skills.
