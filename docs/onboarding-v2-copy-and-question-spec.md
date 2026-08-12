# Onboarding V2 Copy And Question Spec

Date: 2026-06-27

## Phase 2.2 Scope

This spec reflects the compact Phase 2.2 onboarding v2 shell. It does not define the first guided reflection engine, first entry creation, first analysis, Mind Map, goals, reminders, paywall, Home, bottom navigation, RevenueCat, or `/onboarding/complete`.

## New Screen Order

| Order | Screen | Payload |
| --- | --- | --- |
| 1 | Intro / hi screen | none |
| 2 | How did you hear about us? | `referralSource` |
| 3 | Personalization start + age | `ageRange` |
| 4 | Occupation | `primaryContext` |
| 5 | AI tone | `reflectionTone: [toneId]` |
| 6 | What are you dealing with lately? | `primarySupportFocus`, `supportFocusAreas: string[]` |
| 7 | Theme selector | `preferredTheme` |
| 8 | Reflection ready screen | none |
| 9 | AI/privacy bottom sheet | `privacyConsent` |
| 10 | First reflection placeholder | none |

Removed screens:

- Old `what_brings_you_here`.
- Old separate large `support_focus` grid.
- Old long day-to-day context screen.
- Old large theme palette UI.

## Global Interaction Rules

- Every screen after intro shows a small back arrow.
- Back cancels any pending auto-advance timer and preserves local draft state.
- Occupation and AI tone remain single-select and auto-advance after a short selected-state delay.
- Support focus is multi-select, keeps a persistent skip action, and shows `Continue` only after at least one option is selected.
- Theme selection stays on-screen, applies the selected app theme live, and uses an explicit `Continue` button plus helper text instead of a skip action.
- `reflectionTone` remains an array for compatibility and stores one value, for example `["direct"]`.
- `supportFocusAreas` remains an array for compatibility and can store multiple values, for example `["stress", "overthinking"]`.
- The intro, ready screen, and placeholder may keep a CTA.
- No v2 screen calls `/onboarding/complete`.
- No v2 screen creates an entry, shows analysis, opens Mind Map, or opens paywall.

## Screen Copy And Options

### 1. Intro / Hi Screen

Title:

- If first name exists: `Hi {firstName}, ready to begin?`
- Fallback: `Ready to begin?`

Body:

- `Start your journaling journey with a space that learns what kind of reflection helps you most.`

CTA:

- `Start my journey`

Notes:

- Uses the app icon/logo asset with subtle float.
- No skip action.
- No mascot, orbit dots, or `hi` badge.

### 2. How Did You Hear About Us?

Title:

- `How did you hear about us?`

Subtitle:

- `Just helps us understand what's working.`

State key:

- `referralSource?: string`

Options:

| Value | Label |
| --- | --- |
| `app_store` | App Store |
| `tiktok_instagram` | TikTok / Instagram |
| `x_twitter` | X / Twitter |
| `friend_family` | Friend or family |
| `reddit_community` | Reddit / community |
| `other` | Other |

Phase 3 note:

- Keep local in Phase 2.2. Persist only when the Phase 3 onboarding contract is defined.

### 3. Personalization Start + Age

Eyebrow:

- `Personalization starts here`

Title:

- `What's your age range?`

Subtitle:

- `Used only to tune the tone of prompts.`

State key:

- `ageRange?: string`

Options:

| Value | Label |
| --- | --- |
| `18_24` | 18-24 |
| `25_34` | 25-34 |
| `35_44` | 35-44 |
| `45_plus` | 45+ |
| `prefer_not_to_say` | Prefer not to say |

### 4. Occupation

Title:

- `What do you do most days?`

Subtitle:

- `This helps make prompts feel more relevant.`

State key:

- `primaryContext?: string`

Options:

| Value | Label |
| --- | --- |
| `student` | Student |
| `working_professional` | Working professional |
| `founder_builder` | Founder / building something |
| `creative_work` | Creative work |
| `looking_for_work` | Looking for work |
| `other_prefer_not` | Other / prefer not to say |

### 5. AI Tone

Title:

- `How should the AI reflect with you?`

Subtitle:

- `Choose the tone that would help you most.`

State key:

- `reflectionTone?: string[]`

Options:

| Value | Label |
| --- | --- |
| `gentle` | Gentle |
| `direct` | Direct |
| `deep` | Deep |
| `practical` | Practical |
| `motivating` | Motivating |
| `neutral` | Neutral |

Notes:

- This is a communication style preference, not personality typing.
- Store one selected value inside the array for compatibility.

### 6. What Are You Dealing With Lately?

Title:

- `What are you dealing with lately?`

Subtitle:

- `Choose any that feel true right now.`

State keys:

- `primarySupportFocus?: string`
- `supportFocusAreas?: string[]`

Options:

| Value | Label |
| --- | --- |
| `stress` | Stress |
| `overthinking` | Overthinking |
| `low_mood` | Low mood |
| `loneliness` | Loneliness |
| `anger` | Anger |
| `focus` | Focus |

Notes:

- This replaces the old motivation/support split.
- Do not include ADHD.
- Do not make this clinical or diagnostic.
- `Skip` always remains visible below a reserved button area after the options.
- `Continue` appears with a small pop-in animation only after at least one support area is selected.

### 7. Theme Selector

Title:

- `Choose your app theme`

Subtitle:

- `Preview how Journal.IO can feel.`

State key:

- `preferredTheme?: string`

Options:

| Value | Label | Primary color |
| --- | --- | --- |
| `warm_cream` | Cream | `#E87461` |
| `midnight_calm` | Midnight | `#FF8A75` |
| `soft_peach` | Peach | `#F2A278` |
| `forest` | Forest | `#6E8B6B` |
| `sky_blue` | Sky Blue | `#3B82C4` |

Notes:

- Show one primary color circle only.
- Store the selected preference in `preferredTheme`.
- The selected theme updates the progress-dot accent, footer button color, onboarding colors, and global app theme tokens live.
- The bottom helper text should read `This can be changed later in the app.`

### 8. Reflection Ready Screen

Title:

- `Your personalization is ready.`

Body:

- `Next, we'll write your first entry.`

CTA:

- `Continue`

Feature cards:

| Text |
| --- |
| Thoughtful questions shaped by your setup. |
| Your writing stays private and protected. |
| Your entries become insights over time. |

Behavior:

- A congratulations icon appears above the title and plays a short shake animation with light haptic cues.
- The title stays bold and compact enough to fit on one line on standard phones.
- The body stays lighter-weight than the title.
- Feature cards use provided icons, are theme-aware, and animate in one by one with a slow subtle stagger.
- The progress indicator treats this ready screen as the final visible onboarding personalization step.
- The `Continue` button stays hidden until the card animation finishes, then appears with a subtle pulsing prompt animation.
- Continue opens the AI/privacy bottom sheet.
- Does not call `/onboarding/complete`.

### 9. AI/Privacy Bottom Sheet

Title:

- `You're in control.`

Body:

- None.

Bullets:

- `AI can ask thoughtful questions and help you notice patterns.`
- `Your entries are private to you and can be deleted anytime.`
- `Journal.IO supports reflection, but does not diagnose or replace professional care.`

Consent checkbox:

- `I agree to the Privacy Policy and Terms.`
- `Privacy Policy` and `Terms` are tappable legal links inside the agreement text.

CTA:

- `Begin my first reflection`

- Secondary action: none. Users can partially drag the sheet down to a half-dismissed snap point, fully dismiss with a stronger downward drag, or tap the scrim when dismissal is safe.

Behavior:

- Bottom sheet fades/slides in on open and fades/slides out before dismissing or continuing.
- There is no close X and no `Not now` text action.
- Users can drag the sheet down under their finger; a moderate pull snaps the sheet half-way down and a stronger pull dismisses it.
- The scrim fades slightly as the sheet is dragged down.
- From the half-way state, users can drag upward to restore the full sheet.
- Privacy Policy and Terms close/reset the bottom sheet before opening legal content, so returning to the ready screen can open the sheet again from a clean state.
- The title is centered.
- The agreement checkbox plays a small pop animation when tapped.
- When consent enables the CTA, the primary button plays a subtle scale/highlight sweep.
- If `REQUIRE_ONBOARDING_V2_PRIVACY_CONSENT` is true, CTA is disabled until checked.
- CTA routes to the Phase 2 placeholder only.

### 10. First Reflection Placeholder

Title:

- `Your first reflection starts next.`

Body:

- `Journal.IO will ask a few thoughtful questions and turn your answers into your first real entry.`

Required TODO:

```ts
// TODO Phase 3: replace this placeholder with real guided reflection + first entry save + first analysis.
```

Hard rules:

- Do not call `/onboarding/complete`.
- Do not show paywall.
- Do not create a journal entry.
- Do not show first analysis.

## Layout And Card Changes

- Compact content width with no large empty vertical zones.
- No hero artwork on normal question screens.
- Smaller cards with reduced padding, tighter gaps, and subtle selected fills.
- No heavy outlines or large descriptions under each option.
- Theme cards use a single primary color swatch.
- Bottom sheet uses shorter copy, smaller bullets, and softer spacing.

## Animation Changes

- Intro logo: subtle fade/float only.
- Screen transition: subtle fade/slide.
- Option selected: quick scale/fill feedback before auto-advance.
- Ready screen: compact feature cards reveal one by one.
- Bottom sheet: slide-up with scrim.

## What Remains For Phase 3

- Persist any selected v2 draft fields only after the Phase 3 contract is finalized.
- Replace placeholder with the real guided reflection.
- Save the first real entry.
- Trigger first analysis.
- Seed Mind Map from first entry and onboarding draft.
- Add goals, reminder setup, paywall, and eventual onboarding completion.
- Define exactly when `/onboarding/complete` should be called after value is shown.

## Manual Test Checklist

1. New auth user enters v2 onboarding when dev flag enabled.
2. Intro greets by first name if available.
3. Intro CTA goes to referral screen.
4. Referral option auto-advances.
5. Back arrow returns to previous screen.
6. Age option auto-advances.
7. Occupation option auto-advances.
8. AI tone option stores `[toneId]`.
9. Dealing-with-lately stores `supportFocusAreas` as a multi-select array.
10. Theme stores `preferredTheme`.
11. Theme UI shows only one color per theme and applies the selected theme live.
12. Ready screen feature cards animate in.
13. Bottom sheet opens from ready screen.
14. Bottom sheet can snap half-way, restore upward, and dismiss with a stronger downward drag or scrim tap while preserving draft.
15. Privacy Policy and Terms links can be opened and closed, then the ready-screen Continue button opens the sheet again.
16. Consent gate works.
17. Begin my first reflection goes only to placeholder.
18. No onboarding complete call is made.
19. No paywall appears.
20. Old onboarding fallback still works when v2 flag disabled.
