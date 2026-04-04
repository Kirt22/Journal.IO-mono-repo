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
- Google provider tokens must never be treated as the app's own access or refresh tokens

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

Reminder controls are also privacy-sensitive:

- `GET /reminders`
- `POST /reminders`
- `PATCH /reminders/{reminderId}`
- `DELETE /reminders/{reminderId}`

Current reminder delivery is local-device scheduling from the mobile client. Notification permission must remain explicit opt-in, and reminder records must stay scoped to the authenticated user.

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

---

# 7) Trust Principles

User data must remain:

- private
- secure
- transparent
- user-controlled

Security decisions should favor user safety over convenience shortcuts.
