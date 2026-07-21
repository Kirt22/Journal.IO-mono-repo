# Phase 3C Post-Entry Value Chain Report

Date: 2026-06-30

## Summary

Phase 3C extends the post-first-entry onboarding path after the saved session analysis. Instead of moving directly to Home, Journal.IO now shows a short value chain:

1. Session analysis
2. Local AI-generated goals
3. UI-only streak started
4. Local Mind Map preview
5. Mind Map explanation
6. Home

The first journal entry remains the only persisted artifact in this flow.

## Files Changed

- `frontend/src/screens/onboarding/FirstGuidedReflectionScreen.tsx`
- `frontend/src/services/guidedReflectionService.ts`
- `backend/src/services/guided-reflection/guided-reflection.service.ts`
- `backend/src/services/guided-reflection/guided-reflection.validators.ts`
- `backend/src/services/guided-reflection/guided-reflection.controllers.ts`
- `backend/src/services/guided-reflection/guided-reflection.routes.ts`
- `backend/src/services/guided-reflection/guided-reflection.service.test.ts`
- `docs/AI_API_SPEC.md`
- `docs/AI_UI_UX_CONTEXT.md`
- `docs/SCREEN_IMPLEMENTATION_STATUS.md`

## Backend

Added `POST /guided-reflection/goal-suggestions`.

This endpoint:

- requires authentication
- validates the request body
- generates up to four small, practical, non-clinical goal suggestions
- uses OpenAI only when configured and allowed
- falls back to deterministic safe starter goals
- returns `hasEnoughSignal: false` for sparse/noisy sessions
- does not persist goals
- does not create goal CRUD
- does not schedule reminders
- does not touch streak or Mind Map state

## Frontend Flow

The previous path was:

```txt
Session analysis -> final completion -> Home
```

The Phase 3C path is:

```txt
Session analysis -> goals -> streak started -> Mind Map preview -> Mind Map explanation -> Home
```

The screen continues to use the existing first-reflection safe Home route. It does not call `/onboarding/complete` in this pass because the current completion path may trigger downstream paywall behavior.

## Goals Screen

The goals screen shows compact editable goal cards.

Supported local actions:

- select/deselect a goal
- edit title
- edit description
- edit frequency
- continue with selected goals
- skip when no goals are selected

Persistence:

- selected goals are local-only
- edited goals are local-only
- no goals backend was added

TODO:

```ts
// TODO Phase 3D: persist selected onboarding goals once the goals backend/model is designed.
```

## Streak Screen

The streak screen is a motivational onboarding value screen only.

It shows:

- `Your streak has started.`
- `You showed up today. That's day 1.`
- a day-1 streak card

Persistence:

- no streak persistence is added in this pass
- existing streak infrastructure was not changed

TODO:

```ts
// TODO Phase 3D: persist streak once streak backend/model is finalized.
```

## Mind Map Preview

The Mind Map preview is generated locally from:

- session analysis observed trends
- selected local goal cards
- safe fallback tags

The preview uses:

- one center node
- 3-6 surrounding nodes
- simple connection lines
- theme-aware soft colors
- safe, non-clinical labels only

Persistence:

- no Mind Map backend was added
- no node/edge schema was added
- no graph API was added
- no Mind Map state is persisted

TODO:

```ts
// TODO Phase 3D: persist Mind Map nodes/edges once the Mind Map backend is designed.
```

## Mind Map Explanation

The explanation screen includes three compact cards:

- `Entries become nodes`
- `Patterns form connections`
- `You stay in control`

The copy frames the map as private reflection support, not diagnosis.

## Safety

The goal and Mind Map generation rules avoid:

- clinical labels
- diagnostic claims
- sensitive inferred identity labels
- shame-based wording
- heavy treatment-plan language

Low-signal sessions receive starter goals and fallback Mind Map tags rather than invented insight.

## Intentionally Left For Later

- full goals backend/model
- goal CRUD
- selected goal persistence
- streak persistence
- reminder setup
- Mind Map backend
- Mind Map node/edge persistence
- graph API
- full 3D Mind Map
- paywall strategy
- RevenueCat changes

## Manual Test Checklist

1. Complete Onboarding V2.
2. Complete first guided reflection.
3. Save first entry.
4. Confirm exactly one journal entry is created.
5. Confirm session analysis screen appears.
6. Tap Continue.
7. Confirm goals loading/generation occurs.
8. Confirm max 4 goal cards appear.
9. Confirm goal cards can be selected/deselected.
10. Confirm goal card edit opens.
11. Confirm edited goal saves locally/UI updates.
12. Confirm `Add selected goals` works.
13. Confirm user can skip if no goal selected.
14. Confirm streak screen appears.
15. Confirm streak screen says day 1 / streak started.
16. Confirm Mind Map preview screen appears after streak screen.
17. Confirm Mind Map has central node and 3-6 surrounding nodes.
18. Confirm no clinical/sensitive labels appear.
19. Confirm Mind Map explanation screen appears after Mind Map.
20. Confirm final CTA routes Home.
21. Confirm no paywall appears.
22. Confirm no RevenueCat files changed.
23. Confirm no reminder setup appears.
24. Confirm no duplicate journal entries are created.
25. Confirm old onboarding fallback still works when v2 is disabled.

## Risks And Open Questions

- Goal suggestions are generated but not persisted, so app close/resume mid-chain is intentionally not fully handled yet.
- The Mind Map preview is illustrative and local-only, so product should decide the Phase 3D persistence model before adding real map history.
- Streak is motivational UI only in this flow; persistence should wait until the streak model and onboarding-completion strategy are finalized.
- The final `/onboarding/complete` decision remains deferred to avoid accidentally triggering paywall before the full post-entry value sequence is product-approved.
