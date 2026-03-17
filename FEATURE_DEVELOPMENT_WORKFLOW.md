# Feature Development Workflow

Journal.IO development follows vertical feature slices.

Each slice must be implemented end-to-end before moving to the next.

---

# 1) Required Slice Order

1. Understand request and design target.
2. Read relevant docs (`AGENTS.md`, `AI_API_SPEC.md`, `CODING_STANDARDS.md`, and feature-specific docs).
3. Inspect current code in both backend and frontend areas affected.
4. Define smallest complete vertical slice.
5. Implement backend contracts and validation.
6. Implement frontend integration and UI states.
7. Add/update tests.
8. Run verification commands.
9. Update docs/specs if contract or behavior changed.

---

# 2) Design-Driven Slice Rule

When work starts from Figma/design:

1. Identify exact screen flow and required states.
2. Map screens to existing services and contracts.
3. If API is missing, implement the minimal backend support first.
4. Implement UI with loading, empty, success, and error states.
5. Verify interaction flow end-to-end.

---

# 3) Backend Checklist (Per Slice)

- routes
- validators
- controllers
- service logic
- schema updates (if needed)
- auth/ownership checks
- standard response format

---

# 4) Frontend Checklist (Per Slice)

- screens
- reusable components
- service-layer API calls
- MVVM boundary adherence:
  - View in screens/components
  - ViewModel in hooks/store
  - Model in services/domain structures
- navigation integration
- loading/empty/error states
- UX alignment to `AI_UI_UX_CONTEXT.md`
- state split kept consistent (TanStack Query for server state, Zustand for app/client state)

---

# 5) Verification Checklist

At minimum run relevant:

- backend tests (if available)
- frontend tests (if available)
- type checks
- lint checks

If test coverage is missing in touched areas, add focused tests where practical.

---

# 6) Completion Rule

A feature slice is complete only when:

- implementation matches the request
- backend and frontend are connected
- validation is present
- contracts are respected
- tests/checks are run and reported
- no unrelated refactor is bundled

---

# 7) Branching Workflow

When a task includes cross-scope changes, split delivery into dedicated branches:

1. `frontend` for `frontend/` implementation changes
2. `backend` for `backend/` implementation changes
3. `global` for root/global docs or config changes (including root `.md`, `.agents/`, `.codex/`)

Do not mix these scopes into the same commit. Commit and push each branch separately.
