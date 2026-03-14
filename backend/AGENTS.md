# Backend AGENTS.md

This file adds backend-specific guidance on top of the root [AGENTS.md](/Users/kirtansolanki/Desktop/Journal.IO/AGENTS.md).

## Scope

Apply these rules for all work under `backend/`.

## Current Backend State

- TypeScript Express app rooted at `src/app.ts`
- MongoDB via Mongoose
- Validation middleware already uses Zod-style schemas
- Feature folders currently present: `user`, `journal`
- The codebase is scaffolded but several controllers are still placeholders

## Backend Working Rules

- Keep the request flow `route -> controller -> service -> schema`.
- Move non-trivial logic into `*.service.ts` files instead of expanding controllers.
- Validate request body, params, and query input for every endpoint.
- Keep API responses aligned with `AI_API_SPEC.md` and the repo response envelope.
- Enforce authentication and ownership checks on protected data.
- Do not block journal creation on AI analysis availability.

## File Placement

- Routes live in `src/services/<feature>/<feature>.routes.ts`
- Controllers live in `src/services/<feature>/<feature>.controllers.ts`
- Validators live in `src/services/<feature>/<feature>.validators.ts`
- Schemas live in `src/schema`
- Shared middleware belongs in `src/middleware`

## Verification

Use these backend checks after changes:

- `npm run build`

If a task touches runtime behavior, add or run the smallest relevant test coverage available before finishing.
