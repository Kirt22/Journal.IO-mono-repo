---
name: backend-feature-slice
description: Implement or update a Journal.IO backend feature slice when work touches Express routes, controllers, validators, Mongoose schemas, or service logic under `backend/src`. Use for new endpoints, API contract alignment, auth-protected data access, schema-backed features, and backend vertical slices that must follow `AGENTS.md`, `AI_API_SPEC.md`, and the repo response formats.
---

# Backend Feature Slice

Use this skill for backend work in `backend/src`, especially under `services/*`, `schema`, `middleware`, and `routes`.

## Read first

Open only the docs that matter to the task, in this priority:

1. `AGENTS.md`
2. `AI_API_SPEC.md`
3. `CODING_STANDARDS.md`
4. `AI_ARCHITECTURE.md`
5. `SECURITY_MODEL.md`
6. `AI_INSIGHTS_PIPELINE.md` for AI-analysis work

## Required repo rules

- Follow the repo request flow: route -> controller -> service -> database -> response.
- Validate request body, params, and query input.
- Keep controllers thin. Put business logic in services.
- Preserve the standard response shapes:
  - success: `{ success: true, message, data }`
  - error: `{ success: false, message, error }`
- Enforce authentication and ownership checks for protected data.
- Do not log secrets, tokens, or raw journal text unless the task explicitly requires safe local debugging.
- Keep all end-user insight language non-clinical, supportive, behavior-focused, and uncertainty-aware.

## Workflow

1. Inspect the relevant existing module, schema, middleware, and API contract before editing.
2. Identify the smallest complete backend slice required.
3. If the contract changes, update implementation and spec together. Do not let them drift.
4. Add or update validators, controllers, services, and schema/types together where applicable.
5. Keep schema changes narrow. Add indexes only for clear query patterns.
6. Add focused tests for happy path, validation failure, and auth/ownership behavior when practical.
7. Run targeted verification commands for the touched backend area.

## Journal.IO-specific reminders

- AI analysis must not block journal creation.
- Structured outputs should be deterministic in shape and validated before storage.
- Safety logic must stay separate from general insights.
- Do not introduce new architecture, frameworks, or infra for MVP work.

## Done criteria

- Backend slice is vertically complete for the requested scope.
- Validation is present.
- API contract is respected.
- Relevant checks were run and reported honestly.
- No unrelated refactors were mixed in.

