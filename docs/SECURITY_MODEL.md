# Security Model

Journal.IO handles sensitive personal journaling content and must enforce strong privacy defaults.

---

# 1) Core Security Posture

- encryption in transit: HTTPS + TLS 1.3
- encryption at rest: AES-256-capable storage controls
- sensitive profile, journal, memory, and cached AI payload fields also support application-level AES-256-GCM envelopes with versioned key IDs so raw MongoDB reads and snapshots do not expose plaintext by default
- strict authentication and data ownership checks
- no cross-user data leakage

---

# 2) Why E2EE Is Not Used For The Main AI Flow

Server-side AI analysis requires server access to journal text.

Therefore:

- end-to-end encryption is not compatible with AI-enabled journaling in current MVP

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
- `DEV_PREMIUM_ACCESS_OVERRIDE` may force effective Pro or Free access only outside production; production must ignore it, no override may create a user session, and it must not mutate stored RevenueCat entitlement data or bypass ownership checks
- Premium Home Screen mood actions must use a separate opaque credential scoped only to the widget mood route; the extension must never receive the app access token or refresh token

---

# 4) Privacy Controls in Product Flow

The current product context includes privacy controls that must be implemented and enforced:

- data export
- delete account / delete request

Related APIs:

- `POST /privacy/export`
- `POST /privacy/delete-request`
- `POST /auth/logout`

Implemented privacy/session actions must invalidate server-side refresh tokens where applicable and keep user-owned data isolated by account.

Mobile auth tokens remain in Keychain. The cached auth profile and onboarding payload are now stored in separate device-only Keychain services rather than AsyncStorage, must be cleared on sign-out or unauthorized profile responses, and must never replace backend authorization for protected API data.
Auth-first onboarding must not clear Keychain tokens during normal launch migration on a known app installation. A missing app-container installation marker is treated as a full reinstall: the app must clear residual auth tokens and profile/onboarding cache before any token read or protected request, then require sign-in again. If secure-token cleanup fails, the marker must remain absent so the cleanup is retried on the next launch.
Offline access is limited to a real token pair plus the last server-verified profile. Development `mock-*` tokens must be removed during bootstrap, and a cached-profile session must be revalidated when backend reachability returns; an unauthorized response clears both secure tokens and the profile cache before Auth is shown.
The offline UI must not add journal bodies or composer drafts to AsyncStorage or another persistent queue. Existing mounted data may remain readable in memory, but protected writes are disabled while offline, are never replayed automatically, and still require normal backend authentication and ownership checks after reconnect.
The iOS biometric app lock is device-local and Premium-only: its enabled preference may live in AsyncStorage, and its unlock marker must use a separate Keychain service protected by Face ID, Touch ID, or device-passcode access. No development configuration may bypass the Premium entitlement, and a free enable attempt must return before changing AsyncStorage or Keychain. It must not reuse or gate the auth-token Keychain entry, sync to the backend, log biometric state as analytics payload beyond locked-feature/paywall intent, or transmit biometric data off-device. A fresh reinstall must also remove its residual Keychain marker. Backgrounding covers journal content immediately; the 60-second foreground-return grace only suppresses a repeated prompt for a previously unlocked session and never bypasses cold-launch, long-absence, cancelled, failed, or already-locked authentication.

Home Screen widget privacy requirements:

- widget tokens must be random, hashed before storage, time-limited, revocable, installation-scoped, and accepted only by `POST /widgets/mood/check_in`; provisioning and use require active server-verified Premium access
- widget-session provisioning and revocation must require a current access-token widget-session version, so access tokens issued before logout or password reset cannot reconnect revoked widgets
- normal access and refresh tokens remain app-only; only the scoped widget token may use the shared Keychain access group, and each credential must be keyed by session generation so an older in-flight widget action cannot delete or overwrite a newer account's credential
- App Group defaults and widget responses may store or return versioned auth/rendering state, device-local activation preferences, a date key, neutral action status, the selected mood until local midnight, and non-sensitive streak data (current streak, best streak, this-month entries, total entries, whether an entry exists today, the most recent entry's date key, and a 30-day activity bitmap), but never journal text, composer drafts, a user name, or a mood-record identifier
- the Streak widget renders only from that App Group aggregate snapshot (no widget token, no network request from the extension); the app pushes the snapshot and it is cleared on logout, account switch, or fresh reinstall alongside the mood widget credential, activation preferences, and installation ID
- Quick Thought links may open and focus the in-app composer but must not carry journal text in a URL; because iOS widgets cannot host a text field, quick-thought capture always happens in the in-app composer, never inside the widget
- widget mood writes require connectivity, are never persisted in an offline queue, and are not retried automatically
- logout, password reset, account deletion, account switching, unauthorized session cleanup, and fresh reinstall must clear the local widget credential; successful server-side session-ending actions also revoke widget sessions
- direct iOS 17+ mood actions intentionally remain available when the separate Journal.IO biometric overlay is enabled; the widget may show only the selected mood and a completed state until local midnight and never exposes journal content

AI-derived data must remain protected throughout its lifecycle:

- persisted `entry_insights` evidence quotes are short slices of the user's own sentences, stored only under the user's own account to power their cross-session memory and Mind Map patterns; they are never logged and are masked client-side when Hide Journal Previews is enabled
- privacy export should include each journal's versioned session-analysis snapshot, cached Mind Map payloads, and the persisted per-entry Mind Map scores (`mindMapEntryScores`) when present so users can see the derived reflection-map data held in their account export
- `Hide Journal Previews` must mask Mind Map evidence snippets in the client (both the global map and the per-entry `EntryMindMapScreen`) — including the recurring-`patterns` `evidenceQuote` — while keeping non-sensitive region labels, pattern labels, and scores usable for navigation and accessibility
- Free educational Mind Map mode must never request, calculate, cache, or expose hidden personal map results before a user becomes eligible
- `/goals` routes must enforce authentication. Journal-context suggestions must enforce ownership and active Premium; suggestions are transient until the user explicitly creates a goal

Reminder controls are also privacy-sensitive:

- `GET /reminders`
- `POST /reminders`
- `PATCH /reminders/{reminderId}`
- `DELETE /reminders/{reminderId}`

Current reminder delivery is local-device scheduling from the mobile client. Notification permission must remain explicit opt-in, and reminder records must stay scoped to the authenticated user.

Additional backend data-protection rules:

- `FIELD_ENCRYPTION_MODE` controls staged rollout: `disabled`, `migration`, or `enforced`
- migration/enforced startup must verify both the field-encryption canary and the lookup-HMAC canary before serving traffic
- lookup-only queries for encrypted identity fields must use blinded HMAC indexes rather than plaintext values
- production MongoDB connections must require TLS, and release mobile API resolution must fail closed unless the configured base URL is HTTPS
- JWT access tokens must keep only minimal session claims required by the app (`sub` and session-version state), not profile fields such as name, email, or phone number

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
