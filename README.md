# Journal.IO

Journal.IO is a behavioral journaling app with AI-powered pattern detection. It helps users journal consistently, track mood and context, review trends, and receive practical weekly action plans.

The product is intentionally non-clinical. AI-generated language should stay supportive, behavior-focused, and uncertainty-aware. Do not present insights as diagnosis, medical advice, or certainty.

## Monorepo Layout

```text
.
+-- backend/              # Express, MongoDB, Mongoose, OpenAI-backed services
+-- frontend/             # React Native iOS/Android app
+-- docs/                 # Product, architecture, API, release, and security docs
+-- Journal.io assets/    # Brand/store assets
+-- render.yaml           # Render blueprint for backend deployment
+-- AGENTS.md             # Repo working rules for coding agents
```

Important docs:

- `docs/AI_PRODUCT.md` - product goals and non-goals
- `docs/AI_ARCHITECTURE.md` - backend and AI architecture
- `docs/AI_API_SPEC.md` - API contracts
- `docs/AI_UI_UX_CONTEXT.md` - mobile UX and design system context
- `docs/SECURITY_MODEL.md` - privacy and security rules
- `docs/PUBLISH_READINESS_CHECKLIST.md` - release tracker
- `docs/backend-deployment.md` - backend production deployment
- `docs/LOCAL_IOS_ENVIRONMENTS.md` - simulator, physical-device local test, and local production commands
- `docs/IOS_REVENUECAT_TRIAL_TESTING.md` - iOS subscription testing notes

## Tech Stack

Backend:

- Node.js
- Express
- TypeScript
- MongoDB and Mongoose
- Zod validation
- OpenAI API for structured analysis

Frontend:

- React Native
- TypeScript
- React Navigation
- Zustand
- RevenueCat
- Notifee local notifications
- Google and Apple sign-in

Infrastructure:

- Render for backend hosting
- MongoDB Atlas or local MongoDB
- App Store Connect for iOS distribution and IAP
- RevenueCat for subscriptions and entitlement state

## Prerequisites

Install:

- Node.js 20 or newer
- npm
- MongoDB locally, or access to a MongoDB Atlas database
- Xcode for iOS work
- CocoaPods for iOS native dependencies
- Android Studio if working on Android

For iOS:

```bash
cd frontend/ios
pod install
cd ../..
```

## Environment Files

Environment files exist in both apps. Do not commit real secrets.

Backend:

- `backend/.env.example` - safe template
- `backend/.env` - local development values
- `backend/.env.prod` - production reference values, keep secrets private

Frontend:

- `frontend/.env` - fallback values when no explicit app environment is selected
- `frontend/.env.simulator` - iOS Simulator with the backend on this Mac
- `frontend/.env.local` - physical iPhone with the backend on this Mac
- `frontend/.env.production` - production mobile bundle values

See `docs/LOCAL_IOS_ENVIRONMENTS.md` for the exact commands and URL rules for all three environments.

iOS build environment:

- `frontend/ios/.xcode.env` sets `BABEL_ENV=production` for Release builds
- Release archives therefore read `frontend/.env.production`

Minimum backend local env:

```env
PORT=3001
NODE_ENV=development
MONGO_STAGE=local
MONGO_URI=mongodb://localhost:27017/journal_io
JWT_ACCESS_SECRET=replace_me
JWT_ACCESS_EXPIRES_IN=14d
JWT_REFRESH_EXPIRES_IN=7d
AUTH_EMAIL_DELIVERY_MODE=console
OPENAI_API_KEY=replace_me
REVENUECAT_WEBHOOK_AUTH_TOKEN=replace_me
REVENUECAT_SECRET_API_KEY=replace_me
REVENUECAT_APP_ID=replace_me
REVENUECAT_ALLOWED_WEBHOOK_ENVIRONMENTS=PRODUCTION,SANDBOX
```

Minimum frontend local env:

```env
API_BASE_URL=http://127.0.0.1:3001/api/v1
GOOGLE_WEB_CLIENT_ID=
GOOGLE_IOS_CLIENT_ID=
REVENUECAT_IOS_API_KEY=
REVENUECAT_ANDROID_API_KEY=
```

For a physical iPhone on the same Wi-Fi network, the phone cannot use the
Mac's `localhost`. The complete setup is documented in
`docs/LOCAL_IOS_ENVIRONMENTS.md`.

Production mobile builds should use:

```env
API_BASE_URL=https://api.journalio.app/api/v1
REVENUECAT_IOS_API_KEY=
REVENUECAT_ANDROID_API_KEY=
```

RevenueCat product, offering, and entitlement identifiers are centralized in
`frontend/src/config/revenueCat.ts`; only platform public SDK keys belong in
environment configuration. Server-side verification and webhooks use:

- `POST https://api.journalio.app/api/v1/webhooks/revenuecat`
- `Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH_TOKEN>`
- RevenueCat secret API access via `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_APP_ID` plus `REVENUECAT_ALLOWED_WEBHOOK_ENVIRONMENTS=PRODUCTION,SANDBOX`

RevenueCat dashboard setup notes:

- configure the webhook above for both production and sandbox events
- use RevenueCat's dashboard authorization header so the backend can authenticate deliveries
- keep Apple Server Notification V2 configured in both the App Store Connect production and sandbox fields so RevenueCat can emit prompt expiration and billing lifecycle events

## Install

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
cd ios
pod install
```

## Run Locally

Start MongoDB first if using local MongoDB.

Backend:

```bash
cd backend
npm run dev
```

The backend exposes:

- `GET /health`
- `GET /ready`
- API routes under `/api/v1`

Frontend Metro and iOS commands are grouped by environment in
`docs/LOCAL_IOS_ENVIRONMENTS.md`.

Android emulator:

```bash
cd frontend
npm run android
```

## iOS Environment Runs

Use `docs/LOCAL_IOS_ENVIRONMENTS.md` for the exact Simulator, Local Test, and
Local Prod commands. The Local Prod flow includes both Release-device testing
and the optional production-API Debug workflow.

For App Store upload, use Xcode:

1. Open `frontend/ios/JournalFrontend.xcworkspace`.
2. Select `Any iOS Device`.
3. Confirm signing team, bundle ID, version, and build number.
4. Product -> Archive.
5. Distribute App -> App Store Connect.

If env values change, create a fresh archive. Already uploaded builds keep the env values bundled at archive time.

If an archive fails in the `react-native-skia` `[CP] Copy XCFrameworks` phase with
an rsync `No such file or directory`, the prebuilt Skia binaries are missing from
`frontend/node_modules/@shopify/react-native-skia/libs/`. They are not part of that
package's npm tarball: they ship in `react-native-skia-apple-ios` / `-macos` / `-tvos`
and are copied into `libs/<platform>/` by the Skia podspec at `pod install` time, and
by `frontend/scripts/install-skia-apple-libs.mjs` on `npm install`. Run
`cd frontend/ios && pod install` and archive again.

## Scripts

Backend:

```bash
cd backend
npm run dev
npm run build
npm start
npm test
npm run check:production:domains
```

Frontend:

```bash
cd frontend
npm start
npm run ios
npm run android
npm run ios:simulator-debug
npm run ios:local-test
npm run ios:local-prod
npm run lint
npm test
```

## Backend Architecture

Backend source lives in `backend/src`.

```text
backend/src
+-- config
+-- helpers
+-- middleware
+-- routes
+-- schema
+-- services
|   +-- auth
|   +-- insights
|   +-- journal
|   +-- mood
|   +-- paywall
|   +-- privacy
|   +-- prompts
|   +-- reminders
|   +-- streaks
|   +-- user
+-- types
```

Request flow:

```text
client -> route -> controller -> service -> database -> response
```

Response format:

```json
{
  "success": true,
  "message": "Human readable success message",
  "data": {}
}
```

Error format:

```json
{
  "success": false,
  "message": "Human readable error message",
  "error": {}
}
```

Protected resources must enforce authentication and ownership checks.

## Frontend Architecture

Frontend source lives in `frontend/src`.

```text
frontend/src
+-- assets
+-- components
+-- config
+-- content
+-- infrastructure
+-- models
+-- navigation
+-- screens
+-- services
+-- store
+-- theme
+-- utils
```

Rules:

- API calls belong in `frontend/src/services`.
- Reusable UI belongs in `frontend/src/components`.
- Navigation belongs in `frontend/src/navigation`.
- Client/app state belongs in Zustand store files.
- Screens should handle loading, empty, error, and success states.

## AI and Safety Rules

Journal.IO stores sensitive user journals. AI behavior must remain safe and non-clinical.

Allowed phrasing:

- "journal entries suggest"
- "a recurring pattern may be"
- "appears associated with"
- "may indicate"

Avoid:

- diagnosis
- certainty
- medical claims
- labeling a user with a mental health condition
- exposing raw safety classifier internals

AI analysis should not block the primary journaling flow. A journal entry must still save if analysis fails.

## RevenueCat Release Checklist

Before submitting an iOS production build, confirm RevenueCat has:

- App Store app configured with bundle ID `app.journalio`
- valid App Store in-app purchase key credentials
- iOS public SDK key copied into `frontend/.env.production`
- entitlement identifier exactly matching `Journal.IO Pro`
- production offerings, not dev offerings
- each paywall attached to its matching explicit offering
- the summer paywall comparison uses custom variables instead of a hardcoded currency
- no automatic exit offer is configured after standard-paywall dismissal

Expected entitlement:

```text
Journal.IO Pro
```

Expected App Store products:

```text
app.journalio.premium.weekly
app.journalio.premium.yearly
app.journalio.premium.yearly.exit
app.journalio.premium.lifetime
```

Active production offering IDs:

```text
journalio_offering_other_screens_standard
journalio_offering_post_onboarding_exit
journalio_offering_lifetime
```

Both post-auth and contextual standard paywalls use
`journalio_offering_other_screens_standard`. The legacy post-onboarding
standard offering is intentionally not used because its attached exit behavior
must not be reachable from the app.

Do not include monthly packages unless the product decision changes.

## App Store Connect Release Checklist

Before final submission:

- Paid Apps Agreement accepted
- banking information added
- tax forms completed
- in-app purchases created and ready for review
- subscription group localized
- app metadata, screenshots, privacy policy, and support URL complete
- build number incremented for each upload
- `ITSAppUsesNonExemptEncryption=false` set if the app only uses standard Apple/platform encryption and HTTPS
- production RevenueCat offerings verified
- `frontend/.env.production` verified before archiving

Recommended App Store URLs:

- Support URL: `https://api.journalio.app/support`
- Privacy Policy: `https://api.journalio.app/privacy`
- Terms: `https://api.journalio.app/terms`

## Deployment

Backend deployment is configured through `render.yaml`.

Render service:

- name: `journal-io-backend`
- root directory: `backend`
- build command: `npm ci && npm run build`
- start command: `npm start`
- health check: `/health`

Required production env vars are documented in `docs/backend-deployment.md`.
The latest production variable-name inventory is maintained in
`docs/BACKEND_PRODUCTION_ENV_VARIABLES.md`.

## Testing and Verification

Run backend checks:

```bash
cd backend
npm test
```

Run frontend checks:

```bash
cd frontend
npm test
npm run lint
```

For release work, also verify on a real iPhone:

- auth
- onboarding
- local reminders
- journaling
- search/history
- insights
- paywall presentation
- purchase and restore flows
- account deletion

## Git Workflow

Default branch model:

- `main` - shared development branch
- `codex` - active feature/fix branch
- `prod` - production-ready branch

Keep changes focused. Do not mix unrelated refactors with release fixes.

Before committing:

```bash
git status --short
```

Avoid committing local Xcode UI state files such as:

```text
frontend/ios/JournalFrontend.xcworkspace/xcuserdata/*/UserInterfaceState.xcuserstate
```

## Security Notes

- Never commit API keys, JWT secrets, SMTP passwords, MongoDB credentials, or App Store private keys.
- Do not log raw journal text in production.
- Do not log full MongoDB URLs unless intentionally debugging locally with `LOG_FULL_MONGO_URI=true`.
- Use host-managed secrets for Render production values.
- Keep App Store Connect banking, tax, and private key files outside the repo.

## Current Release References

- `docs/PUBLISH_READINESS_CHECKLIST.md`
- `docs/backend-deployment.md`
- `docs/IOS_REVENUECAT_TRIAL_TESTING.md`
- `docs/SCREEN_IMPLEMENTATION_STATUS.md`
- `frontend/README.md`
