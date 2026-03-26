# Next Codex Implementation Handoff

Use this brief for the next implementation pass. It reflects the latest Figma Make flow and the docs already synced on `2026-03-25`.

## Source of Truth

- Figma Make URL: `https://www.figma.com/make/TwIHpnGcuQiWooDwPDbOER/Design-Journal.IO-Mobile-App?p=f&t=g4PDg1lIppYHD3Sh-0`
- Figma Make file key: `TwIHpnGcuQiWooDwPDbOER`
- Updated context docs:
  - `AI_PRODUCT.md`
  - `AI_UI_UX_CONTEXT.md`
  - `AI_API_SPEC.md`
  - `AI_TASKS.md`
  - `SCREEN_IMPLEMENTATION_STATUS.md`

## Mascot Assets

Mascot assets now exist locally under:

- `frontend/src/assets/png/Masscott.png`
- `frontend/src/assets/svg/Masscott.svg`

Implementation guidance:

- Prefer `frontend/src/assets/png/Masscott.png` first for the React Native implementation pass because the repo does not currently show a clear static SVG import setup.
- Only switch to `frontend/src/assets/svg/Masscott.svg` if you intentionally add or confirm SVG asset import support.
- Keep mascot usage subtle and aligned with the existing calm visual system.

## Design Changes To Implement

### 1. Onboarding

Replace the current 3-step onboarding with the new 8-step flow:

1. Welcome / value intro
2. Age range
3. Journaling experience
4. Journaling goals
5. What the user wants help with
6. Reminder preference
7. AI comfort / explanation
8. Privacy consent

Current replacement point:

- `frontend/src/screens/onboarding/OnboardingScreen.tsx`

### 2. Auth Flow Migration

The app flow is no longer phone-first. Replace the old auth stages with:

- `/auth` -> email-first landing screen
- `/sign-in` -> returning user email sign-in
- `/create-account` -> email, password, confirm password
- `/verify-email` -> verification screen

Current replacement points:

- `frontend/src/screens/auth/EnterPhoneScreen.tsx`
- `frontend/src/screens/auth/VerifyOtpScreen.tsx`
- `frontend/src/navigation/routes.tsx`
- `frontend/src/App.tsx`
- `frontend/src/services/authService.ts`

Expected outcome:

- remove phone-number-centric frontend flow state
- replace `otp` stage with explicit email auth stages
- preserve Google sign-in as a secondary auth path
- hand off onboarding selections into auth/profile setup

### 3. Setup Profile

Update profile setup to reflect email-verification and Google entry states rather than phone verification.

Current replacement point:

- `frontend/src/screens/profile/SetupProfileScreen.tsx`

Expected outcome:

- support post-email-verification entry
- support post-Google entry
- remove or downgrade phone-first assumptions in copy and state handling

### 4. Paywall

Add the new paywall screen from Figma:

- route: `/paywall`
- target file: `frontend/src/screens/PaywallScreen.tsx`

Also review `/subscription` in the Figma Make routes and decide whether:

- it remains separate, or
- it should redirect to / merge into the new paywall

### 5. Mascot Integration

Use the mascot in:

- onboarding hero / brand moments
- auth landing
- create account
- verify email
- paywall
- selected mood and success states where appropriate

Do not:

- add mascot clutter to every screen
- break the existing spacing, palette, or calm tone

## Recommended Implementation Order

1. Re-fetch the relevant Figma screens with MCP before touching code.
2. Update `frontend/src/navigation/routes.tsx` flow-stage model and route rendering plan.
3. Refactor `frontend/src/App.tsx` to remove phone/OTP state and introduce email-auth state.
4. Replace `EnterPhoneScreen.tsx` with the new auth landing experience.
5. Replace `VerifyOtpScreen.tsx` with new dedicated `CreateAccountScreen.tsx` and `VerifyEmailScreen.tsx`.
6. Add `SignInScreen.tsx`.
7. Update `SetupProfileScreen.tsx` for email/google-aware entry.
8. Add `PaywallScreen.tsx`.
9. Update `frontend/src/services/authService.ts` to match the backend reality or temporary mock layer used during the migration.
10. If backend work is included in the same pass, implement the email auth endpoints after the frontend route/state plan is clear.
11. Update `SCREEN_IMPLEMENTATION_STATUS.md` after each shipped screen slice.
12. Run targeted checks.

## Backend Reality vs Design Target

Current backend files still implement phone OTP:

- `backend/src/services/auth/auth.routes.ts`
- `backend/src/services/auth/auth.controllers.ts`
- `backend/src/services/auth/auth.validators.ts`
- `backend/src/services/auth/auth.service.ts`

Current backend endpoints still implemented:

- `POST /auth/send_otp`
- `POST /auth/resend_otp`
- `POST /auth/verify_otp`
- `POST /auth/register_from_googleOAuth`

Design-aligned target endpoints are documented in `AI_API_SPEC.md`:

- `POST /auth/sign_up_with_email`
- `POST /auth/resend_email_verification`
- `POST /auth/verify_email`
- `POST /auth/sign_in_with_email`

Important:

- do not describe email auth as implemented unless the backend actually lands
- if frontend must move first, isolate the temporary/mock behavior cleanly
- do not delete or overwrite user-auth changes already in progress without understanding them first

## Files Most Likely To Change

Frontend:

- `frontend/src/App.tsx`
- `frontend/src/navigation/routes.tsx`
- `frontend/src/services/authService.ts`
- `frontend/src/screens/onboarding/OnboardingScreen.tsx`
- `frontend/src/screens/auth/EnterPhoneScreen.tsx`
- `frontend/src/screens/auth/SignInScreen.tsx`
- `frontend/src/screens/auth/CreateAccountScreen.tsx`
- `frontend/src/screens/auth/VerifyEmailScreen.tsx`
- `frontend/src/screens/profile/SetupProfileScreen.tsx`
- `frontend/src/screens/PaywallScreen.tsx`
- `frontend/src/assets/png/Masscott.png`
- `frontend/src/assets/svg/Masscott.svg`

Backend, if included:

- `backend/src/services/auth/auth.routes.ts`
- `backend/src/services/auth/auth.controllers.ts`
- `backend/src/services/auth/auth.validators.ts`
- `backend/src/services/auth/auth.service.ts`

Docs to re-sync after implementation:

- `AI_API_SPEC.md`
- `AI_UI_UX_CONTEXT.md`
- `SCREEN_IMPLEMENTATION_STATUS.md`

## Current Risks / Notes

- `frontend/src/App.tsx` and `frontend/src/navigation/routes.tsx` are tightly coupled to the old `auth -> otp -> profile` stage model and will likely need a coordinated refactor first.
- `frontend/src/services/authService.ts` is still phone-OTP shaped.
- `frontend/src/assets/` is currently untracked in git; keep the mascot assets in place during implementation.
- `frontend/android/app/build/` and `frontend/android/app/.cxx/` are generated directories and should not be part of the implementation diff.
- There are already in-progress auth backend changes in the worktree; read them before editing.

## Suggested Checks

Frontend:

- targeted TypeScript check
- targeted lint
- relevant screen or app tests if present

Backend, if changed:

- auth validators / tests
- backend test or typecheck commands used by the repo

## One-Line Goal

Implement the latest Figma Make onboarding, email auth, mascot branding, and paywall changes as the smallest coherent vertical slices without losing Journal.IO's current theme, tone, or design system.
