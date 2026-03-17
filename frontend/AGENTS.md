# Frontend AGENTS.md

This file adds frontend-specific guidance on top of the root [AGENTS.md](/Users/kirtansolanki/Desktop/Journal.IO/AGENTS.md).

## Scope

Apply these rules for all work under `frontend/`.

## Current Frontend State

- React Native app with TypeScript
- Default scaffold is still present
- The target structure is `src/screens`, `src/components`, `src/services`, `src/hooks`, `src/store`, and `src/navigation`
- Frontend architecture should follow MVVM:
  - View: `src/screens` and `src/components`
  - ViewModel: `src/hooks` and `src/store`
  - Model: `src/services` and shared feature/domain types
- Server state should move toward TanStack Query and app/client global state should use Zustand as features are added
- Do not introduce Redux/Redux Toolkit unless explicitly requested

## Frontend Working Rules

- Keep API calls out of screen components and place them in `src/services`.
- Keep MVVM boundaries clear: views render state, viewmodels coordinate UI logic/state, and models handle data access.
- Prefer focused screens and small reusable components.
- Handle loading, empty, success, and error states for each shipped feature.
- Preserve a calm, minimal, emotionally safe tone in copy and UI decisions.
- Keep insights language non-clinical and uncertainty-aware.

## App Structure

- Use `App.tsx` only as the entry point and keep app composition inside `src/`.
- Add new feature UI under `src/` instead of expanding generated root files.
- Reuse components before adding one-off UI helpers.

## Verification

Use these frontend checks after changes:

- `npm run lint`
- `npm test -- --runInBand`

The test script is configured with `--watchman=false` so Jest runs cleanly in restricted local environments.

## Branch Scope

- Frontend implementation changes should be committed to the `frontend` branch.
- Do not mix backend or root-global changes in frontend branch commits.
