# Publish Readiness Checklist

This checklist tracks what is already implemented and what is still required before Journal.IO is ready for App Store submission.

Use this as the single running go-live tracker. Update a line only when the work is fully implemented, verified, and production-ready.

Last updated: `2026-04-16`

---

## Status Legend

- `[x]` Implemented and considered production-ready
- `[~]` Implemented, but still needs cleanup, QA, or production hardening
- `[ ]` Not done yet

---

## 1) Core Product Flows

- `[x]` Onboarding flow
- `[x]` Auth landing screen
- `[x]` Email create-account UI flow
- `[~]` Email OTP sending and real production verification delivery
- `[x]` Email verification screen and post-verify handoff
- `[x]` Sign in flow
- `[x]` Google sign-in flow
- `[x]` Profile setup flow
- `[x]` Home dashboard
- `[x]` Journal create flow
- `[x]` Journal detail flow
- `[x]` Journal edit flow
- `[x]` Calendar / history flow
- `[x]` Search flow
- `[x]` Insights overview flow
- `[~]` AI insights experience cleanup and final polish
- `[x]` Streaks screen
- `[~]` Reminders screen UI and backend support
- `[ ]` Push notification delivery end to end
- `[x]` Profile screen
- `[x]` Settings screen
- `[x]` Privacy screen
- `[x]` Subscription screen

---

## 2) Premium / Monetization

- `[x]` Main paywall flow
- `[x]` Post-auth 3-step paywall flow
- `[x]` Exit-offer screen
- `[x]` Lifetime-offer screen
- `[x]` RevenueCat integration in development
- `[~]` Final production RevenueCat offering and package verification
- `[~]` Restore purchases QA across real store scenarios
- `[~]` Purchase success and entitlement sync QA on device

---

## 3) Privacy, Data, and Account Controls

- `[x]` Privacy Mode premium gating
- `[x]` Hide Journal Previews premium gating
- `[x]` Export data premium gating
- `[x]` Data export flow for premium users
- `[x]` Delete account flow
- `[~]` Full privacy/settings/manual regression pass

---

## 4) AI and Insights Readiness

- `[x]` AI-backed weekly analysis pipeline integration
- `[x]` Home AI insight card integration
- `[x]` Entry quick analysis premium flow
- `[~]` Final AI insight copy cleanup
- `[~]` Final AI insight UI polish and consistency pass
- `[~]` Verify all AI language is supportive, non-clinical, and production-safe
- `[ ]` Final fallback behavior review when AI is unavailable

---

## 5) Copy and Content Review

- `[ ]` Full app-wide text review for production readiness
- `[ ]` Remove all dev-only or placeholder text that should not ship
- `[ ]` Review all alerts, error messages, and empty states
- `[ ]` Review all paywall, premium, and trial copy
- `[ ]` Review all onboarding, auth, and privacy copy
- `[ ]` Review all AI insight and suggestion copy

---

## 6) Notifications and Device Behavior

- `[x]` Local day-5 free-trial reminder for yearly trial purchases
- `[ ]` Push notification setup and delivery
- `[ ]` Notification permission flow QA
- `[ ]` Reminder scheduling QA on real devices
- `[ ]` Verify skip/reminder-resync behavior after journal creation
- `[ ]` Validate notification copy for production

---

## 7) QA and Release Hardening

- `[ ]` End-to-end auth QA on device
- `[ ]` End-to-end paywall purchase QA on device
- `[ ]` End-to-end restore purchases QA on device
- `[ ]` End-to-end onboarding -> auth -> paywall -> profile -> home QA
- `[ ]` Regression pass across Home, Calendar, Search, Insights, Profile, Settings, and Privacy
- `[ ]` Theme-change animation QA on Home and Settings
- `[ ]` Dark mode and light mode visual QA across core screens
- `[ ]` Small-screen and large-screen layout QA
- `[ ]` Loading / empty / error state QA
- `[ ]` Crash and console-warning cleanup for release builds

---

## 8) Backend and Production Configuration

- `[~]` Production email OTP provider configuration
- `[~]` Production push notification configuration
- `[~]` Production environment variable review
- `[~]` MongoDB paywall/offering/template data review
- `[~]` RevenueCat production identifiers and offering mapping review
- `[ ]` Production API domain and mobile environment verification
- `[ ]` Final secrets/config handoff check

---

## 9) Store Submission Readiness

- `[ ]` App icon and launch/store assets finalized
- `[ ]` App Store screenshots finalized
- `[ ]` App description / subtitle / keywords finalized
- `[ ]` Privacy policy and support URLs finalized
- `[ ]` App Store privacy questionnaire completed
- `[ ]` In-app purchase metadata reviewed in App Store Connect
- `[ ]` Final production build generated and tested

---

## 10) Current Known Open Items

These are the items currently known to still need work before submission:

- `[ ]` Real OTP sending and verification delivery
- `[ ]` Push notifications
- `[ ]` Final AI insights cleanup
- `[ ]` Full production text review across the app

---

## 11) Implemented Areas Snapshot

These areas are already meaningfully implemented in the app and should stay checked unless a regression is found:

- `[x]` Onboarding
- `[x]` Email auth UI
- `[x]` Google sign-in
- `[x]` Verify email screen flow
- `[x]` Profile setup
- `[x]` Home
- `[x]` New entry
- `[x]` Entry detail
- `[x]` Entry edit
- `[x]` Calendar / history
- `[x]` Search
- `[x]` Insights
- `[x]` Streaks
- `[x]` Reminders surface
- `[x]` Profile
- `[x]` Settings
- `[x]` Privacy
- `[x]` Subscription
- `[x]` Main paywall flows
- `[x]` Success screen system

---

## Update Rule

When a feature is finished, update this checklist only after:

1. the implementation is complete
2. the relevant QA or validation is done
3. any required copy/config cleanup is also done

Do not mark an item `[x]` if it still needs production wiring, release QA, or cleanup.
