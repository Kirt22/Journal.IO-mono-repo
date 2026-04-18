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
- `AUTH_EMAIL_REPLY_TO`
- `AUTH_EMAIL_HELO_HOST`
- `RESEND_SMTP_PASSWORD`

Required if Google sign-in remains enabled in the client:

- `GOOGLE_WEB_CLIENT_ID`
- `GOOGLE_IOS_CLIENT_ID`
- `GOOGLE_WEB_CLIENT_SECRET`

Required if AI-backed insights/prompts remain enabled:

- `OPENAI_API_KEY`

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
