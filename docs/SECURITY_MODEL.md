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
- password reset requests must not reveal whether an email is registered
- non-production password reset responses may expose local-only diagnostics for testing, but production responses must stay generic
- password reset tokens must be random, hashed before storage, time-limited, one-time use, and cleared after a successful reset
- successful password reset must invalidate the stored refresh token so existing sessions cannot continue silently with an old password
- RevenueCat webhooks must require a configured authorization header and must not trust unauthenticated purchase lifecycle requests
- premium authorization must not trust `isPremium` alone; time-limited access requires a server-verified RevenueCat source and an unexpired timestamp, with periodic reconciliation covering inactive and legacy users

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

Mobile auth tokens remain in Keychain. A profile-only cache may be stored in AsyncStorage for offline launch, but it must not contain access or refresh tokens, must be cleared on sign-out or unauthorized profile responses, and must never replace backend authorization for protected API data.
Auth-first onboarding must not clear Keychain tokens during normal launch migration. Tokens are cleared only on explicit logout or when a protected profile request is rejected as unauthorized.
Offline access is limited to a real token pair plus the last server-verified profile. Development `mock-*` tokens must be removed during bootstrap, and a cached-profile session must be revalidated when backend reachability returns; an unauthorized response clears both secure tokens and the profile cache before Auth is shown.
The offline UI must not add journal bodies or composer drafts to AsyncStorage or another persistent queue. Existing mounted data may remain readable in memory, but protected writes are disabled while offline, are never replayed automatically, and still require normal backend authentication and ownership checks after reconnect.
The iOS biometric app lock is device-local only: its enabled preference may live in AsyncStorage, and its unlock marker must use a separate Keychain service protected by Face ID, Touch ID, or device-passcode access. It must not reuse or gate the auth-token Keychain entry, sync to the backend, log biometric state as analytics payload beyond locked-feature/paywall intent, or transmit biometric data off-device.

AI opt-out must be enforced at runtime, not stored as cosmetic onboarding state only:

- `aiOptIn === false` must block `GET /insights/ai-analysis`
- `aiOptIn === false` must also block `GET /insights/mind-map`
- Home and Insights AI surfaces must stay hidden or disabled when the user has opted out
- opting out should clear cached weekly AI-analysis payloads and cached Mind Map payloads so stale AI summaries or region maps are not resurfaced later
- onboarding AI preference must be persisted during email, Google, and Apple sign-in flows when onboarding context is supplied, so a user-selected Privacy Mode state is reflected after premium activation and later login
- privacy export should include cached Mind Map payloads when present so users can see the derived reflection-map data held in their account export
- `Hide Journal Previews` must mask Mind Map evidence snippets in the client while keeping non-sensitive region labels and scores usable for navigation and accessibility
- Free and AI-off educational Mind Map mode must never request, calculate, cache, or expose hidden personal map results before a user becomes eligible
- `/goals` routes must enforce authentication. Journal-context suggestions must enforce ownership, active Premium, and AI opt-in; suggestions are transient until the user explicitly creates a goal

Reminder controls are also privacy-sensitive:

- `GET /reminders`
- `POST /reminders`
- `PATCH /reminders/{reminderId}`
- `DELETE /reminders/{reminderId}`

Current reminder delivery is local-device scheduling from the mobile client. Notification permission must remain explicit opt-in, and reminder records must stay scoped to the authenticated user.

Biometric app-lock recovery requirements:

- if Face ID, Touch ID, or passcode availability disappears after setup, the app should keep journal content covered and offer a sign-out recovery path rather than exposing authenticated content
- cancelling a biometric unlock prompt should keep the app locked until the user explicitly tries again
- local biometric-lock preference state may remain on the device after sign-out so the same device can resume the control later once Premium access and biometric availability are restored

Onboarding demo analysis is the only public journal-like text endpoint:

- `POST /onboarding/demo-analysis` must not persist submitted demo text
- the controller/service must not log raw demo journal text
- the endpoint is limited to deterministic onboarding copy and must not expose authenticated journal data

Onboarding completion is protected account state:

- `POST /onboarding/complete` requires authentication
- completion stores sanitized onboarding answers on the user profile
- completion must not create, update, delete, or expose journal entries, subscription records, RevenueCat credentials, or reminder records
- existing-user lazy migration must use metadata-only checks such as journal existence/count and must never read or return journal text

---

# 5) Logging Rules

Never log:

- access tokens
- refresh tokens
- passwords or OAuth secrets
- RevenueCat secret API keys or webhook authorization tokens
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
