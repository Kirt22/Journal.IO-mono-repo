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
  "avatarColor": "#8E4636",
  "journalingGoals": ["Daily Reflection", "Personal Growth"],
  "profileSetupCompleted": true,
  "onboardingCompleted": true,
  "profilePic": null,
  "aiOptIn": true
}
```

Both routes require authentication.

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

Returns the cached weekly AI-analysis payload used by the mobile `AI Analysis` tab. The Home AI insight card also consumes this endpoint and derives short rotating snippets from the same response.

Behavior:

- protected route
- returns `403` with error code `AI_ANALYSIS_DISABLED` when the authenticated user has `onboardingContext.aiOptIn === false`
- overview insights remain available even when AI analysis is disabled

Response:

```json
{
  "success": true,
  "message": "Insights AI analysis loaded",
  "data": {
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
