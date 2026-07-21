# Journal.IO Experience Flow
This document is the approved revamp journey and an honest implementation tracker. It does not treat a target as shipped behavior.

## Access Matrix

| Area | Free | Pro with AI enabled |
| --- | --- | --- |
| Open-ended journal | Available | Available |
| Guided reflection after onboarding | Locked | Available |
| Manual goals | Available | Available |
| Entry-context goal suggestions | Unavailable | Available, never auto-saved |
| Personal entry analysis and map | Generic preview only | Personal result after safe processing |
| Main Mind Map tab | Educational eight-region model | Educational model plus personal cumulative map |

AI opt-out always keeps journaling, manual goals, Calendar, Home, reminders, account settings, privacy, support, and sign-out available. It removes personal AI analysis and personal Mind Map data.

## Approved Journey

1. Auth supports account creation, sign-in, Apple, Google, email verification, password recovery, and profile recovery.
2. A first-time authenticated user enters V2 onboarding, provides personalization, privacy/AI consent, and reminder preferences, then completes one guided reflection.
3. The onboarding reflection saves one entry and shows its guided value sequence: reflection result, optional suggestions, a one-time Mind Map preview, streak, and Home. The Free preview is not persistent personal Mind Map data.
4. Home is the hub for writing, manual Goals, Calendar, Insights, reminders, streaks, and account settings. iOS navigation is `Home | Calendar | Create entry | Insights | Mind Map`; Android retains Profile in the fifth position for this release.
5. Every Home writing CTA and global create action opens the same chooser. `Write freely` is always available. `Guided reflection` opens a paywall for Free users before any draft is created, except for onboarding's one-time reflection.
6. Saving never waits for AI work, payment, a Mind Map, goals, or a streak view. A saved entry retains its identity through back navigation, retries, cancellation, and purchase return.

## Post-Entry States

Free open-ended saves show a generic blurred analysis preview with `Create goals` and `Continue`. `Create goals` opens manual goals with no entry text or AI context. `Continue` opens a generic blurred Mind Map upgrade preview, then streak and Home. A successful upgrade returns to the same saved entry, briefly processes it, then reveals only the real result.

Pro saves can process analysis after the entry is safely stored. The result shell supports processing, ready, retry, and support-first states. AI goal suggestions are optional and selected suggestions become saved goals only after explicit acceptance. Entry maps may show a brief building state; safety-sensitive content receives the existing support-first experience and is not normally ranked.

## Goals Rules

Goals are a user-owned list, separate from journal metadata. The first Goals screen contains only goals the user created or accepted. It does not expose pending suggestions, journal evidence, hidden entry text, or automatic goals. Goal actions do not determine Mind Map eligibility.

## Mind Map Rules

The Mind Map describes patterns in writing, not literal brain activity or a medical measure. Educational mode always contains all eight tappable regions and never contains personal scores, rank, evidence, pulse, activity claims, or inferred results. Personal Pro mode defaults to `All reflections`, also offers `Latest week`, masks evidence when Hide Journal Previews is on, and uses building or support-first states rather than invented activity.

AI opt-out must clear stored derived personal map contexts. Premium expiry pauses personal processing and returns to educational mode; resubscription may restore securely paused data. Entry edits, deletes, favorites, and eligible historic backfill must invalidate/rebuild derived contexts safely.

## Screen Action Map

| Screen | Key actions | Required return states |
| --- | --- | --- |
| Auth and recovery | create, sign in, verify, reset, recover | auth errors keep entered context where safe |
| Onboarding | personalize, consent, reminders, guided reflection | AI decline stays usable without personal AI results |
| Home | open entry chooser, Goals, settings, Calendar, Insights, Mind Map | returns to the active tab |
| Entry chooser | write freely, guided reflection | Free guided opens paywall before draft; dismissal returns to chooser |
| Journal editor | save immediately | entry remains saved on AI/payment/map/streak failure |
| Post-entry result | retry, create goals, continue, upgrade | preserves entry ID and route through payment |
| Goals | create, accept, edit, dismiss, remove | only explicit active goals persist |
| Mind Map | rotate, zoom, recenter, select region, choose range | educational, building, ready, paused, error, and support-first states |
| Calendar and Entry Detail | revisit, edit, delete, favorite, open eligible results | mutations invalidate derived results safely |
| Account settings | profile, theme, subscription, privacy, export, deletion, support, reminders, sign-out | all privacy changes take effect immediately |

## Implemented Now vs Target

Implemented in this slice:

- journal modes are normalized to `open_ended` and `guided` in current create/update payloads
- authenticated manual Goals list/create/delete endpoints and a Home-linked Goals screen
- authenticated Pro-and-AI-opt-in journal-context suggestion endpoint; suggestions are not auto-saved
- iOS has the primary Mind Map tab; Home exposes account settings; Android keeps Profile tab
- Free and AI-off iOS Mind Map rendering is educational and does not call the personal map API
- personal Mind Map remains the existing cached cumulative endpoint, with `All reflections` selected by default

Still target work:

- reusable entry-type chooser and paid guided-entry gate
- unified post-entry result/paywall-resume shell
- one-to-one per-entry derived reflection contexts, entry detail map access, and resumable historical backfill
- free generic blurred post-entry previews that are separate from personal data
- persisted accepted AI-goal flow, goal editing, and explicit suggestion review UI
- Premium expiry pause/restore state and completed privacy-driven derived-context deletion semantics
