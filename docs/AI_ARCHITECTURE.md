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
The last server-verified user profile and onboarding payload are cached in separate device-only Keychain services so a signed-in user can enter the app during a temporary network outage without persisting that data in AsyncStorage. Tokens remain in Keychain, unauthorized profile responses clear both token and secure caches, and reconnect-driven API calls refresh the cached profile. Legacy development-only `mock-*` token records are discarded during bootstrap and can never establish an authenticated route.
The mobile app owns one backend-readiness state sourced from the root `/ready` endpoint, foreground probes, and request outcomes. Signed-out and pre-main navigation remain behind a full-screen connectivity boundary until the backend is ready. A previously verified authenticated session may keep the mounted shell readable offline; non-idempotent API requests are blocked locally, affected reads refresh after reconnect, and cached-profile sessions revalidate before continuing as verified.
Offline journal support is intentionally memory-only. The app does not persist journal entry bodies or composer drafts for offline launch, does not queue writes, and does not automatically retry a save after reconnect. Screens distinguish unavailable unhydrated data from a genuinely hydrated empty collection.
The iOS Premium biometric app lock is a local frontend-only privacy control. The toggle state is stored per device in AsyncStorage, while a separate `react-native-keychain` marker protected by `BIOMETRY_ANY_OR_DEVICE_PASSCODE` confirms Face ID, Touch ID, or device-passcode access without changing the auth-token Keychain entry.
The iOS Home Screen widget extension is a pure SwiftUI/WidgetKit target rather than a React Native surface. It publishes three static gallery entries from one extension: Streak in small and medium families, a small Quick Thought launcher, and a medium Mood Check-in widget. Streak deep-links to the Streaks screen, Quick Thought deep-links into the authenticated fast composer, and iOS 17+ mood buttons use App Intents for direct submission while iOS 15/16 deep-link to an in-app confirmation path.
The app stores device-local widget activation preferences in the shared App Group. Preferences start with no enabled widgets, drive whether placed widgets show data or an enable/upgrade state, and cannot remove statically compiled entries from Apple's widget gallery. Streak is free in both sizes; Mood Check-in and Quick Thought are Premium. The backend remains authoritative for mood entitlement even if local preferences are stale.
Widget rendering state is a minimal versioned snapshot in the shared App Group and never contains journal text, composer drafts, a user name, or a mood-record identifier. It may retain the selected mood value only until local midnight so the completed widget can show the user's chosen icon. A separate opaque widget credential is stored in shared Keychain, keyed by session generation to isolate in-flight actions during logout or account switching, hashed server-side, expires after 30 days, and is authorized only for `POST /widgets/mood/check_in`; the app's normal access and refresh tokens remain app-only. Provisioning and using that credential require active server-verified Premium access. A user-level widget-session version prevents an older access token from provisioning a new widget credential after logout or password reset.
Launch routing is auth-first: signed-out installs land on Auth, signed-in installs fetch `GET /users/profile`, authenticated users with incomplete onboarding v2 route to onboarding, and users already complete or lazily migrated continue into the existing post-auth/home flow.
When that local biometric lock is enabled, the authenticated app shell starts in a locked state on cold launch and re-locks on inactive/background transitions. A root overlay above authenticated navigation owns the unlock prompt and recovery states; signed-out/auth screens remain accessible because the lock is never enforced outside an authenticated session.
The backend profile builder lazily marks clearly existing users as onboarding v2 complete using non-destructive signals such as legacy onboarding state, journal existence metadata, premium state, reminder records, and the configurable onboarding v2 release cutoff.
For Google mobile sign-in, the device only forwards the Google `idToken`; the backend verifies it with Google and then issues the normal Journal.IO access and refresh tokens.
For Apple mobile sign-in, the device forwards the Apple `identityToken` plus the raw nonce; the backend verifies the Apple signature, issuer, audience, expiry, and nonce before issuing the normal Journal.IO access and refresh tokens.
Authenticated API calls use a single-flight `401` recovery path: concurrent unauthorized responses share one `/auth/refresh` request, the app atomically replaces the access token in Keychain, retries each failed request once, and clears the local session if refresh fails.

Home-screen lightweight data note:

- the Home current-streak card does not call the full streak summary endpoint
- the existing `GET /mood/today` response includes a lightweight `currentStreak` field for the Home bootstrap path
- the full streaks screen still reads the dedicated streak endpoints for the richer streak surface
- the Home summer offer card reads `GET /admin/home-offer`; the singleton `admin_configs` document controls whether the card is globally visible, while tapping the card still uses the existing paywall placement flow
- Home refreshes today's mood on foreground/focus so a check-in created by the WidgetKit extension is reflected in the mounted React Native screen
- widget timelines roll their local saved state over after local midnight and do not poll the backend or queue offline writes
- the app refreshes the Streak App Group snapshot with summary counts plus a 30-day Boolean activity history for the medium widget grid

Frontend state management split:

- server state: TanStack Query
- app/client global state: Zustand

Biometric lock boundary:

- local Face ID/Touch ID app lock is guarded exclusively by the current authenticated Premium entitlement; development launch configuration cannot bypass it
- service-layer enable attempts from free sessions return `premium_required` before writing the preference or Keychain marker, while the Settings row opens the contextual paywall directly
- app backgrounding immediately mounts a privacy cover; an unlocked app only arms a new biometric challenge after 60 seconds away, while cold launch and an already-locked state authenticate without the grace bypass

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
Selected profile, journal, memory, and cached AI fields may be wrapped in application-level AES-256-GCM envelopes before MongoDB persistence. This is not end-to-end encryption: the authenticated backend still decrypts plaintext temporarily for product logic and authorized OpenAI calls, but database-only exposure does not reveal those protected fields by default.

Onboarding demo exception:

- `POST /onboarding/demo-analysis` is a public demo endpoint for the onboarding questionnaire only
- it returns deterministic, keyword-aware AI-style copy without persisting the submitted text
- it does not call the stored journal AI analysis pipeline or create journal records
- `POST /onboarding/complete` is the authenticated onboarding v2 completion endpoint; it stores sanitized onboarding answers on the user profile without touching journals, RevenueCat subscription state, or reminder records

Onboarding first guided reflection exception:

- `POST /guided-reflection/first-summary` and `POST /guided-reflection/go-deeper` are authenticated onboarding-value endpoints used before the first real entry is saved
- the main-app Guided entry point is Premium-only; the backend AI path also requires active Premium, while deterministic safe fallback copy keeps onboarding and failure handling non-blocking
- first-summary and go-deeper return 45-70 word reflections plus a separate 6-14 word practical question; prompts explicitly prohibit diagnosis or claims of professional authority
- OpenAI-backed interpretation uses shared evidence-led balance guidance: when both sides are supported, roughly 55% of attention goes to friction, setbacks, contradictions, avoidance, risks, or unmet needs and 45% to strengths and progress. The model must never manufacture negativity or force the ratio onto one-sided/low-signal writing; the response tone stays constructive while structured mood remains evidence-based.
- they do not persist journal records or inferred labels; the mobile app still saves exactly one real journal entry through the existing journal create route after review
- `POST /guided-reflection/session-analysis` runs after that single entry is saved and always returns `detectedTopics`, `detectedMood`, and `brainSessionMap`; when `journalId` is supplied, the full validated response is stored atomically as a versioned snapshot on the owned journal
- if OpenAI is unavailable, disabled, or returns malformed structured output for session analysis, the backend still returns a valid non-clinical `brainSessionMap` fallback without blocking the saved-entry flow
- safety-sensitive text returns support-first copy and avoids normal reflective interpretation

Shared saved-entry session analysis:

- `POST /journal/session_analysis` owns the Premium analysis contract for a saved open-ended journal
- journal ownership is validated before content is read
- Quick Notes are excluded; eligible legacy entries generate once on first detail open, while later reads replay the stored result without another model call
- each journal embeds the full session analysis, its guided/open-ended/backfill source, version, and generation timestamp; normal entry edits deliberately preserve this historical snapshot
- `detectedTopics` uses the closed emotional/action/context taxonomy and `detectedMood` uses `amazing|good|okay|bad|terrible`
- detected metadata is stored separately from user-authored tags, included in journal serialization/privacy export, and contributes to search and aggregate insight topic counts
- the Free iOS preview is entirely local and never calls the personal analysis endpoint
- journal history uses opaque cursor pagination ordered by `createdAt` and `_id`; date-bounded pages support complete calendar months while list screens append older entries without loading the full journal into memory

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
- the iOS-only `Mind Map` is a primary authenticated tab. Premium users read `GET /insights/mind-map`; Free users receive an entirely local educational model and do not request derived personal map data
- Goals use the authenticated `/goals` vertical slice and user-owned structured `goals[]` persistence, with `journalingGoals` retained only as a lazy migration source. Manual create/list/edit/archive is available to all signed-in users; the hard-delete endpoint remains archive-only but is not exposed by the mobile Manage UI. `iconSource` distinguishes title-following automatic icons from fixed user choices.
- journal-context and guided-reflection goal candidates are filtered against both active and archived goals. Deterministic canonical intent matching always runs; eligible AI paths add one transient batch embedding comparison at cosine similarity `>= 0.84`. Vectors are not persisted, failures retain deterministic results, and zero suggestions is a valid non-error outcome.
- the Home AI insight card also reuses `GET /insights/ai-analysis`, but only surfaces short rotating snippets instead of the full weekly card stack
- the `AI Analysis` tab, Home AI card, and personal Mind Map route are gated by active Premium entitlement
- backend stores a per-user cached `insights` document for fast read access
- the cache keeps lightweight aggregate counters and maps derived from:
  - journal entries
  - favorite state
  - journal tags
  - home mood check-ins
- the same `insights` document now also stores separate Mind Map caches for:
  - `latest_week`, keyed by closed premium-week window, timezone, scorer version, and response status
  - `all_time`, keyed by timezone, scorer version, and response status
- per-entry Mind Map scores are persisted in the `mindmap_entry_scores` collection (one row per journal entry): a deterministic heuristic row at save time, upgraded by a background OpenAI pass when the user is premium + AI-enabled. The global map aggregates these stored per-entry scores; the `/insights/mind-map` route itself issues no new OpenAI request. Per-entry maps are served by `GET /mind-map/entry/:journalId`. Region `trend` (neutral emphasis) and a supportive `focus` prompt are added to the ready payload.
- per-entry **key insights** are persisted in the `entry_insights` collection (one row per journal): a short context summary + up to 4 therapist-style recurring themes (label + rationale + user's own evidence quote) + an **embedding** of the distilled memory text. Written by the same save-time heuristic + background AI pass as the region scores. Consumers: (1) `buildUserReflectionMemory(userId, { queryEmbedding })` injects long-term memory into every guided-reflection prompt; (2) the Mind Map aggregates these themes into recurrence-ranked `patterns`. Guided-reflection runs on the latest model tier (`OPENAI_GUIDED_REFLECTION_MODEL`) at high reasoning effort (`OPENAI_GUIDED_REFLECTION_REASONING_EFFORT`, default `high`).
- **long-term memory (premium)** has four layers, composed by `buildUserReflectionMemory`:
  1. **Rolling narrative** — one `user_memories` document per user, an AI-maintained whole-history summary of ongoing situations, key relationships, and sensitive topics the user raised. Refreshed fire-and-forget + throttled by `updateUserMemory(userId)` after each new AI insight (premium-gated, never blocks a save). Model `OPENAI_USER_MEMORY_MODEL`.
  2. **Semantic recall** — at session time the current answers are embedded (`requestEmbedding`, `OPENAI_EMBEDDING_MODEL`, default `text-embedding-3-small`) and ranked by in-memory cosine similarity against the user's stored `entry_insights` embeddings (`loadRelevantEntryInsights`), surfacing the *most relevant* past entries rather than just the most recent. No vector DB — Atlas Vector Search is the future scale path.
  3. **Recurring themes** — recurrence-ranked patterns seen ≥2× (`aggregateRecurringPatterns`). Still the fallback, but superseded by layer 4 once a user's graph is established.
  4. **Pattern graph** — a per-user graph of the behaviours their entries keep showing and how those behaviours appear to connect (`patternGraph.service.ts`, collections `pattern_nodes` / `pattern_edges`). Layers 1-3 could only ever say *what* recurs; this is the first layer that can say *how two patterns relate* — "the screen-heavy evenings and the eating past fullness look like the same loop". It is a materialized projection of `entry_insights.themes` (plus themes mined from Ask Jade sessions), so the whole graph is replayable from those sources and is never a second write path.
     - **Nodes** are behaviours, never conditions. `isClinicalPatternLabel` rejects diagnoses, abbreviations, and Big Five / dark-triad trait nouns on every write — the graph must not reintroduce the trait framing that behavioural `patterns` deliberately replaced (see below). Node identity uses two keys: `toThemeId` (exact slug) and `toPatternKey` (token-sorted and lightly stemmed, so "avoids conflict" / "avoiding conflict" / "conflict avoidance" resolve to one node).
     - **Edges** come from three tiers: `co_occurrence` and `temporal` are deterministic and free; `ai_inferred` is one throttled model pass (`OPENAI_PATTERN_GRAPH_MODEL`, `PATTERN_GRAPH_REFINE_EVERY`, default every 5 entries, low reasoning effort) that names the mechanism between pairs the deterministic tiers only counted. The model may only relate and group nodes that already exist — any endpoint it invents is dropped before a write, and any evidence quote it did not copy verbatim from the user's stored words is discarded.
     - **God nodes** are umbrella clusters over member patterns, and are named as behavioural phrases ("bracing for things going wrong", "soothing tension with screens"), never as a state or condition. They are fully derived from the latest refinement, require ≥2 established members and confidence ≥0.6, and are capped at 6 per user.
     - **No graph database and no vector database.** Nodes and edges are ordinary Mongo collections with per-user compound indexes; near-duplicate node merging reuses the same in-memory cosine as layer 2. Atlas Vector Search remains the only sanctioned future scale path.
     - Drift control is deterministic: `computeNodeStrength` decays by recency, single-sighting nodes go dormant at 90 days and are deleted at 180, weak edges are pruned at 60 days, and inferred edges expire at 180 days without reconfirmation. Edges below 0.55 confidence never reach a prompt, and a `precedes` edge needs 3 observations before it is treated as a sequence rather than coincidence.
  Guided reflection is **premium-gated** (`canUseGuidedReflectionAi`); `GUIDED_REFLECTION_ALLOW_NON_PREMIUM=true` bypasses for dev. All memory layers are best-effort: any failure degrades gracefully and never breaks the core flow. The graph block clamps itself to 700 characters *before* the composed memory's 2200-character clamp, so it can never starve the rolling narrative in the six call sites that share that budget.
- **Ask Jade (premium)** is the conversational surface of the same reflection companion, reached by tapping the Home hero orb. Backend `services/ask-jade/`, mounted at `/api/v1/ask-jade`; collections `jade_sessions` and `jade_messages` (row-per-message, so a long chat never rewrites a growing document). Frontend `screens/jade/AskJadeScreen.tsx` + `store/slices/askJadeSlice.ts`.
  - **One voice, one set of limits.** The guided-reflection `SYSTEM_PROMPT` was lifted into `helpers/reflectionVoice.helpers.ts` and is shared by both surfaces, so the crisis handling and no-diagnosis hard limits cannot drift apart. Jade appends only its own deltas: its name, a chat-length format, and an explicit refusal clause — it is a support partner for the user's own patterns, not a general-purpose assistant.
  - **Context per turn:** the pattern graph slice (`buildJadeGraphContext`), long-term memory, an AI-compacted `runningSummary` of older turns, and the last 12 turns verbatim. The user's live message is embedded so recall is about *this* question rather than just recent entries. **No raw journal text is ever sent** — the same invariant every other memory layer holds.
  - `requestStructuredOpenAi` has no `assistant` role, so prior turns are JSON-encoded inside one `user` message, exactly as guided reflection already does. Model `OPENAI_ASK_JADE_MODEL`, `reasoningEffort` `OPENAI_ASK_JADE_REASONING_EFFORT` (default `medium` — chat has to feel responsive).
  - **Failure is a reply, not an error.** A `null` from the model persists a deterministic fallback message and still returns `200`, so the transcript stays coherent and the client offers a retry in place. A safety signal short-circuits to a deterministic support-first reply with no model request at all.
  - **Turn limiting lives in Mongo**, counted from the user's own messages (`JADE_TURNS_PER_DAY` / `JADE_TURNS_PER_HOUR`), because the repo has no request-level rate limiting and adding middleware would be new infrastructure.
  - **Conversations feed the graph.** After a reply, the user's messages (never Jade's — that would let the graph confirm its own conclusions) are mined into pattern nodes at 0.8× confidence, so a passing remark never outranks something written in an entry. Mined themes are persisted on the session so a full graph rebuild stays lossless. There is no cron: mining triggers on a turn threshold plus a lazy idle sweep when the user next opens the feature.
  - **Streaming is client-side only.** No streaming transport exists anywhere in the app; the full reply arrives at once and is revealed word by word, as in the guided-reflection thread. Crisis copy is exempt and appears whole.
- the global Mind Map supports three ranges — `latest_week`, `monthly` (rolling 30 days), and `all_time` — each cached separately on the `insights` document. Guided reflection is available both in onboarding and from the main app's "New" action (a bottom sheet offering Guided vs Open-ended), reusing the same engine.
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
  - weekly summary metadata (headline + narrative only — no separate `highlight` field)
  - pattern tags
  - **behavioural `patterns`** — 1-3 recurring behaviour↔trigger patterns, each with the user's own evidence and one gentle non-judgmental nudge (this replaced the earlier Big Five / dark-triad personality-trait framing)
  - actionable steps (fixed at 2)
  - app-guidance cards
- the weekly enhancement now feeds the model real pattern material — the window's persisted `entry_insights` themes, recurrence-ranked patterns, the rolling long-term memory (`buildUserReflectionMemory`), the mood-by-day trend, and per-entry hour/weekday — so it can name a genuine behavioural pattern and connect it to the user's longer arc instead of counting keywords. Long-term memory now also feeds the per-entry Quick Analysis card (optional `connection` line) and single-entry goal suggestions, not only guided reflection. The weekly cache key carries a payload version (`WEEKLY_AI_ANALYSIS_VERSION`, currently `3`) so a shape change recomputes stale caches.
- the mobile `AI Analysis` tab renders a minimal 4-card layout from the `ready` payload — a narrative card, a topic bar chart (`themeBreakdown`), a patterns card, and a 2-step actionable-steps card. The prior stats-row/highlight-box/expand interaction, the "What shaped your week" signals card, and the "Explore your Mind Map" CTA card were removed from this tab for minimalism; `scoreboard`, `emotionTrend`, and `signals` are still computed and returned (used internally / by the OpenAI prompt) but are no longer rendered here, and Mind Map itself (screen, route, endpoints) is unchanged — only its entry point from this tab was removed.

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
