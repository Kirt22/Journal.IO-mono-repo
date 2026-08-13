# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Journal.IO — a behavioral journaling iOS/Android app with AI-powered pattern detection. Monorepo: `backend/` (Express + MongoDB + TypeScript) and `frontend/` (React Native + TypeScript). Insight language must stay non-clinical, supportive, and uncertainty-aware (never diagnostic).

**Authoritative docs — read before non-trivial work:**
- `AGENTS.md` — full working rules, conventions, branch model, and doc-priority order. This is the primary instruction file; CLAUDE.md only adds the architecture/command details you'd otherwise reconstruct by hand.
- `README.md` — install, env files, iOS release, RevenueCat/App Store checklists.
- `docs/` — source-of-truth specs. Priority when they conflict: `AGENTS.md` → `AI_API_SPEC.md` → `CODING_STANDARDS.md` → `AI_ARCHITECTURE.md` → `AI_UI_UX_CONTEXT.md` → rest.
- `docs/LOCAL_IOS_ENVIRONMENTS.md` — exact Simulator / device / prod run commands and URL rules.

## Commands

### Backend (`cd backend`)
```bash
npm run dev            # ts-node + nodemon, reads backend/.env
npm run build          # tsc -> dist/
npm start              # node dist/app.js
npm test               # builds first, then runs compiled tests (see below)
npm run check:production:domains
```

### Frontend (`cd frontend`)
```bash
npm start              # Metro (APP_ENV=simulator)
npm run ios            # build+run iOS on Simulator
npm run ios:local-test # APP_ENV=local, physical device against this Mac's backend
npm run ios:local-prod # APP_ENV=production, Release mode
npm run android
npm run lint           # eslint .
npm test               # jest --watchman=false
```

### Running a single test — the two runners differ
- **Backend uses Node's built-in test runner, NOT Jest.** `npm test` compiles TS then `scripts/run-tests.mjs` globs `dist/**/*.test.js` and runs `node --test` on them. Tests are colocated `*.test.ts`. To run one file: `npm run build && node --test dist/services/mood/mood.service.test.js`.
- **Frontend uses Jest** (`preset: react-native`). Tests live in `frontend/__tests__/`. Run one: `npx jest FirstGuidedReflectionScreen` or `npx jest -t "test name"`.

### Environment selection (the key mechanism behind the many `ios:*`/`start:*` scripts)
`APP_ENV` (`simulator` | `local` | `production`) is read in `frontend/babel.config.js`, which points `react-native-dotenv` at the matching `.env.simulator` / `.env.local` / `.env.production` (default `.env`). `BABEL_ENV=production`, `NODE_ENV=production`, or `CONFIGURATION=Release` also force the production file — so **Xcode Release archives read `.env.production`**. Vars are imported via the `@env` module. Babel cache is disabled so switching envs takes effect without a manual clear.

Backend DB target: `MONGO_STAGE` (`local`/`dev`/`prod`) selects a stage-specific `MONGO_URI_*`, but a direct `MONGO_URI` overrides it (`config/mongo.db.config.ts`).

## Backend architecture

Request pipeline is strict and consistent across every service:
```
route -> verifyJwtToken -> validateRequest(zodSchema) -> controller -> service -> mongoose -> response
```
- **Routing:** `src/routes/index.ts` mounts every domain router under `/api/v1/<domain>`. Health at `/health`, readiness at `/ready`, legal pages registered separately. `createApp()` and `startServer()` are split in `src/app.ts` (`createApp` is import-safe for tests). `startServer` asserts RevenueCat prod config, connects Mongo, then starts the background RevenueCat entitlement-reconciliation job.
- **Validation:** `validateRequest(schema)` (middleware) parses `{ body, query, params, headers }` as one object — so Zod validators in `*.validators.ts` must be shaped with those top-level keys. Never skip validation.
- **Responses:** always the envelope from `helpers/commonHelper.helpers` — `apiResponse(success, message, data, error)` with `API_MESSAGES` constants. Success `{success:true,message,data}`, error `{success:false,message,error}`. Don't hand-roll response shapes.
- **Service-module pattern** (one folder per domain under `src/services/<domain>/`): `<domain>.routes.ts`, `<domain>.controllers.ts`, `<domain>.validators.ts`, `<domain>.service.ts` (business logic), plus colocated `<domain>.service.test.ts`. Controllers stay thin; services hold logic, DB orchestration, and AI calls. Domains present: `auth, user, mood, journal, goals, guided-reflection, onboarding, insights, prompts, reminders, streaks, privacy, paywall, revenuecat, widgets, admin`.
- **Schemas:** Mongoose models in `src/schema/*.schema.ts`. Changing a schema means updating its `src/types/*`, validators, affected services, and `docs/AI_API_SPEC.md` if the contract shifts.
- **Widgets & webhooks:** widget flows use their own `verifyWidgetToken` / `verifyWidgetSessionProvisioning` middleware and `widget_session` schema. RevenueCat webhooks are mounted at `/api/v1/webhooks` (Bearer `REVENUECAT_WEBHOOK_AUTH_TOKEN`).

### AI layer
There is **no OpenAI SDK dependency.** All model calls go through one helper, `helpers/openai.helpers.ts` → `requestStructuredOpenAi(...)`, which POSTs to the OpenAI **Responses API** (`/v1/responses`) via `fetch` with `text.format = json_schema` (`strict: true`), then validates the output with a Zod parser. Model defaults to `OPENAI_RESPONSES_MODEL` / `OPENAI_MODEL` / `gpt-5.4-mini`.

Critical invariants:
- The helper **returns `null` on any failure** (missing key, HTTP error, empty/malformed output, schema-validation failure) and never throws. Callers must treat `null` as "no AI result" and keep the core flow working — a journal entry must save even if analysis fails.
- AI is gated per-user by `canUseOpenAiForUser`: it requires an active premium entitlement. Respect this and do not call the model for non-premium users.
- Store structured feature objects, not free-form prose. Keep extraction shape deterministic.

## Frontend architecture

- **Graphics/animation stack.** Most motion uses the legacy `Animated` API. The Home hero orb is the one exception: it draws a
  procedural energy ring through **`@shopify/react-native-skia` 2.11.0** + **`react-native-reanimated` 4.3.3**
  (`src/components/orb/`). Both are **pinned** — Reanimated 4.4+ needs RN 0.83 and worklets 0.9+, while this project is on RN
  0.82.1 with `react-native-worklets` 0.8.3; taking `@latest` on either breaks the peer graph. Reanimated 4 is New-Architecture
  only. The worklets Babel plugin is already last in `babel.config.js`. Skia and Reanimated are mocked in `jest.setup.ts`.
  Note `react-native-screens` is `^4.25.0-beta.1` but must stay at exactly `4.25.0-beta.1` — 4.26.x fails RN 0.82 codegen, and a
  bare `npm i` will happily upgrade it.
- **State is Zustand-only.** `src/store/appStore.ts` is the central store (with slices under `src/store/slices/`). Note: `AGENTS.md` mentions TanStack Query, but it is **not** a dependency — do not add it or reach for it; use the existing store + service pattern.
- **App is a stage machine.** `App.tsx` → `AppBootstrapper` drives a `stage` value (`main-app`, `new-entry`, `journal-detail`, `journal-edit`, auth-gate stages, …) and orchestrates auth gating, cached-session revalidation, RevenueCat identity/entitlement sync, biometric app-lock overlay, connectivity boundary, and widget-session provisioning on boot.
- **API calls live only in `src/services/*Service.ts`** (one per backend domain). Screens must not fetch directly. Reusable UI goes in `src/components/`, navigation in `src/navigation/`. Screens handle loading/empty/error/success states.
- **UI consistency:** for any mobile UI change, follow `docs/UI_IMPLEMENTATION_STANDARDS.md` (header, spacing, theme tokens, icons, haptics, conditional-action animations) instead of inventing local variants. Keep the app calm/minimal — avoid gamification and heavy animation.

## Conventions & guardrails (see AGENTS.md for the full list)

- Work in **vertical slices**: backend (route→validator→controller→service→schema) first, then frontend service+screen, then tests. Don't leave half-built features or TODOs in critical logic.
- **Branch model:** `main` = shared dev (don't edit directly during branch tasks unless asked), `codex` = default working branch for feature/fix/docs work, `prod` = production-ready. Commit related backend+frontend+docs changes together on `codex`.
- Never log raw journal text or secrets. Enforce auth + ownership on every protected resource; never leak one user's data to another.
- Don't introduce new frameworks/infra (Redux, GraphQL, Prisma, E2EE for the AI flow, etc.) without an explicit request — prefer the existing repo pattern.
- Screen work: default design source is the Figma Make project referenced in `AGENTS.md §23`; update `docs/SCREEN_IMPLEMENTATION_STATUS.md` after screen tasks.

## Knowledge graph (graphify)

A code knowledge graph lives in `graphify-out/`. For codebase questions, prefer `graphify query "<question>"` / `graphify path "<A>" "<B>"` / `graphify explain "<concept>"` over broad grep when `graphify-out/graph.json` exists; `graphify-out/wiki/index.md` is good for navigation. Run `graphify update .` after code changes (AST-only, no API cost). Dirty `graphify-out/` files are expected and not a blocker.
