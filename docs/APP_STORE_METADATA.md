# App Store Metadata

Captured: `2026-08-18` · Target version: **1.3** (`PREPARE_FOR_SUBMISSION`)

App Store Connect app ID `6770075245` · bundle `app.journalio` · SKU `journalio-ios` · primary locale `en-US`.

This document is the source of truth for Journal.IO's App Store listing copy. Every
value below is written to be pasted directly into App Store Connect without edits.

**Two localizations are live: `en-US` and `en-GB`.** They are maintained separately
below. Do not copy one into the other — see [Localization rules](#localization-rules).

---

## Localization rules

- **`en-US` is the primary language.** Any storefront without a matching localization
  falls back to it. `en-GB` serves the UK storefront and the other storefronts that
  default to English (U.K.).
- **Keyword pools do not combine across locales.** Apple indexes *name + subtitle +
  keywords* together, per locale, for that locale's storefronts only. Each locale's
  keyword list must therefore be self-sufficient — never split terms across locales
  hoping they add up.
- **Never repeat a term across name, subtitle, and keywords within one locale.** It is
  indexed once and the duplicate slot is wasted. The name already contributes
  `journal`, `io`, `ai`, `journaling` in both locales, so neither subtitle nor keyword
  list may reuse them.
- **Apple ignores stopwords** (`and`, `the`, `for`, `a`, `with`) and separators in the
  keyword field. Use commas with **no spaces** — a space costs a character and buys
  nothing.
- **Spelling follows the locale.** `en-US`: favorites, behavior. `en-GB`: favourites,
  behaviour, journalling.
- **Promotional Text is editable without a new build or review.** Use it for
  time-sensitive angles; keep the evergreen pitch in the description.

---

## Shared, non-localized

| Field | Value |
|---|---|
| Name (both locales) | `Journal.IO - AI Journaling` |
| Primary Category | Health & Fitness |
| Secondary Category | Lifestyle |
| Copyright | `© 2026 Journal.IO. All rights reserved.` |
| Marketing URL | `https://journalio.app/` |
| Support URL | `https://api.journalio.app/support` |
| Privacy Policy URL | `https://api.journalio.app/privacy` |
| Privacy Choices URL | `https://api.journalio.app/privacy-choices` |
| Release type | Manual |

---

# en-US

App-level localization `20ade910-20eb-429e-90f3-16d55aecc8e6` ·
version localization `18b8388a-e7e9-4d4e-ace3-3dec5edf1752`

## en-US — Name (30 max)

```
Journal.IO - AI Journaling
```

## en-US — Subtitle (30 max)

```
Diary, Mood Tracker & Insights
```

Adds `diary`, `mood`, `tracker`, `insights` — none of which appear in the name.
Supersedes `AI Journaling & Mood Tracker`, which duplicated `AI` and `Journaling`
from the name and so indexed only `mood` and `tracker`.

## en-US — Keywords (100 max)

```
prompts,reflection,thoughts,guided,self,private,lock,gratitude,stress,anxiety,vent,feelings,secret
```

Chosen from measured competition — see [Keyword research](#keyword-research).

Dropped, with the reason: `notes` (Apple's own Notes owns it, 627k ratings), `mindful`
(Headspace, 974k), `care` (Finch owns "self care", 741k), `habit` (145k), `sleep`
(SleepWatch, 328k), `daily` ("daily journal" is Day One's, 118k). Those six were
unwinnable and were spending characters for nothing.

Added, with what each unlocks: `prompts` → **"journal prompts", whose top result has 6
ratings**; `thoughts` (274); `guided` → "guided journal" (1,854); `self` → **"self
reflection", top result has 0 ratings**; `lock` + `private` + `secret` → the
"diary with lock" / "private journal" / "secret diary" cluster, all held by one app at
27k; `vent` (3,524); `feelings` → "emotion tracker" (29k).

## en-US — Promotional Text (170 max)

```
Meet Jade. Ask about anything you've written, see how your thoughts connect on the Mind Map, and never face a blank page again.
```

## en-US — Description (4000 max)

```
Journal.IO is a calm place to write things down, and a quiet way to notice what keeps coming back.

Three minutes of writing. The app does the noticing.

WRITE WITHOUT FACING A BLANK PAGE
Open the app and answer one question. Guided reflection adapts to how you're feeling and gets out of the way when the words are already there. Your entry saves the moment you finish — writing never waits on AI.

TALK IT THROUGH WITH JADE
Jade is a private AI that has read your journal and nothing else. Ask why last week felt heavy, what keeps coming up, or what might be worth trying. Conversations are saved, so you can pick one back up days later.

SEE HOW YOUR THOUGHTS CONNECT
The Mind Map turns your entries into a picture of the themes, people, and moods that keep showing up — all-time or week by week. Patterns, not verdicts.

CHECK IN, EVEN ON THE DAYS YOU DON'T WRITE
Log mood, stress, energy, and sleep in seconds. Watch how they move across your calendar and history.

STAY CONSISTENT FROM YOUR HOME SCREEN
Streak, Quick Thought, and Mood Check-in widgets let you keep the habit without opening the app. Gentle reminders, only if you want them.

GOALS IN YOUR OWN WORDS
Set what you're working toward and see how your writing connects to it.

YOUR THOUGHTS STAY YOURS
Lock the app with Face ID or Touch ID. Hide entry previews from the app switcher. Export everything or delete it for real — no ads, ever, and we do not sell your journal content.

FIVE THEMES
Pick the one you'll actually want to open.

HONEST ABOUT WHAT'S FREE
Free forever: unlimited entries, daily mood check-ins and history, streaks, calendar, search and favorites, goals you create and own, the Streak widget, and all five themes.

Premium adds: Ask Jade with saved conversations, guided reflection any time with Go deeper, weekly and per-entry analysis, your personal Mind Map, the Quick Thought and Mood Check-in widgets, and the Face ID app lock.

NON-CLINICAL BY DESIGN
Journal.IO is a reflection tool, not a medical one. Insights are supportive and behavior-focused. It does not diagnose conditions, give medical advice, or replace professional support.

Start with today. One entry is enough to begin — the patterns turn up on their own.

Terms of Use: https://api.journalio.app/terms
Privacy Policy: https://api.journalio.app/privacy
```

## en-US — What's New, v1.3 (4000 max)

```
Journal.IO v2 — the biggest update since launch.

Ask Jade
A private AI you can actually talk to about what you've written. Ask why a week felt heavy, what keeps coming up, or what to try next. Conversations are saved so you can pick them back up.

The Mind Map
See how your themes, people, and moods connect over time — all-time or week by week.

Guided reflection
Never face a blank page. A short guided flow adapts to how you're feeling, with "Go deeper" when you want to keep going.

Home Screen widgets
Streak, Quick Thought, and Mood Check-in widgets, so staying consistent doesn't mean opening the app.

Goals
Set goals in your own words and see how your entries connect to them.

Face ID app lock
Lock the app with Face ID or Touch ID and hide entry previews from the app switcher.

Five themes
Pick the one you'll actually want to open.

Also in this release: a redesigned home and writing experience, a rebuilt first-run setup, richer weekly and per-entry analysis, and a long list of reliability and performance fixes.

Writing never waits on AI — your entry saves instantly, every time.
```

---

# en-GB

App-level localization `64abb1c2-4ee3-4374-809f-15d6a8106b32` ·
version localization `86740c69-ec7a-49c7-b986-1179101f19d1`

## en-GB — Name (30 max)

```
Journal.IO - AI Journaling
```

Deliberately identical to `en-US`. The name carries brand recognition across
storefronts and already contributes `journal` / `journaling` to the UK keyword pool.

## en-GB — Subtitle (30 max)

```
Mood Diary & Wellbeing Tracker
```

UK and Ireland search **diary** far more than **journal**, and `journaling` is already
in the name — so leading on `diary` adds a high-volume term rather than repeating one.
Drops the `AI` from the proposed `AI Diary and Mood Tracker` (already in the name) and
the stopword `and` (never indexed).

The reclaimed characters go to `wellbeing`, not `sleep`. `wellbeing` is the standard UK
term and its top-ranked competitor has **4,480** ratings; `sleep` is owned by SleepWatch
at **328,457** and we would never rank. Same character cost, two orders of magnitude
less competition.

## en-GB — Keywords (100 max)

```
prompts,reflection,thoughts,guided,self,private,lock,gratitude,stress,journalling,vent,goals,secret
```

Self-sufficient for UK storefronts — it does not rely on the `en-US` list.

Differs from `en-US` in three places. `journalling` is the British double-L spelling;
Apple's stemming is not reliably cross-spelling, so `en-US`'s `journaling` may not
match it. `goals` replaces `feelings` because the Goals feature is in the free tier.
`anxiety` is dropped — see the note on it under [Keyword research](#keyword-research).
`calm` was considered and rejected: the term is owned by Calm, a meditation app far
outside our weight class.

## en-GB — Promotional Text (170 max)

```
Meet Jade. Ask about anything you've written, see how your thoughts connect on the Mind Map, and never face a blank page again.
```

## en-GB — Description (4000 max)

```
Journal.IO is a calm place to write things down, and a quiet way to notice what keeps coming back.

Three minutes of writing. The app does the noticing.

WRITE WITHOUT FACING A BLANK PAGE
Open the app and answer one question. Guided reflection adapts to how you're feeling and gets out of the way when the words are already there. Your entry saves the moment you finish — writing never waits on AI.

TALK IT THROUGH WITH JADE
Jade is a private AI that has read your journal and nothing else. Ask why last week felt heavy, what keeps coming up, or what might be worth trying. Conversations are saved, so you can pick one back up days later.

SEE HOW YOUR THOUGHTS CONNECT
The Mind Map turns your entries into a picture of the themes, people, and moods that keep showing up — all-time or week by week. Patterns, not verdicts.

CHECK IN, EVEN ON THE DAYS YOU DON'T WRITE
Log mood, stress, energy, and sleep in seconds. Watch how they move across your calendar and history.

STAY CONSISTENT FROM YOUR HOME SCREEN
Streak, Quick Thought, and Mood Check-in widgets let you keep the habit without opening the app. Gentle reminders, only if you want them.

GOALS IN YOUR OWN WORDS
Set what you're working towards and see how your writing connects to it.

YOUR THOUGHTS STAY YOURS
Lock the app with Face ID or Touch ID. Hide entry previews from the app switcher. Export everything or delete it for real — no ads, ever, and we do not sell your journal content.

FIVE THEMES
Pick the one you'll actually want to open.

HONEST ABOUT WHAT'S FREE
Free forever: unlimited entries, daily mood check-ins and history, streaks, calendar, search and favourites, goals you create and own, the Streak widget, and all five themes.

Premium adds: Ask Jade with saved conversations, guided reflection any time with Go deeper, weekly and per-entry analysis, your personal Mind Map, the Quick Thought and Mood Check-in widgets, and the Face ID app lock.

NON-CLINICAL BY DESIGN
Journal.IO is a reflection tool, not a medical one. Insights are supportive and behaviour-focused. It does not diagnose conditions, give medical advice, or replace professional support.

Start with today. One entry is enough to begin — the patterns turn up on their own.

Terms of Use: https://api.journalio.app/terms
Privacy Policy: https://api.journalio.app/privacy
```

## en-GB — What's New, v1.3 (4000 max)

```
Journal.IO v2 — the biggest update since launch.

Ask Jade
A private AI you can actually talk to about what you've written. Ask why a week felt heavy, what keeps coming up, or what to try next. Conversations are saved so you can pick them back up.

The Mind Map
See how your themes, people, and moods connect over time — all-time or week by week.

Guided reflection
Never face a blank page. A short guided flow adapts to how you're feeling, with "Go deeper" when you want to keep going.

Home Screen widgets
Streak, Quick Thought, and Mood Check-in widgets, so staying consistent doesn't mean opening the app.

Goals
Set goals in your own words and see how your entries connect to them.

Face ID app lock
Lock the app with Face ID or Touch ID and hide entry previews from the app switcher.

Five themes
Pick the one you'll actually want to open.

Also in this release: a redesigned home and writing experience, a rebuilt first-run setup, richer weekly and per-entry analysis, and a long list of reliability and performance fixes.

Writing never waits on AI — your entry saves instantly, every time.
```

---

## Screenshots

Seven panels are uploaded to 1.3 for `APP_IPHONE_67` and `APP_IPAD_PRO_3GEN_129`.
Art direction and the generation prompts live in `docs/APP_STORE_SCREENSHOT_PROMPTS.md`.

Panel headlines, in order:

1. Check in with yourself
2. Never face a blank page
3. Talk it through with Jade
4. See how your thoughts connect
5. Stay consistent from your Home Screen
6. Your thoughts stay yours
7. *(unconfirmed — a seventh panel is uploaded but `APP_STORE_SCREENSHOT_PROMPTS.md` documents only six plates; confirm what panel-7 shows and record it here)*

The description's section headers map onto these headlines on purpose — the panels and
the copy must tell the same story. **If a panel changes, change the matching header.**

---

## App Review Notes — 1.3

Paste into App Store Connect → version → **App Review Information → Notes**.
Fill the `[…]` placeholders and verify both demo accounts are in the state the notes
claim. Body is 3,996 characters against Apple's 4,000 limit — re-count after any edit.

```
WHAT CHANGED IN THIS VERSION
Version 1.3 is a full feature release, not a patch. New in this build: Ask Jade (a private AI that answers questions about the user's own entries), the Mind Map, guided reflection, Home Screen widgets, Goals, a Face ID / Touch ID app lock, five themes, and a redesigned home and first-run experience.

DEMO ACCOUNTS
Sign in with "Continue with email" on the first screen. Both accounts are already email-verified, so no verification code is required. Apple and Google sign-in are also offered.

1) Premium account - for the paid features
Email: [premium demo email]
Password: [premium demo password]
Has an active premium entitlement and existing entries, so Ask Jade, the Mind Map, and weekly analysis have content to work with.

2) Free account - for the paywalls and the two special offers
Email: [free demo email]
Password: [free demo password]
Both offers below are shown only to users without premium, so review them on this account.

WHERE TO FIND THE NEW FEATURES
"Settings icon" below means the icon in the top right of Home.
- Ask Jade: Home, "Ask Jade". Conversations are saved and can be reopened later.
- Mind Map: Insights tab, "Mind Map". Also per entry from an entry detail screen.
- Guided reflection: tap the new-entry button on Home; "Go deeper" continues it.
- Goals: Home, settings icon, "Goals".
- Face ID app lock and Hide Journal Previews: Home, settings icon, "Privacy & Data".
- Themes: Home, settings icon, "Settings".
- Widgets: long-press the iOS Home Screen, add Journal.IO, choose Streak, Quick Thought, or Mood Check-in. Requires a signed-in account.

HOW TO DELETE AN ACCOUNT
Home, then the settings icon in the top right, then "Settings", then "Manage account", then "Delete account". This permanently deletes the account and all journal data from inside the app. Also at https://api.journalio.app/privacy.

IN-APP PURCHASES
Free, no purchase: unlimited entries, mood check-ins and history, streaks, calendar, search, favorites, Goals, the Streak widget, all five themes.
Premium adds: Ask Jade, guided reflection on demand, weekly and per-entry analysis, the Mind Map, the Quick Thought and Mood Check-in widgets, the Face ID app lock, and data export.

Weekly and yearly auto-renewable subscriptions and a one-time lifetime unlock are sold through RevenueCat.

Standard paywall: on the free account, open any premium feature.

Lifetime offer: Home, then the settings icon. Users without premium see an "Unlock Lifetime Premium" card near the top, showing how many of the 100 launch spots are claimed; tap "View lifetime offer". It is hidden once an account has premium.

Discounted yearly offer: it appears in the pill under the greeting on Home only after a user without premium has cleared every item in it. On the free account, in this order: write an entry, complete the mood check-in, clear any pending goals, and open today's reflection. The pill then reads "Your special offer is here" - tap it to open the discounted yearly paywall.

Sandbox testing: purchase the yearly plan with its free trial; premium unlocks once RevenueCat verifies it. Cancelling the trial keeps access until the verified expiration date with auto-renewal shown as disabled, then returns to the free plan. Entitlements are re-verified on launch, on foreground, on RevenueCat updates, and after any purchase. Restore Purchases is on the paywall and under Settings, then Subscription.

AI AND USER DATA
Ask Jade, the Mind Map, and entry and weekly analysis send journal text to OpenAI's API for processing. Disclosed in-app and in the privacy policy; journal content is not sold or used for advertising. AI features are premium-only. If an AI request fails the entry still saves - writing never depends on the model.

Insight language is non-clinical and supportive. The app does not diagnose, give medical advice, or claim to replace professional support.

CONTACT
[support email] - happy to send a screen recording or another test account on request.
```

**Two accounts are required, and it is not optional.** The lifetime card and the
discounted-yearly nudge both render only when the user is not premium
(`ProfileScreen.tsx:830`, `homeNudge.ts:136`), so a reviewer signed in on the premium
account cannot see either offer and will report the in-app purchases as unlocatable.
The premium account makes the paid *features* reviewable without a purchase; the free
account makes the *purchase paths* reachable at all.

**The delete-account path is spelled out in full because a vague version caused a real
rejection.** It is four taps deep (Home → settings icon, top right → Settings → Manage
account → Delete account), and a reviewer who cannot find it files 5.1.1(v). Verify the
path still matches before every submission — if the Settings hierarchy is reorganized,
these notes are wrong and the rejection repeats.

**Expedited review.** Expedited is requested through the separate form in App Store
Connect, not through these notes, and Apple grants it for critical bug fixes and
time-sensitive events — not for feature releases. 1.2's expedited request was
legitimate (broken paid access, offline auth lockout); 1.3 has no equivalent argument.
Submit normally. The way to ship fast here is a first-pass approval, which is what the
notes above are built for.

---

## Keyword research

Measured `2026-08-18` against the public iTunes Search API (`country=us`, top 200 per
term, 51 seed terms). Reproduce with `scripts/aso-probe.py`.

**Method and its limits.** The Search API is not the App Store's ranking algorithm — no
personalization, no Apple editorial signals, different index. Do not read a position
here as your real store rank. What it does give honestly is *who owns a term*, and the
top-ranked competitor's rating count is a sound proxy for how hard that term is to take.
Volume is the thing this method cannot see at all; for true volume figures you need a
paid tool (AppTweak, Sensor Tower, Mobile Action).

### The finding that matters

**Journal.IO appeared in the top 200 for 1 of 51 terms** — `ai journaling`, at position
93, and only because "AI Journaling" is literally in the app name. It ranked for nothing
else. Not `journal`, not `diary`, not `ai journal`, not `mood tracker`, not `reflection`.
The pre-1.3 keyword field was not underperforming, it was inert.

### Difficulty table

Difficulty = rating count of the top-ranked app for that term. Lower is more winnable.

| Winnable | Difficulty | Target? |
|---|---|---|
| self reflection | 0 | ✅ via `self` + `reflection` |
| journal prompts | 6 | ✅ via `prompts` + name |
| thoughts | 274 | ✅ |
| reflect / reflection | 297 / 1,065 | ✅ |
| guided journal | 1,854 | ✅ via `guided` |
| vent | 3,524 | ✅ |
| ai journal / ai journaling | 3,235 | ✅ already in name |
| wellbeing | 4,480 | ✅ en-GB subtitle |
| bullet journal | 301 | ❌ not a bullet journal — relevance |
| voice journal | 2,149 | ❌ no voice feature |
| dream journal | 3,756 | ❌ no dream feature |
| cbt / ai therapist | 367 / 3,200 | ❌ clinical — violates positioning |

| Contested (worth fighting) | Difficulty |
|---|---|
| five minute journal | 17,509 |
| gratitude journal | 17,873 |
| diary / private journal / secret diary / diary with lock | 26,949 (all one app) |
| emotion tracker / feelings | 29,178 |
| mood tracker / mood journal | 61,144 |

| Unwinnable — do not spend characters | Difficulty |
|---|---|
| mindfulness | 973,866 |
| self care | 740,944 |
| affirmations | 727,654 |
| notes | 627,164 |
| sleep tracker | 328,457 |
| journal / journaling / journal app | 309,915 (Apple's own Journal) |
| therapy | 148,918 |
| habit tracker | 145,462 |
| daily journal | 117,717 |

### Competitor naming pattern

Every serious app in this category puts **both** "journal" and "diary" in its name:

| App | Ratings |
|---|---|
| Day One: Daily Journal & Diary | 117,717 |
| Reflectly - Journal & AI Diary | 81,694 |
| Daylio Journal - Mood Tracker | 61,144 |
| stoic. journal & mental health | 35,316 |
| My Diary - Journal with Lock | 27,979 |
| Diary With Password | 26,949 |
| Rosebud: AI Journal & Diary | 3,235 |
| Mindsera: Daily AI Journaling | 254 |

Two consequences. First, our name has `journal` but not `diary`, so `diary` **must**
come from the subtitle — which is why both locales now lead their subtitle with it.
Second, the lock/password cluster is a genuine business: two apps with 27k+ ratings each
are built entirely around it, and Journal.IO has had a Face ID lock since 1.3 but has
never targeted the term. `lock`, `private`, and `secret` are the cheapest relevant
volume available to us.

### Deliberate omissions

- **`anxiety`** (10,357) is in `en-US` only, and it is the one term here worth arguing
  about. Journaling for anxiety is a legitimate non-clinical use, but the term attracts
  users looking for treatment, and `AGENTS.md` holds insight language to non-clinical.
  If review friction or refund/review complaints appear, drop it first.
- **`shadow work`** has real, visible demand — Prompted Journal (6,903 ratings) is named
  for it and several 2026 clones have launched. We have no shadow-work prompt set, so
  targeting it would be a relevance lie. **This is a product opportunity, not a keyword
  one.** Revisit if a shadow-work prompt pack ships.
- **`manifestation`, `affirmations`, `cbt`, `dream`, `voice`** — no matching feature.

### Re-run cadence

Re-run the probe before each submission with metadata changes. The single number to
watch is how many of the 51 terms Journal.IO appears for at all; going from 1 to any
meaningful number is the whole point of the 1.3 rewrite.

---

## Positioning notes

- **Core promise:** a calm place to write, and a quiet way to notice what keeps coming
  back. Not productivity, not therapy.
- **Lead differentiators for paid acquisition:** Ask Jade, the Mind Map, guided
  reflection. These are what v2 has and competitors' journals do not. Mood tracking and
  streaks are table stakes now — they support the pitch, they no longer are it.
- **Free/Premium split in the description is verbatim from the pricing table on
  `journalio.app`.** If one changes, change both. A mismatch between the listing and
  the paywall is an App Review rejection risk.
- **Safety boundary:** insight language stays supportive, non-clinical, and
  behaviour-focused. Never diagnostic. The NON-CLINICAL BY DESIGN paragraph is not
  optional — keep it in every localization.
- **Claims that must stay true to the build:** "five themes", "writing never waits on
  AI", the free/premium feature lists, and "we do not sell your journal content"
  (wording tracks `docs/PRIVACY_POLICY.md` line 98). Re-verify before each submission.

---

## Change log

### 1.3 — 2026-08-18

Rewrote every field except the name. 1.3 inherited 1.2's description and keywords
verbatim, which sold v1: no mention of Ask Jade, the Mind Map, guided reflection,
widgets, Goals, the Face ID lock, or themes — all of which shipped after 1.2
(`9cb9c2a`, `090597c`, `3e41a93`). Promotional Text and What's New were both empty.
Subtitles were rebuilt to stop duplicating the name, and the two keyword lists were
split along US/UK search phrasing. App Review Notes were rewritten from 1.2's
expedited-patch text to a feature-release brief — 1.2's notes documented only the
subscription and offline-auth fixes and named none of the v2 features, all of which are
premium-gated and therefore unreachable to a reviewer without instructions.

### 1.2 — 2026-06-21

Reliability release: RevenueCat lifecycle reconciliation, offline auth, keyboard
handling. Metadata unchanged from 1.1 apart from Promotional Text and What's New.
