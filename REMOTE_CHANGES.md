# Remote changes log

Changes made from a remote Claude Code session (cloud container, fresh clone).
Nothing here lands in your local checkout automatically — pull the branch listed
below to pick it up.

---

## 2026-08-15 — Biometric lock overlay: single loader

**Branches pushed to:** `codex`, and `claude/face-id-loader-consolidation-7eoqrd`
**Fix commit:** `2d1a58f` — `fix(frontend): keep a single loader on the biometric lock overlay`

### What changed

The Face ID lock screen showed two progress indicators at once while
authenticating: a `Checking Face ID...` spinner row, and the spinner inside the
`Try again` button. The inline row was removed so the button is the only loader.

**File:** `frontend/src/components/BiometricLockOverlay.tsx` (1 file, 24 deletions)

- Removed the `isBiometricAuthenticating` JSX block that rendered
  `<JournalLoader />` plus the `Checking {biometricMethodName}...` text.
- Removed the now-unused `JournalLoader` import.
- Removed the now-unused `loadingRow` / `loadingText` entries from `StyleSheet`.
- `PrimaryButton` keeps `loading={isBiometricAuthenticating}` — unchanged, and
  now the sole authenticating indicator.

No backend, schema, API-contract, or store changes. No other component imports
those styles, and `biometricMethodName` is still used by the title/description
copy.

### How to get it locally

```bash
git fetch origin codex
git checkout codex
git pull origin codex
```

If you work on a different local branch, merge instead:

```bash
git fetch origin codex
git merge origin/codex
```

Then restart Metro (or just let Fast Refresh pick it up) — this is a
JSX/style-only change, so no native rebuild is needed.

### Not verified

`npm run lint` and `tsc --noEmit` could not be run in the remote container —
`frontend/node_modules` was not installed there (ESLint found no config, and
`tsc` could not resolve `@react-native/typescript-config`). The change is a pure
deletion of one JSX block plus its only-used import and styles, but it has not
been machine-checked. Worth running locally:

```bash
cd frontend && npm run lint && npx jest BiometricLockOverlay
```
