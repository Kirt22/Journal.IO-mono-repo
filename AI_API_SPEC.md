# journal.io API Specification

This document defines the REST API contract for the journal.io backend.

All endpoints follow REST principles and return JSON responses.

---

# Base URL

/api/v1

---

# Standard Response Format

All responses must follow this structure.

Success Response

{
success: true,
message: string,
data: object | array
}

Error Response

{
success: false,
message: string,
error?: object
}

---

# Authentication

Authentication uses JWT tokens.

Authorization header format

Authorization: Bearer {access_token}

---

# AUTH MODULE

## POST /auth/signup

Creates a new user account.

Request Body

{
email: string,
password: string,
name: string
}

Response

{
success: true,
message: "User created",
data: {
userId,
email,
name
}
}

---

## POST /auth/login

Authenticates a user.

Request Body

{
email: string,
password: string
}

Response

{
success: true,
message: "Login successful",
data: {
accessToken,
refreshToken,
user
}
}

---

## POST /auth/refresh

Generates a new access token.

Request Body

{
refreshToken: string
}

---

## POST /auth/logout

Invalidates user session.

Requires authentication.

---

# USER MODULE

## GET /users/profile

Returns current user profile.

Response

{
success: true,
data: {
userId,
name,
email,
createdAt
}
}

---

## PATCH /users/profile

Updates user profile.

Request Body

{
name?: string
}

---

## DELETE /users/profile

Deletes user account permanently.

---

# JOURNAL MODULE

## POST /journals

Creates a new journal entry.

Request Body

{
entry_text: string,
entry_mode: "free" | "guided" | "mixed",
mood_score: number,
stress_score: number,
energy_score: number,
sleep_hours: number,
sleep_quality: number,
tags: string[],
client_created_at: date,
timezone: string
}

Response

{
success: true,
message: "Journal entry created",
data: {
journalId
}
}

---

## GET /journals

Returns paginated journal list.

Query Params

from
to
cursor
limit

---

## GET /journals/{journalId}

Returns a single journal entry.

---

## PATCH /journals/{journalId}

Updates a journal entry.

---

## DELETE /journals/{journalId}

Deletes a journal entry.

---

# PROMPTS MODULE

## GET /prompts/daily

Returns daily reflection prompts.

Response

{
prompts: [
"What happened today?",
"How did you feel?",
"What challenged you?"
]
}

---

## POST /prompts/answer

Stores answer to guided prompt.

---

## GET /prompts/history

Returns previous prompt responses.

---

# INSIGHTS MODULE

## GET /insights/overview

Returns behavioral insight summary.

Example

{
averageMood,
stressTrend,
topEmotions,
topThemes
}

---

## GET /insights/trends

Returns time-series metrics.

Query

metric
from
to

Metrics

mood
stress
energy

---

## GET /insights/patterns

Returns detected behavioral patterns.

Example

{
pattern: "Work stress",
frequency: 6,
confidence: "medium"
}

---

## GET /insights/traits

Returns personality tendency indicators.

These are non-clinical signals derived from journal language.

---

## GET /insights/explain/{insightId}

Returns explanation of a generated insight.

---

# PLANS MODULE

## POST /plans/generate

Generates weekly action plan.

Input

date range

Output

3–5 improvement steps.

---

## GET /plans/latest

Returns most recent action plan.

---

## GET /plans/{planId}

Returns specific plan.

---

## POST /plans/{planId}/feedback

User feedback on plan usefulness.

---

## POST /plans/{planId}/mark-step

Marks action step as completed.

---

# REMINDERS MODULE

## POST /reminders

Creates reminder.

Example

Daily journaling reminder.

---

## GET /reminders

Returns user reminders.

---

## PATCH /reminders/{id}

Updates reminder.

---

## DELETE /reminders/{id}

Deletes reminder.

---

# STREAK MODULE

## GET /streaks

Returns journaling streak information.

Example

{
currentStreak,
longestStreak
}

---

# SAFETY MODULE

## GET /safety/status

Returns safety risk status.

---

## POST /safety/check

Runs manual safety check.

---

## GET /resources/crisis

Returns country-specific crisis resources.

Example

country=IN

---

# PRIVACY MODULE

## POST /privacy/export

Exports user data.

---

## POST /privacy/delete-request

Deletes all user data.

---

# ADMIN MODULE

Internal monitoring APIs.

## GET /admin/queues

Queue health status.

---

## GET /admin/model-evals

AI model evaluation logs.

---

## GET /admin/safety-flags

Entries flagged for risk signals.

---

## POST /admin/interventions/reindex

Reindex intervention database.
