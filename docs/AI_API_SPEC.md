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

- the implemented backend supports phone OTP, email-first auth, and Google OAuth
- the current frontend auth flow uses the email-first endpoints below
- the mobile Google sign-in flow now posts the Google ID token to `POST /auth/google/mobile`
- the phone OTP endpoints remain available as a legacy auth path during migration

### `POST /auth/send_otp`

Send a one-time passcode for phone login/signup.

Request:

```json
{
  "phoneNumber": "+15551234567"
}
```

Success `data`:

```json
{
  "phoneNumber": "+15551234567",
  "expiresInSeconds": 300,
  "debugOtp": "123456"
}
```

`debugOtp` is for safe local development/test workflows only.

### `POST /auth/resend_otp`

Resend a one-time passcode for phone login/signup.

Request:

```json
{
  "phoneNumber": "+15551234567"
}
```

Success `data`:

```json
{
  "phoneNumber": "+15551234567",
  "expiresInSeconds": 300,
  "debugOtp": "123456"
}
```

`debugOtp` is for safe local development/test workflows only.

### `POST /auth/verify_otp`

Verify OTP and create/login account.

Request:

```json
{
  "phoneNumber": "+15551234567",
  "otp": "123456",
  "name": "Alex",
  "goals": ["Daily Reflection", "Personal Growth"],
  "onboardingCompleted": true
}
```

`name` is optional and typically passed for new-user onboarding completion.
`goals` is optional and carries the selected onboarding goals into the authenticated session.
`onboardingCompleted` is optional and should be set when the onboarding flow has already been completed so the backend can persist that state.

Success `data`:

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "user": {
    "userId": "string",
    "name": "Alex",
    "phoneNumber": "+15551234567",
    "email": null,
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

Persist the authenticated user's premium access state after purchase completion or restore.

Request:

```json
{
  "isPremium": true
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
  "premiumPlanKey": "yearly",
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

## 3.2.1 Paywall Module (`/paywall`)

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
      "price": "$4.99",
      "priceSuffix": "/week",
      "subtitle": "Flexible access",
      "badge": null,
      "highlight": null,
      "sortOrder": 1,
      "revenueCatOfferingId": "journalio_offering_dev",
      "revenueCatPackageId": "$rc_weekly",
      "purchasedUsersCount": 0,
      "purchaseLimit": null
    },
    {
      "key": "yearly",
      "title": "YEARLY",
      "price": "$99.99",
      "priceSuffix": "/year",
      "subtitle": "Best for steady journaling",
      "badge": "Most Value",
      "highlight": "$8.33/month",
      "sortOrder": 3,
      "revenueCatOfferingId": "journalio_offering_dev",
      "revenueCatPackageId": "$rc_annual",
      "purchasedUsersCount": 0,
      "purchaseLimit": null
    }
  ]
}
```

Behavior notes:

- returns `shouldShow: false` for premium users
- `post_auth` resolves to the standard `weekly-standard` template; the dedicated lifetime offer is a separate frontend surface that is shown only after the user dismisses that first post-auth paywall
- may return `shouldShow: false` for interruptive placements when thresholds, cooldowns, caps, or randomization do not pass
- when the lifetime offering reaches its purchase limit, the backend falls back from `lifetime-launch` to its configured fallback template automatically
- `featureList` is an ordered array of feature-card objects with `title`, `body`, and optional `footer`
- `visibleOfferingKeys` controls which offering cards the frontend renders for the active template; a template may show one card or multiple cards
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

Persist the purchased premium plan after a successful RevenueCat purchase or restore.

Request:

```json
{
  "offeringKey": "lifetime",
  "revenueCatOfferingId": "journalio_offering_dev",
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
  "avatarColor": "#8E4636",
  "journalingGoals": ["Daily Reflection", "Personal Growth"],
  "profileSetupCompleted": true,
  "onboardingCompleted": true,
  "profilePic": null,
  "aiOptIn": true
}
```

Behavior notes:

- sets the authenticated user premium state and plan attribution
- increments the lifetime offering purchase counter only once per user
- should be the primary backend sync path after RevenueCat purchase or restore
- `PATCH /users/premium-status` remains available as a compatibility fallback for boolean-only entitlement reconciliation

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
  "headline": "Work stood out in this bad check-in",
  "summary": "This entry may indicate work pressure was closely tied to how you felt here.",
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
  "nextStep": "In your next entry, separate what felt in your control today from what can wait until later.",
  "generatedAt": "2026-04-06T09:20:00.000Z"
}
```

Notes:

- protected route
- returns `403` with error code `PREMIUM_REQUIRED` when the authenticated user is not premium
- returns `403` with error code `QUICK_ANALYSIS_DISABLED` when the authenticated user has AI turned off
- reads one saved journal only; it does not depend on the weekly analysis cache
- when OpenAI is available for an eligible user, the backend refines the short reflection with OpenAI
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

### `POST /auth/register_from_googleOAuth`

Google OAuth remains a supported alternate auth path and should continue to return the same session payload shape as other sign-in flows.

### `POST /auth/google/mobile`

The mobile client obtains a Google `idToken`, posts it to the backend, and receives the same Journal.IO session payload used by the other sign-in flows. The backend verifies the Google token before linking or creating the user account.

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
- during the first 7 days after account creation for an eligible premium user, the route returns a `pending` warm-up payload instead of a weekly analysis so the app can prompt the user to keep journaling consistently
- when OpenAI is configured, the backend uses the cached deterministic weekly signal as a baseline and asks OpenAI to generate the user-facing summary, pattern tags, action plan, and support guidance before caching the final response
- if OpenAI is unavailable, the endpoint still returns the deterministic weekly analysis payload

Pending response:

```json
{
  "success": true,
  "message": "Insights AI analysis loaded",
  "data": {
    "status": "pending",
    "readiness": {
      "joinedAt": "2026-04-03T00:00:00.000Z",
      "eligibleOn": "2026-04-10T00:00:00.000Z",
      "daysSinceSignup": 3,
      "daysUntilReady": 4,
      "totalEntries": 2,
      "activeDays": 2,
      "currentStreak": 2
    },
    "summary": {
      "headline": "Weekly analysis is warming up",
      "narrative": "Keep journaling for 4 more days so Journal.IO can build a fuller week of context.",
      "highlight": "Your 2-day streak is already helping the first weekly analysis feel more grounded."
    },
    "quickAnalysis": {
      "available": true,
      "title": "Quick Analysis is available now",
      "description": "Open any saved journal entry to generate a short entry-by-entry AI reflection while the weekly analysis is still warming up."
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
      "headline": "Conscientiousness stood out most this week",
      "narrative": "string",
      "highlight": "string"
    },
    "patternTags": [
      {
        "label": "Routine Seeking",
        "tone": "amber"
      }
    ],
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
- if the weekly AI-analysis cache is stale or missing, the backend recomputes it from recent journal content, recent tags, and recent mood check-ins, then stores the result back on the `insights` document
- output language must remain supportive, uncertainty-aware, and non-clinical even when surfacing Big Five or dark-triad-adjacent signals

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

Allowed tone examples:

- "journal entries suggest"
- "appears associated with"
- "a recurring pattern may be"

Not allowed:

- medical certainty
- psychiatric labeling
- diagnosis wording
