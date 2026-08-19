# Backend Production Environment Variables

This is the canonical inventory for the Journal.IO backend production
environment. Keep variable names here synchronized with the production server
and update this document whenever a production variable is added, removed, or
renamed.

Values and secrets are intentionally not stored in this repository. Configure
the variables in the production host's secret/environment settings.

## Current Production Inventory

The following names are the latest production-server inventory, confirmed on
2026-08-19:

```text
AI_INSIGHTS_DEV_ALLOW_EARLY_READY
AUTH_EMAIL_DELIVERY_MODE
AUTH_EMAIL_FROM_ADDRESS
AUTH_EMAIL_FROM_NAME
AUTH_EMAIL_HELO_HOST
AUTH_EMAIL_OTP_EXPIRES_IN
AUTH_EMAIL_REPLY_TO
AUTH_OTP_EXPIRES_IN
FIELD_ENCRYPTION_ACTIVE_KEY_ID
FIELD_ENCRYPTION_CANARY
FIELD_ENCRYPTION_KEYS_JSON
FIELD_ENCRYPTION_MODE
FIELD_LOOKUP_HMAC_CANARY
FIELD_LOOKUP_HMAC_KEY
GOOGLE_IOS_CLIENT_ID
GOOGLE_WEB_CLIENT_ID
GOOGLE_WEB_CLIENT_SECRET
JWT_ACCESS_EXPIRES_IN
JWT_ACCESS_SECRET
JWT_REFRESH_EXPIRES_IN
JWT_SECRET
MONGO_STAGE
MONGO_URI
MSG91_AUTH_KEY
MSG91_OTP_API_URL
MSG91_TEMPLATE_ID
NODE_ENV
OPENAI_API_KEY
OPENAI_RESPONSES_MODEL
PORT
RESEND_SMTP_HOST
RESEND_SMTP_PASSWORD
RESEND_SMTP_PORT
RESEND_SMTP_USERNAME
REVENUECAT_ALLOWED_WEBHOOK_ENVIRONMENTS
REVENUECAT_APP_ID
REVENUECAT_SECRET_API_KEY
REVENUECAT_WEBHOOK_AUTH_TOKEN
```

`AI_INSIGHTS_DEV_ALLOW_EARLY_READY` is retained in this inventory because it
was reported as present on the server. The current release-safe code ignores
this legacy flag; do not rely on it to enable production behavior.

## Encryption Rollout Status

All six encryption variables are live on the production server. The mode moved
to `migration` on **2026-08-19**, after an audit
(`scripts/audit-duplicate-identities.mjs`) reported zero duplicate identities
and zero already-encrypted rows across 19 users and 22 journals.

`FIELD_ENCRYPTION_MODE` is declared with a literal `value:` in `render.yaml`
rather than left dashboard-only, because Render re-applies blueprint-managed
values on every sync — a dashboard-only mode silently reverts. Change it in the
file, not the dashboard.

**`enforced` is not yet reachable.** In `migration` mode a row is encrypted only
when something saves it, so rows belonging to users who have not signed in since
the flip remain plaintext. `decryptFieldValue` throws on any plaintext it reads
in `enforced` mode, so the mode may only advance after a backfill has swept every
schema carrying encrypted paths: users, journals, insights, entry insights,
pattern nodes, pattern edges, user memory, Jade sessions, and Jade messages.

Now that ciphertext exists in production, `FIELD_ENCRYPTION_KEYS_JSON` and
`FIELD_ENCRYPTION_ACTIVE_KEY_ID` are load-bearing: clearing either one makes the
encrypted data permanently unrecoverable.

## Encryption Variable Guidance

- `FIELD_ENCRYPTION_ACTIVE_KEY_ID`: a stable identifier chosen by the team,
  such as `primary-2026-08`.
- `FIELD_ENCRYPTION_KEYS_JSON`: a JSON object mapping the active key ID to a
  separate 32-byte secret. Generate the secret with `openssl rand -base64 32`
  or `openssl rand -hex 32`.
- `FIELD_LOOKUP_HMAC_KEY`: a different 32-byte secret, generated separately
  with `openssl rand -base64 32` or `openssl rand -hex 32`.
- `FIELD_ENCRYPTION_CANARY` and `FIELD_LOOKUP_HMAC_CANARY`: generated from the
  configured encryption key and HMAC key by the repository's
  `buildFieldEncryptionCanaries` helper. Do not invent these values manually —
  startup round-trips both against the live keys and refuses to boot on a
  mismatch. Generate them with:

  ```bash
  npm run build
  DOTENV_CONFIG_PATH=<env-file> node -r dotenv/config \
    scripts/print-field-encryption-canaries.mjs
  ```

  Regenerate and update the canaries in the same change as any key rotation.

Keep all encryption keys, canaries, JWT secrets, API keys, SMTP passwords, and
MongoDB credentials only in the production secret manager or host settings.

## How To Use This File

- “Latest production variables” means the names in **Current Production
  Inventory**. Every name there is confirmed present on the production server.
- Add a name to that list only once it is actually set on the server, and note
  any name that is set but unused in the notes below the list.
- Record every encryption mode change in **Encryption Rollout Status**, with the
  date and what was verified beforehand.

Related deployment instructions are in
[`docs/backend-deployment.md`](./backend-deployment.md).
