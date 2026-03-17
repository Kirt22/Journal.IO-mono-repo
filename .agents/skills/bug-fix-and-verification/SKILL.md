---
name: bug-fix-and-verification
description: Diagnose and fix a Journal.IO bug or regression when the task involves broken behavior, failing tests, incorrect API responses, UI issues, or cross-layer integration problems. Use for root-cause-first debugging, smallest-surface fixes, regression protection, and targeted verification across the backend and frontend.
---

# Bug Fix And Verification

Use this skill for debugging and regression work anywhere in the repo.

## Read first

Open only what is relevant:

1. `AGENTS.md`
2. The failing code path and nearby tests
3. `AI_API_SPEC.md` if the bug involves request or response behavior
4. `CODING_STANDARDS.md`
5. `SECURITY_MODEL.md` if user data, auth, or privacy is involved

## Debugging workflow

1. Reproduce or inspect the failure before changing code.
2. Trace the issue to the smallest responsible surface area.
3. Check for contract mismatches between frontend, backend, validation, and schema layers.
4. Fix the root cause, not just the visible symptom.
5. Add focused regression protection when practical.
6. Run the narrowest useful verification commands first, then broader checks only if needed.

## Repo-specific guardrails

- Do not refactor unrelated areas while debugging.
- Respect an already dirty worktree; do not revert user changes.
- Preserve response formats, auth checks, and ownership rules.
- Keep user-facing insight or safety copy non-clinical and uncertainty-aware.
- If AI analysis fails, avoid breaking the primary journaling flow.

## Verification expectations

- Prefer targeted tests or checks for the touched path.
- If no automated coverage exists, capture manual verification notes clearly.
- Report what passed, what failed, and what could not be run.

## Done criteria

- Root cause is identified and addressed.
- The fix is limited to the smallest responsible area.
- Regression risk is reduced with tests or explicit manual verification.
- Remaining uncertainty is called out plainly.
