# AI Architecture

## 1) Overview

Journal.IO uses a modular backend + mobile frontend architecture:

- Backend: Node.js, Express, MongoDB (Mongoose)
- Frontend: React Native + TypeScript
- AI Layer: OpenAI-driven asynchronous analysis jobs

The architecture is intentionally MVP-friendly: simple services, clear contracts, and vertical feature slices.

---

## 2) Backend Module Structure

`backend/src`:

- `config`
- `helpers`
- `middleware`
- `routes`
- `schema`
- `types`
- `services/{feature}`

Expected feature services:

- `auth`
- `onboarding`
- `user`
- `journal`
- `prompts`
- `insights`
- `paywall`
- `plans`
- `safety`
- `reminders`
- `streaks`
- `privacy`
- `admin`

Service file pattern:

- `feature.routes.ts`
- `feature.controllers.ts`
- `feature.validators.ts`
- `feature.service.ts` (when business logic is non-trivial)

---

## 3) Request Lifecycle

Request flow:

1. Route
2. Validator middleware
3. Controller
4. Service orchestration
5. Database interaction
6. Standard response formatting

Controllers remain thin. Services contain domain logic.

---

## 4) Frontend Architecture Context

Current design flow represented in architecture decisions:

1. Auth (email / Google / Apple)
2. Onboarding v2 for authenticated users who have not completed or been migrated
3. OTP verification
4. Post-auth paywall for eligible non-premium users after onboarding is complete
5. Profile setup where still needed
6. Home dashboard
6. Core journaling and insights surfaces

Frontend structure:

- `frontend/src/screens`
- `frontend/src/screens/{flow}`
- `frontend/src/components`
- `frontend/src/utils`
- `frontend/src/services`
- `frontend/src/hooks`
- `frontend/src/store`
- `frontend/src/navigation`

Mobile navigation is now route-based instead of stage-swapped:

- the app owns a root `NavigationContainer` with a React Navigation native stack
- auth, paywall, onboarding, and legal surfaces live at the root stack level
- the authenticated app shell uses a nested native stack for Home, Calendar, Insights, Profile, Settings, Privacy, Subscription, journal detail/edit, search, reminders, and new-entry routes
- the bottom nav is treated as shell chrome over the nested stack, not as a separate tabs navigator
- hosted legal pages open through a root-stack modal route so the app can keep the in-app browser inside the navigator flow

Frontend architectural pattern: MVVM.

- View: screens and reusable UI components
- ViewModel: hooks/store state and UI orchestration
- Model: service-layer data access and feature/domain data structures

API calls must remain in `frontend/src/services`.
Low-level shared helpers like API clients and secure token storage belong in `frontend/src/utils`.
Future global state should live in `frontend/src/store` and be organized by feature slice or flow when introduced.
Auth tokens are stored in secure device storage on the mobile client and attached to authenticated requests through the service layer.
The last server-verified user profile is cached separately in AsyncStorage so a signed-in user can enter the app during a temporary network outage. Tokens remain in Keychain, unauthorized profile responses clear both token and profile caches, and reconnect-driven API calls refresh the cached profile. Legacy development-only `mock-*` token records are discarded during bootstrap and can never establish an authenticated route.
The mobile app owns one backend-readiness state sourced from the root `/ready` endpoint, foreground probes, and request outcomes. Signed-out and pre-main navigation remain behind a full-screen connectivity boundary until the backend is ready. A previously verified authenticated session may keep the mounted shell readable offline; non-idempotent API requests are blocked locally, affected reads refresh after reconnect, and cached-profile sessions revalidate before continuing as verified.
Offline journal support is intentionally memory-only. The app does not persist journal entry bodies or composer drafts for offline launch, does not queue writes, and does not automatically retry a save after reconnect. Screens distinguish unavailable unhydrated data from a genuinely hydrated empty collection.
The iOS Premium biometric app lock is a local frontend-only privacy control. The toggle state is stored per device in AsyncStorage, while a separate `react-native-keychain` marker protected by `BIOMETRY_ANY_OR_DEVICE_PASSCODE` confirms Face ID, Touch ID, or device-passcode access without changing the auth-token Keychain entry.
Launch routing is auth-first: signed-out installs land on Auth, signed-in installs fetch `GET /users/profile`, authenticated users with incomplete onboarding v2 route to onboarding, and users already complete or lazily migrated continue into the existing post-auth/home flow.
When that local biometric lock is enabled, the authenticated app shell starts in a locked state on cold launch and re-locks on inactive/background transitions. A root overlay above authenticated navigation owns the unlock prompt and recovery states; signed-out/auth screens remain accessible because the lock is never enforced outside an authenticated session.
The backend profile builder lazily marks clearly existing users as onboarding v2 complete using non-destructive signals such as legacy onboarding state, journal existence metadata, premium state, reminder records, and the configurable onboarding v2 release cutoff.
For Google mobile sign-in, the device only forwards the Google `idToken`; the backend verifies it with Google and then issues the normal Journal.IO access and refresh tokens.
For Apple mobile sign-in, the device forwards the Apple `identityToken` plus the raw nonce; the backend verifies the Apple signature, issuer, audience, expiry, and nonce before issuing the normal Journal.IO access and refresh tokens.

Home-screen lightweight data note:

- the Home current-streak card does not call the full streak summary endpoint
- the existing `GET /mood/today` response includes a lightweight `currentStreak` field for the Home bootstrap path
- the full streaks screen still reads the dedicated streak endpoints for the richer streak surface
- the Home summer offer card reads `GET /admin/home-offer`; the singleton `admin_configs` document controls whether the card is globally visible, while tapping the card still uses the existing paywall placement flow

Frontend state management split:

- server state: TanStack Query
- app/client global state: Zustand

Development note:

- `frontend/src/utils/devLaunchConfig.json` may enable `enableBiometricLockForTesting` for local `__DEV__` builds so the iOS biometric lock can be exercised without a verified Premium entitlement; production access still requires the normal Premium check

Redux/Redux Toolkit is not part of the default frontend architecture.

---

## 5) AI Processing Architecture

Journal analysis is asynchronous and non-blocking:

1. User submits journal entry.
2. Journal entry is persisted immediately.
3. Analysis job is queued/triggered.
4. OpenAI extracts structured behavioral features.
5. Structured output is validated.
6. Features are persisted.
7. Insights and weekly plans aggregate from stored feature data.

Primary flow must not fail if AI analysis fails.

Onboarding demo exception:

- `POST /onboarding/demo-analysis` is a public demo endpoint for the onboarding questionnaire only
- it returns deterministic, keyword-aware AI-style copy without persisting the submitted text
- it does not call the stored journal AI analysis pipeline or create journal records
- `POST /onboarding/complete` is the authenticated onboarding v2 completion endpoint; it stores sanitized onboarding answers on the user profile without touching journals, RevenueCat subscription state, or reminder records

Onboarding first guided reflection exception:

- `POST /guided-reflection/first-summary` and `POST /guided-reflection/go-deeper` are authenticated onboarding-value endpoints used before the first real entry is saved
- these endpoints are not premium-gated and must not trigger paywall, Mind Map, goals, or reminders
- they use OpenAI only when configured and the user has not opted out of AI; otherwise they return deterministic, non-clinical Journal.IO reflection copy
- they do not persist journal records or inferred labels; the mobile app still saves exactly one real journal entry through the existing journal create route after review
- `POST /guided-reflection/session-analysis` runs after that single entry is saved and always returns `brainSessionMap`, which contains one dominant brain-inspired reflection center, 1-3 secondary centers, and all 8 center scores sorted by signal strength
- if OpenAI is unavailable, disabled, or returns malformed structured output for session analysis, the backend still returns a valid non-clinical `brainSessionMap` fallback without blocking the saved-entry flow
- safety-sensitive text returns support-first copy and avoids normal reflective interpretation

---

## 6) AI Output Contracts

AI outputs should be:

- structured
- deterministic in shape
- parseable
- safe and non-clinical

Typical extracted fields:

- sentiment
- primary emotions
- themes
- stress indicators
- behavior markers
- social context

---

## 7) Safety and Privacy Architecture

Safety and general insights must remain separated in logic and presentation.

Core requirements:

- never diagnose or label users with psychiatric conditions
- route elevated-risk signals through dedicated safety handling
- preserve user dignity in all messaging
- enforce auth and data ownership checks
- avoid logging secrets or sensitive raw journal text

---

## 8) Current vs Target Surface

Current implemented backend modules are centered around:

- `auth`
- `onboarding`
- `user`
- `journal`
- `mood`
- `insights`
- `privacy`
- `reminders`
- `streaks`

Design-aligned target modules include:

- prompts
- plans
- streaks

Architecture should evolve incrementally through vertical slices, not broad refactors.

Current insights overview architecture:

- the mobile Insights screen reads from `GET /insights/overview`
- the mobile `AI Analysis` tab reads from `GET /insights/ai-analysis`
- the iOS-only `Mind Map` is a primary authenticated tab. Premium users with AI enabled read `GET /insights/mind-map`; Free and AI-off users receive an entirely local educational model and do not request derived personal map data
- Goals use the authenticated `/goals` vertical slice and current user-owned `journalingGoals` persistence. Manual create/list/delete is available to all signed-in users; journal-context suggestions remain Premium plus AI opt-in and require journal ownership
- the Home AI insight card also reuses `GET /insights/ai-analysis`, but only surfaces short rotating snippets instead of the full weekly card stack
- the `AI Analysis` tab, Home AI card, and Mind Map route are gated by the user's stored `aiOptIn` onboarding/privacy preference
- backend stores a per-user cached `insights` document for fast read access
- the cache keeps lightweight aggregate counters and maps derived from:
  - journal entries
  - favorite state
  - journal tags
  - home mood check-ins
- the same `insights` document now also stores separate Mind Map caches for:
  - `latest_week`, keyed by closed premium-week window, timezone, scorer version, and response status
  - `all_time`, keyed by timezone, scorer version, and response status
- Mind Map scoring is deterministic, reuses the existing 8-region reflection taxonomy, strips prompt carryover, and down-weights low-signal writing instead of issuing a new OpenAI request
- latest-week Mind Map safety-sensitive windows switch to support-first output without region ranking; all-time Mind Map views exclude safety-sensitive entries and only switch to support-first if no safe writing remains
- journal and mood write paths incrementally maintain the cache
- if the cache is missing, the backend rebuilds it from journals and mood check-ins
- the same `insights` document also stores a weekly AI-analysis cache plus staleness metadata
- if a user opts out of AI analysis, the backend rejects `GET /insights/ai-analysis` and clears the cached weekly AI-analysis payload
- weekly AI-analysis is recomputed on demand from recent journal text, recent tags, and recent mood check-ins only when the cache is stale or the rolling week changes
- recomputation uses a hybrid path:
  - deterministic weekly scoring builds the stable metadata and trait/watchpoint structure
  - an OpenAI Responses API call then generates the user-facing summary, pattern tags, action-plan copy, and Journal.IO support guidance when AI is enabled and the backend has `OPENAI_API_KEY`
  - deterministic copy remains the fallback if OpenAI is unavailable
- before normal quick or weekly analysis, the backend runs a deterministic safety-signal check; self-harm or harm-to-others wording is saved but routed to support-first copy, excluded from normal trait/pattern scoring, and not sent through weekly OpenAI refinement
- AI-analysis output is structured for the mobile screen into:
  - weekly summary metadata
  - pattern tags
  - Big Five-style trait signals
  - supportive dark-triad watchpoints
  - actionable steps
  - app-guidance cards

Current prompts and tag architecture:

- `GET /prompts/writing` uses the backend prompts service to assemble writing-pattern context, then calls OpenAI for fresh prompt generation when AI is enabled
- `POST /journal/suggest_tags` uses the backend journal service to call OpenAI for allowed-tag selection on the draft entry when AI is enabled
- both services keep deterministic fallbacks so journaling and prompt loading still work if OpenAI is disabled, unavailable, or the user has opted out

Current paywall architecture:

- MongoDB stores paywall offerings, templates, placement mappings, raw paywall events, and the singleton interruptive/cooldown configuration
- the mobile client asks `GET /paywall/config` for a placement-specific paywall decision before opening the paywall screen
- Home merchandising can surface a non-interruptive summer offer card when the admin singleton allows it; that card is the only entry to the hosted summer offering and uses `post_auth_exit_offer` tracking
- the backend resolves lifetime-launch eligibility, template fallback, and interruptive eligibility from stored config plus recent user event history
- RevenueCat routing is centralized and explicit: post-auth and contextual premium gates both use `journalio_offering_other_screens_standard`, Home summer uses `journalio_offering_post_onboarding_exit`, and lifetime uses `journalio_offering_lifetime`; the legacy post-onboarding standard offering is not referenced because its attached exit behavior must remain unreachable
- package lookup uses exact App Store product identifiers, and every displayed purchasable price comes from the same package's StoreKit-localized `priceString`; backend prices are not purchase fallbacks
- the post-auth purchase step hands off into its explicit RevenueCat-hosted standard paywall; dismissing it returns directly to the normal post-auth destination without a second purchase prompt, spin wheel, or exit offer
- after a successful checkout or restore, the client requires the exact `Journal.IO Pro` entitlement, derives plan attribution from its active product, and then asks the backend to verify the authenticated App User ID before the profile is updated
- the authenticated app shell also performs a RevenueCat bootstrap/foreground refresh and then calls `POST /paywall/entitlement-sync`; failed refreshes leave the cached membership state unchanged until verification succeeds again
- the backend receives `POST /webhooks/revenuecat`, authenticates the configured bearer token, validates `app_id` plus environment allowlists, records an idempotent event ledger, and then re-fetches the current subscriber state from RevenueCat instead of trusting webhook event-type translations
- backend profile responses and premium feature gates use one effective-entitlement rule: a stored boolean alone is insufficient, time-limited access must be server-verified and unexpired, and only verified lifetime access may omit an expiration
- a production reconciliation worker runs on startup and every six hours to clear known expired rows and re-fetch legacy/unverified premium rows, covering inactive users and historical records that predate webhook verification
- premium-intent and paywall lifecycle events are written through `POST /paywall/events` and used for cooldown gating and future paywall tuning
- the user schema stores verified premium attribution fields such as `premiumPlanKey`, `premiumActivatedAt`, `premiumProductId`, `premiumExpiresAt`, `premiumWillRenew`, `premiumVerifiedAt`, `premiumRevenueCatRequestDate`, `revenueCatAppUserId`, `premiumSource`, and `lifetimePurchaseRecordedAt` so premium gating and lifecycle UX are not inferred only from local client state

Current streaks architecture:

- the mobile Streaks screen reads from `GET /streaks/current` and `GET /streaks/history?days=30`
- journals remain the source of truth; streaks are derived from grouped journal-entry calendar dates rather than stored as a separate mutable streak counter
- backend streak aggregation computes:
  - current streak
  - best streak
  - current-month entry total
  - lifetime entry total
  - 30-day activity presence
  - milestone achievements
- the frontend keeps the existing Make layout and only swaps in the API-backed values

---

## 9) Non-Goals for MVP

Not required for current MVP:

- vector databases
- RAG orchestration
- complex multi-model infrastructure
- premature microservices
