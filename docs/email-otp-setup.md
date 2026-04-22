# Email OTP Setup

This document captures the Journal.IO email OTP setup discussion for later reference.

It covers:

- how the current backend email OTP flow is wired
- which backend env vars are required
- what each env var means
- how to configure Resend SMTP
- recommended domain and subdomain naming
- example values for local and production environments
- production rollout steps for GoDaddy, Resend, and Render
- common mistakes to avoid

## Current backend wiring

The backend already exposes the email-first auth routes:

- `POST /auth/sign_up_with_email`
- `POST /auth/resend_email_verification`
- `POST /auth/verify_email`

Current email OTP delivery is wired through:

- [backend/src/services/auth/auth.service.ts](/Users/kirtansolanki/Desktop/Journal.IO/backend/src/services/auth/auth.service.ts)
- [backend/src/services/auth/emailOtp.service.ts](/Users/kirtansolanki/Desktop/Journal.IO/backend/src/services/auth/emailOtp.service.ts)

Behavior:

- signup generates an OTP and stores the pending verification state
- resend generates a fresh OTP and updates the pending verification state
- email delivery uses console logging in local fallback mode
- email delivery uses Resend SMTP when SMTP mode is enabled or SMTP credentials are present

## Recommended domain structure

Use one main product domain, one API subdomain, and one dedicated sending subdomain.

Recommended structure:

- main app domain: `journalio.app`
- backend API: `api.journalio.app`
- Resend sending domain: `mail.journalio.app`
- OTP sender address: `otp@mail.journalio.app`
- optional reply mailbox: `support@journalio.app`

Why this structure is recommended:

- `journalio.app` is the public brand domain
- `api.journalio.app` is the clean backend hostname
- `mail.journalio.app` isolates sending reputation from the root domain
- `otp@mail.journalio.app` is explicit and appropriate for one-time passcode emails

Good alternatives if the main domain changes:

- `getjournalio.com`
- `usejournalio.com`
- `journalioapp.com`
- `myjournalio.com`

Then keep the same pattern:

- `api.getjournalio.com`
- `mail.getjournalio.com`
- `otp@mail.getjournalio.com`

## Important distinction

When adding a domain in Resend:

- enter `mail.journalio.app`
- do not enter `otp@mail.journalio.app`

Reason:

- `mail.journalio.app` is the domain or subdomain to verify
- `otp@mail.journalio.app` is the sender email address used after verification

## Required backend environment variables

Use these in `backend/.env`:

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

AUTH_EMAIL_OTP_EXPIRES_IN=30m
```

## What each env var means

### `AUTH_EMAIL_DELIVERY_MODE`

Purpose:

- application-level delivery mode switch

Valid values:

- `smtp`
- `console`

Use:

- `smtp` for real email sending
- `console` for local fallback logging instead of sending mail

This value is chosen by the app, not provided by Resend.

### `AUTH_EMAIL_FROM_ADDRESS`

Purpose:

- visible sender email in the `From:` field

Example:

- `otp@mail.journalio.app`

Where it comes from:

- you choose it
- it must belong to a domain or subdomain verified in Resend

For this setup, after `mail.journalio.app` is verified in Resend, a good sender is:

- `otp@mail.journalio.app`

### `AUTH_EMAIL_FROM_NAME`

Purpose:

- display name shown with the sender email

Example:

- `Journal.IO`

Visible result:

- `Journal.IO <otp@mail.journalio.app>`

This value is chosen by the app.

### `AUTH_EMAIL_REPLY_TO`

Purpose:

- where replies should go if the user hits Reply

Example:

- `support@journalio.app`

This value is chosen by the app. It should ideally point to a real mailbox.
For OTP-only sending, it can be left blank until a support inbox exists.

### `AUTH_EMAIL_HELO_HOST`

Purpose:

- hostname presented by the backend during the SMTP `EHLO` or `HELO` handshake

Example:

- `api.journalio.app`

Where it comes from:

- you choose it based on where the backend runs
- it is not provided by Resend

Recommended values:

- local development: `localhost`
- production with custom API domain: `api.journalio.app`
- Render without custom domain: `your-service-name.onrender.com`
- Railway without custom domain: `your-service-name.up.railway.app`
- VPS with custom domain: `api.journalio.app`

### `RESEND_SMTP_HOST`

Purpose:

- Resend SMTP server hostname

Value:

- `smtp.resend.com`

This comes from Resend SMTP documentation.

### `RESEND_SMTP_PORT`

Purpose:

- Resend SMTP port

Value:

- `465`

This implementation uses implicit TLS, so `465` is the correct value.

### `RESEND_SMTP_USERNAME`

Purpose:

- Resend SMTP username

Value:

- `resend`

This comes from Resend SMTP documentation.

### `RESEND_SMTP_PASSWORD`

Purpose:

- SMTP password for authenticating to Resend

Value source:

- your Resend API key

Example format:

- `re_xxxxxxxxx`

### `AUTH_EMAIL_OTP_EXPIRES_IN`

Purpose:

- application-level OTP expiration duration

Example:

- `30m`

This is chosen by the app, not provided by Resend.

## Resend setup steps

1. Create or sign in to a Resend account.
2. Open the Resend dashboard.
3. Go to Domains.
4. Add the sending subdomain:
   - `mail.journalio.app`
5. Do not enter a full email address in the domain field.
6. Copy the DNS records Resend gives you.
7. Open your DNS provider, such as Cloudflare.
8. Add the Resend DNS records exactly as provided.
9. Wait until Resend shows the domain as verified.
10. Go to API Keys.
11. Create a new API key with sending access.
12. Copy the API key immediately.
13. Place that API key into `RESEND_SMTP_PASSWORD`.

## Production Rollout

The production rollout is env-driven.

Keep local development unchanged:

- keep `AUTH_EMAIL_DELIVERY_MODE=console` locally unless you are intentionally testing SMTP
- keep `AUTH_EMAIL_HELO_HOST=localhost` locally
- keep `frontend/.env` on the local backend URL for day-to-day development

Apply production values only in platform-managed configuration:

- GoDaddy DNS for `api.journalio.app`
- GoDaddy DNS for `mail.journalio.app`
- Resend domain verification and API key creation
- Render environment variables for the production backend
- production mobile build configuration for `API_BASE_URL`

Use the manual rollout checklist in [production-email-otp-rollout.md](/Users/kirtansolanki/Desktop/Journal.IO/docs/production-email-otp-rollout.md).

## DNS and mailbox naming guidance

Recommended naming:

- product site: `journalio.app`
- API: `api.journalio.app`
- mail sending subdomain: `mail.journalio.app`
- sender email: `otp@mail.journalio.app`
- reply mailbox: `support@journalio.app` when a real inbox exists

Recommended reasoning:

- keep mail on a dedicated subdomain
- keep OTP sender purpose-specific
- keep support replies on the root product domain
- keep API hostname separate from mail hostname

## Example `.env` values

### Local development

Use this if the backend is running on your machine:

```env
AUTH_EMAIL_DELIVERY_MODE=smtp
AUTH_EMAIL_FROM_ADDRESS=otp@mail.journalio.app
AUTH_EMAIL_FROM_NAME=Journal.IO
AUTH_EMAIL_REPLY_TO=
AUTH_EMAIL_HELO_HOST=localhost

RESEND_SMTP_HOST=smtp.resend.com
RESEND_SMTP_PORT=465
RESEND_SMTP_USERNAME=resend
RESEND_SMTP_PASSWORD=re_xxxxxxxxx

AUTH_EMAIL_OTP_EXPIRES_IN=30m
```

### Production with custom API domain

Use this if the backend is reachable as `api.journalio.app`:

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

AUTH_EMAIL_OTP_EXPIRES_IN=30m
```

### Render without a custom API domain

```env
AUTH_EMAIL_HELO_HOST=your-service-name.onrender.com
```

### Railway without a custom API domain

```env
AUTH_EMAIL_HELO_HOST=your-service-name.up.railway.app
```

## Common mistakes

- adding `otp@mail.journalio.app` to the Resend domain field instead of `mail.journalio.app`
- forgetting that `RESEND_SMTP_PASSWORD` should be the Resend API key
- using a sender address that is not on a verified Resend domain
- setting `AUTH_EMAIL_HELO_HOST` to an email address instead of a hostname
- leaving SMTP mode enabled without valid credentials

## Practical default recommendation

Use this as the default production setup unless there is a reason to do otherwise:

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

AUTH_EMAIL_OTP_EXPIRES_IN=30m
```

## Later follow-up checklist

When returning to email OTP work later, verify:

1. `mail.journalio.app` is verified in Resend
2. the backend has the SMTP env vars set
3. the sender address is on the verified sending subdomain
4. `AUTH_EMAIL_HELO_HOST` matches the current backend host
5. signup can send an OTP to a real Gmail address
6. Gmail inbox and spam folder are both checked during testing
