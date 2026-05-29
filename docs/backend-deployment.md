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
