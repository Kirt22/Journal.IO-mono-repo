---
name: frontend-feature-implementation
description: Implement or update a Journal.IO frontend feature in React Native and TypeScript when work involves screens, components, navigation, client state, or API integration under `frontend/src`. Use for vertical slices that require screen states, service-layer API calls, calm UI behavior, and alignment with `AGENTS.md`, `AI_UI_UX_CONTEXT.md`, and the backend API contract.
---

# Frontend Feature Implementation

Use this skill for work in `frontend/src`, especially `screens`, `components`, `services`, `hooks`, `store`, and `navigation`.

## Read first

Open only the docs needed for the task, in this order:

1. `AGENTS.md`
2. `AI_API_SPEC.md` for request and response shapes
3. `CODING_STANDARDS.md`
4. `AI_UI_UX_CONTEXT.md`
5. `FEATURE_DEVELOPMENT_WORKFLOW.md`

## Required repo rules

- Use React Native with TypeScript and preserve the existing repo structure.
- Put API calls in `frontend/src/services`.
- Keep screens focused; extract reusable UI into `frontend/src/components`.
- Handle loading, empty, error, and success states where applicable.
- Prefer TanStack Query for server state and Zustand for app state if state work is needed.
- Avoid embedding raw API details directly in screen JSX.
- Keep the UI calm, minimal, and emotionally safe.

## Journal.IO design constraints

- Respect the documented visual tone: calm, reflective, and data-informative.
- Prefer the repo typography and color direction from `AI_UI_UX_CONTEXT.md`.
- Keep motion subtle.
- For any user-facing insight copy, use non-clinical and uncertainty-aware language.

## Workflow

1. Inspect the target screen, related components, current services, and relevant backend contract.
2. Implement the smallest complete frontend slice for the request.
3. Add or update service-layer functions before wiring UI to backend data.
4. Keep view logic simple; extract repeatable UI or formatting helpers when needed.
5. Cover major state transitions: loading, empty, populated, submit-in-progress, and error.
6. Add or update focused tests when the touched area has practical coverage hooks.
7. Run relevant frontend verification commands after changes.

## Guardrails

- Do not introduce new state libraries, new navigation patterns, or a parallel component architecture.
- Do not hardcode backend contracts that differ from `AI_API_SPEC.md`.
- Do not turn the app into a noisy or heavily gamified experience.

## Done criteria

- Frontend behavior matches the request.
- API integration lives in the service layer.
- UI states are handled.
- Verification was run and reported accurately.

