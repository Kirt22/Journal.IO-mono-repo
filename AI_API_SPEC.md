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

- the implemented backend still uses phone OTP plus Google OAuth
- the latest Figma design has moved to email-first auth
- the email auth contract is documented in the design-aligned target section below and should not be treated as already implemented until the backend/frontend migration lands

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
  "goals": ["Daily Reflection", "Personal Growth"]
}
```

`name` is optional and typically passed for new-user onboarding completion.
`goals` is optional and carries the selected onboarding goals into the authenticated session.

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
    "profilePic": null
  },
  "isNewUser": true
}
```

### `POST /auth/register_from_googleOAuth`

Google OAuth-based login/signup.

Request:

```json
{
  "googleIdToken": "token",
  "googleUserId": "optional_google_sub",
  "email": "alex@gmail.com",
  "name": "Alex",
  "profilePic": "https://..."
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
  "profilePic": null
}
```

Both routes require authentication.

---

## 3.3 Journal Module (`/journal`)

### `GET /journal/get_journals`

Get authenticated user journals.

### `POST /journal/create_journal`

Create journal entry.

### `GET /journal/get_journal_details`

Get details for one journal entry.

### `POST /journal/edit_journal`

Edit one journal entry.

### `DELETE /journal/delete_journal`

Delete one journal entry.

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
  "code": "123456"
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
  "password": "strong-password"
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
    "profilePic": null
  }
}
```

### `POST /auth/register_from_googleOAuth`

Google OAuth remains a supported alternate auth path and should continue to return the same session payload shape as other sign-in flows.

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
- `GET /insights/trends`
- `GET /insights/patterns`
- `GET /insights/traits`
- `GET /insights/explain/{insightId}`

## 4.5 Plans and Reminders

- `POST /plans/generate`
- `GET /plans/current`
- `PATCH /plans/current`
- `GET /reminders`
- `POST /reminders`
- `PATCH /reminders/{reminderId}`
- `DELETE /reminders/{reminderId}`

## 4.6 Streaks

- `GET /streaks/current`
- `GET /streaks/history`

## 4.7 Privacy

- `POST /privacy/export`
- `POST /privacy/delete-request`
- `PATCH /privacy/ai-opt-out`

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
