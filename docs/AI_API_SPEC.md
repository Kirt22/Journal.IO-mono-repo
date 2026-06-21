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

---

# 3) Implemented Endpoints (Current Backend)

## 3.1 Auth Module (`/auth`)

Current backend reality:

- the implemented backend supports email-first auth, Google OAuth, and Sign in with Apple
- the current frontend auth flow uses the email-first endpoints below
- the mobile Google sign-in flow now posts the Google ID token to `POST /auth/google/mobile`
- the mobile Apple sign-in flow posts the Apple identity token and raw nonce to `POST /auth/apple/mobile`
- the current frontend password-reset flow uses `POST /auth/request_password_reset` and `POST /auth/reset_password`

### `POST /auth/google/mobile`

Mobile Google sign-in.

Request:

```json
{
  "idToken": "google_id_token",
  "onboardingContext": {
    "goals": ["Daily Reflection"],
    "reminderPreference": "Evening",
    "aiOptIn": false,
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
    "profilePic": "https://...",
    "aiOptIn": false
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
    "aiOptIn": false,
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
    "profilePic": "https://...",
    "aiOptIn": true
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

### `POST /onboarding/demo-analysis`

Generate the onboarding first-entry demo reflection before auth. This endpoint is intentionally public, does not persist the submitted text, and does not run the stored journal AI pipeline.

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
  "profilePic": null,
  "aiOptIn": true
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
  "profilePic": null,
  "aiOptIn": true
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
  "profilePic": null,
  "aiOptIn": true
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

---

## 3.3 Mood Tracker Module (`/mood`)

The mood tracker is separate from journal entries. It stores only the authenticated user, the mood value, and the day-specific check-in record.

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

## 3.4 Journal Module (`/journal`)

### `GET /journal/get_journals`

Get authenticated user journals.

Response `data`:

```json
[
  {
    "_id": "string",
    "title": "string",
    "content": "string",
    "type": "journal",
    "aiPrompt": "string",
    "tags": ["string"],
    "images": ["string"],
    "isFavorite": false,
    "createdAt": "2026-03-30T12:00:00.000Z",
    "updatedAt": "2026-03-30T12:00:00.000Z"
  }
]
```

### `POST /journal/create_journal`

Create journal entry.

Request:

```json
{
  "title": "Morning note",
  "content": "Today felt steady and clear.",
  "type": "journal",
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
  "type": "journal",
  "aiPrompt": "What are you grateful for today?",
  "tags": ["reflection"],
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
- when the authenticated user is premium, has AI enabled, and the backend is configured with OpenAI, tag suggestions are chosen through OpenAI against Journal.IO's allowed tag set
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
  "generatedAt": "2026-04-06T09:20:00.000Z"
}
```

Notes:

- protected route
- returns `403` with error code `PREMIUM_REQUIRED` when the authenticated user is not premium
- returns `403` with error code `QUICK_ANALYSIS_DISABLED` when the authenticated user has AI turned off
- reads one saved journal only; it does not depend on the weekly analysis cache
- the response is visual-first and signal-first for the entry-detail screen: summary, compact scorecard, pattern tags, three signal cards, and one grounded next step
- the backend strips any saved `aiPrompt` text from the journal before reading it so the prompt itself is not mistaken for the user's reflection
- if the remaining text is too short, too noisy, or obviously prompt-led, the response stays intentionally light and surfaces that as a low-signal read instead of forcing a stronger topic or personality interpretation
- if the entry may involve self-harm, suicide risk, or harm to another person, the entry remains readable but quick analysis switches to support-first copy, avoids normal pattern or personality interpretation, and does not ask OpenAI to refine the entry
- when OpenAI is available for an eligible user, the backend refines the single-entry reflection with OpenAI
- if OpenAI is unavailable, the backend falls back to a deterministic, non-clinical quick reflection

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
  "type": "journal",
  "aiPrompt": "string",
  "tags": ["string"],
  "images": ["string"],
  "isFavorite": false,
  "createdAt": "2026-03-30T12:00:00.000Z",
  "updatedAt": "2026-03-30T12:00:00.000Z"
}
```

### `POST /journal/edit_journal`

Edit one journal entry.

Request:

```json
{
  "journalId": "string",
  "title": "Updated title",
  "content": "Updated content",
  "type": "journal",
  "aiPrompt": "What are you grateful for today?",
  "images": [],
  "tags": ["reflection", "growth"],
  "isFavorite": true
}
```

Success `data`:

```json
{
  "_id": "string",
  "title": "Updated title",
  "content": "Updated content",
  "type": "journal",
  "aiPrompt": "What are you grateful for today?",
  "tags": ["reflection", "growth"],
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
  "type": "journal",
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
- when the user is premium, has AI enabled, and the backend has OpenAI configured, the prompt list is freshly generated through OpenAI from recent writing patterns and recent entry excerpts
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
    "aiOptIn": true,
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
    "profilePic": null,
    "aiOptIn": true
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
    "aiOptIn": false,
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
    "profilePic": null,
    "aiOptIn": true
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
- returns `403` with error code `AI_ANALYSIS_DISABLED` when the authenticated user has `onboardingContext.aiOptIn === false`
- overview insights remain available even when AI analysis is disabled
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
      "narrative": "string",
      "highlight": "string"
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
    "bigFive": [
      {
        "trait": "conscientiousness",
        "label": "Conscientiousness",
        "score": 74,
        "band": "pronounced",
        "description": "string",
        "evidenceTags": ["4-day streak", "Routine"]
      }
    ],
    "darkTriad": [
      {
        "trait": "machiavellianism",
        "label": "Machiavellianism",
        "supportiveLabel": "Control-seeking signal",
        "score": 42,
        "band": "watch",
        "description": "string",
        "supportTip": "string"
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

Behavior:

- protected route
- reads from the same per-user cached `insights` document as the overview route
- cache is marked stale by journal create/edit/delete/favorite changes and mood check-ins
- if the AI-analysis cache is stale or missing, the backend recomputes it from the relevant premium-week window’s journal content, tags, and mood check-ins, then stores the result back on the `insights` document
- the primary mobile surface is signal-first and visual-first: summary, scoreboard, emotion trend, theme breakdown, signals, action plan, and app support
- legacy `bigFive` and `darkTriad` fields may still be present for continuity, but they are no longer the primary mobile framing
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

### `PATCH /privacy/ai-opt-out`

Update the authenticated user's AI usage preference.

Request:

```json
{
  "aiOptOut": true
}
```

Returns:

```json
{
  "success": true,
  "message": "AI preference updated",
  "data": {
    "aiOptIn": false
  }
}
```

Behavior:

- returns `403` with error code `PREMIUM_REQUIRED` when the authenticated user is not premium
- sets `onboardingContext.aiOptIn` for the authenticated user
- when opt-out is enabled, clears any cached weekly AI analysis from the `insights` document

---

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
