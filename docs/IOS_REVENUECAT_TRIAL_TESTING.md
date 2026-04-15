# iOS RevenueCat Trial Testing

Use this checklist when validating the Journal.IO iOS paywall free-trial flow.

## Setup

- Test with an iOS sandbox tester or a TestFlight build using Apple sandbox billing.
- Confirm the App Store subscription product already has the introductory free trial configured and that the same product is attached to the active RevenueCat offering/package used by the standard paywall.
- The Apple purchase sheet is the source of truth for whether the account is eligible for the introductory offer.

## Trial Eligibility Notes

- If the same sandbox tester has already consumed the introductory offer for that subscription group, Apple may not show the trial again.
- If you need to re-test eligibility, clear the sandbox purchase history for the tester account and retry with a fresh sandbox session if needed.
- The app only presents trial-aware copy from RevenueCat package data. It does not track trial usage locally.

## What To Verify

- Open the standard `/paywall` flow on iOS and confirm the CTA becomes trial-aware only when the selected subscription package exposes an introductory offer.
- Confirm the dedicated lifetime-offer paywall does not show free-trial messaging.
- Complete a purchase and verify premium unlocks only after RevenueCat returns an active entitlement.
- Use `Restore Purchases` and verify the entitlement refresh updates the UI immediately.
- Cancel out of the Apple purchase sheet and confirm the paywall exits the loading state without unlocking premium.
- Cancel the subscription in Apple subscription settings, wait for RevenueCat customer info to refresh, and confirm premium access follows the active entitlement state.
