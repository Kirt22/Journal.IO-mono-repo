---
name: context-sync-on-change
description: Keep Journal.IO root context/spec markdown files in sync whenever feature behavior, API contracts, architecture, UX flow, security/privacy behavior, or roadmap state changes. Use after backend/frontend implementation, bug fixes, or design-driven updates that risk doc drift across `AI_UI_UX_CONTEXT.md`, `AI_API_SPEC.md`, `AI_ARCHITECTURE.md`, `AI_INSIGHTS_PIPELINE.md`, `AI_PRODUCT.md`, `AI_TASKS.md`, `CODING_STANDARDS.md`, `FEATURE_DEVELOPMENT_WORKFLOW.md`, and `SECURITY_MODEL.md`.
---

# Context Sync On Change

Use this skill after meaningful code or design changes to keep project context docs current.

This skill is for documentation synchronization, not feature implementation.

## Read first

Open in this order:

1. `AGENTS.md`
2. Changed files and diff (`git status --short`, `git diff --name-only`, targeted file reads)
3. Relevant source-of-truth docs likely affected:
   - `AI_API_SPEC.md`
   - `CODING_STANDARDS.md`
   - `AI_ARCHITECTURE.md`
   - `AI_UI_UX_CONTEXT.md`
   - `AI_INSIGHTS_PIPELINE.md`
   - `AI_PRODUCT.md`
   - `AI_TASKS.md`
   - `FEATURE_DEVELOPMENT_WORKFLOW.md`
   - `SECURITY_MODEL.md`
   - `SCREEN_IMPLEMENTATION_STATUS.md`

## Trigger conditions

Run this skill when any of these changed:

- API routes, request/response shapes, auth flow, validators
- UX flows, screen states, navigation behavior, design system usage
- AI extraction/output fields, insight aggregation behavior, plan generation behavior
- security/privacy behavior, ownership rules, logging constraints
- roadmap/feature sequencing assumptions
- coding conventions actually used by the repo

If a change is purely internal and does not alter context, record that no doc updates are needed.

## Sync workflow

1. Identify changed runtime behavior or contract from code/design diff.
2. Map each change to the minimum set of docs that must be updated.
3. Update docs with concrete, implementation-aligned wording.
4. Keep consistency across docs; do not let one doc contradict another.
5. Keep scope tight; avoid speculative future architecture unless explicitly requested.
6. Ensure language remains non-clinical and uncertainty-aware for user-facing insight context.
7. Re-read edited docs and run quick consistency grep for stale terms or contradictory route names.

## Mapping guide

- API/contract changes:
  - update `AI_API_SPEC.md`
  - update `AI_ARCHITECTURE.md` if request flow or module boundaries changed
  - update `CODING_STANDARDS.md` if contract conventions changed

- Screen/UX/design-flow changes:
  - update `AI_UI_UX_CONTEXT.md`
  - update `AI_PRODUCT.md` if user journey or product scope changed
  - update `AI_TASKS.md` if implementation order changed
  - update `SCREEN_IMPLEMENTATION_STATUS.md` when screen inventory or completion state changed

- AI behavior changes:
  - update `AI_INSIGHTS_PIPELINE.md`
  - update `AI_ARCHITECTURE.md`
  - update `AI_API_SPEC.md` if payloads changed

- Security/privacy changes:
  - update `SECURITY_MODEL.md`
  - update `AI_API_SPEC.md` for privacy endpoints
  - update `CODING_STANDARDS.md` if coding guardrails changed

- Process/quality changes:
  - update `FEATURE_DEVELOPMENT_WORKFLOW.md`
  - update `CODING_STANDARDS.md`

## Guardrails

- Preserve `AGENTS.md` as highest-priority guidance.
- Do not silently change API assumptions without reflecting current backend reality.
- Do not describe unimplemented features as implemented.
- Separate "implemented now" vs "target/planned" when needed.
- Keep edits concise and practical.
- Do not touch unrelated app code while running this skill.
- For screen work, preserve the default Figma Make source recorded in repo docs unless the user explicitly overrides it.

## Output expectations

After syncing docs, report:

1. Which docs were updated
2. Why each update was required
3. Commands/checks used for validation
4. Any known remaining gaps between implementation and docs
