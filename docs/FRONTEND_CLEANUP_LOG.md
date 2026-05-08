# Frontend Cleanup Log

## 2026-04-25

### Scope

Focused cleanup pass across the React Native frontend to remove low-risk, unnecessary code without changing product behavior, API contracts, purchase routing, or navigation flow.

### Removed

- `frontend/src/utils/apiClient.ts`
  Removed dev-only request lifecycle logging:
  - base URL resolution logs
  - request start logs
  - pre-response failure logs
  - response status logs
  - response payload logs

- `frontend/src/services/journalService.ts`
  Removed dev-only request/response logging for:
  - `createJournalEntry`
  - `updateJournalEntry`
  - `toggleJournalFavorite`

- `frontend/src/components/BottomNav.tsx`
  Removed:
  - dev-only active-tab change logging
  - dev-only layout size logging
  - dev-only navigation press logging
  - unused `useEffect` / `useRef` debug plumbing
  - stale commented-out gradient/SVG block

- `frontend/src/screens/NewEntryScreen.tsx`
  Removed verbose dev-only save and prompt loading logs:
  - save button and blocking traces
  - optimistic save traces
  - local store update traces
  - prompt load failure traces
  - auto-tag failure traces
  - reminder sync skip logging

- `frontend/src/screens/HomeScreen.tsx`
  Removed verbose dev-only quick-thought save logs:
  - save tap / blocked traces
  - payload preparation traces
  - request success traces
  - local state cleanup traces
  - final save completion traces
  - one unnecessary inline `minHeight` style literal moved into `StyleSheet`

- `frontend/src/screens/profile/LifetimeOfferPaywallScreen.tsx`
  Removed the dev-only purchase cancellation info log.

### Intentionally Kept

- Runtime error handling and user-visible alerts
- RevenueCat failure warnings for real purchase/restore issues
- Existing production logic, screen state, and API behavior

### Verification

- `cd frontend && npx eslint src/screens/main/MainAppShell.tsx __tests__/MainAppShell.test.tsx`
- `cd frontend && npx eslint src/utils/apiClient.ts src/services/journalService.ts src/components/BottomNav.tsx src/screens/NewEntryScreen.tsx src/screens/HomeScreen.tsx src/screens/profile/LifetimeOfferPaywallScreen.tsx`
- `cd frontend && npx eslint src/utils/apiClient.ts src/services/journalService.ts src/components/BottomNav.tsx src/screens/NewEntryScreen.tsx src/screens/HomeScreen.tsx src/screens/profile/LifetimeOfferPaywallScreen.tsx __tests__/HomeScreen.test.tsx __tests__/NewEntryScreen.test.tsx`
- `cd frontend && npm test -- --runInBand __tests__/apiClient.test.ts __tests__/NewEntryScreen.test.tsx __tests__/HomeScreen.test.tsx __tests__/LifetimeOfferPaywallScreen.test.tsx`

### Notes

- This pass did not remove behavior-bearing code or change public UX flows.
- Remaining frontend lint warnings were pre-existing style warnings outside the cleanup scope.
