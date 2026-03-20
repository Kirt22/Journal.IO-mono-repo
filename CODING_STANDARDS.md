# Coding Standards

This document defines coding conventions for Journal.IO.

Goals:

- consistency
- maintainability
- predictable feature delivery

---

# 1) Backend Standards

Stack:

- Node.js
- Express
- MongoDB (Mongoose)

Structure:

- feature-based modules under `backend/src/services/{feature}`
- validators, controllers, routes, and service logic separated

Flow:

- route -> validator -> controller -> service -> DB -> response

Rules:

- validate all request body/params/query input
- keep controllers thin
- move business logic to services
- preserve response contract:
  - success: `{ success: true, message, data }`
  - error: `{ success: false, message, error }`
- enforce auth and ownership checks on protected resources
- avoid logging secrets, tokens, and raw sensitive journal text

---

# 2) Frontend Standards

Stack:

- React Native
- TypeScript
- React Navigation
- TanStack Query (server state)
- Zustand (app/client state)

Do not introduce Redux Toolkit for this repo unless explicitly requested.

Structure:

- `frontend/src/screens/{flow}`
- `frontend/src/screens/{flow}/{ScreenName}.tsx`
- `frontend/src/utils`
- `frontend/src/components`
- `frontend/src/services`
- `frontend/src/hooks`
- `frontend/src/store`
- `frontend/src/navigation`

Rules:

- group screen files by flow folders such as `onboarding`, `auth`, and `profile`
- keep low-level shared helpers like `apiClient` and `tokenStorage` in `frontend/src/utils`
- keep app-wide state in `frontend/src/store` when introduced
- place API calls in `frontend/src/services`
- keep screens focused on composition and state display
- extract reusable UI into components
- include loading, empty, success, and error states
- avoid direct API contract logic embedded in JSX
- build responsive screen layouts for iOS and Android phone sizes (compact, base, and large widths)
- use adaptive values (spacing, typography, control sizes, max content width) rather than single fixed dimensions for all devices
- route screen colors through shared theme tokens and avoid isolated hardcoded palettes in screen files
- use the app theme provider so light/dark mode follows the device system theme by default

---

# 3) Naming and Files

- variables/functions: `camelCase`
- React components: `PascalCase`
- constants: `UPPER_SNAKE_CASE` where meaningful
- files: `feature.type.ts` or `FeatureScreen.tsx`

Use existing naming patterns first when extending current modules.

---

# 4) Code Quality Rules

- keep functions small and readable
- avoid deep nested branching
- extract helpers when logic grows
- add comments only where logic is non-obvious
- do not leave dead code or commented-out legacy blocks

---

# 5) UI and Content Rules

UI should remain:

- calm
- minimal
- reflective
- emotionally safe

For user-facing AI insight copy:

- use non-clinical, uncertainty-aware language
- do not use diagnostic or medical-certainty wording

---

# 6) Testing and Verification

For meaningful changes, run relevant checks:

- backend tests
- frontend tests
- type checks
- lint

If no tests exist for touched logic, add focused tests when practical.

---

# 7) AI-Assisted Development Rules

When generating code with AI tools:

- follow repo structure
- do not invent parallel architecture
- keep diffs scoped to the requested change
- align implementation with `AGENTS.md` and `AI_API_SPEC.md`
