# Backend Production Environment Variables

This is the canonical inventory for the Journal.IO backend production
environment. Keep variable names here synchronized with the production server
and update this document whenever a production variable is added, removed, or
renamed.

Values and secrets are intentionally not stored in this repository. Configure
the variables in the production host's secret/environment settings.

## Current Production Inventory

The following names are the latest production-server inventory supplied on
2026-08-13:

```text
AI_INSIGHTS_DEV_ALLOW_EARLY_READY
AUTH_EMAIL_DELIVERY_MODE
AUTH_EMAIL_FROM_ADDRESS
AUTH_EMAIL_FROM_NAME
AUTH_EMAIL_HELO_HOST
AUTH_EMAIL_OTP_EXPIRES_IN
AUTH_EMAIL_REPLY_TO
AUTH_OTP_EXPIRES_IN
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

## Pending Additions

Add these six variables before enabling field encryption in production:

```text
FIELD_ENCRYPTION_MODE
FIELD_ENCRYPTION_ACTIVE_KEY_ID
FIELD_ENCRYPTION_KEYS_JSON
FIELD_LOOKUP_HMAC_KEY
FIELD_ENCRYPTION_CANARY
FIELD_LOOKUP_HMAC_CANARY
```

Until the rollout begins, `FIELD_ENCRYPTION_MODE=disabled` is the safe
default. Use `migration` for the staged rollout, and move to `enforced` only
after the migration has been verified.

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
  `buildFieldEncryptionCanaries` helper. Do not invent these values manually.

Keep all encryption keys, canaries, JWT secrets, API keys, SMTP passwords, and
MongoDB credentials only in the production secret manager or host settings.

## How To Use This File

- “Latest production variables” means the names in **Current Production
  Inventory**.
- “New variables to add” means the names in **Pending Additions** until they
  are confirmed as present on the production server.
- After the encryption rollout is confirmed, move the six names into the
  current inventory and record the rollout date in this document.

Related deployment instructions are in
[`docs/backend-deployment.md`](./backend-deployment.md).
