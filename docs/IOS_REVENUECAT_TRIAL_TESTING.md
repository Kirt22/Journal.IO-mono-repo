# iOS RevenueCat Trial Testing

Use this checklist when validating the Journal.IO iOS paywall free-trial flow.

## Setup

- Test with an iOS sandbox tester or a TestFlight build using Apple sandbox billing.
- Confirm the App Store subscription product already has the introductory free trial configured and that the same product is attached to the active RevenueCat offering/package used by the standard paywall.
- The Apple purchase sheet is the source of truth for whether the account is eligible for the introductory offer.
- For local Debug runs before the App Store products are approved, use `frontend/ios/JournalIO.storekit`. The shared `JournalFrontend` run scheme points to this file so StoreKit can provide local product metadata for:
  - `app.journalio.premium.weekly`
  - `app.journalio.premium.yearly`
  - `app.journalio.premium.yearly.exit`
  - `app.journalio.premium.lifetime`
- The shared Xcode Debug Run action uses `APP_ENV=local` and
  `BABEL_ENV=development`, so Metro loads `frontend/.env.local`.
  - iOS Simulator: use `API_BASE_URL=http://localhost:3000/api/v1`.
  - Physical iPhone: use `API_BASE_URL=http://<mac-wifi-ip>:3000/api/v1`,
    keep the Mac and iPhone on the same Wi-Fi, and start the backend with
    `HOST=0.0.0.0`.
  - `0.0.0.0` is only the backend listen address; never use it as the client URL.
- On first physical-device access, allow Journal.IO's local-network permission.
  If it was denied, enable it under iPhone Settings > Privacy & Security >
  Local Network.
- If Xcode does not pick up the file, open `Product > Scheme > Edit Scheme > Run > Options` and confirm `StoreKit Configuration` is set to `JournalIO.storekit`.
- Start Metro with `npm run start:local` before pressing Xcode's Run button. If
  Metro was previously started with production settings, stop it and restart it
  with `--reset-cache` via `npm run start:local-debug`.

## Backend Verification Environments

- Xcode StoreKit configuration is useful for purchase-sheet, cancellation,
  restore, pricing, and SDK `CustomerInfo` checks.
- Do not treat an Xcode `CustomerInfo` entitlement as proof that the RevenueCat
  REST subscriber record is available. If the REST record remains empty, the
  secure backend intentionally leaves MongoDB premium access unchanged.
- Use RevenueCat Test Store for a fast local end-to-end test whose purchases
  appear in RevenueCat, or use Apple sandbox/TestFlight for the closest match to
  production App Store behavior.
- `POST /paywall/purchase-sync` retries brief RevenueCat propagation delays. If
  the server entitlement is still unavailable, it returns
  `503 revenuecat_purchase_pending` and the app keeps the access-updating state
  instead of accepting a false successful free profile.

## Trial Eligibility Notes

- If the same sandbox tester has already consumed the introductory offer for that subscription group, Apple may not show the trial again.
- If you need to re-test eligibility, clear the sandbox purchase history for the tester account and retry with a fresh sandbox session if needed.
- The app only presents trial-aware copy from RevenueCat package data. It does not track trial usage locally.
- Trial reminders are scheduled from the verified RevenueCat expiration timestamp, not from a fixed local activation offset.

## What To Verify

- Open the standard `/paywall` flow on iOS and confirm the CTA becomes trial-aware only when the selected subscription package exposes an introductory offer.
- Confirm the dedicated lifetime-offer paywall does not show free-trial messaging.
- Complete a purchase and verify premium unlocks only after RevenueCat returns an active entitlement.
- Verify the backend purchase sync returns a verified profile and that the success state only leaves `access updating` once the backend verification succeeds.
- Use `Restore Purchases` and verify the entitlement refresh updates the UI immediately.
- Cancel out of the Apple purchase sheet and confirm the paywall exits the loading state without unlocking premium.
- Cancel the subscription in Apple subscription settings, wait for RevenueCat customer info to refresh, and confirm premium access stays active until the verified expiration while Subscription shows `Auto-renewal is off` plus the end date.
- Bring the app to the foreground after a sandbox cancellation, renewal, or expiration and confirm the backend entitlement-sync refresh updates the cached profile without requiring a relaunch.
- In RevenueCat dashboard testing, verify the webhook target is `https://api.journalio.app/api/v1/webhooks/revenuecat`, the authorization header matches `REVENUECAT_WEBHOOK_AUTH_TOKEN`, and both sandbox and production events are enabled.
- In App Store Connect, confirm Apple Server Notification V2 is configured in both the production and sandbox URL fields so RevenueCat can emit prompt expiration events quickly.
