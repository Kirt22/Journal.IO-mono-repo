# Security Model

Journal.IO handles sensitive personal journaling content and must enforce strong privacy defaults.

---

# 1) Core Security Posture

- encryption in transit: HTTPS + TLS 1.3
- encryption at rest: AES-256-capable storage controls
- strict authentication and data ownership checks
- no cross-user data leakage

---

# 2) Why E2EE Is Not Default in AI Mode

Server-side AI analysis requires server access to journal text.

Therefore:

- end-to-end encryption is not compatible with AI-enabled journaling in current MVP

Future optional mode may support private E2EE with AI disabled.

---

# 3) Authentication and Session Security

Minimum requirements:

- JWT-based auth for protected routes
- refresh-token lifecycle management
- token invalidation on logout
- authorization checks before read/update/delete operations
- Google mobile sign-in must verify the Google ID token server-side before linking or creating a user
- Apple mobile sign-in must verify the Apple identity token signature, issuer, audience, expiry, and nonce server-side before linking or creating a user
- Provider tokens must never be treated as the app's own access or refresh tokens

---

# 4) Privacy Controls in Product Flow

The current product context includes privacy controls that must be implemented and enforced:

- data export
- delete account / delete request
- AI analysis opt-out path

Related APIs:

- `POST /privacy/export`
- `POST /privacy/delete-request`
- `PATCH /privacy/ai-opt-out`
- `POST /auth/logout`

Implemented privacy/session actions must invalidate server-side refresh tokens where applicable and keep user-owned data isolated by account.

AI opt-out must be enforced at runtime, not stored as cosmetic onboarding state only:

- `aiOptIn === false` must block `GET /insights/ai-analysis`
- Home and Insights AI surfaces must stay hidden or disabled when the user has opted out
- opting out should clear cached weekly AI-analysis payloads so stale AI summaries are not resurfaced later
- onboarding AI preference must be persisted during email, Google, and Apple sign-in flows when onboarding context is supplied, so a user-selected Privacy Mode state is reflected after premium activation and later login

Reminder controls are also privacy-sensitive:

- `GET /reminders`
- `POST /reminders`
- `PATCH /reminders/{reminderId}`
- `DELETE /reminders/{reminderId}`

Current reminder delivery is local-device scheduling from the mobile client. Notification permission must remain explicit opt-in, and reminder records must stay scoped to the authenticated user.

Onboarding demo analysis is the only public journal-like text endpoint:

- `POST /onboarding/demo-analysis` must not persist submitted demo text
- the controller/service must not log raw demo journal text
- the endpoint is limited to deterministic onboarding copy and must not expose authenticated journal data

---

# 5) Logging Rules

Never log:

- access tokens
- refresh tokens
- passwords or OAuth secrets
- raw sensitive journal text (except explicitly approved local debug workflow)

Log operational failures safely:

- auth failures
- permission denials
- AI processing failures
- unexpected server exceptions

---

# 6) Safety and Sensitive Content

Journal.IO may contain emotionally sensitive user content.

System behavior must:

- avoid harmful instruction output
- keep insight language non-clinical
- route elevated-risk signals to safety handling
- preserve user dignity and privacy in messaging
- allow the journal write itself to succeed, then keep self-harm or harm-to-others wording out of normal AI trait/pattern scoring
- surface support-first wording for elevated-risk analysis instead of diagnosis, certainty, or personality labeling

---

# 7) Trust Principles

User data must remain:

- private
- secure
- transparent
- user-controlled

Security decisions should favor user safety over convenience shortcuts.
