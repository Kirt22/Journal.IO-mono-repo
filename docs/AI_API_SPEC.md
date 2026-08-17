# Journal.IO API Specification

This document is the API contract source for the current Journal.IO backend and near-term design-aligned endpoints.

Base URL:

- `/api/v1`

All APIs return JSON.

---

# 1) Standard Response Contract

Success:

```json
{
  "success": true,
  "message": "Human readable success message",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Human readable error message",
  "error": {}
}
```

---

# 2) Auth and Authorization

- Access token sent as `Authorization: Bearer {accessToken}`
- Refresh tokens used for access-token renewal
- Protected endpoints must enforce user ownership

## 2.1 AI interpretation balance

- OpenAI-backed reflection, analysis, extraction, memory, writing-prompt, Mind Map, and goal-generation features use an evidence-led, challenge-forward balance.
- When both difficult and positive material are present, prompts target roughly 55% interpretive attention on supported friction, setbacks, contradictions, avoidance, risks, or unmet needs and 45% on supported strengths, progress, resources, or protective factors.
- The ratio is not a sentiment quota: models must not invent or exaggerate negative material, and low-signal or clearly one-sided writing must not be distorted to satisfy it.
- User-facing language remains warm, constructive, non-clinical, uncertainty-aware, and agency-focused without using reassurance to erase unresolved difficulty.
- Structured mood fields continue to reflect the writing itself; they are never forced to a positive value to make the response sound supportive.

---

# 3) Implemented Endpoints (Current Backend)

## 3.1 Auth Module (`/auth`)

Current backend reality:

- the implemented backend supports email-first auth, Google OAuth, and Sign in with Apple
- the current frontend auth flow uses the email-first endpoints below
- the mobile Google sign-in flow now posts the Google ID token to `POST /auth/google/mobile`
- the mobile Apple sign-in flow posts the Apple identity token and raw nonce to `POST /auth/apple/mobile`
- the current frontend password-reset flow uses `POST /auth/request_password_reset` and `POST /auth/reset_password`
- successful auth responses return `user` using the same safe profile payload fields as `GET /users/profile`, including onboarding v2 metadata and journal existence metadata

### `POST /auth/google/mobile`

Mobile Google sign-in.

Request:

```json
{
  "idToken": "google_id_token",
  "onboardingContext": {
    "goals": ["Daily Reflection"],
    "reminderPreference": "Evening",
    "privacyConsentAccepted": true
  },
  "onboardingCompleted": true
}
```

Notes:

- backend verifies the Google ID token against `GOOGLE_WEB_CLIENT_ID`
- backend derives the Google identity from the verified token payload, not from frontend profile fields
- backend stores the Google `sub` in the existing user Google identity field and then issues the normal app access/refresh tokens
- when onboarding context is present, the backend persists it on the user before returning the session
- while field encryption is migrating, lookup-hash matches take precedence over plaintext fallback rows so the migrated identity remains authoritative
- if saving an auth identity would collide with another migrated row, the endpoint returns the standard error envelope with HTTP `409` and code `ACCOUNT_LOOKUP_CONFLICT` rather than guessing which account to use

Success `data`:

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "user": {
    "userId": "string",
    "name": "Alex",
    "phoneNumber": null,
    "email": "alex@gmail.com",
    "isPremium": false,
    "journalingGoals": [],
    "avatarColor": null,
    "profileSetupCompleted": false,
    "onboardingCompleted": true,
    "profilePic": "https://..."
  }
}
```

### `POST /auth/apple/mobile`

Mobile Sign in with Apple.

Request:

```json
{
  "identityToken": "apple_identity_token",
  "nonce": "raw_nonce_sent_to_apple",
  "email": "alex@privaterelay.appleid.com",
  "fullName": {
    "givenName": "Alex",
    "familyName": "Appleseed"
  },
  "onboardingContext": {
    "goals": ["Daily Reflection"],
    "reminderPreference": "Evening",
    "privacyConsentAccepted": true
  },
  "onboardingCompleted": true
}
```

Notes:

- backend verifies the Apple identity token against Apple public keys and `APPLE_CLIENT_ID`
- backend verifies the token issuer, audience, expiry, signature, and hashed nonce
- backend stores the Apple `sub` in the user Apple identity field and then issues the normal app access/refresh tokens
- frontend-provided Apple email/name are used only after token verification and only as fallback profile data

Success `data` uses the same session payload shape as `POST /auth/google/mobile`.

### `POST /auth/register_from_googleOAuth`

Legacy compatibility route for Google OAuth-based login/signup. The backend now verifies `googleIdToken` server-side and ignores untrusted frontend profile fields.

Request:

```json
{
  "googleIdToken": "token",
  "googleUserId": "optional_google_sub",
  "email": "alex@gmail.com",
  "name": "Alex",
  "profilePic": "https://...",
  "onboardingCompleted": true
}
```

Success `data`:

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "user": {
    "userId": "string",
    "name": "Alex",
    "phoneNumber": null,
    "email": "alex@gmail.com",
    "isPremium": false,
    "journalingGoals": [],
    "avatarColor": null,
    "profileSetupCompleted": false,
    "onboardingCompleted": true,
    "profilePic": "https://..."
  }
}
```

### `POST /auth/refresh`

Refresh access token.

Request:

```json
{
  "refreshToken": "jwt"
}
```

### `POST /auth/logout`

Invalidate active refresh token for current authenticated user.

Requires `Authorization` header.

Available to every authenticated user; export is not a Premium-gated action.

Returns:

```json
{
  "success": true,
  "message": "Logout successful",
  "data": {}
}
```

---

## 3.1.1 Onboarding Module (`/onboarding`)

### `POST /onboarding/complete`

Mark onboarding v2 complete for the authenticated user.

Requires `Authorization` header.

Request:

```json
{
  "version": 2,
  "ageRange": "25-34",
  "journalingExperience": "occasional journaler",
  "goals": ["Daily Reflection"],
  "supportFocusAreas": ["Stress", "Sleep"],
  "reminderPreference": "Evening",
  "privacyConsent": true,
  "commitmentSignedAt": "2026-08-09T10:15:00.000Z"
}
```

Behavior notes:

- updates only the authenticated user onboarding fields
- sets `onboardingCompleted: true`, `onboardingVersion: 2`, and `onboardingCompletedAt`
- stores a sanitized `onboardingPayload` and preserves legacy `onboardingContext` compatibility
- does not create, delete, or update journals, subscriptions, RevenueCat fields, or reminder records
- reminder preference may be stored in `onboardingPayload`; reminder record sync remains handled by the existing reminders flow
- `commitmentSignedAt` is optional, must be an ISO 8601 datetime, and is stored on `onboardingPayload` as a `Date`; anything unparseable is dropped rather than persisted

Success `data` uses the same safe profile payload shape as `GET /users/profile`.

### `POST /onboarding/demo-analysis`

Generate the onboarding first-entry demo reflection. This endpoint is intentionally public, does not persist the submitted text, and does not run the stored journal AI pipeline.

Request:

```json
{
  "mood": "okay",
  "feeling": "scattered",
  "challenge": "too many tabs open",
  "thoughts": "I felt pulled in too many directions today, but writing it down already feels lighter."
}
```

Validation:

- `mood` is required and must be one of `great`, `good`, `okay`, `low`, or `stressed`
- `thoughts` is required and must be 1-500 characters after trimming
- `feeling` is optional and limited to 24 characters
- `challenge` is optional and limited to 80 characters

Success `data`:

```json
{
  "moodTone": "neutral and reflective",
  "summary": "You named \"scattered\" as the feeling underneath the entry. \"too many tabs open\" appears associated with the part of the day that felt heavier. I noticed \"Okay\", \"scattered\", and \"too many tabs open\" and used those words as anchors for this read. Your words suggest a moment of self-awareness...",
  "keywords": [
    {
      "label": "Okay",
      "description": "Your okay mood check-in gives this demo reflection its emotional starting point."
    }
  ],
  "prompt": "What is one small, gentle thing that could make \"scattered\" feel a little lighter tomorrow?"
}
```

Notes:

- this endpoint is used only for the onboarding demo screen
- response copy must stay supportive, non-clinical, and uncertainty-aware
- raw demo journal text must not be logged or persisted

---

## 3.2 User Profile Module (`/users`)

### `GET /users/profile`

Get the authenticated user's profile.

Success `data`:

```json
{
  "userId": "string",
  "name": "Alex",
  "phoneNumber": "+15551234567",
  "email": null,
  "createdAt": "2026-06-01T09:30:00.000Z",
  "isPremium": false,
  "premiumPlanKey": null,
  "premiumActivatedAt": null,
  "premiumProductId": null,
  "premiumExpiresAt": null,
  "premiumWillRenew": null,
  "premiumVerifiedAt": null,
  "premiumRevenueCatRequestDate": null,
  "revenueCatAppUserId": null,
  "premiumSource": null,
  "avatarColor": "#8E4636",
  "journalingGoals": ["Daily Reflection"],
  "profileSetupCompleted": true,
  "onboardingCompleted": true,
  "onboardingVersion": 2,
  "onboardingCompletedAt": "2026-06-01T09:35:00.000Z",
  "hasJournalEntries": true,
  "journalCount": 12,
  "profilePic": null,
  "onboardingPreferences": {
    "ageRange": "25-34",
    "journalingExperience": "New to journaling",
    "whatBringsYouHere": ["Build a reflection habit"],
    "supportFocusAreas": ["Stress"],
    "reflectionTone": ["Gentle"],
    "reminderPreference": "evening"
  }
}
```

Behavior notes:

- computes journal existence/count from metadata only and never returns journal text
- returns the authenticated user's safe onboarding-selection summary for profile personalisation; it excludes journal content and safety data
- lazily marks clearly existing users as onboarding v2 complete so app updates do not force legacy users through new onboarding
- existing-user signals include legacy onboarding completion/context, journal entries, premium state, reminder records, and users created before the onboarding v2 release cutoff
- `isPremium` is an effective entitlement result, not a direct echo of the stored boolean: time-limited access requires `premiumSource = revenuecat_verified` and a future `premiumExpiresAt`; verified lifetime access does not expire
- legacy `revenuecat_client_sync` rows are returned as non-premium until the backend has reconciled them with RevenueCat

### `PATCH /users/profile`

Update the authenticated user's profile setup fields.

Request:

```json
{
  "name": "Alex",
  "avatarColor": "#8E4636",
  "goals": ["Daily Reflection", "Personal Growth"]
}
```

Success `data`:

```json
{
  "userId": "string",
  "name": "Alex",
  "phoneNumber": "+15551234567",
  "email": null,
  "isPremium": false,
  "premiumPlanKey": null,
  "avatarColor": "#8E4636",
  "journalingGoals": ["Daily Reflection", "Personal Growth"],
  "profileSetupCompleted": true,
  "onboardingCompleted": true,
  "profilePic": null
}
```

Both routes require authentication.

### `PATCH /users/premium-status`

Compatibility entitlement refresh route. The backend ignores the client `isPremium`
flag as an authority signal and re-verifies the authenticated user's RevenueCat App
User ID on the server before returning the profile.

Request:

```json
{
  "isPremium": true
}
```

Notes:

- the request body is legacy/optional compatibility input for older mobile builds
- the server verifies the current RevenueCat subscriber state using the authenticated
  MongoDB `_id` as the App User ID
- transient RevenueCat verification failures return `503` so clients can keep cached
  premium access instead of self-downgrading on uncertainty

Success `data`:

```json
{
  "userId": "string",
  "name": "Alex",
  "phoneNumber": "+15551234567",
  "email": null,
  "isPremium": true,
  "premiumPlanKey": "yearly",
  "premiumActivatedAt": "2026-06-01T09:30:00.000Z",
  "premiumProductId": "app.journalio.premium.yearly",
  "premiumExpiresAt": "2026-06-28T09:30:00.000Z",
  "premiumWillRenew": false,
  "premiumVerifiedAt": "2026-06-21T09:30:00.000Z",
  "premiumRevenueCatRequestDate": "2026-06-21T09:30:00.000Z",
  "revenueCatAppUserId": "6654fd0b84ab9d62d19cb123",
  "premiumSource": "revenuecat_verified",
  "avatarColor": "#8E4636",
  "journalingGoals": ["Daily Reflection", "Personal Growth"],
  "profileSetupCompleted": true,
  "onboardingCompleted": true,
  "profilePic": null
}
```

This route requires authentication.

---

## 3.2.1 Admin Module (`/admin`)

The admin module exposes app-wide read-only configuration needed by authenticated clients. The source of truth is the singleton MongoDB `admin_configs` document with `key: "global"`.

### `GET /admin/home-offer`

Return the global Home offer visibility flag for the authenticated user.

Success `data`:

```json
{
  "homeSummerOfferVisible": true
}
```

Behavior notes:

- the backend creates the singleton admin document with `homeSummerOfferVisible: true` if it does not exist
- setting `homeSummerOfferVisible` to `false` in MongoDB hides the Home summer offer card for all users
- the mobile app uses this flag only as a global visibility control; premium eligibility and paywall routing remain client/paywall-flow concerns

This route requires authentication.

---

## 3.2.2 Paywall Module (`/paywall`)

MongoDB now owns the app paywall configuration for offering metadata, paywall templates, placement mapping, and interruptive cooldown rules. RevenueCat still executes purchases and restores, but the mobile app asks the backend which paywall template to show and then syncs the successful purchase back to the backend.

### `GET /paywall/config`

Return the resolved paywall decision for the authenticated user and requested placement.

Query:

- `placementKey` (required)
- `screenKey` (optional)
- `currentStage` (optional)
- `triggerMode` (optional, `contextual` or `interruptive`)

Success `data`:

```json
{
  "shouldShow": true,
  "placementKey": "post_auth",
  "screenKey": "auth",
  "triggerMode": "contextual",
  "wasInterruptive": false,
  "reason": "ready",
  "template": {
    "key": "weekly-standard",
    "title": "Weekly Or Yearly Premium",
    "headline": "Start flexibly now, or choose the longer premium path up front.",
    "subheadline": "A two-card template with weekly access and the longer-term yearly option.",
    "heroBadgeLabel": null,
    "purchaseChipTitle": null,
    "purchaseChipBody": null,
    "featureCarouselTitle": null,
    "socialProofLine": null,
    "footerLegal": null,
    "featureList": [
      {
        "title": "Choose your pace",
        "body": "Start with weekly premium if you want a lighter commitment, or go yearly if you already know you will stay.",
        "footer": "Two options, one calmer premium flow."
      },
      {
        "title": "Weekly analysis stays unlocked",
        "body": "Both options open AI tagging, saved-entry quick analysis, and the weekly behavior read across the app.",
        "footer": "The feature set stays the same across the two plans."
      }
    ],
    "primaryOfferingKey": "weekly",
    "secondaryOfferingKeys": ["yearly"],
    "visibleOfferingKeys": ["weekly", "yearly"]
  },
  "offerings": [
    {
      "key": "weekly",
      "title": "WEEKLY",
      "price": null,
      "priceSuffix": "/week",
      "subtitle": "Flexible access",
      "badge": null,
      "highlight": null,
      "sortOrder": 1,
      "revenueCatOfferingId": "journalio_offering_other_screens_standard",
      "revenueCatPackageId": null,
      "purchasedUsersCount": 0,
      "purchaseLimit": null
    },
    {
      "key": "yearly",
      "title": "YEARLY",
      "price": null,
      "priceSuffix": "/year",
      "subtitle": "Best for steady journaling",
      "badge": "Most Value",
      "highlight": null,
      "sortOrder": 3,
      "revenueCatOfferingId": "journalio_offering_other_screens_standard",
      "revenueCatPackageId": null,
      "purchasedUsersCount": 0,
      "purchaseLimit": null
    }
  ]
}
```

Behavior notes:

- returns `shouldShow: false` for premium users
- `post_auth` resolves to the standard weekly/yearly template; dismissing it continues to the saved destination and never opens a second offer
- may return `shouldShow: false` for interruptive placements when thresholds, cooldowns, caps, or randomization do not pass
- when the lifetime offering reaches its purchase limit, the backend falls back from `lifetime-launch` to its configured fallback template automatically
- `featureList` is an ordered array of feature-card objects with `title`, `body`, and optional `footer`
- `visibleOfferingKeys` controls which offering cards the frontend renders for the active template; a template may show one card or multiple cards
- backend offering prices and package identifiers are nullable merchandising metadata; purchasable prices and package identifiers must come from the exact RevenueCat package selected by the client
- `subheadline` remains in the contract for merchandising control, but the mobile UI may choose not to render it
- `heroBadgeLabel`, `purchaseChipTitle`, `purchaseChipBody`, `featureCarouselTitle`, `socialProofLine`, and `footerLegal` are optional merchandising fields currently used by the dedicated lifetime-offer screen so its hero/footer copy stays Mongo-backed instead of hardcoded in the app

### `POST /paywall/events`

Track authenticated paywall lifecycle and premium-intent events.

Request:

```json
{
  "placementKey": "home_ai_card_locked",
  "screenKey": "home",
  "eventType": "locked_feature_tap",
  "wasInterruptive": false
}
```

Supported `eventType` values:

- `locked_feature_tap`
- `upgrade_tap`
- `paywall_impression`
- `paywall_dismiss`
- `plan_select`
- `cta_tap`
- `purchase_success`
- `restore_success`
- `purchase_failure`

Success `data`:

```json
{
  "eventId": "string",
  "createdAt": "2026-04-08T12:00:00.000Z"
}
```

### `POST /paywall/purchase-sync`

Compatibility purchase/restore sync route. The backend accepts the existing purchase
payload shape, but it does not trust the client payload for premium access. Instead,
it re-fetches the authenticated RevenueCat subscriber state and returns the verified
profile.

Request:

```json
{
  "offeringKey": "lifetime",
  "revenueCatOfferingId": "journalio_offering_lifetime",
  "revenueCatPackageId": "$rc_lifetime",
  "store": "APP_STORE",
  "entitlementId": "Journal.IO Pro",
  "wasRestore": false
}
```

Success `data`:

```json
{
  "userId": "string",
  "name": "Alex",
  "phoneNumber": "+15551234567",
  "email": null,
  "isPremium": true,
  "premiumPlanKey": "lifetime",
  "premiumActivatedAt": "2026-06-01T09:30:00.000Z",
  "premiumProductId": "app.journalio.premium.lifetime",
  "premiumExpiresAt": null,
  "premiumWillRenew": false,
  "premiumVerifiedAt": "2026-06-21T09:30:00.000Z",
  "premiumRevenueCatRequestDate": "2026-06-21T09:30:00.000Z",
  "revenueCatAppUserId": "6654fd0b84ab9d62d19cb123",
  "premiumSource": "revenuecat_verified",
  "avatarColor": "#8E4636",
  "journalingGoals": ["Daily Reflection", "Personal Growth"],
  "profileSetupCompleted": true,
  "onboardingCompleted": true,
  "profilePic": null
}
```

Behavior notes:

- the client derives `offeringKey` and RevenueCat identifiers from the active `Journal.IO Pro` entitlement product after purchase or restore, not from the currently selected pricing card
- the server verifies the current RevenueCat subscriber state and ignores client-side attempts to self-grant premium access
- the server retries briefly when RevenueCat's SDK has completed a purchase but the server subscriber record has not propagated yet
- if the entitlement is still absent after those retries, the route returns `503` with `error.code = "revenuecat_purchase_pending"` instead of returning a successful free profile
- if RevenueCat confirms the purchase but backend verification is temporarily unavailable, the client should stay on the shared success state with access-updating copy instead of downgrading the user

### `POST /paywall/entitlement-sync`

Primary authenticated entitlement refresh route for current mobile clients.

Request:

```json
{
  "reason": "foreground"
}
```

Success `data` uses the same verified profile payload shape shown above.

Behavior notes:

- intended for launch, foreground, and listener-driven reconciliation
- returns the backend-verified RevenueCat premium state for the authenticated user
- should replace client-authored premium toggles in new mobile builds
- `PATCH /users/premium-status` remains available only as a compatibility alias

### `POST /webhooks/revenuecat`

RevenueCat server-to-server webhook endpoint.

Request requirements:

- `Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH_TOKEN>`
- RevenueCat `event.app_id` must match `REVENUECAT_APP_ID`
- RevenueCat `event.environment` must be in `REVENUECAT_ALLOWED_WEBHOOK_ENVIRONMENTS`

Behavior notes:

- returns `200` for processed events and already-processed duplicates
- returns `400` for malformed payloads or disallowed app/environment deliveries
- returns `401` for invalid authorization headers
- returns `503` when RevenueCat subscriber verification fails in a retryable way
- stores a minimal idempotency ledger keyed by RevenueCat `event.id` or a derived legacy hash; full payloads are not persisted
- webhook processing re-fetches the current subscriber state from RevenueCat instead of translating event types directly
- transfer events reconcile both the `transferred_from` and `transferred_to` App User ID lists when they map cleanly to Journal.IO MongoDB `_id` values
- as a missed-webhook fallback, the production backend clears locally known expirations and re-verifies a bounded batch of legacy/unverified premium rows on startup and every six hours, without requiring the user to reopen the app

---

## 3.3 Mood Tracker Module (`/mood`)

The mood tracker is separate from journal entries. It stores only the authenticated user, the mood value, and the day-specific check-in record.

Both mood routes accept the optional `X-Client-Timezone` header. A valid IANA timezone makes "today" use the user's local calendar date; missing or invalid values fall back to UTC. Unversioned legacy UTC-keyed records created inside the current local-day window are still recognized, so this change does not require a bulk migration. When a legacy record is matched, API responses expose the effective requested local-day key rather than its historical stored UTC key. Newly written versioned date keys are matched exactly and are not reinterpreted after travel or a timezone change.

### `GET /mood/today`

Get the authenticated user's mood check-in for today.

Response `data`:

```json
{
  "currentStreak": 4,
  "moodCheckIn": {
    "_id": "string",
    "mood": "good",
    "moodDateKey": "2026-03-30",
    "createdAt": "2026-03-30T12:00:00.000Z",
    "updatedAt": "2026-03-30T12:00:00.000Z"
  }
}
```

If no check-in exists yet for today, `moodCheckIn` is `null`.
`currentStreak` is always returned so the Home screen can render its streak card without calling the full streak summary endpoints.

### `POST /mood/check_in`

Create today's mood check-in if one does not already exist.

Request:

```json
{
  "mood": "good"
}
```

Success `data`:

```json
{
  "moodCheckIn": {
    "_id": "string",
    "mood": "good",
    "moodDateKey": "2026-03-30",
    "createdAt": "2026-03-30T12:00:00.000Z",
    "updatedAt": "2026-03-30T12:00:00.000Z"
  }
}
```

If a check-in already exists for the current day, the backend returns the existing record rather than creating a duplicate.

Both routes require authentication.

## 3.3.1 Home Screen Widgets Module (`/widgets`)

The Premium iOS Home Screen mood widget uses a separate, least-privilege credential. A widget token can call only the widget mood route; it cannot read journals, profile data, insights, or other authenticated APIs. Quick Thought and Streak do not use these endpoints: Quick Thought opens the authenticated in-app composer, while Streak renders from an App Group snapshot written by the app.

### `POST /widgets/session`

Create or rotate the current installation's widget credential. Requires normal JWT authentication and an active server-verified Premium entitlement.

Request:

```json
{
  "platform": "ios",
  "installationId": "device-generated-uuid"
}
```

Success `data`:

```json
{
  "widgetToken": "one-time-opaque-token",
  "expiresAt": "2026-08-21T12:00:00.000Z"
}
```

Returns `201` when the session is created or rotated. A signed-in user without active Premium access receives `403` in the standard error envelope. The raw token is returned only in this response; the backend stores only its hash. Sessions expire after 30 days and the mobile app rotates them before expiry. Both widget-session routes compare the access token's widget-session version with the current user record, so an access token issued before logout or password reset cannot reconnect a revoked widget.

### `DELETE /widgets/session`

Revoke the current installation's widget credential. Requires normal JWT authentication.

Request:

```json
{
  "platform": "ios",
  "installationId": "device-generated-uuid"
}
```

Success `data` is an empty object. Logout, successful password reset, and account deletion also revoke affected widget sessions.

### `POST /widgets/mood/check_in`

Create today's mood check-in from the iOS widget without launching the app.

Request headers:

```text
Authorization: Widget <opaque-widget-token>
X-Client-Timezone: Asia/Kolkata
```

Request:

```json
{
  "mood": "good"
}
```

Success uses a privacy-minimized response. It returns the effective mood so the extension can retain the selected icon until local midnight, but never returns a mood-record identifier:

```json
{
  "success": true,
  "message": "Your check-in has been saved.",
  "data": {
    "saved": true,
    "mood": "good",
    "moodDateKey": "2026-03-30",
    "alreadyCheckedIn": false
  }
}
```

If today's check-in already exists, the route returns the existing effective mood with `alreadyCheckedIn: true` and does not replace or duplicate the record. Missing, malformed, expired, revoked, or session-version-invalid widget credentials return `401` in the standard error envelope. A valid widget session whose owner no longer has active Premium access is revoked and returns `403`.

## 3.4 Goals Module (`/goals`)

All Goals routes require authentication. Goals are user-owned records stored on the user (`goals[]`) separately from `journalingGoals` (onboarding preferences) and journal metadata; no endpoint automatically creates a goal.

**Goals are recurring.** Completion is not a status — it is derived per period from `frequency` plus `lastCompletedLocalDate`, so a `daily` goal reappears the next local day and a `weekly` goal resets at the start of each Sunday-start week. `as_needed` completes permanently.

Each goal has:

| Field | Notes |
| --- | --- |
| `id` | Stable generated id, independent of the title so it survives edits |
| `title` | Trimmed, ≤120 chars |
| `description` | Trimmed, ≤200 chars, or `null` |
| `icon` | Curated key (e.g. `journal`, `gym`, `peach`) from the shared goal-icon library, never an emoji |
| `iconSource` | `automatic \| fixed`; automatic icons follow title edits, while fixed icons preserve the user's explicit picker choice |
| `frequency` | `daily \| weekly \| as_needed` |
| `status` | `active \| archived` |
| `reminderEnabled` | Whether a local reminder is armed |
| `reminderTime` | `HH:mm` (24h) or `null` |
| `lastCompletedLocalDate` | The **client's** local `YYYY-MM-DD` of the last completion, or `null` |
| `isCompletedForPeriod` | Server-derived against the request's `today` |
| `createdAt` / `updatedAt` | ISO timestamps |

**Why a local date and not a timestamp:** the server has no reliable user timezone (the only one stored is scoped to the single `daily_journal` reminder and may be stale), so the client sends its own local date key and the server never does timezone math. Both the raw fields *and* the derived boolean are returned, because the client's reminder scheduler must evaluate "would this be done on date D" for future dates, which a single boolean cannot express.

Legacy accounts self-heal on the next write: `journalingGoals` titles seed as `active` goals with an automatic keyword-matched icon, a missing source is inferred as `automatic` for missing/placeholder icons and `fixed` for prior explicit icons, `status: "completed"` becomes an `as_needed` goal already completed, and `status: "dismissed"` becomes `archived`.

### `GET /goals`

Query: `?today=YYYY-MM-DD` (optional; the server falls back to its own UTC date). Returns the authenticated user's goals, newest first, across all statuses.

```json
{
  "success": true,
  "message": "Your goals are ready.",
  "data": {
    "goals": [
      {
        "id": "b1c2…",
        "title": "Write one honest line",
        "description": null,
        "icon": "journal",
        "iconSource": "automatic",
        "frequency": "daily",
        "status": "active",
        "reminderEnabled": true,
        "reminderTime": "21:00",
        "lastCompletedLocalDate": null,
        "isCompletedForPeriod": false,
        "createdAt": "2026-08-04T18:00:00.000Z",
        "updatedAt": "2026-08-04T18:00:00.000Z"
      }
    ]
  }
}
```

### `POST /goals`

Request: `{ "title", "description"?, "icon"?, "iconSource"?, "frequency"?, "reminderEnabled"?, "reminderTime"?, "today"? }`. Title required, trimmed, ≤120 chars. Omitting `icon` creates an `automatic` icon resolved from the title without an AI call. `iconSource: "fixed"` requires `icon`; legacy clients that send `icon` without a source are treated as fixed. Returns `201` with the saved record.

A duplicate case-insensitive title among `active` goals **merges** the incoming payload into the existing goal rather than ignoring it — silently discarding the payload would lose a caller's reminder or frequency.

### `PATCH /goals/{goalId}`

Partial update; every field optional but at least one required. Untouched fields are preserved. Renaming an automatic goal recalculates its icon while renaming a fixed goal preserves the chosen icon. Returns the updated record, or `404` when the account does not own the goal.

### `PATCH /goals/{goalId}/completion`

Marks a goal done or not-done for the current period. Request: `{ "completed": boolean, "localDate"?: "YYYY-MM-DD", "today"? }` — `localDate` is required when `completed` is `true`. One endpoint both ways because both directions write the same single field. Returns the updated record, or `404`.

### `PATCH /goals/{goalId}/status`

Archive / unarchive. Request: `{ "status": "active" | "archived" }`. `reminderEnabled` is deliberately preserved, so unarchiving restores the reminder. Returns the updated record, or `404`.

### `DELETE /goals/{goalId}`

Removes a goal by its stable id. **Only permitted on an archived goal** — returns `409` with `GOAL_NOT_ARCHIVED` otherwise, so a UI slip can never hard-delete user data. Returns `404` when that account does not own the goal.

### `POST /goals/suggestions`

Request: `{ "journalId": "string" }`.

- requires active Premium
- confirms journal ownership before using it as context
- returns 0-4 supportive suggestions only; an empty array is valid when the user's saved goals already cover the entry, and the endpoint never creates a goal
- returns `403` with `PREMIUM_REQUIRED` when unavailable
- does not log raw journal text
- compares candidates with active and archived goals plus earlier candidates, first through deterministic intent normalization and then through one best-effort batch embedding request at cosine similarity `>= 0.84`; embedding failure falls back to the deterministic result
- changed duration, cadence, meal, time, or trigger does not make an otherwise repeated core action novel
- each suggestion carries `icon`, `iconSource: "automatic"`, and `frequency`; automatic icons avoid the user's other goal icons when the catalog has an alternative

Response `data`:

```json
{
  "journalId": "string",
  "suggestions": [
    {
      "title": "Write tomorrow's first step",
      "description": "Name one small action tonight so tomorrow starts with less friction.",
      "icon": "plan",
      "iconSource": "automatic",
      "frequency": "daily"
    }
  ]
}
```

## 3.5 Journal Module (`/journal`)

### `GET /journal/get_journals`

Get authenticated user journals using stable newest-first cursor pagination.

Query parameters:

- `limit`: optional integer from `1..50`; defaults to the backend page size
- `cursor`: optional opaque cursor returned by the preceding page
- `from`: optional ISO timestamp, inclusive
- `to`: optional ISO timestamp, exclusive; must be later than `from`

Response `data`:

```json
{
  "entries": [
    {
      "_id": "string",
      "title": "string",
      "content": "string",
      "type": "open_ended",
      "entryKind": "journal",
      "aiPrompt": "string",
      "tags": ["string"],
      "detectedTopics": ["focus", "work"],
      "detectedMood": "good",
      "images": ["string"],
      "isFavorite": false,
      "createdAt": "2026-03-30T12:00:00.000Z",
      "updatedAt": "2026-03-30T12:00:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "opaque-string-or-null",
    "hasMore": true,
    "matchingCount": 42
  },
  "summary": {
    "totalEntries": 42,
    "favoriteEntries": 8
  }
}
```

Entries are ordered by `createdAt DESC, _id DESC`. `matchingCount` reflects the
optional date range, while `summary` always reflects the user's complete journal.
Invalid cursors return `400` with `INVALID_JOURNAL_CURSOR`. List responses do not
include the heavier per-entry session-analysis snapshot.

### `POST /journal/create_journal`

Create journal entry.

`type` must be `open_ended` or `guided`. Legacy stored entry types serialize as `open_ended`.
`entryKind` is optional on create, accepts `journal` or `quick_thought`, defaults to
`journal`, and remains immutable after creation.

Request:

```json
{
  "title": "Morning note",
  "content": "Today felt steady and clear.",
  "type": "open_ended",
  "entryKind": "journal",
  "aiPrompt": "What are you grateful for today?",
  "images": [],
  "tags": ["reflection"],
  "isFavorite": false
}
```

Success `data`:

```json
{
  "_id": "string",
  "title": "Morning note",
  "content": "Today felt steady and clear.",
  "type": "open_ended",
  "entryKind": "journal",
  "aiPrompt": "What are you grateful for today?",
  "tags": ["reflection"],
  "detectedTopics": ["gratitude", "calm"],
  "detectedMood": "good",
  "images": [],
  "isFavorite": false,
  "createdAt": "2026-03-30T12:00:00.000Z",
  "updatedAt": "2026-03-30T12:00:00.000Z"
}
```

### `POST /journal/suggest_tags`

Suggest tags for an in-progress journal draft.

Request:

```json
{
  "content": "Today felt calmer after I wrote everything out.",
  "selectedTags": ["reflection"],
  "mood": "bad"
}
```

Success `data`:

```json
{
  "tags": ["mindfulness", "self-care"]
}
```

Notes:

- protected route
- returns `403` with error code `PREMIUM_REQUIRED` when the authenticated user is not premium
- when the authenticated user is Premium and the backend is configured with OpenAI, tag suggestions are chosen through OpenAI against Journal.IO's allowed tag set
- if a premium user has opted out of AI or OpenAI is unavailable, the backend falls back to deterministic keyword and mood-aware tag scoring
- positive prompt words inside negated or distressed phrasing should not force a positive tag

### `POST /journal/quick_analysis`

Generate a short AI-assisted reflection for one saved journal entry.

Request:

```json
{
  "journalId": "string"
}
```

Success `data`:

```json
{
  "journalId": "string",
  "summary": {
    "headline": "Work carried this bad moment",
    "narrative": "This entry may indicate work pressure was closely tied to how the moment felt. You were not just logging the day, you were trying to make sense of it while it was still live.",
    "highlight": "Work looks like the clearest thread to keep tracking if this feeling or situation comes back."
  },
  "scorecard": {
    "vibeLabel": "Heavy moment",
    "vibeTone": "slate",
    "cards": [
      {
        "key": "words",
        "label": "Words",
        "value": "26",
        "tone": "blue"
      },
      {
        "key": "mood",
        "label": "Mood",
        "value": "Bad",
        "tone": "slate"
      },
      {
        "key": "focus",
        "label": "Focus",
        "value": "Work",
        "tone": "amber"
      },
      {
        "key": "depth",
        "label": "Depth",
        "value": "Quick note",
        "tone": "amber"
      }
    ]
  },
  "patternTags": [
    {
      "label": "Work",
      "tone": "amber"
    },
    {
      "label": "Self Care",
      "tone": "sage"
    }
  ],
  "signals": {
    "whatStoodOut": {
      "title": "Work was the clearest signal",
      "description": "This entry may indicate work carried most of the meaning in the moment, not just the background context around it.",
      "evidence": ["Work", "Bad"],
      "tone": "amber"
    },
    "whatNeedsCare": {
      "title": "This moment deserves a softer read",
      "description": "The entry carries enough strain that it makes sense to treat this as a real stress moment, not something to brush past.",
      "evidence": ["Bad", "Self Care"],
      "tone": "slate"
    },
    "whatToCarryForward": {
      "title": "There is still something useful to keep",
      "description": "The entry does not just flag friction. It also shows a thread that could help you build the next reflection with a little more steadiness.",
      "evidence": ["Quick note", "Work"],
      "tone": "sage"
    }
  },
  "nextStep": {
    "title": "Track what steadied you",
    "description": "Next time, note one small thing that helped you feel safer, steadier, or more supported so the pattern is easier to reuse.",
    "focus": "Support"
  },
  "connection": "This is the second time this week a work deadline showed up right before you felt this way.",
  "generatedAt": "2026-04-06T09:20:00.000Z"
}
```

`connection` is an optional, best-effort line (`string | null`) drawn from the user's long-term memory; it appears only when today genuinely echoes a specific past thread, and is `null` otherwise.

Notes:

- protected route
- returns `403` with error code `PREMIUM_REQUIRED` when the authenticated user is not premium
- reads one saved journal only; it does not depend on the weekly analysis cache
- the response is visual-first and signal-first for the entry-detail screen: summary, compact scorecard, pattern tags, three signal cards, and one grounded next step
- the backend strips any saved `aiPrompt` text from the journal before reading it so the prompt itself is not mistaken for the user's reflection
- if the remaining text is too short, too noisy, or obviously prompt-led, the response stays intentionally light and surfaces that as a low-signal read instead of forcing a stronger topic or personality interpretation
- if the entry may involve self-harm, suicide risk, or harm to another person, the entry remains readable but quick analysis switches to support-first copy, avoids normal pattern or personality interpretation, and does not ask OpenAI to refine the entry
- when OpenAI is available for an eligible user, the backend refines the single-entry reflection with OpenAI
- if OpenAI is unavailable, the backend falls back to a deterministic, non-clinical quick reflection

### `POST /journal/session_analysis`

Generate the shared post-save session analysis for one user-owned open-ended journal. The route is protected and Premium-only.

Request:

```json
{
  "journalId": "string"
}
```

Success `data` uses the same structured shape as `POST /guided-reflection/session-analysis`, including `analysis`, `majorInsight`, `observedTrends`, `detectedTopics`, `detectedMood`, `brainSessionMap`, and `hasEnoughSignal`.

Notes:

- confirms journal ownership before reading the entry
- returns `403` with `PREMIUM_REQUIRED` for Free users
- returns `422` with `SESSION_ANALYSIS_NOT_AVAILABLE` for Quick Notes
- replays the journal's stored session-analysis snapshot when one exists; it does not regenerate on subsequent detail opens
- the one exception is a stale snapshot — one whose analysis carries `isFallback: true`, or a legacy (`version: 1`) snapshot holding the old open-ended fallback boilerplate. Those regenerate on the next open and overwrite in place, so an entry analysed during an AI outage repairs itself instead of keeping generic copy forever
- eligible legacy journal entries generate once on first detail open and atomically persist the validated full response, source, schema version, and generated timestamp
- persists normalized `detectedTopics` and `detectedMood` on the journal without overwriting user-authored `tags`
- editing an entry preserves its original session-analysis snapshot; no automatic re-analysis occurs after edits
- the Free iOS preview is local-only and must not call this endpoint

### `POST /guided-reflection/first-summary`

Generate a concise, therapeutically informed but non-clinical reflection after the user answers the three required daily prompts. The response keeps the practical reflection separate from one short `followUpQuestion`.

**Premium gating:** guided reflection is a premium experience. The AI path requires an active premium entitlement (`canUseGuidedReflectionAi`). Set `GUIDED_REFLECTION_ALLOW_NON_PREMIUM=true` to bypass the premium check in development/testing while still requiring OpenAI configuration. When the gate fails, the route still returns deterministic, non-clinical fallback copy (including a `followUpQuestion`) — it never opens a paywall or errors.

Request:

```json
{
  "journalId": "saved-guided-journal-id",
  "promptAnswers": [
    {
      "questionId": "good_exciting",
      "question": "What was one good or exciting thing that happened today?",
      "answer": "I woke up early"
    },
    {
      "questionId": "hurdle",
      "question": "What was one hurdle or stressful moment you faced today?",
      "answer": "I felt pulled into an old habit"
    },
    {
      "questionId": "carry_tomorrow",
      "question": "What would you like to carry into tomorrow?",
      "answer": "One small action that feels aligned"
    }
  ],
  "onboardingContext": {
    "ageRange": "25-34",
    "primaryContext": "working_professional",
    "reflectionTone": ["gentle"],
    "primarySupportFocus": "stress",
    "supportFocusAreas": ["stress", "overthinking"],
    "preferredTheme": "sunset"
  }
}
```

Success `data`:

```json
{
  "reflection": "Your early start appears to have created useful momentum, while the old habit added friction later. Noticing both keeps one difficult moment from defining the whole day. Tomorrow, protect one small aligned action with a clear time or trigger, then treat completing it as information rather than a test of your worth.",
  "followUpQuestion": "What feeling was strongest when the old habit appeared?",
  "takeaway": "Hold the full picture, then choose one small next step."
}
```

Notes:

- protected route
- **premium-gated** (`canUseGuidedReflectionAi`); `GUIDED_REFLECTION_ALLOW_NON_PREMIUM=true` bypasses in dev. Fallback copy is returned on gate failure — never a paywall or error.
- runs at high reasoning effort (`OPENAI_GUIDED_REFLECTION_REASONING_EFFORT`, default `high`) for genuine depth
- injected with cross-session **long-term memory** (rolling narrative + semantically-relevant past entries + recurring themes) for premium users; the current session is embedded to pull the most relevant history
- `reflection` is 45-70 words and remains practical, grounded, supportive, and uncertainty-aware
- `followUpQuestion` is always present, 6-14 words, and at most 100 characters; the mobile client renders it outside the response card as the next composer prompt
- if OpenAI is unavailable or disabled, returns deterministic, non-clinical Journal.IO reflection copy (still with a `followUpQuestion`)
- does not save journal content; the mobile app still saves exactly one entry later through `POST /journal/create_journal`
- safety-sensitive text returns support-first copy and skips normal reflective interpretation
- when an owned `journalId` is supplied, the full validated response is atomically stored as that journal's session-analysis snapshot and reused by later entry-detail reads

### `POST /guided-reflection/go-deeper`

Generate a short follow-up reflection for optional text added after the first onboarding reflection summary.
The same endpoint also powers the optional suggestion thread after the three required first-reflection prompts.

Request:

```json
{
  "promptAnswers": [
    {
      "questionId": "good_exciting",
      "question": "What was one good or exciting thing that happened today?",
      "answer": "A good walk"
    },
    {
      "questionId": "hurdle",
      "question": "What was one hurdle or stressful moment you faced today?",
      "answer": "I felt behind on work"
    },
    {
      "questionId": "carry_tomorrow",
      "question": "What would you like to carry into tomorrow?",
      "answer": "One focused hour"
    }
  ],
  "aiSummary": "Today held a good walk and some pressure around work. Keep tomorrow simple.",
  "previousDeeperReflections": [],
  "threadMessages": [
    {
      "role": "user",
      "kind": "suggestion_request",
      "text": "Offer another perspective.",
      "actionType": "another_perspective"
    },
    {
      "role": "assistant",
      "kind": "assistant_reflection",
      "text": "Another way to see this is that the pressure did not erase the steadiness you practiced.",
      "promptQuestion": "What part of that steadiness can you repeat tomorrow?"
    }
  ],
  "currentText": "I think I need to protect my morning better.",
  "suggestionAction": "go_deeper",
  "onboardingContext": {
    "reflectionTone": ["practical"]
  }
}
```

Success `data`:

```json
{
  "reflection": "Protecting your morning seems tied to the focused hour you keep reaching for — it sounds less like time management and more like guarding something that matters to you.",
  "nextQuestion": "What tends to get in the way of that first hour before it even starts?",
  "canGoDeeper": true
}
```

Notes:

- protected route
- **premium-gated** (`canUseGuidedReflectionAi`); `GUIDED_REFLECTION_ALLOW_NON_PREMIUM=true` bypasses in dev. Falls back to deterministic copy on gate failure.
- accepts the original onboarding prompt answers, the first summary, previous deeper reflections, optional thread messages, the current optional text, and an optional suggestion action
- this is an adaptive, user-paced deepening turn: it returns a 45-70 word grounded `reflection`, one separate 6-14 word `nextQuestion`, and `canGoDeeper` (false once the reflection reaches a natural stopping point)
- when the user references something heavy, the response acknowledges it without diagnosing, claiming professional authority, or pushing the user deeper
- runs on the latest model tier (`OPENAI_GUIDED_REFLECTION_MODEL`) at high reasoning effort (`OPENAI_GUIDED_REFLECTION_REASONING_EFFORT`, default `high`), injected with cross-session **long-term memory** (rolling narrative + semantic recall + recurring themes) so it can gently check in on ongoing threads from past sessions.
- `suggestionAction` may be `gentle_prompt`, `go_deeper`, `another_perspective`, `small_next_step`, or `summarize` (still accepted for compatibility)
- the client applies a soft cap (~6 turns) so deepening cannot run forever; the backend's `canGoDeeper` drives the natural stopping point

### `POST /guided-reflection/session-analysis`

Generate the session-level analysis shown after the first onboarding journal entry has been saved. This is not a diagnosis, therapy, or medical interpretation; it is a fuller behavioral reflection over the whole first-guided-reflection session.

Every successful response includes a required `brainSessionMap`. The map classifies the completed reflection into exactly one dominant brain-inspired reflection center, 1-3 secondary centers, and a complete score breakdown for all 8 centers sorted by score descending. Evidence snippets must come from the user's own prompt answers or user-authored thread messages only.

Request:

```json
{
  "promptAnswers": [
    {
      "questionId": "good_exciting",
      "question": "What was one good or exciting thing that happened today?",
      "answer": "I stayed disciplined with my morning routine"
    },
    {
      "questionId": "hurdle",
      "question": "What was one hurdle or stressful moment you faced today?",
      "answer": "I felt pressure from my dad and worried I was being judged"
    },
    {
      "questionId": "carry_tomorrow",
      "question": "What would you like to carry into tomorrow?",
      "answer": "I want to carry discipline without turning it into pressure"
    }
  ],
  "aiSummary": "Today shows discipline alongside the discomfort of feeling judged.",
  "threadMessages": [
    {
      "role": "user",
      "kind": "suggestion_request",
      "text": "Offer another perspective.",
      "actionType": "another_perspective"
    },
    {
      "role": "assistant",
      "kind": "assistant_reflection",
      "text": "Another perspective is that this was also about proving steadiness to yourself."
    }
  ],
  "onboardingContext": {
    "reflectionTone": ["deep"]
  }
}
```

Success `data`:

```json
{
  "analysis": "This session suggests a useful contrast between discipline and the discomfort of feeling judged. The strongest signal is that the user is trying to keep discipline connected to steadiness rather than pressure. The entry also shows a tomorrow-oriented anchor, which can make the reflection practical instead of only emotional. A broader pattern may be emerging around noticing outside judgment, returning to personal alignment, and choosing one grounded action.",
  "majorInsight": "Major insight: the clearest signal is the move from external pressure toward one self-directed choice.",
  "observedTrends": ["Discipline", "Pressure", "Family", "Tomorrow"],
  "topicsObserved": ["discipline", "stress", "family"],
  "detectedTopics": ["discipline", "stress", "family"],
  "detectedMood": "bad",
  "brainSessionMap": {
    "dominantCenterId": "planning_self_control",
    "dominantCenter": {
      "id": "planning_self_control",
      "productName": "Planning & Self-Control",
      "brainRegion": "Prefrontal Cortex",
      "score": 0.82,
      "confidence": 0.78,
      "rank": 1,
      "intensity": "high",
      "evidence": ["stayed disciplined", "carry discipline"],
      "shortInsight": "This center stood out through discipline, direction, and what the user wants to carry into tomorrow.",
      "nuancedDetails": {
        "emotionalTone": "Steady but pressured.",
        "cognitivePattern": "The reflection organizes around restraint, choice, and next action.",
        "timeOrientation": "future",
        "selfOtherFocus": "mixed",
        "actionOrientation": "planning",
        "repeatedSignal": "discipline"
      }
    },
    "secondaryCenterIds": [
      "relationships_perspective",
      "self_reflection_identity",
      "emotional_intensity"
    ],
    "secondaryCenters": [
      {
        "id": "relationships_perspective",
        "productName": "Relationships & Perspective",
        "brainRegion": "Social Brain / Temporoparietal Junction",
        "score": 0.68,
        "confidence": 0.72,
        "rank": 2,
        "intensity": "high",
        "evidence": ["pressure from my dad", "being judged"],
        "shortInsight": "This center stood out through social perception and another person's role in the reflection.",
        "nuancedDetails": {
          "emotionalTone": "Socially alert.",
          "cognitivePattern": "The writing considers judgment and perspective.",
          "timeOrientation": "present",
          "selfOtherFocus": "mixed",
          "actionOrientation": "reflecting",
          "repeatedSignal": "being judged"
        }
      },
      {
        "id": "self_reflection_identity",
        "productName": "Self-Reflection & Identity",
        "brainRegion": "Default Mode Network",
        "score": 0.61,
        "confidence": 0.66,
        "rank": 3,
        "intensity": "moderate",
        "evidence": ["proving steadiness"],
        "shortInsight": "This center reflected self-image and the user's inner narrative around steadiness.",
        "nuancedDetails": {
          "emotionalTone": "Self-aware.",
          "cognitivePattern": "The writing turns inward toward identity and personal alignment.",
          "timeOrientation": "present",
          "selfOtherFocus": "self",
          "actionOrientation": "reflecting",
          "repeatedSignal": "steadiness"
        }
      },
      {
        "id": "emotional_intensity",
        "productName": "Emotional Intensity",
        "brainRegion": "Amygdala",
        "score": 0.52,
        "confidence": 0.64,
        "rank": 4,
        "intensity": "moderate",
        "evidence": ["felt pressure"],
        "shortInsight": "This center picked up the emotional charge around pressure and judgment.",
        "nuancedDetails": {
          "emotionalTone": "Pressured.",
          "cognitivePattern": "The writing tracks emotional charge without turning it into certainty.",
          "timeOrientation": "present",
          "selfOtherFocus": "mixed",
          "actionOrientation": "processing",
          "repeatedSignal": "pressure"
        }
      }
    ],
    "centers": [
      {
        "id": "planning_self_control",
        "productName": "Planning & Self-Control",
        "brainRegion": "Prefrontal Cortex",
        "score": 0.82,
        "confidence": 0.78,
        "rank": 1,
        "intensity": "high",
        "evidence": ["stayed disciplined", "carry discipline"],
        "shortInsight": "This center stood out through discipline, direction, and what the user wants to carry into tomorrow.",
        "nuancedDetails": {
          "emotionalTone": "Steady but pressured.",
          "cognitivePattern": "The reflection organizes around restraint, choice, and next action.",
          "timeOrientation": "future",
          "selfOtherFocus": "mixed",
          "actionOrientation": "planning",
          "repeatedSignal": "discipline"
        }
      },
      {
        "id": "relationships_perspective",
        "productName": "Relationships & Perspective",
        "brainRegion": "Social Brain / Temporoparietal Junction",
        "score": 0.68,
        "confidence": 0.72,
        "rank": 2,
        "intensity": "high",
        "evidence": ["pressure from my dad", "being judged"],
        "shortInsight": "This center stood out through social perception and another person's role in the reflection.",
        "nuancedDetails": {
          "timeOrientation": "present",
          "selfOtherFocus": "mixed",
          "actionOrientation": "reflecting"
        }
      }
    ],
    "neuroscienceSummary": "Your reflection leaned most strongly toward Planning & Self-Control. Discipline and tomorrow's choices were the clearest signals, while your dad's perception added a social and self-image layer to the session.",
    "mostNoticedText": "The strongest center in this session was Planning & Self-Control, because your writing kept returning to discipline, direction, and what you want to carry into tomorrow.",
    "mindMapSeedText": "Your first reflection has added its first signal to your Mind Map."
  },
  "hasEnoughSignal": true,
  "isFallback": false
}
```

`brainSessionMap.centers` always contains all 8 center ids exactly once:

- `emotional_intensity` / Emotional Intensity / Amygdala
- `planning_self_control` / Planning & Self-Control / Prefrontal Cortex
- `memory_meaning` / Memory & Meaning / Hippocampus
- `body_inner_signals` / Body & Inner Signals / Insula
- `conflict_attention` / Conflict & Attention / Anterior Cingulate Cortex
- `motivation_reward` / Motivation & Reward / Reward Circuit / Ventral Striatum
- `relationships_perspective` / Relationships & Perspective / Social Brain / Temporoparietal Junction
- `self_reflection_identity` / Self-Reflection & Identity / Default Mode Network

For readability, the sample `centers` array above is shortened; production responses must include all 8 center objects with the same object shape.

Low-signal success `data`:

```json
{
  "analysis": "There is not enough clear information in this session to form a useful insight yet. Journal.IO can notice patterns best when the entry includes a few specific details about what happened, what felt difficult, and what you want to carry forward.",
  "majorInsight": "Major insight: there is not enough clear detail yet to identify a reliable pattern.",
  "observedTrends": ["More detail needed", "Reflection started", "Tomorrow"],
  "topicsObserved": ["More detail needed", "Reflection started", "Tomorrow"],
  "brainSessionMap": {
    "dominantCenterId": "self_reflection_identity",
    "dominantCenter": {
      "id": "self_reflection_identity",
      "productName": "Self-Reflection & Identity",
      "brainRegion": "Default Mode Network",
      "score": 0.55,
      "confidence": 0.58,
      "rank": 1,
      "intensity": "moderate",
      "evidence": [],
      "shortInsight": "This first signal is mostly about noticing the user's inner narrative and what they want to carry forward.",
      "nuancedDetails": {
        "actionOrientation": "reflecting",
        "selfOtherFocus": "self",
        "timeOrientation": "mixed"
      }
    },
    "secondaryCenterIds": [
      "planning_self_control",
      "memory_meaning",
      "relationships_perspective"
    ],
    "secondaryCenters": [
      {
        "id": "planning_self_control",
        "productName": "Planning & Self-Control",
        "brainRegion": "Prefrontal Cortex",
        "score": 0.45,
        "confidence": 0.44,
        "rank": 2,
        "intensity": "moderate",
        "evidence": [],
        "shortInsight": "Planning & Self-Control is present only lightly in this fallback reflection map.",
        "nuancedDetails": {
          "actionOrientation": "planning",
          "selfOtherFocus": "self",
          "timeOrientation": "future"
        }
      },
      {
        "id": "memory_meaning",
        "productName": "Memory & Meaning",
        "brainRegion": "Hippocampus",
        "score": 0.35,
        "confidence": 0.44,
        "rank": 3,
        "intensity": "moderate",
        "evidence": [],
        "shortInsight": "Memory & Meaning is present only lightly in this fallback reflection map.",
        "nuancedDetails": {
          "actionOrientation": "reflecting",
          "selfOtherFocus": "self",
          "timeOrientation": "mixed"
        }
      },
      {
        "id": "relationships_perspective",
        "productName": "Relationships & Perspective",
        "brainRegion": "Social Brain / Temporoparietal Junction",
        "score": 0.26,
        "confidence": 0.44,
        "rank": 4,
        "intensity": "low",
        "evidence": [],
        "shortInsight": "Relationships & Perspective is present only lightly in this fallback reflection map.",
        "nuancedDetails": {
          "actionOrientation": "reflecting",
          "selfOtherFocus": "others",
          "timeOrientation": "mixed"
        }
      }
    ],
    "centers": [
      {
        "id": "self_reflection_identity",
        "productName": "Self-Reflection & Identity",
        "brainRegion": "Default Mode Network",
        "score": 0.55,
        "confidence": 0.58,
        "rank": 1,
        "intensity": "moderate",
        "evidence": [],
        "shortInsight": "This first signal is mostly about noticing the user's inner narrative and what they want to carry forward.",
        "nuancedDetails": {
          "actionOrientation": "reflecting",
          "selfOtherFocus": "self",
          "timeOrientation": "mixed"
        }
      },
      {
        "id": "planning_self_control",
        "productName": "Planning & Self-Control",
        "brainRegion": "Prefrontal Cortex",
        "score": 0.45,
        "confidence": 0.44,
        "rank": 2,
        "intensity": "moderate",
        "evidence": [],
        "shortInsight": "Planning & Self-Control is present only lightly in this fallback reflection map.",
        "nuancedDetails": {
          "actionOrientation": "planning",
          "selfOtherFocus": "self",
          "timeOrientation": "future"
        }
      },
      {
        "id": "memory_meaning",
        "productName": "Memory & Meaning",
        "brainRegion": "Hippocampus",
        "score": 0.35,
        "confidence": 0.44,
        "rank": 3,
        "intensity": "moderate",
        "evidence": [],
        "shortInsight": "Memory & Meaning is present only lightly in this fallback reflection map.",
        "nuancedDetails": {
          "actionOrientation": "reflecting",
          "selfOtherFocus": "self",
          "timeOrientation": "mixed"
        }
      },
      {
        "id": "relationships_perspective",
        "productName": "Relationships & Perspective",
        "brainRegion": "Social Brain / Temporoparietal Junction",
        "score": 0.26,
        "confidence": 0.44,
        "rank": 4,
        "intensity": "low",
        "evidence": [],
        "shortInsight": "Relationships & Perspective is present only lightly in this fallback reflection map.",
        "nuancedDetails": {
          "actionOrientation": "reflecting",
          "selfOtherFocus": "others",
          "timeOrientation": "mixed"
        }
      },
      {
        "id": "conflict_attention",
        "productName": "Conflict & Attention",
        "brainRegion": "Anterior Cingulate Cortex",
        "score": 0.24,
        "confidence": 0.44,
        "rank": 5,
        "intensity": "low",
        "evidence": [],
        "shortInsight": "Conflict & Attention is present only lightly in this fallback reflection map.",
        "nuancedDetails": {
          "actionOrientation": "processing",
          "selfOtherFocus": "self",
          "timeOrientation": "mixed"
        }
      },
      {
        "id": "emotional_intensity",
        "productName": "Emotional Intensity",
        "brainRegion": "Amygdala",
        "score": 0.22,
        "confidence": 0.44,
        "rank": 6,
        "intensity": "low",
        "evidence": [],
        "shortInsight": "Emotional Intensity is present only lightly in this fallback reflection map.",
        "nuancedDetails": {
          "actionOrientation": "processing",
          "selfOtherFocus": "self",
          "timeOrientation": "mixed"
        }
      },
      {
        "id": "motivation_reward",
        "productName": "Motivation & Reward",
        "brainRegion": "Reward Circuit / Ventral Striatum",
        "score": 0.2,
        "confidence": 0.44,
        "rank": 7,
        "intensity": "low",
        "evidence": [],
        "shortInsight": "Motivation & Reward is present only lightly in this fallback reflection map.",
        "nuancedDetails": {
          "actionOrientation": "acting",
          "selfOtherFocus": "self",
          "timeOrientation": "mixed"
        }
      },
      {
        "id": "body_inner_signals",
        "productName": "Body & Inner Signals",
        "brainRegion": "Insula",
        "score": 0.18,
        "confidence": 0.44,
        "rank": 8,
        "intensity": "low",
        "evidence": [],
        "shortInsight": "Body & Inner Signals is present only lightly in this fallback reflection map.",
        "nuancedDetails": {
          "actionOrientation": "reflecting",
          "selfOtherFocus": "self",
          "timeOrientation": "mixed"
        }
      }
    ],
    "neuroscienceSummary": "This reflection has started building your personal Mind Map by capturing what you noticed, what challenged you, and what you want to carry forward.",
    "mostNoticedText": "The strongest center in this session was Self-Reflection & Identity, because this first entry begins with noticing the user's inner narrative.",
    "mindMapSeedText": "Your first reflection has added its first signal to your Mind Map."
  },
  "hasEnoughSignal": false
}
```

Notes:

- protected route
- not premium-gated and must not trigger paywall
- used only after the mobile app has saved the first real onboarding journal entry
- reads the full in-session context sent by the client: prompt answers, first AI summary, optional user requests, and assistant deeper responses
- detects sparse/noisy/gibberish sessions before calling AI and returns an explicit low-signal analysis instead of inventing insight
- `hasEnoughSignal` is part of the model contract, not only a server heuristic: it is a required property of the strict `json_schema` and the model sets it to `false` when the writing is too sparse, vague, or unreadable to support a real pattern. When it comes back `false`, the server substitutes the canonical low-signal `analysis`, `majorInsight`, and `observedTrends` copy — the schema's `minLength: 120` would otherwise force the model to pad — while keeping the model's `brainSessionMap` so the analysis screen still renders its cards
- `detectedTopics` carries at least one taxonomy entry whenever `hasEnoughSignal` is true: the prompt requires one, and if the model still returns none the server falls back to `detectEntryMetadataHeuristically`. It never invents a tag, so the Topics Detected card keeps an empty state for the rare case where neither finds anything
- responses built from the deterministic fallback carry `isFallback: true`. This is provenance for the snapshot layer, not user-facing copy — see the regeneration note under `POST /journal/session_analysis`. Open-ended entries arrive as a single `open_ended_entry` prompt answer, so the fallback derives its sentences from the user's own writing rather than the three guided question ids
- when `journalId` is supplied this route replays the stored snapshot, and applies the same staleness check as `POST /journal/session_analysis`: a stale snapshot is regenerated and overwritten instead of replayed, so both entry points into the same snapshot behave identically
- output must remain non-clinical, behavior-focused, uncertainty-aware, and must not claim diagnosis or therapy
- `brainSessionMap` is required even when OpenAI is unavailable, returns malformed output, or the session is low-signal
- clear non-AI fallback sessions may use deterministic local center scoring from the user's writing; low-signal or no-reliable-map fallback responses use Self-Reflection & Identity as dominant with non-flat low/neutral scores across the remaining centers
- if OpenAI is unavailable, returns deterministic, non-clinical Journal.IO reflection copy
- safety-sensitive text returns support-first copy and skips normal reflective interpretation

### `POST /guided-reflection/goal-suggestions`

Generate up to four local onboarding goal suggestions after the first entry has been saved and the session analysis has been shown. Each suggestion must be a concrete, low-effort action tied to the user's writing or a plausible broadly useful contextual experiment, without presenting a speculative cause as fact. Suggestions that repeat a saved goal are removed, overlapping candidate actions are merged, and a curated movement-first baseline bank fills the result to three suggestions when novelty filtering or low-signal writing would otherwise leave the screen sparse. This endpoint returns suggestions only; it does not create goals, persist selected goals, schedule reminders, update streaks, or complete onboarding.

Request:

```json
{
  "promptAnswers": [
    {
      "questionId": "good_exciting",
      "question": "What was one good or exciting thing that happened today?",
      "answer": "I stayed disciplined with my morning routine"
    },
    {
      "questionId": "hurdle",
      "question": "What was one hurdle or stressful moment you faced today?",
      "answer": "I felt pressure from my dad and worried I was being judged"
    },
    {
      "questionId": "carry_tomorrow",
      "question": "What would you like to carry into tomorrow?",
      "answer": "I want to carry discipline without turning it into pressure"
    }
  ],
  "aiSummary": "Today shows discipline alongside the discomfort of feeling judged.",
  "threadMessages": [
    {
      "role": "user",
      "kind": "suggestion_request",
      "text": "Suggest a small next step.",
      "actionType": "small_next_step"
    },
    {
      "role": "assistant",
      "kind": "assistant_reflection",
      "text": "A small next step could be choosing one steady action before reacting to outside pressure."
    }
  ],
  "sessionAnalysis": {
    "analysis": "This session suggests a useful contrast between discipline and the discomfort of feeling judged.",
    "majorInsight": "Major insight: the clearest signal is the move from external pressure toward one self-directed choice.",
    "observedTrends": ["Discipline", "Pressure", "Family", "Tomorrow"],
    "hasEnoughSignal": true
  },
  "onboardingContext": {
    "reflectionTone": ["gentle"],
    "primaryContext": "working_professional",
    "supportFocusAreas": ["stress"]
  }
}
```

Success `data`:

```json
{
  "goals": [
    {
      "title": "Carry one steady choice",
      "description": "Choose one small action tomorrow that reflects the discipline you want to keep.",
      "frequency": "daily",
      "category": "journaling_habit"
    },
    {
      "title": "Name the pressure",
      "description": "When stress appears, write one sentence about what is causing it before reacting.",
      "frequency": "as_needed",
      "category": "stress"
    },
    {
      "title": "Notice one pattern",
      "description": "At the end of the day, name one thought, mood, or habit that repeated.",
      "frequency": "daily",
      "category": "self_awareness"
    }
  ],
  "hasEnoughSignal": true
}
```

Low-signal success `data`:

```json
{
  "goals": [
    {
      "title": "Write for 5 minutes",
      "description": "Take five quiet minutes to write what felt most noticeable today.",
      "frequency": "daily",
      "category": "journaling_habit"
    },
    {
      "title": "Notice one pattern",
      "description": "At the end of the day, name one thought, mood, or habit that repeated.",
      "frequency": "daily",
      "category": "self_awareness"
    },
    {
      "title": "Carry one small step",
      "description": "Choose one small action you want to bring into tomorrow.",
      "frequency": "as_needed",
      "category": "general"
    }
  ],
  "hasEnoughSignal": false
}
```

Notes:

- protected route
- not premium-gated and must not trigger paywall
- generation-only for the Phase 3C onboarding value chain
- does not save a selected suggestion, schedule reminders, or update streak state; separate authenticated manual Goals CRUD is available through `/goals`
- returns 0-4 compact goals with `daily`, `weekly`, or `as_needed` frequency after filtering against active and archived saved goals; an empty array is valid when no genuinely new action remains, and the response must not pad to a fixed count. Titles are capped at 30 characters and descriptions at 96 characters.
- deterministic intent normalization treats changed duration, cadence, meal, time, or trigger as the same core action; eligible AI responses also receive one best-effort batch semantic comparison at cosine similarity `>= 0.84`
- categories are limited to `journaling_habit`, `stress`, `mood`, `relationships`, `self_awareness`, `sleep`, `focus`, `confidence`, and `general`
- output must stay small, direct, specific, actionable, non-clinical, and tied to a concrete detail in the user's written session when enough signal exists; generic prompts such as `reflect more` or `notice a pattern` require a concrete cue and action before they are valid
- sparse/noisy/gibberish sessions return safe starter goals and `hasEnoughSignal: false`
- if OpenAI is unavailable or disabled, returns deterministic fallback goals
- selected goals remain local-only in the mobile onboarding sequence; the separate `/goals` model stores only goals a signed-in user explicitly creates or accepts

### `GET /journal/get_journal_details`

Get details for one journal entry.

Request query:

```json
{
  "journalId": "string"
}
```

Success `data`:

```json
{
  "_id": "string",
  "title": "string",
  "content": "string",
  "type": "guided",
  "entryKind": "journal",
  "aiPrompt": "string",
  "tags": ["string"],
  "detectedTopics": ["anxiety", "loneliness"],
  "detectedMood": "bad",
  "images": ["string"],
  "isFavorite": false,
  "createdAt": "2026-03-30T12:00:00.000Z",
  "updatedAt": "2026-03-30T12:00:00.000Z"
}
```

`tags` remains user-authored metadata. Reserved `onboarding:` markers are
discarded from new writes and omitted from journal responses. AI-derived
topics remain separate in `detectedTopics`; clients must not copy them into
`tags` when editing an entry.

### `POST /journal/edit_journal`

Edit one journal entry.

Request:

```json
{
  "journalId": "string",
  "title": "Updated title",
  "content": "Updated content",
  "type": "guided",
  "aiPrompt": "What are you grateful for today?",
  "images": [],
  "tags": ["reflection", "growth"],
  "isFavorite": true
}
```

`entryKind` is returned by edit responses but is not editable. Legacy records
without the field normalize to `quick_thought` only when their stored title is
exactly `Quick Thought`; all other legacy records normalize to `journal`.

Success `data`:

```json
{
  "_id": "string",
  "title": "Updated title",
  "content": "Updated content",
  "type": "guided",
  "entryKind": "journal",
  "aiPrompt": "What are you grateful for today?",
  "tags": ["reflection", "growth"],
  "detectedTopics": ["anxiety", "loneliness"],
  "detectedMood": "bad",
  "images": [],
  "isFavorite": true,
  "createdAt": "2026-03-30T12:00:00.000Z",
  "updatedAt": "2026-03-30T12:10:00.000Z"
}
```

### `POST /journal/toggle_favorite`

Update only the favorite state for one journal entry.

Request:

```json
{
  "journalId": "string",
  "isFavorite": true
}
```

Success `data`:

```json
{
  "_id": "string",
  "title": "Updated title",
  "content": "Updated content",
  "type": "guided",
  "entryKind": "journal",
  "tags": ["reflection", "growth"],
  "images": [],
  "isFavorite": true,
  "createdAt": "2026-03-30T12:00:00.000Z",
  "updatedAt": "2026-03-30T12:10:00.000Z"
}
```

### `DELETE /journal/delete_journal`

Delete one journal entry.

Request:

```json
{
  "journalId": "string"
}
```

All journal module routes require authentication.

---

## 3.45 Ask Jade Module (`/ask-jade`)

Jade is the conversational surface of the same reflection companion used by guided reflection, reading the user's pattern graph and long-term memory. It is a support partner for the user's own patterns, not a general-purpose assistant, and it never receives raw journal text — only distilled patterns, context summaries, and the user's own quoted sentences.

Every route in this module is Premium-only and returns `403` with `PREMIUM_REQUIRED` for Free users, including the session list, so the client's locked state needs no special case.

### `GET /ask-jade/sessions`

List the user's Ask Jade conversations, newest first, for the previous-chats panel.

Request:

- optional query param: `limit` (1-30, default 20)
- optional query param: `cursor` (opaque, from a previous response)

Success `data`:

```json
{
  "sessions": [
    {
      "id": "string",
      "title": "Why do I keep overeating at night",
      "lastMessagePreview": "Your entries suggest those two often show up together.",
      "messageCount": 6,
      "lastMessageAt": "2026-08-11T10:04:00.000Z"
    }
  ],
  "pagination": { "nextCursor": "string | null", "hasMore": true }
}
```

Notes:

- cursor-based keyset pagination on `{ lastMessageAt, _id }`, matching `GET /journal/get_journals`; there is no offset paging
- an invalid or tampered cursor returns `400` with `INVALID_JADE_CURSOR`
- reading this list also sweeps the user's idle conversations for pattern mining, so a chat the user walked away from is still folded into the graph on their next visit

### `GET /ask-jade/sessions/:sessionId`

Load one conversation's transcript, newest turns first, for rendering and for scroll-up history.

Request:

- optional query param: `limit` (1-50, default 30)
- optional query param: `cursor` (opaque, from a previous response)

Success `data`:

```json
{
  "session": { "id": "string", "title": "string", "lastMessagePreview": "string", "messageCount": 6, "lastMessageAt": "2026-08-11T10:04:00.000Z" },
  "messages": [
    {
      "id": "string",
      "seq": 1,
      "role": "user",
      "text": "Why do I keep overeating at night?",
      "status": "ok",
      "blocks": [],
      "createdAt": "2026-08-11T10:03:00.000Z"
    }
  ],
  "pagination": { "nextCursor": "string | null", "hasMore": false }
}
```

Notes:

- ownership is confirmed before reading; a conversation belonging to another user returns `404`
- this list paginates **backwards**: the newest `limit` turns are returned in ascending `seq` order, and `nextCursor` walks into older history as the user scrolls up. The session list paginates forwards. Both are keyset
- `status` is `ok`, `fallback` (the model was unreachable), `support_first` (a safety signal was detected), or `product_fact` (a deterministic Journal.IO privacy/security answer)
- `blocks` is always an array. Legacy rows normalize to `[]`; `text` remains the complete readable fallback for older clients

### `POST /ask-jade/messages`

Send one message to Jade and receive the reply. Omitting `sessionId` opens a new conversation, so no separate create call is needed and an abandoned "New chat" tap never leaves an empty session.

Request:

```json
{
  "sessionId": "string (optional)",
  "text": "Why do I keep overeating at night?"
}
```

The client may send `X-Client-Timezone` (IANA timezone, maximum 128 characters); mood ranges use it and otherwise fall back to UTC.

Success `data`:

```json
{
  "sessionId": "string",
  "title": "Why do I keep overeating at night",
  "userMessage": { "id": "string", "seq": 1, "role": "user", "text": "string", "status": "ok", "blocks": [], "createdAt": "2026-08-11T10:03:00.000Z" },
  "reply": { "id": "string", "seq": 2, "role": "assistant", "text": "string", "status": "ok", "blocks": [{ "type": "text", "text": "string" }], "createdAt": "2026-08-11T10:04:00.000Z" },
  "limits": { "turnsUsedToday": 3, "turnsPerDay": 40, "resetAt": null }
}
```

Notes:

- `text` is required, trimmed, and capped at 2000 characters
- returns `403` with `PREMIUM_REQUIRED` for Free users
- returns `429` with `JADE_TURN_LIMIT` once the per-user allowance is spent (`JADE_TURNS_PER_DAY`, default 40; `JADE_TURNS_PER_HOUR`, default 15). `data.resetAt` carries the ISO time the allowance frees up. Limits are counted from the user's own stored messages rather than by request-level rate limiting
- **a model failure still returns `200`.** The reply is persisted with `status: "fallback"` and calm non-technical copy, so the transcript stays a real conversation and the client can offer a retry on that bubble rather than stranding the user's message with no response
- `blocks` is an additive discriminated union: `text`, `list`, `stats`, `mood_trend`, `mood_distribution`, or `activity`. Lists carry `bulleted | numbered`; data blocks carry `ready | empty | unavailable`, a nullable `updatedAt`, and their validated server-derived values
- charts/cards are returned only for explicit graph, trend, comparison, or statistics requests. Mood trends support 7 or 30 days, mood distributions support 30 days or all time, activity supports 7 days, and summary statistics reuse the insights overview. Numeric values are never accepted from the model
- if a requested data block loads but the model does not, the server returns deterministic introductory copy plus the data block. If neither can load, the normal fallback is used
- when the message trips the shared safety detection, a deterministic support-first reply is stored with `status: "support_first"` and **no model request is made**. The client renders that message without the typewriter reveal
- after safety screening, product privacy questions receive a deterministic runtime-aware `product_fact` response and no model request. It describes TLS/account isolation, reports application-level at-rest encryption according to `FIELD_ENCRYPTION_MODE`, and states that the AI flow is not end-to-end encrypted
- `limits` is returned on every send so the client can warn before the wall rather than after it
- sequence numbers are allocated atomically, so two concurrent sends cannot collide
- after the reply is delivered, the conversation is summarized and mined into the pattern graph as fire-and-forget work; neither can delay or fail the reply

### `DELETE /ask-jade/sessions/:sessionId`

Delete one conversation and all of its messages.

Notes:

- ownership is confirmed first; another user's conversation returns `404`
- deletion is immediate and permanent; account deletion removes all conversations regardless

---

## 3.5 Prompts Module (`/prompts`)

### `GET /prompts/writing`

Load personalized writing prompts for the authenticated user.

Success `data`:

```json
{
  "featuredPrompt": {
    "id": "patterns-1",
    "topic": "Patterns",
    "text": "Where did your mood shift, and what seemed to influence it?"
  },
  "prompts": [
    {
      "id": "patterns-1",
      "topic": "Patterns",
      "text": "Where did your mood shift, and what seemed to influence it?"
    },
    {
      "id": "next-step-2",
      "topic": "Next Step",
      "text": "What is one small habit you want to reinforce tomorrow?"
    }
  ],
  "source": "personalized",
  "generatedAt": "2026-04-06T10:00:00.000Z"
}
```

Notes:

- prompts are personalized from the authenticated user's stored journaling patterns, mood trends, and recurring topics
- when the user is Premium and the backend has OpenAI configured, the prompt list is freshly generated through OpenAI from recent writing patterns and recent entry excerpts
- if the user is free, has opted out of AI, or OpenAI is unavailable, the backend falls back to the cached insights-derived prompt set
- `featuredPrompt` is stable for the current day and is intended for the Home `Today's Prompt` card
- `prompts` is intended for surfaces like New Entry that need the full personalized list

All prompts module routes require authentication.

---

# 4) Design-Aligned Target Endpoints (Planned Contract)

These endpoints are expected by the current design context and should be treated as target modules for upcoming slices.

## 4.1 Auth Migration (Email + Google)

The latest design context replaces phone-first signup with email-first auth.

### `POST /auth/sign_up_with_email`

Create a pending account and trigger email verification.

Request:

```json
{
  "email": "alex@example.com",
  "password": "strong-password",
  "onboardingCompleted": true,
  "onboardingContext": {
    "ageRange": "25-34",
    "journalingExperience": "regular",
    "goals": ["Daily Reflection", "Personal Growth"],
    "supportFocus": ["Managing Stress", "Better Sleep"],
    "reminderPreference": "evening",
    "privacyConsentAccepted": true
  }
}
```

Success `data`:

```json
{
  "email": "alex@example.com",
  "verificationRequired": true,
  "expiresInSeconds": 1800
}
```

### `POST /auth/resend_email_verification`

Resend the email verification code/message for a pending account.

Request:

```json
{
  "email": "alex@example.com"
}
```

Success `data`:

```json
{
  "email": "alex@example.com",
  "expiresInSeconds": 1800
}
```

### `POST /auth/verify_email`

Verify the user's email with the code shown in the design flow and start an authenticated session.

Request:

```json
{
  "email": "alex@example.com",
  "code": "123456",
  "onboardingCompleted": true
}
```

Success `data`:

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "user": {
    "userId": "string",
    "name": "Journal User",
    "phoneNumber": null,
    "email": "alex@example.com",
    "isPremium": false,
    "journalingGoals": ["Daily Reflection"],
    "avatarColor": null,
    "profileSetupCompleted": false,
    "onboardingCompleted": true,
    "profilePic": null
  },
  "isNewUser": true
}
```

### `POST /auth/sign_in_with_email`

Sign in an existing email/password user.

Request:

```json
{
  "email": "alex@example.com",
  "password": "strong-password",
  "onboardingContext": {
    "goals": ["Daily Reflection"],
    "reminderPreference": "Evening",
    "privacyConsentAccepted": true
  },
  "onboardingCompleted": true
}
```

Notes:

- when onboarding context is present, the backend persists it on the user before returning the session

Success `data`:

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "user": {
    "userId": "string",
    "name": "Alex",
    "phoneNumber": null,
    "email": "alex@example.com",
    "isPremium": false,
    "journalingGoals": ["Daily Reflection"],
    "avatarColor": "#8E4636",
    "profileSetupCompleted": true,
    "onboardingCompleted": true,
    "profilePic": null
  }
}
```

### `POST /auth/request_password_reset`

Request a password reset email for a verified account.

Request:

```json
{
  "email": "alex@example.com"
}
```

Notes:

- this endpoint always returns a generic success response so account existence is not exposed
- if the email belongs to a verified account, the backend stores a hashed one-time reset token and sends a reset link so the user can set or replace an email password
- reset links use the configured app URL, defaulting to the hosted browser page `https://api.journalio.app/reset-password?token={token}` in production and `http://localhost:3000/reset-password?token={token}` in local development
- non-production responses may include `resetToken`, `resetLink`, `resetIssued`, and `resetSkippedReason` for local testing only

Success `data`:

```json
{
  "email": "alex@example.com",
  "expiresInSeconds": 1800
}
```

### `POST /auth/reset_password`

Set a new password from a valid password-reset token.

Request:

```json
{
  "token": "reset-token-from-email",
  "password": "new-strong-password"
}
```

Notes:

- token validation is server-side and uses only the stored token hash
- reset tokens are one-time use and expire based on `AUTH_PASSWORD_RESET_EXPIRES_IN`
- a successful password reset clears the reset token and invalidates the stored refresh token so existing sessions must sign in again

Success `data`:

```json
{}
```

### `POST /auth/register_from_googleOAuth`

Google OAuth remains a supported alternate auth path and should continue to return the same session payload shape as other sign-in flows.

### `POST /auth/google/mobile`

The mobile client obtains a Google `idToken`, posts it to the backend, and receives the same Journal.IO session payload used by the other sign-in flows. The backend verifies the Google token before linking or creating the user account.

### `POST /auth/apple/mobile`

The mobile client obtains an Apple `identityToken`, posts it with the raw nonce to the backend, and receives the same Journal.IO session payload used by the other sign-in flows. The backend verifies the Apple token and nonce before linking or creating the user account.

## 4.2 User Profile

- `GET /users/profile`
- `PATCH /users/profile`
- `DELETE /users/profile`

## 4.3 Prompting

- `GET /prompts/daily`
- `GET /prompts/history`
- `POST /prompts/answer`

## 4.4 Insights

- `GET /insights/overview`
- `GET /insights/ai-analysis`
- `GET /insights/mind-map`
- `GET /mind-map/entry/:journalId`
- `GET /insights/trends`
- `GET /insights/patterns`
- `GET /insights/traits`
- `GET /insights/explain/{insightId}`

### `GET /insights/overview`

Returns the cached insights overview used by the mobile Insights screen.

Response:

```json
{
  "success": true,
  "message": "Insights overview loaded",
  "data": {
    "stats": {
      "totalEntries": 14,
      "currentStreak": 4,
      "averageWords": 91,
      "totalFavorites": 3
    },
    "activity7d": [
      {
        "dateKey": "2026-04-01",
        "label": "Wed",
        "count": 2
      }
    ],
    "moodDistribution": [
      {
        "mood": "good",
        "label": "Good",
        "count": 4,
        "percentage": 34
      }
    ],
    "popularTopics": [
      {
        "tag": "gratitude",
        "label": "Gratitude",
        "count": 3,
        "percentage": 12
      }
    ],
    "analysis": {
      "summary": "string",
      "keyInsight": "string",
      "growthPatterns": [
        {
          "title": "Consistency",
          "subtitle": "string"
        }
      ],
      "personalizedPrompts": [
        {
          "topic": "Reflection",
          "text": "string"
        }
      ]
    },
    "updatedAt": "ISO-8601|null"
  }
}
```

Behavior:

- protected route
- data is served from a per-user cached insights document
- cache source of truth remains journal entries and mood check-ins
- popular topics are derived from the most-used non-`mood:` journal tags
- mood distribution is derived from saved home mood check-ins

### `GET /insights/ai-analysis`

Returns the weekly AI-analysis payload used by the mobile `AI Analysis` tab. The Home AI insight card also consumes this endpoint and derives short rotating snippets from the same response.

Behavior:

- protected route
- returns `403` with error code `PREMIUM_REQUIRED` when the authenticated user is not premium
- overview insights remain available to every authenticated user
- request header `X-Client-Timezone` is accepted and used to anchor the premium-week window in the user’s local timezone; invalid or missing values fall back to `UTC`
- weekly windows are anchored to `premiumActivatedAt`, not account creation time
- example: if premium starts on `2026-04-11` in the user’s local timezone, the first analysis week is `2026-04-11` through `2026-04-17`, and the first closed-week result becomes available on `2026-04-18`
- the route uses three states:
  - `collecting`: the current premium week is still open
  - `insufficient`: the most recent closed premium week ended with fewer than 4 active journal days
  - `ready`: the most recent closed premium week had at least 4 active journal days and has a full report
- minimum threshold for a report is `4` active journal days inside the closed 7-day premium week
- when OpenAI is configured, the backend uses the deterministic weekly signal as a baseline and asks OpenAI to refine the user-facing summary, pattern tags, action plan, and support guidance before caching the final response
- if OpenAI is unavailable, the endpoint still returns the deterministic weekly analysis payload
- the AI-analysis cache key is scoped to `window start + window end + timezone + status`, so the route no longer behaves like a rolling last-7-days cache
- before weekly synthesis, the backend strips prompt carryover from saved journal content and down-weights low-signal entries such as filler or obvious gibberish so those entries lower confidence and appear as a clarity signal instead of dominating the topic read
- self-harm, suicide-risk, or harm-to-others wording is kept out of normal weekly trait/pattern scoring; the weekly payload switches to support-first summary/action copy and skips OpenAI refinement for that window
- development early-ready reports are disabled unless `AI_INSIGHTS_EXPERIMENTAL_EARLY_READY=true` is explicitly set outside production
- the mobile `AI Analysis` tab renders a minimal 4-card layout from the `ready` payload: a narrative card (`summary.headline` + `summary.narrative` only — no `highlight`), a topic bar chart (`themeBreakdown.items`), a patterns card (`patterns`, capped at 3), and an actionable-steps card (`actionPlan.steps`, fixed at 2). `scoreboard`, `emotionTrend`, and `signals` are still returned (used internally and by the OpenAI enhancement prompt) but are not rendered by these cards.

Collecting response:

```json
{
  "success": true,
  "message": "Insights AI analysis loaded",
  "data": {
    "status": "collecting",
    "window": {
      "startDate": "2026-04-11",
      "endDate": "2026-04-17",
      "label": "Apr 11 - Apr 17",
      "entryCount": 2,
      "activeDays": 2,
      "totalWords": 248
    },
    "progress": {
      "activeDays": 2,
      "minimumActiveDays": 4,
      "entriesNeeded": 2,
      "daysRemaining": 4
    },
    "summary": {
      "headline": "Your first weekly read is still collecting signal",
      "narrative": "You’re still inside this premium week, so Journal.IO is waiting for a little more texture before it turns the week into a real read.",
      "highlight": "Two active days are already on the board. Hit four and the week becomes eligible for AI insights."
    },
    "quickAnalysis": {
      "available": true,
      "title": "Quick Analysis is available now",
      "description": "Open any saved journal entry to get a short AI reflection while the weekly view is still collecting."
    }
  }
}
```

Insufficient response:

```json
{
  "success": true,
  "message": "Insights AI analysis loaded",
  "data": {
    "status": "insufficient",
    "window": {
      "startDate": "2026-04-11",
      "endDate": "2026-04-17",
      "label": "Apr 11 - Apr 17",
      "entryCount": 3,
      "activeDays": 3,
      "totalWords": 312
    },
    "progress": {
      "activeDays": 3,
      "minimumActiveDays": 4,
      "entriesNeeded": 1,
      "daysRemaining": 0
    },
    "summary": {
      "headline": "This week stayed a little too light for a full AI read",
      "narrative": "Journal.IO only turns a closed week into weekly insights when it has at least 4 active journal days to work from.",
      "highlight": "You still logged 3 active days, so the next week is close to being analysis-ready if you stay consistent."
    },
    "quickAnalysis": {
      "available": true,
      "title": "Quick Analysis can still help between weekly reports",
      "description": "Use it on any saved entry if you want a short read while the next full week is still building."
    }
  }
}
```

Ready response:

```json
{
  "success": true,
  "message": "Insights AI analysis loaded",
  "data": {
    "status": "ready",
    "window": {
      "startDate": "2026-03-26",
      "endDate": "2026-04-01",
      "label": "Mar 26 - Apr 1",
      "entryCount": 6,
      "activeDays": 5,
      "totalWords": 842
    },
    "freshness": {
      "generatedAt": "2026-04-01T09:05:00.000Z",
      "confidence": "high",
      "confidenceLabel": "Clearer weekly pattern",
      "note": "string"
    },
    "summary": {
      "headline": "Morning Routines kept shaping your week",
      "narrative": "string"
    },
    "patternTags": [
      {
        "label": "Routine Seeking",
        "tone": "amber"
      }
    ],
    "scoreboard": {
      "vibeLabel": "Steadier week",
      "vibeTone": "sage",
      "cards": [
        {
          "key": "activeDays",
          "label": "Active days",
          "value": "5/7",
          "tone": "sage"
        },
        {
          "key": "entries",
          "label": "Entries",
          "value": "6",
          "tone": "blue"
        }
      ]
    },
    "emotionTrend": {
      "headline": "Emotional pace across the week",
      "days": [
        {
          "dateKey": "2026-03-26",
          "label": "Thu",
          "moodLabel": "Good",
          "moodScore": 4,
          "entryCount": 1,
          "tone": "sage"
        }
      ]
    },
    "themeBreakdown": {
      "headline": "Themes that kept resurfacing",
      "items": [
        {
          "label": "Morning Routines",
          "count": 4,
          "percentage": 36,
          "tone": "coral"
        }
      ]
    },
    "signals": {
      "whatHelped": [
        {
          "title": "Consistency gave the week more shape",
          "description": "string",
          "evidence": ["5/7 active days", "6 entries"],
          "tone": "sage"
        }
      ],
      "whatDrained": [
        {
          "title": "Work Stress kept pulling focus",
          "description": "string",
          "evidence": ["3 mentions", "Work Stress"],
          "tone": "amber"
        }
      ],
      "whatKeptShowingUp": [
        {
          "title": "Morning Routines",
          "description": "string",
          "evidence": ["4 mentions", "36% topic share"],
          "tone": "coral"
        }
      ]
    },
    "patterns": [
      {
        "label": "Late-night spiral",
        "insight": "The behaviour and the trigger/feeling it connects to, in the user's own terms.",
        "evidence": ["11:40pm entry", "work deadline"],
        "nudge": "One gentle, practical, non-judgmental thing to try.",
        "tone": "coral"
      }
    ],
    "actionPlan": {
      "headline": "string",
      "steps": [
        {
          "title": "string",
          "description": "string",
          "focus": "string"
        }
      ]
    },
    "appSupport": {
      "headline": "string",
      "items": [
        {
          "title": "string",
          "description": "string"
        }
      ]
    }
  }
}
```

### `GET /insights/mind-map`

Returns the premium Mind Map payload used by the iOS-only `Mind Map` screen reached from the `AI Analysis` tab.

Request:

- required query param: `range=latest_week|monthly|all_time`
- optional header: `X-Client-Timezone`

Behavior:

- protected route
- returns `403` with error code `PREMIUM_REQUIRED` when the authenticated user is not premium
- `latest_week` uses the latest closed premium-week window in the user's local timezone; if no eligible closed window exists yet, the route returns `building`
- `monthly` aggregates the rolling **last 30 days** of safe writing; like the other windows it requires at least 4 active writing days plus enough clear writing before it returns `ready`, and its cache recomputes per day
- `all_time` aggregates the user's full safe writing history, including pre-premium entries
- `all_time` requires at least 4 active writing days plus enough clear writing before it returns `ready`
- the payload always uses the same 8 reflection regions and stable ids:
  - `planning_self_control`
  - `emotional_intensity`
  - `memory_meaning`
  - `body_inner_signals`
  - `conflict_attention`
  - `motivation_reward`
  - `relationships_perspective`
  - `self_reflection_identity`
- region scores are aggregated from **persisted per-entry scores** (see `GET /mind-map/entry/:journalId`): each entry is AI-scored across the 8 regions in the background at save time (falling back to a deterministic keyword score), and this route averages those stored per-entry scores across the window's clear entries. Entries with no stored row yet fall back to per-entry keyword scoring. This route itself does not make a new OpenAI request.
- each region also carries a neutral emphasis `trend` (`rising` | `steady` | `easing`) with a non-clinical `trendLabel`, computed by comparing the recent half of the user's clear scored entries against the earlier half. Trends never imply improvement or decline.
- each region additionally carries a `tier` band (`low` | `balanced` | `high` | `very_high`) with a human-readable `tierLabel`, and the ready payload carries a top-level `overallTier` (`{ tier, label, blurb }`, e.g. `Emerging Reflector` / `Balanced Reflector` / `Deeply Reflective` / `Highly Attuned`). Tiers describe how strongly the region shows up **versus a typical reflector** using fixed baseline thresholds — deterministic, band-only, never a number, percentile, or clinical judgement. They are computed from the region's pre-normalization weighted mean, so they read against the baseline rather than against the user's own strongest region. Older cached payloads without tiers normalize to the neutral `low` / `emerging` defaults client-side.
- the ready payload includes a top-level `focus` object (`headline`, `body`, `regionId`) with a supportive, non-clinical reflection prompt keyed off the most-rising region (or the strongest region when nothing is rising)
- the ready payload also includes an ordered `patterns` array of the **most recurring themes** across the window, aggregated from persisted per-entry insights (`entry_insights`). Each pattern is `{ id, label, rationale, evidenceQuote, occurrences, confidence }` — a therapist-style theme, the reason it was concluded, and the user's own supporting sentence. Patterns are ordered most-recurring first and are meant to render **after** the strongest region and **before** the remaining region scores. `evidenceQuote` is masked client-side when journal previews are hidden. Older cached payloads without `patterns` normalize to an empty list.
- before scoring, the backend strips prompt carryover, down-weights low-signal writing, and filters safety-sensitive text out of normal region ranking
- latest-week safety-sensitive windows return `support_first` without ranked regions
- all-history aggregation excludes safety-sensitive entries; it returns `support_first` only when no safe writing remains to map
- cache keys are scoped separately for latest-week and all-time reads and include timezone plus scorer version

Ready response:

```json
{
  "success": true,
  "message": "Your Mind Map is ready.",
  "data": {
    "status": "ready",
    "period": {
      "range": "latest_week",
      "label": "Jul 3 - Jul 9",
      "startDate": "2026-07-03",
      "endDate": "2026-07-09",
      "entryCount": 5,
      "activeDays": 4,
      "clearEntryCount": 4,
      "totalWords": 612,
      "minimumActiveDays": 4,
      "generatedAt": "2026-07-10T08:00:00.000Z"
    },
    "summary": {
      "headline": "Planning & Self-Control carried the strongest reflection signal",
      "narrative": "Across Jul 3 - Jul 9, your writing most often returned to planning and self-control patterns.",
      "note": "Brightness and pulse reflect recurring patterns in your writing, not literal brain activity."
    },
    "strongestRegionId": "planning_self_control",
    "patterns": [
      {
        "id": "protects-morning-focus",
        "label": "Protects morning focus",
        "rationale": "You keep returning to guarding your mornings for the work that matters.",
        "evidenceQuote": "I need to protect my morning better",
        "occurrences": 3,
        "confidence": 0.8
      }
    ],
    "regions": [
      {
        "id": "planning_self_control",
        "productLabel": "Planning & Self-Control",
        "brainRegionSubtitle": "Prefrontal Cortex",
        "signalScore": 0.84,
        "confidence": 0.79,
        "rank": 1,
        "intensity": "high",
        "shortInsight": "Your writing kept returning to structure, next steps, and follow-through.",
        "actionStep": "Try picking one small next step tonight and writing down the very first move it needs.",
        "evidenceSnippets": [
          "I stuck to the plan",
          "I want to keep this routine tomorrow"
        ],
        "trend": "rising",
        "trendLabel": "Planning & Self-Control has been showing up more in your recent writing.",
        "tier": "very_high",
        "tierLabel": "Very High"
      },
      {
        "id": "relationships_perspective",
        "productLabel": "Relationships & Perspective",
        "brainRegionSubtitle": "Social Brain / Temporoparietal Junction",
        "signalScore": 0.61,
        "confidence": 0.7,
        "rank": 2,
        "intensity": "moderate",
        "shortInsight": "Other people and social interpretation still showed up often in the week.",
        "actionStep": "Before your next hard conversation, try noting what you felt separately from what you assumed the other person thought.",
        "evidenceSnippets": ["I kept replaying that conversation"],
        "trend": "steady",
        "trendLabel": "Relationships & Perspective has stayed steady in your recent writing.",
        "tier": "balanced",
        "tierLabel": "Balanced"
      }
    ],
    "focus": {
      "headline": "What to focus on",
      "body": "You often write toward what's next. Noticing one small, kind next step can make the plan feel lighter.",
      "regionId": "planning_self_control"
    },
    "overallTier": {
      "tier": "deeply_reflective",
      "label": "Deeply Reflective",
      "blurb": "You go deeper than most journalers in a few areas, returning to them with real consistency."
    },
    "disclaimer": {
      "title": "Reflection signal only",
      "body": "This map reflects patterns in your writing, not a medical or brain-activity measurement."
    }
  }
}
```

Production responses include all 8 regions sorted by `rank`, each with `trend`/`trendLabel`/`tier`/`tierLabel`; the sample above is shortened for readability.

### `GET /insights/mind-map/region/:regionId/series`

Returns the **development graph** for a single reflection region across a window, used by the region detail modal on the iOS Mind Map screen. Reads persisted per-entry scores directly and makes no OpenAI request.

Request:

- protected route; path param `regionId` (one of the 8 stable region ids)
- required query param: `range=latest_week|monthly|all_time`
- optional header: `X-Client-Timezone`

Behavior:

- same Premium gate as the global map: `403 PREMIUM_REQUIRED`
- returns `400` when `regionId` is not one of the 8 known regions
- averages the region's per-entry `score` across the window's clear entries, bucketed by **day** for `latest_week` / `monthly` and by **week** (UTC, Monday-anchored) for `all_time`, so the line stays readable at any range
- sparse or empty windows return a short (or empty) `points` list; the client renders a flat/placeholder line

Ready response:

```json
{
  "success": true,
  "message": "Region development series is ready.",
  "data": {
    "regionId": "planning_self_control",
    "productLabel": "Planning & Self-Control",
    "brainRegionSubtitle": "Prefrontal Cortex",
    "range": "monthly",
    "bucket": "day",
    "startDate": "2026-06-11",
    "endDate": "2026-07-10",
    "points": [
      { "dateKey": "2026-06-14", "label": "Jun 14", "value": 0.42 },
      { "dateKey": "2026-06-21", "label": "Jun 21", "value": 0.66 }
    ]
  }
}
```

### `GET /mind-map/entry/:journalId`

Returns the per-entry Mind Map for a single journal entry, used by the iOS `EntryMindMapScreen` shown right after saving an entry (and reachable for any owned entry).

Request:

- protected route; path param `journalId`
- optional header: `X-Client-Timezone` (not required)

Behavior:

- same Premium gate as the global map: `403 PREMIUM_REQUIRED`
- returns `404` when the entry is not found for the authenticated user (ownership enforced)
- each journal entry is scored across the 8 regions at save time: a deterministic heuristic row is written synchronously (so the map is instantly available), then a background AI pass upgrades it. This route reads the persisted score, computing + persisting a heuristic row on the fly if none exists yet.
- `ready` responses include `source` (`ai` | `heuristic`) and `refining` (`true` while still heuristic-only). The client refetches once quietly to pick up the AI upgrade.
- safety-sensitive entries return `support_first` without ranked regions.

Ready response `data`:

```json
{
  "status": "ready",
  "journalId": "664f...",
  "entryType": "open_ended",
  "source": "ai",
  "refining": false,
  "strongestRegionId": "emotional_intensity",
  "patterns": [
    {
      "id": "overwhelm-under-deadlines",
      "label": "Overwhelm under deadlines",
      "rationale": "Pressure spikes when work stacks up faster than you can clear it.",
      "evidenceQuote": "felt overwhelmed by everything due",
      "confidence": 0.6
    }
  ],
  "regions": [
    {
      "id": "emotional_intensity",
      "productLabel": "Emotional Intensity",
      "brainRegionSubtitle": "Amygdala",
      "signalScore": 0.82,
      "confidence": 0.64,
      "rank": 1,
      "intensity": "high",
      "shortInsight": "This region picked up emotional charge around \"felt overwhelmed\".",
      "evidenceSnippets": ["felt overwhelmed today"],
      "tier": "very_high",
      "tierLabel": "Very High"
    }
  ],
  "overallTier": {
    "tier": "deeply_reflective",
    "label": "Deeply Reflective",
    "blurb": "You go deeper than most journalers in a few areas, returning to them with real consistency."
  },
  "summary": {
    "headline": "Emotional Intensity carried the strongest signal in this entry",
    "narrative": "This entry leaned most into emotional intensity patterns. Every region still adds to your Mind Map as you keep writing.",
    "seedText": "This reflection has added its signal to your Mind Map."
  },
  "disclaimer": {
    "title": "Reflection signal only",
    "body": "This map reflects patterns in your writing, not a medical or brain-activity measurement."
  }
}
```

Production responses include all 8 regions sorted by `rank`, each with a `tier`/`tierLabel` band, plus a top-level `overallTier`; the sample above is shortened. Per-entry tiers are computed the same way as the aggregate map, banded against the fixed baseline (for a single entry, off that entry's region score). The mobile clients render tiers but no longer render the `disclaimer` block.

Building response:

```json
{
  "success": true,
  "message": "Your Mind Map is ready.",
  "data": {
    "status": "building",
    "period": {
      "range": "all_time",
      "label": "All reflections",
      "startDate": "2026-06-01",
      "endDate": "2026-07-13",
      "entryCount": 3,
      "activeDays": 3,
      "clearEntryCount": 2,
      "totalWords": 38,
      "minimumActiveDays": 4,
      "generatedAt": "2026-07-13T09:30:00.000Z"
    },
    "summary": {
      "headline": "Your Mind Map is still building",
      "narrative": "Journal.IO needs at least 4 active writing days and a little more clear writing before it can rank reflection regions across all reflections.",
      "note": "Keep adding honest entries in your own words and the map will fill in without inventing activity."
    },
    "progress": {
      "activeDays": 3,
      "minimumActiveDays": 4,
      "clearEntryCount": 2,
      "entriesNeeded": 1,
      "daysRemaining": null
    },
    "disclaimer": {
      "title": "Reflection signal only",
      "body": "This map reflects patterns in your writing, not a medical or brain-activity measurement."
    }
  }
}
```

Support-first response:

```json
{
  "success": true,
  "message": "Your Mind Map is ready.",
  "data": {
    "status": "support_first",
    "period": {
      "range": "latest_week",
      "label": "Jul 3 - Jul 9",
      "startDate": "2026-07-03",
      "endDate": "2026-07-09",
      "entryCount": 2,
      "activeDays": 2,
      "clearEntryCount": 2,
      "totalWords": 121,
      "minimumActiveDays": 4,
      "generatedAt": "2026-07-10T08:00:00.000Z"
    },
    "summary": {
      "headline": "This week needs a support-first read",
      "narrative": "Journal.IO noticed elevated-risk language in the latest closed premium week, so the Mind Map is paused instead of ranking reflection regions.",
      "note": "Support-first handling takes priority over pattern scoring in this view."
    },
    "support": {
      "headline": "A calmer next step matters more than a ranked map right now.",
      "body": "If this writing reflects immediate risk or feeling unsafe, please reach out to local emergency or crisis support now.",
      "note": "Journal.IO hides normal region scoring for safety-sensitive weekly writing."
    },
    "disclaimer": {
      "title": "Reflection signal only",
      "body": "This map reflects patterns in your writing, not a medical or brain-activity measurement."
    }
  }
}
```

Behavior:

- protected route
- reads from the same per-user cached `insights` document as the overview route
- cache is marked stale by journal create/edit/delete/favorite changes and mood check-ins
- if the AI-analysis cache is stale or missing, the backend recomputes it from the relevant premium-week window’s journal content, tags, and mood check-ins, then stores the result back on the `insights` document
- the primary mobile surface is signal-first and visual-first: summary, scoreboard, emotion trend, theme breakdown, signals, behavioural `patterns`, action plan, and app support
- the `patterns` array (behaviour↔trigger patterns with the user's own evidence and one gentle nudge, capped at 1-3) **replaces** the former `bigFive` and `darkTriad` personality-trait fields, which are no longer generated or returned. The weekly enhancement grounds `patterns` in persisted `entry_insights` themes, recurrence-ranked patterns, rolling long-term memory, mood-by-day, and per-entry hour/weekday; safety-sensitive weeks return an empty `patterns` array. `actionPlan.steps` is fixed at exactly 2. The response cache key is versioned (`WEEKLY_AI_ANALYSIS_VERSION`, currently `3`)
- output language must remain supportive, uncertainty-aware, non-clinical, and grounded in what the user actually wrote that week

## 4.5 Plans and Reminders

- `POST /plans/generate`
- `GET /plans/current`
- `PATCH /plans/current`
- `GET /reminders`
- `POST /reminders`
- `PATCH /reminders/{reminderId}`
- `DELETE /reminders/{reminderId}`

`GET /reminders`

Response:

```json
{
  "success": true,
  "message": "Reminders loaded",
  "data": {
    "reminders": [
      {
        "reminderId": "reminder-123",
        "type": "daily_journal",
        "enabled": true,
        "time": "20:00",
        "timezone": "Asia/Kolkata",
        "skipIfCompletedToday": true,
        "includeWeekends": false,
        "streakWarnings": true,
        "createdAt": "2026-04-03T10:00:00.000Z",
        "updatedAt": "2026-04-03T10:00:00.000Z"
      }
    ]
  }
}
```

Behavior:

- protected route
- returns the authenticated user's stored reminder records
- MVP mobile currently reads the `daily_journal` reminder from this list and uses local device scheduling for delivery

`POST /reminders`

Request:

```json
{
  "type": "daily_journal",
  "enabled": true,
  "time": "20:00",
  "timezone": "Asia/Kolkata",
  "skipIfCompletedToday": true,
  "includeWeekends": false,
  "streakWarnings": true
}
```

Response:

```json
{
  "success": true,
  "message": "Reminder created",
  "data": {
    "reminderId": "reminder-123",
    "type": "daily_journal",
    "enabled": true,
    "time": "20:00",
    "timezone": "Asia/Kolkata",
    "skipIfCompletedToday": true,
    "includeWeekends": false,
    "streakWarnings": true,
    "createdAt": "2026-04-03T10:00:00.000Z",
    "updatedAt": "2026-04-03T10:00:00.000Z"
  }
}
```

Behavior:

- protected route
- validates `time` in `HH:MM` 24-hour format
- validates ownership through the authenticated user
- enforces one reminder per `{ userId, type }` pair

`PATCH /reminders/{reminderId}`

Request:

```json
{
  "enabled": false,
  "includeWeekends": true
}
```

Response:

```json
{
  "success": true,
  "message": "Reminder updated",
  "data": {
    "reminderId": "reminder-123",
    "type": "daily_journal",
    "enabled": false,
    "time": "20:00",
    "timezone": "Asia/Kolkata",
    "skipIfCompletedToday": true,
    "includeWeekends": true,
    "streakWarnings": true,
    "createdAt": "2026-04-03T10:00:00.000Z",
    "updatedAt": "2026-04-03T10:05:00.000Z"
  }
}
```

Behavior:

- protected route
- requires at least one mutable field in the request body
- updates only the authenticated user's reminder

`DELETE /reminders/{reminderId}`

Response:

```json
{
  "success": true,
  "message": "Reminder deleted",
  "data": {
    "reminderId": "reminder-123"
  }
}
```

Behavior:

- protected route
- deletes only the authenticated user's reminder record

## 4.6 Streaks

- `GET /streaks/current`
- `GET /streaks/history`

`GET /streaks/current`

Response:

```json
{
  "success": true,
  "message": "Current streak loaded",
  "data": {
    "currentStreak": 12,
    "bestStreak": 18,
    "thisMonthEntries": 9,
    "totalEntries": 54,
    "lastEntryDateKey": "2026-07-24",
    "hasEntryToday": true,
    "achievements": [
      {
        "key": "first-entry",
        "title": "First Entry",
        "description": "Started your journey",
        "unlocked": true
      },
      {
        "key": "7-day-streak",
        "title": "7-Day Streak",
        "description": "Wrote for a week",
        "unlocked": true
      }
    ]
  }
}
```

Behavior:

- protected route
- derives streaks from the authenticated user’s journal entry dates
- `currentStreak` counts consecutive UTC calendar days with at least one journal entry, anchored to today or yesterday
- `bestStreak` is the longest historical consecutive run of journal-entry days
- `thisMonthEntries` counts all entries written in the current UTC calendar month
- `totalEntries` counts all journal entries for the user
- `lastEntryDateKey` is the UTC date key (`YYYY-MM-DD`) of the most recent journal entry, or `null` when the user has no entries; the Streaks home-screen widget uses it to self-correct a lapsed streak across midnight without a network call
- `hasEntryToday` is `true` when at least one entry exists for today's UTC date key
- achievements are backend-derived milestone unlocks so the mobile screen can stay presentation-only

`GET /streaks/history?days=30`

Response:

```json
{
  "success": true,
  "message": "Streak history loaded",
  "data": {
    "days": [
      {
        "dateKey": "2026-04-01",
        "count": 1,
        "hasEntry": true,
        "isToday": true
      }
    ]
  }
}
```

Behavior:

- protected route
- `days` is optional and defaults to `30`
- allowed range for `days` is `1..365`
- returns one row per day in the requested window, including empty days
- the mobile 30-day activity grid should consume this response directly without local hardcoded streak data

## 4.7 Privacy

### `POST /privacy/export`

Export the authenticated user's account data, journal entries, mood check-ins, and derived profile records.

Each exported journal keeps user-authored `tags` separate from the AI-derived
`detectedTopics` and `detectedMood` fields and includes the normalized immutable
`entryKind` value. Eligible journals also include their versioned
`sessionAnalysisSnapshot` when one has been generated.

Requires `Authorization` header.

Returns:

```json
{
  "success": true,
  "message": "Data export generated",
  "data": {
    "exportedAt": "2026-04-03T12:00:00.000Z",
    "account": {
      "userId": "user-123",
      "name": "Alex",
      "email": "alex@example.com"
    },
    "journalEntries": [],
    "moodCheckIns": [],
    "reminders": [],
    "insights": null,
    "streak": null,
    "stats": null
  }
}
```

Behavior:

- the exported `insights` object may include cached weekly AI-analysis data plus cached Mind Map payloads under `mindMapLatestWeek` and `mindMapAllTime`
- Mind Map export fields also include each cache's stale flag, computed timestamp, and cache key
- the export also includes a `mindMapEntryScores` array — the persisted per-entry Mind Map scores (region scores, dominant region, source, scorer version, timestamps) used to build the global map
- each journal export includes its full `sessionAnalysisSnapshot` (`analysis`, `source`, `version`, and `generatedAt`) when present

### `POST /privacy/delete-request`

Delete the authenticated user's account and all owned profile data.

Requires `Authorization` header.

Returns:

```json
{
  "success": true,
  "message": "Account deleted successfully",
  "data": {
    "deletedAccount": true,
    "deletedJournals": 12,
    "deletedMoodCheckIns": 30,
    "deletedReminders": 1,
    "deletedInsights": 1,
    "deletedStreaks": 1,
    "deletedStats": 1
  }
}
```

# 5) Behavioral Data Shapes (Contract Guidance)

Journal creation and updates should support the behavioral fields used by current designs:

```json
{
  "entryText": "string",
  "entryMode": "free|guided|mixed",
  "moodScore": 1,
  "stressScore": 1,
  "energyScore": 1,
  "sleepHours": 7.5,
  "sleepQuality": 1,
  "tags": ["work", "gratitude"],
  "clientCreatedAt": "ISO-8601",
  "timezone": "Asia/Kolkata"
}
```

Field naming should remain consistent across request validators, controllers, services, and frontend services.

---

# 6) Insight Safety and Language Requirements

Any endpoint returning AI-generated insight summaries must avoid diagnostic language and remain uncertainty-aware.
Safety-sensitive content must be handled as support-first content, not normal personality or pattern analysis. The journal entry can remain saved, but analysis copy must avoid diagnostic labels, harmful instructions, or certainty.

Allowed tone examples:

- "journal entries suggest"
- "appears associated with"
- "a recurring pattern may be"

Not allowed:

- medical certainty
- psychiatric labeling
- diagnosis wording
