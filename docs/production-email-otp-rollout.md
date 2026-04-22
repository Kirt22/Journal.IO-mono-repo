# Production Email OTP Rollout

This document is the manual production rollout checklist for Journal.IO email OTP using:

- GoDaddy for DNS
- Resend for sending
- Render for the backend service

It does not change local development defaults.

## Config Surface

Production values are env-driven in these runtime paths:

- frontend production API base URL:
  - [frontend/src/config/env.ts](/Users/kirtansolanki/Desktop/Journal.IO/frontend/src/config/env.ts)
  - [frontend/src/utils/apiClient.ts](/Users/kirtansolanki/Desktop/Journal.IO/frontend/src/utils/apiClient.ts)
- backend email sender and SMTP config:
  - [backend/src/services/auth/emailOtp.service.ts](/Users/kirtansolanki/Desktop/Journal.IO/backend/src/services/auth/emailOtp.service.ts)
- Render blueprint env declarations:
  - [render.yaml](/Users/kirtansolanki/Desktop/Journal.IO/render.yaml)

Tracked local-first env examples:

- [frontend/.env.example](/Users/kirtansolanki/Desktop/Journal.IO/frontend/.env.example)
- [backend/.env.example](/Users/kirtansolanki/Desktop/Journal.IO/backend/.env.example)

## Repo Verification Command

Use this read-only check from the repo after DNS and Render are configured:

```bash
cd backend
npm run check:production:domains
```

What it checks:

- DNS visibility for `api.journalio.app`
- DNS visibility for `mail.journalio.app`
- `https://api.journalio.app/health`
- `https://api.journalio.app/ready`

Optional overrides:

```bash
PRODUCTION_API_DOMAIN=api.journalio.app \
PRODUCTION_API_BASE_URL=https://api.journalio.app \
PRODUCTION_MAIL_DOMAIN=mail.journalio.app \
PRODUCTION_EMAIL_FROM_ADDRESS=otp@mail.journalio.app \
npm run check:production:domains
```

## What Must Not Change Locally

- Do not replace `frontend/.env` local API values with the production API URL.
- Do not commit production secrets into repo-tracked files.
- Do not change local `AUTH_EMAIL_HELO_HOST=localhost` defaults just to prepare production.
- Do not hardcode `api.journalio.app` or SMTP secrets in app source files.

## GoDaddy DNS

### API subdomain for Render

Create the DNS record for:

- host or name: `api`
- type: use the record type Render tells you to use for the custom domain
- target or value: copy the exact Render custom-domain target shown for `api.journalio.app`
- TTL: default GoDaddy TTL is fine

Notes:

- do not guess the Render target; copy it from the Render custom domain UI
- wait for the Render custom domain to show verified and TLS-ready before treating the API hostname as live

### Sending subdomain for Resend

In Resend, add the domain:

- `mail.journalio.app`

Then copy every DNS record Resend shows into GoDaddy exactly as given.

Typical record types may include:

- `TXT` for SPF or verification
- `CNAME` for DKIM
- additional `TXT` records for verification or DMARC guidance

Notes:

- do not add `otp@mail.journalio.app` as the Resend domain
- add the exact records Resend provides; do not improvise record names or values
- wait until Resend shows the domain as verified before enabling production email sends

## Render Service

Target service:

- `Journal.IO_Backend_Prod`

Set or confirm these environment variables in Render:

```env
AUTH_EMAIL_DELIVERY_MODE=smtp
AUTH_EMAIL_FROM_ADDRESS=otp@mail.journalio.app
AUTH_EMAIL_FROM_NAME=Journal.IO
AUTH_EMAIL_REPLY_TO=
AUTH_EMAIL_HELO_HOST=api.journalio.app

RESEND_SMTP_HOST=smtp.resend.com
RESEND_SMTP_PORT=465
RESEND_SMTP_USERNAME=resend
RESEND_SMTP_PASSWORD=re_xxxxxxxxx
```

Notes:

- `RESEND_SMTP_PASSWORD` must be a real Resend API key
- keep `AUTH_EMAIL_REPLY_TO` blank unless you have created a real mailbox
- `AUTH_EMAIL_HELO_HOST` should match the public backend hostname used in production

## Frontend Production API Base URL

Keep repo defaults local-first:

- `frontend/.env.example` stays on `http://localhost:3000/api/v1`

For production builds only, inject:

```env
API_BASE_URL=https://api.journalio.app/api/v1
```

Safe switch guidance:

- set the production value only in the production mobile build environment
- keep local development and simulator runs on local values
- do not commit the production API base URL into the tracked local `.env` defaults

## Resend SMTP Settings

Use these values:

```env
RESEND_SMTP_HOST=smtp.resend.com
RESEND_SMTP_PORT=465
RESEND_SMTP_USERNAME=resend
RESEND_SMTP_PASSWORD=re_xxxxxxxxx
```

Sender identity:

```env
AUTH_EMAIL_FROM_ADDRESS=otp@mail.journalio.app
AUTH_EMAIL_FROM_NAME=Journal.IO
```

## Production Verification Checklist

### DNS and platform readiness

- `api.journalio.app` is attached to the Render backend service
- Render shows the custom domain as verified and TLS-ready
- Resend shows `mail.journalio.app` as verified

### Backend verification

- Render env vars match the production values above
- `https://api.journalio.app/health` returns `200`
- `https://api.journalio.app/ready` returns `200`

### Email OTP verification

- sign-up triggers an OTP send
- resend triggers a fresh OTP send
- the OTP email arrives in a real inbox
- inbox and spam folders were both checked
- the sender is shown as `Journal.IO <otp@mail.journalio.app>`

### Frontend verification

- the production mobile build uses `https://api.journalio.app/api/v1`
- the client can hit the production auth endpoints successfully
- no local defaults were changed to make the production build work
