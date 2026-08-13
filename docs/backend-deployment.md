# Backend Deployment

This backend is now wired for standard Node hosting and includes:

- `render.yaml` for Render blueprint deploys
- `backend/Dockerfile` for container-based hosts
- `/health` and `/ready` endpoints for uptime and readiness checks

## Default Host Target

The repo is configured to deploy cleanly on Render as a Node web service.

Health endpoint:

- `GET /health`

Readiness endpoint:

- `GET /ready`

For the canonical production variable-name inventory, see
[`BACKEND_PRODUCTION_ENV_VARIABLES.md`](./BACKEND_PRODUCTION_ENV_VARIABLES.md).

## Required Environment Variables

Minimum required for boot:

- `NODE_ENV=production`
- `MONGO_STAGE=prod`
- `MONGO_URI`
- `JWT_ACCESS_SECRET`

Required for the current auth flows used in production:

- `AUTH_EMAIL_FROM_ADDRESS`
- `AUTH_EMAIL_FROM_NAME`
- `AUTH_EMAIL_HELO_HOST`
- `RESEND_SMTP_PASSWORD`

Optional for reply handling after a real mailbox exists:

- `AUTH_EMAIL_REPLY_TO`

Required if Google sign-in remains enabled in the client:

- `GOOGLE_WEB_CLIENT_ID`
- `GOOGLE_IOS_CLIENT_ID`
- `GOOGLE_WEB_CLIENT_SECRET`

Required if AI-backed insights/prompts remain enabled:

- `OPENAI_API_KEY`

## Production Environment Matrix

The following runtime variables are not required when the defaults are
acceptable, but are available for the current feature set:

- `AUTH_PASSWORD_RESET_EXPIRES_IN` defaults to `30m`.
- `AUTH_PASSWORD_RESET_APP_URL` defaults to `https://api.journalio.app/reset-password` and should be set only if the reset flow uses a different public URL.
- `GOOGLE_ANDROID_CLIENT_ID` is needed only when Android Google sign-in is enabled and uses a distinct audience.
- `APPLE_CLIENT_ID` is needed only when Apple sign-in uses an audience other than the default `app.journalio`.
- `OPENAI_GUIDED_REFLECTION_MODEL` and `OPENAI_GUIDED_REFLECTION_REASONING_EFFORT` optionally override guided-reflection quality and latency; the current defaults are the session-analysis model and `high` reasoning.
- `OPENAI_EMBEDDING_MODEL` optionally overrides the default `text-embedding-3-small` model.
- `OPENAI_MINDMAP_ENTRY_MODEL`, `OPENAI_PATTERN_GRAPH_MODEL`, and `OPENAI_USER_MEMORY_MODEL` optionally override their feature models; each falls back to `OPENAI_RESPONSES_MODEL`.
- `OPENAI_ASK_JADE_MODEL` and `OPENAI_ASK_JADE_REASONING_EFFORT` optionally override Jade; the current default reasoning effort is `low`.
- `USER_MEMORY_REFRESH_EVERY`, `JADE_TURNS_PER_DAY`, `JADE_TURNS_PER_HOUR`, `JADE_MINE_EVERY`, `JADE_MINE_IDLE_MINUTES`, and `PATTERN_GRAPH_*` are tuning controls with safe code defaults.

Field encryption is opt-in. If production keeps `FIELD_ENCRYPTION_MODE=disabled`
(the current default), no encryption-specific values are required. If the mode
is changed to `migration` or `enforced`, add all of these before deployment:

- `FIELD_ENCRYPTION_MODE`
- `FIELD_ENCRYPTION_ACTIVE_KEY_ID`
- `FIELD_ENCRYPTION_KEYS_JSON`
- `FIELD_LOOKUP_HMAC_KEY`
- `FIELD_ENCRYPTION_CANARY`
- `FIELD_LOOKUP_HMAC_CANARY`

Do not enable development bypasses in production. Leave these unset or false:
`AI_ALLOW_NON_PREMIUM`, `GUIDED_REFLECTION_ALLOW_NON_PREMIUM`,
`MINDMAP_DEV_BYPASS_MIN_ACTIVE_DAYS`, `AI_INSIGHTS_EXPERIMENTAL_EARLY_READY`,
and `DEV_PREMIUM_ACCESS_OVERRIDE`. `AI_INSIGHTS_DEV_ALLOW_EARLY_READY` is a
legacy flag and is ignored by the current release-safe implementation; remove
it from the production environment rather than relying on it.

The `PRODUCTION_*` variables used by `backend/scripts/check-production-domains.mjs`
are for the optional local domain-check script, not backend runtime boot. The
frontend production build separately needs `API_BASE_URL`, the Google client
IDs, and the platform RevenueCat public SDK key(s); RevenueCat entitlement and
offering identifiers are currently code constants, not backend environment
variables.

## Production Rollout

Use Render-managed environment variables for production values.

Keep local development unchanged:

- keep `frontend/.env` pointed at the local backend for normal development
- keep `backend/.env` or local shell envs on `localhost` values for local runs
- do not commit production secrets or replace local defaults in tracked source files

For the email OTP production rollout:

- set the backend custom domain to `api.journalio.app`
- set `AUTH_EMAIL_HELO_HOST` in Render to `api.journalio.app`
- set the sender in Render to `otp@mail.journalio.app`
- place the Resend API key in `RESEND_SMTP_PASSWORD`
- leave local `.env` files unchanged unless you are intentionally testing against production

For the frontend production API switch:

- keep `frontend/.env` local-first
- inject `API_BASE_URL=https://api.journalio.app/api/v1` only in the production mobile build environment
- do not replace the local tracked `frontend/.env` value with the production URL

For public legal pages needed by App Store / Play review:

- keep `api.journalio.app` as both the mobile API base URL and the host for the public legal/support pages
- point the apex `journalio.app` domain at the same Render backend service to serve the public marketing landing page from `https://journalio.app/`
- keep `https://api.journalio.app/api/v1` as the production mobile API base URL; the bare `https://api.journalio.app/` root redirects to `https://journalio.app/`
- optionally point `www.journalio.app` at the same backend service; its bare root also redirects to `https://journalio.app/`
- static landing assets are served from `/assets`, with launch screenshots expected under `backend/public/landing`
- the former root legal hub is now available at `https://api.journalio.app/legal`
- the backend now serves the public legal pages at:
  - `https://api.journalio.app/privacy`
  - `https://api.journalio.app/terms`
  - `https://api.journalio.app/privacy-choices`
  - `https://api.journalio.app/account-deletion`
  - `https://api.journalio.app/support`
- use `https://api.journalio.app/support` as the App Store Connect Support URL
- keep the `/support` page public and have it link users to the Google Form support ticket flow instead of exposing a raw form URL as the App Store listing URL

## Render Deploy Steps

1. Push this repo to GitHub.
2. In Render, create a new Blueprint and point it at the repo root.
3. Render will read `render.yaml` and create the `journal-io-backend` service.
4. Fill in every `sync: false` environment variable before the first deploy.
5. Deploy and confirm both:
   - `GET /health` returns `200`
   - `GET /ready` returns `200`

## Docker Deploy

Build:

```bash
docker build -t journal-io-backend ./backend
```

Run:

```bash
docker run --env-file ./backend/.env -p 3000:3000 journal-io-backend
```

For production, use a production env file or host-managed secrets instead of the local `.env`.
