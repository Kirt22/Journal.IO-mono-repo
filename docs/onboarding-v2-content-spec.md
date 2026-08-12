# Onboarding V2 Content Spec

Date: 2026-06-27

This document defines the implementation-ready content, payload mapping, validation, skip behavior, and future AI usage for the Journal.IO onboarding v2 personalization shell.

Scope:

- Covers the post-auth onboarding v2 personalization flow from Welcome through the AI/privacy disclaimer bottom sheet and the temporary first-reflection handoff.
- Does not define the first guided reflection engine, first journal entry save, first analysis, Mind Map, goals, reminders, paywall, Home, bottom navigation, or RevenueCat behavior.
- Does not change backend contracts. The v2 shell must not call `/onboarding/complete` until Phase 3 creates and saves the first real entry and the product is ready to mark onboarding complete.

Product principles:

- Auth happens before onboarding.
- Onboarding should feel like personalization, not interrogation.
- The visual language is premium, calm, warm, minimal, private, and emotionally safe.
- Do not use mascot assets in onboarding v2. Use the Journal.IO book/logo motif.
- Avoid clinical or diagnostic framing. Use supportive, behavior-focused wording.
- Do not ask gender, faith, relationship status, or ADHD.
- The first entry after personalization is a real journal entry, not a demo.

## Flow Summary

| Order | Screen ID | Required | Payload keys | Primary CTA | Secondary action |
| --- | --- | --- | --- | --- | --- |
| 1 | `welcome` | Optional | none | `Start my reflection` | `Skip setup` |
| 2 | `what_brings_you_here` | Optional | `whatBringsYouHere` | `Continue` | `Skip` |
| 3 | `support_focus` | Optional | `supportFocusAreas` | `Continue` | `Skip` |
| 4 | `day_to_day_context` | Optional | `primaryContext` | `Continue` | `Skip` |
| 5 | `age_range` | Optional | `ageRange` | `Continue` | `Skip` |
| 6 | `reflection_tone` | Optional | `reflectionTone` | `Continue` | `Skip` |
| 7 | `theme_picker` | Optional | `preferredTheme` | `Continue` | `Skip` |
| 8 | `personalization_complete` | Required transition | none | `Continue` | none |
| 9 | `ai_privacy_disclaimer` | Required if consent flag is true | `privacyConsent` | `Start first reflection` | `Not now` only if safe |
| 10 | `first_reflection_handoff` | Temporary Phase 2 placeholder | none | `Continue` | none |

## Payload Shape

Canonical draft payload for Phase 2.1 and Phase 3:

```ts
type OnboardingV2Draft = {
  version: 2;
  whatBringsYouHere?: string[];
  supportFocusAreas?: string[];
  primaryContext?: string;
  ageRange?: string;
  reflectionTone?: string[];
  preferredTheme?: string;
  privacyConsent?: boolean;
};
```

Recommended Phase 3 refinement:

- Keep `reflectionTone: string[]` if backward compatibility with the current frontend type is more important than semantic precision.
- Prefer `reflectionTone: string` for the final persisted contract because the UX should be single-select and a single communication style avoids conflicting AI instructions.
- If changing the type, migrate deliberately and update frontend types, constants, any backend payload validation, and API docs together.

## Screen Specs

### 1. Welcome

| Field | Spec |
| --- | --- |
| Screen ID | `welcome` |
| Purpose | Make the app feel personal and premium immediately. |
| Title | `Let's make Journal.IO feel like yours.` |
| Body | `A private space to reflect, notice patterns, and understand yourself over time.` |
| Primary CTA | `Start my reflection` |
| Secondary CTA | `Skip setup` |
| Required | No. |
| Validation | None. |
| Payload keys | None. |
| Recommended hero | `welcome` variant: abstract book/logo motif, soft glow, tasteful sparkles, subtle waving hand. |
| Recommended animation | Screen fade/slide on entry; book float; hand wave after initial load; subtle sparkle shimmer. |
| Recommended haptic | Light haptic when welcome animation finishes. |
| Accessibility notes | Do not rely on animation to convey meaning. CTA label should clearly start the flow. Progress indicator should not announce "Step X of Y." |
| Small-screen layout | Center hero and copy; keep body to 2-3 lines; avoid oversized top whitespace. |

Options: none.

Future usage:

- No payload. This screen sets emotional tone and trust posture only.
- `Skip setup` should skip optional personalization screens but still show the AI/privacy disclaimer before the first real reflection if the v2 flow continues.

Current implementation notes:

- Current copy matches the spec.
- Current skip jumps directly to `personalization_complete`, which is acceptable for Phase 2.

### 2. What Brings You Here?

| Field | Spec |
| --- | --- |
| Screen ID | `what_brings_you_here` |
| Purpose | Understand the user's main motivation without making onboarding feel diagnostic. |
| Title | `What brings you here?` |
| Subtitle | `Choose what feels closest. You can change this later.` |
| Primary CTA | `Continue` |
| Secondary CTA | `Skip` |
| Required | No. |
| Validation | Allow zero selections. If selected, store unique stable IDs only. |
| Payload keys | `whatBringsYouHere: string[]` |
| Recommended hero | `support` variant. |
| Recommended animation | Card reveal with subtle stagger; selected card scale. |
| Recommended haptic | Light selection haptic on select/deselect. |
| Accessibility notes | Cards should use checkbox role and selected state. Multi-select should be announced clearly. |
| Small-screen layout | Use one-column compact cards; allow scroll; keep footer fixed. |

Options:

| Option ID | User-facing label | Short description | Future usage |
| --- | --- | --- | --- |
| `understand_myself` | Understand myself better | Notice patterns in how you think, feel, and respond. | AI tone/context, first reflection framing, Mind Map seed context. |
| `feel_calmer` | Feel calmer | Create a quieter space for stressful or full days. | Softer prompt wording, grounding-oriented follow-ups, goal suggestions. |
| `build_habit` | Build a journaling habit | Make reflection easier to return to. | Habit-focused goals, reminder tone, first-week encouragement. |
| `process_difficult_days` | Process difficult days | Reflect when a day feels heavy or complicated. | Supportive follow-ups, sensitivity in first reflection, Mind Map themes. |
| `track_patterns` | Track moods and patterns | See what repeats over time. | Pattern-oriented prompts and later insight framing. |
| `better_prompts` | Get better AI prompts | Help Journal.IO ask questions that fit you. | Prompt personalization and tone calibration. |
| `just_trying` | Just trying it out | Keep setup light while you explore. | Lower-pressure copy, simpler first reflection entry. |

Current implementation gaps:

- Current code stores user-facing labels instead of stable IDs.
- Current options have no descriptions.
- Current screen ID is internally `why`, not `what_brings_you_here`.

### 3. What Would You Like Support With?

| Field | Spec |
| --- | --- |
| Screen ID | `support_focus` |
| Purpose | Collect support focus areas without clinical or diagnostic framing. |
| Title | `What would you like support with?` |
| Subtitle | `Pick any areas that would make prompts feel more useful.` |
| Primary CTA | `Continue` |
| Secondary CTA | `Skip` |
| Required | No. |
| Validation | Allow zero selections. If selected, store unique stable IDs only. Do not infer diagnosis from any selected area. |
| Payload keys | `supportFocusAreas: string[]` |
| Recommended hero | `support` variant. |
| Recommended animation | Card reveal; selected card scale; no heavy motion. |
| Recommended haptic | Light selection haptic on select/deselect. |
| Accessibility notes | Cards should use checkbox role. Avoid abbreviations. |
| Small-screen layout | Use compact one-column cards with scroll; keep labels short. |

Options:

| Option ID | User-facing label | Short description | Future usage |
| --- | --- | --- | --- |
| `stress` | Stress | For pressure, tension, or feeling stretched. | Calmer follow-ups, grounding language, action steps. |
| `overthinking` | Overthinking | For loops, rumination, or mental noise. | Reflection prompts that help organize thoughts. |
| `low_mood` | Low mood | For heavier, lower-energy days. | Softer tone and safety-aware language without diagnosis. |
| `loneliness` | Loneliness | For feeling disconnected or unseen. | Social-context sensitivity and relationship-aware prompts. |
| `anger` | Anger | For irritation, conflict, or intensity. | De-escalating prompts and behavior-focused reframing. |
| `shame` | Shame | For self-judgment or feeling not enough. | Extra gentle wording and non-blaming reflection. |
| `focus` | Focus | For distraction or scattered attention. | Practical prompts and clearer action steps. |
| `sleep` | Sleep | For rest, routines, or tiredness. | Sleep-aware context in insights and goals. |
| `confidence` | Confidence | For self-trust and courage. | Encouraging prompts and confidence-building goals. |
| `relationships` | Relationships | For connection, conflict, or boundaries. | Relationship-aware first reflection follow-ups. |
| `motivation` | Motivation | For getting started or keeping momentum. | Action-oriented goals and supportive nudges. |
| `gratitude` | Gratitude | For noticing what feels steady or good. | Gratitude-oriented prompts and Mind Map positive anchors. |
| `self_awareness` | Self-awareness | For understanding reactions and patterns. | Meaning-based prompts and pattern detection seeds. |

Important content rules:

- Do not include ADHD.
- Do not ask "Do you have depression?"
- `Low mood` and `Shame` are allowed because they describe experiences, not diagnoses.

Current implementation gaps:

- Current code stores user-facing labels instead of stable IDs.
- Current options have no descriptions.

### 4. Day-To-Day Context

| Field | Spec |
| --- | --- |
| Screen ID | `day_to_day_context` |
| Purpose | Help AI understand day-to-day context without asking invasive questions. |
| Title | `What does most of your day look like?` |
| Subtitle | `This helps Journal.IO keep examples grounded and relevant.` |
| Primary CTA | `Continue` |
| Secondary CTA | `Skip` |
| Required | No. |
| Validation | Allow no selection. If selected, store one stable ID. |
| Payload keys | `primaryContext: string` |
| Recommended hero | `reflection` variant. |
| Recommended animation | Screen fade/slide; card selection scale. |
| Recommended haptic | Light selection haptic. |
| Accessibility notes | Cards should use radio role. `Prefer not to say` must be treated as a valid answer, not an error. |
| Small-screen layout | Compact cards; scroll only if needed. |

Options:

| Option ID | User-facing label | Short description | Future usage |
| --- | --- | --- | --- |
| `student` | Student | School, coursework, or study rhythms. | Prompt examples, first reflection context, goal suggestions. |
| `working_full_time` | Working full-time | Workdays, routines, and professional load. | Examples and action steps that fit work schedules. |
| `building_something` | Building something | A project, business, craft, or personal venture. | Motivation prompts and progress-oriented goals. |
| `looking_for_work` | Looking for work | Searching, interviewing, or transition. | Confidence-aware prompts and practical next steps. |
| `caregiving_home` | Caregiving or home responsibilities | Supporting others or managing home life. | Compassionate pacing and realistic action steps. |
| `creative_work` | Creative work | Making, designing, writing, or performing. | Creative-block prompts and reflective examples. |
| `other` | Other | A context not listed here. | Keep personalization broad. |
| `prefer_not_to_say` | Prefer not to say | Skip this context. | Avoid assumptions; keep prompts neutral. |

Current implementation gaps:

- Current code stores labels instead of stable IDs.
- Current label says `Caregiving/home responsibilities`; spec recommends `Caregiving or home responsibilities` for polish and screen-reader clarity.

### 5. Age Range

| Field | Spec |
| --- | --- |
| Screen ID | `age_range` |
| Purpose | Tune prompt tone lightly, not profile the user. |
| Title | `To tune your prompts, choose your age range` |
| Subtitle | `Used only to tune prompt tone. You can skip this.` |
| Primary CTA | `Continue` |
| Secondary CTA | `Skip` |
| Required | No. |
| Validation | Allow no selection. If selected, store one stable ID. Age should not be the first data-collection screen. |
| Payload keys | `ageRange: string` |
| Recommended hero | `tone` variant. |
| Recommended animation | Screen fade/slide; card selection scale. |
| Recommended haptic | Light selection haptic. |
| Accessibility notes | Cards should use radio role. Use en dash visually, but stable IDs in payload. |
| Small-screen layout | Compact cards; no long explanatory copy. |

Options:

| Option ID | User-facing label | Short description | Future usage |
| --- | --- | --- | --- |
| `18_24` | 18-24 | Broad age band. | Tune prompt tone lightly. |
| `25_34` | 25-34 | Broad age band. | Tune prompt tone lightly. |
| `35_44` | 35-44 | Broad age band. | Tune prompt tone lightly. |
| `45_54` | 45-54 | Broad age band. | Tune prompt tone lightly. |
| `55_plus` | 55+ | Broad age band. | Tune prompt tone lightly. |
| `prefer_not_to_say` | Prefer not to say | Skip this detail. | Keep prompts age-neutral. |

Current implementation gaps:

- Current code stores display labels like `25-34`, not stable IDs like `25_34`.
- Current subtitle says `A broad range is enough. You can also skip this.` Spec recommends explicitly adding `Used only to tune prompt tone.`

### 6. Reflection Tone

| Field | Spec |
| --- | --- |
| Screen ID | `reflection_tone` |
| Purpose | Let the user choose how Journal.IO should talk to them. This is a communication style preference, not personality typing. |
| Title | `How should Journal.IO reflect with you?` |
| Subtitle | `This helps shape the tone of prompts and insights.` |
| Primary CTA | `Continue` |
| Secondary CTA | `Skip` |
| Required | No. |
| Validation | Recommended single-select. Current type supports `reflectionTone: string[]`; if keeping array, validate max one selected for final UX. |
| Payload keys | `reflectionTone: string[]` currently; recommended final payload is `reflectionTone: string`. |
| Recommended hero | `tone` variant. |
| Recommended animation | Screen fade/slide; selected card scale. |
| Recommended haptic | Light selection haptic. |
| Accessibility notes | If single-select, use radio role. If current multi-select remains, use checkbox role but cap to one selection before persistence. |
| Small-screen layout | One-column cards; descriptions can be omitted on cards and captured in constants for AI behavior. |

Options:

| Option ID | User-facing label | Future AI behavior |
| --- | --- | --- |
| `gentle_supportive` | Gentle and supportive | Softer wording, more reassurance, slower pacing, more emotional safety language. |
| `direct_practical` | Direct and practical | Concise questions, clearer action steps, less abstract reflection. |
| `deep_reflective` | Deep and reflective | More meaning-based questions and pattern-oriented prompts. |
| `light_simple` | Light and simple | Shorter prompts, less heavy language, lower cognitive load. |
| `motivating` | Motivating | Encouraging, action-oriented, momentum-building language. |
| `neutral` | Neutral | Balanced, minimal, less emotionally colored phrasing. |

Recommendation:

- Make this single-select before Phase 3. Multiple tone selections can produce conflicting AI instructions, for example `direct_practical` plus `deep_reflective`.
- If keeping the current `string[]` payload temporarily, store either `[]` or `[toneId]`.

Current implementation gaps:

- Current implementation is multi-select and stores labels rather than stable IDs.
- Current copy does not explicitly say this is not personality typing. Add this in copy or helper text before Phase 3.

### 7. Theme Picker

| Field | Spec |
| --- | --- |
| Screen ID | `theme_picker` |
| Purpose | Give instant personalization and make the app feel owned by the user. |
| Title | `Choose a visual theme` |
| Subtitle | `Choose the atmosphere you want Journal.IO to open with.` |
| Primary CTA | `Continue` |
| Secondary CTA | `Skip` |
| Required | No. If skipped, default to `warm_cream`. |
| Validation | Allow no selection. If selected, store one stable ID. |
| Payload keys | `preferredTheme: string` |
| Recommended hero | `theme` variant. |
| Recommended animation | Theme cards fade in; selection scale or subtle glow. |
| Recommended haptic | Light haptic on theme selection. |
| Accessibility notes | Theme cards should use radio role; swatches need readable labels in accessibility text. |
| Small-screen layout | Two-column grid when width allows; one-column or compact wrapping on small phones. |

Options:

| Option ID | Display label | Vibe line | Preview colors | Apply now? |
| --- | --- | --- | --- | --- |
| `warm_cream` | Warm Cream | Soft, familiar, reflective. | `#FDFCFB`, `#F5F1ED`, `#E87461`, `#F0B45E` | Can be represented by current light theme; store as preference. |
| `midnight_calm` | Midnight Calm | Quiet, private, low-light. | `#1A1816`, `#2D2A26`, `#FF8A75`, `#F4D7A1` | Can map roughly to current dark theme; store as preference. |
| `soft_peach` | Soft Peach | Warm, gentle, emotionally light. | `#FFF1EA`, `#F2A278`, `#7B4639` | Store for later; do not rewrite theme system now. |
| `forest` | Forest | Grounded, steady, spacious. | `#F2F3EA`, `#6E8B6B`, `#314635` | Store for later; do not rewrite theme system now. |
| `sky_blue` | Sky Blue | Clear, calm, and spacious. | `#F5FAFF`, `#3B82C4`, `#253746` | Store for later; do not rewrite theme system now. |

Current implementation gaps:

- Current implementation uses hyphen IDs (`warm-cream`) rather than underscore IDs (`warm_cream`).
- Current subtitle says the preference will be applied once the theme system supports full previews. That is accurate for Phase 2, but the spec recommends warmer user-facing copy and keeping implementation details out of the UI.

### 8. Personalization Complete

| Field | Spec |
| --- | --- |
| Screen ID | `personalization_complete` |
| Purpose | Make the user feel setup is done and transition into the first real reflection. |
| Title | `Your reflection space is ready.` |
| Body | `Next, we'll create your first real reflection.` |
| Primary CTA | `Continue` |
| Secondary CTA | none |
| Required | Required transition screen. |
| Validation | None. |
| Payload keys | None. |
| Recommended hero | `complete` variant: book/logo hero, tasteful sparkles, no mascot. |
| Recommended animation | Screen fade/slide; celebration sparkles; book float. |
| Recommended haptic | Success haptic when screen appears. |
| Accessibility notes | Celebration must not be required to understand the state. CTA should open disclaimer sheet. |
| Small-screen layout | Center hero/copy; avoid large blank space; CTA fixed near bottom. |

Behavior:

- Tapping `Continue` opens the AI/privacy disclaimer bottom sheet.
- Do not call `/onboarding/complete`.
- Do not show paywall.

Current implementation notes:

- Current copy and behavior match the spec.

### 9. AI/Privacy Disclaimer Bottom Sheet

| Field | Spec |
| --- | --- |
| Screen ID | `ai_privacy_disclaimer` |
| Purpose | Give a small transparent disclaimer before the first AI-guided reflection. |
| Presentation | Bottom sheet/modal, not a full screen. |
| Title | `Before your first reflection` |
| Primary CTA | `Start first reflection` |
| Secondary action | `Not now` only if it safely returns to `personalization_complete` without losing draft state. |
| Required | Required if `REQUIRE_ONBOARDING_V2_PRIVACY_CONSENT` is true. |
| Validation | If consent is required, CTA is disabled until `privacyConsent === true`. |
| Payload keys | `privacyConsent: boolean` |
| Recommended hero | Optional `privacy` iconography inside sheet only if space allows; current sheet without hero is acceptable. |
| Recommended animation | Scrim fade and sheet slide-up. |
| Recommended haptic | None by default; optional light haptic on consent checkbox only if not overused. |
| Accessibility notes | Modal should trap focus while open. Consent checkbox must expose checked state. Legal links must be accessible as links. Disabled CTA must be clear. |
| Small-screen layout | Keep bullets short; avoid requiring scroll where possible; CTA visible at bottom. |

Body points:

- `Journal.IO uses AI to help you reflect.`
- `It does not diagnose, treat, or replace professional care.`
- `AI reflections may be imperfect.`
- `You stay in control of your entries.`
- `You can delete or export your data.`

Legal copy:

- `Review our Privacy Policy and Terms.`
- `Privacy Policy` opens the existing Privacy Policy link.
- `Terms` opens the existing Terms link.

Consent checkbox copy:

- `I agree to the Privacy Policy and Terms.`

Behavior:

- If `REQUIRE_ONBOARDING_V2_PRIVACY_CONSENT` is true, consent is a hard gate.
- On continue, set `privacyConsent: true`.
- Continue to the first real guided reflection in Phase 3.
- In Phase 2, continue to the placeholder handoff.

Current implementation notes:

- Current body points match the spec.
- Current sheet includes `Not now` because `onDismiss` is provided. This is acceptable only if dismissing leaves the user safely on `personalization_complete`.
- Current consent is stored as a privacy-policy acknowledgement, not an AI feature preference.

### 10. First Reflection Placeholder Handoff

| Field | Spec |
| --- | --- |
| Screen ID | `first_reflection_handoff` |
| Purpose | Temporary Phase 2 placeholder that Phase 3 will replace with the real guided reflection. |
| Title | `Your first reflection starts next.` |
| Body | `In the next step, Journal.IO will ask a few thoughtful questions and turn your answers into your first real entry.` |
| Primary CTA | `Continue` in development/feature branches only. |
| Secondary CTA | none |
| Required | Temporary. |
| Validation | None. |
| Payload keys | None. |
| Recommended hero | `reflection` variant. |
| Recommended animation | Screen fade/slide. |
| Recommended haptic | None. |
| Accessibility notes | Make clear this is a handoff, not a completed state. |
| Small-screen layout | Center copy; include no extra form controls. |

Required TODO:

```ts
// TODO Phase 3: replace this placeholder with real guided reflection + first entry save + first analysis.
```

Expanded Phase 3 TODO:

- Replace placeholder with real guided reflection.
- Save the first real journal entry.
- Trigger first analysis.
- Seed Mind Map generation.
- Continue to Mind Map generating, Mind Map reveal, Mind Map explanation, goals, reminder setup, paywall, then Home.

Hard rules:

- Do not call `/onboarding/complete` here in Phase 2 or Phase 2.1.
- Do not show paywall here.
- Do not create an entry here.
- Do not show first analysis here.
- Do not route to Mind Map here.

Current implementation notes:

- Current placeholder copy matches the spec.
- Current `Continue` only shows a local note and does not complete onboarding. That is acceptable for Phase 2.

## Phase 3 Handoff Contract

Phase 3 should pass the onboarding v2 draft into the first real guided reflection engine:

```ts
type FirstReflectionPersonalizationContext = {
  whatBringsYouHere?: string[];
  supportFocusAreas?: string[];
  primaryContext?: string;
  ageRange?: string;
  reflectionTone?: string[]; // or string after contract refinement
  preferredTheme?: string;
  privacyConsent?: boolean;
};
```

Required draft fields for Phase 3 context:

- `whatBringsYouHere`
- `supportFocusAreas`
- `primaryContext`
- `ageRange`
- `reflectionTone`
- `preferredTheme`
- `privacyConsent`

Guided reflection usage:

- The first 3 guided reflection questions should remain fixed so every new user gets a stable, reliable entry start.
- Later questions may become dynamic based on the user's feeling, answers, and onboarding draft.
- `reflectionTone` changes wording style only. It should not change safety obligations or factual behavior.
- `supportFocusAreas` should influence follow-up sensitivity and avoid blunt wording around tender topics like low mood, loneliness, anger, or shame.
- `primaryContext` should influence examples and action steps, for example school, work, caregiving, creative work, or job search contexts.
- `whatBringsYouHere` should influence first-reflection framing, goal suggestions, and Mind Map seed context.
- `ageRange` should lightly tune prompt tone only. It must not be used for profiling or exclusion.
- `preferredTheme` should personalize visual preference only until the theme system supports more modes.
- `privacyConsent` must be true when required before any AI-guided reflection starts.

Mind Map usage:

- Use selected motivations and support focus areas as seed context for initial Mind Map categories.
- Do not show inferred identity labels.
- Phrase early map nodes as patterns or areas of attention, not diagnoses.
- Example safe language: `A recurring focus may be stress around work rhythms.`

Goals/reminder usage:

- Use `whatBringsYouHere`, `supportFocusAreas`, and `primaryContext` to suggest goals after first analysis.
- Do not ask for reminder setup until after first entry and first analysis have shown value.
- Paywall should come after first entry, first analysis, goals, and reminder setup.

## Recommended TypeScript Constants

Recommended location:

- Move onboarding v2 option definitions to `frontend/src/screens/onboarding/onboardingV2.constants.ts`.
- This keeps `OnboardingV2Screen.tsx` focused on composition and state, and makes Phase 3 AI mapping easier.
- Do not move constants as part of Phase 2.1 unless the change is intentionally scoped and tested.

Recommended constants shape:

```ts
type OnboardingV2Option = {
  id: string;
  label: string;
  description?: string;
  aiUsage: string;
};

export const WHAT_BRINGS_YOU_HERE_OPTIONS = [
  {
    id: "understand_myself",
    label: "Understand myself better",
    description: "Notice patterns in how you think, feel, and respond.",
    aiUsage: "First reflection framing, goal suggestions, Mind Map seed context.",
  },
  {
    id: "feel_calmer",
    label: "Feel calmer",
    description: "Create a quieter space for stressful or full days.",
    aiUsage: "Softer prompt wording and grounding-oriented follow-ups.",
  },
  {
    id: "build_habit",
    label: "Build a journaling habit",
    description: "Make reflection easier to return to.",
    aiUsage: "Habit goals, reminders, and first-week encouragement.",
  },
  {
    id: "process_difficult_days",
    label: "Process difficult days",
    description: "Reflect when a day feels heavy or complicated.",
    aiUsage: "Supportive follow-ups and sensitivity in first reflection.",
  },
  {
    id: "track_patterns",
    label: "Track moods and patterns",
    description: "See what repeats over time.",
    aiUsage: "Pattern-oriented prompts and insight framing.",
  },
  {
    id: "better_prompts",
    label: "Get better AI prompts",
    description: "Help Journal.IO ask questions that fit you.",
    aiUsage: "Prompt personalization and tone calibration.",
  },
  {
    id: "just_trying",
    label: "Just trying it out",
    description: "Keep setup light while you explore.",
    aiUsage: "Lower-pressure copy and simpler first reflection entry.",
  },
] as const;

export const SUPPORT_FOCUS_OPTIONS = [
  { id: "stress", label: "Stress" },
  { id: "overthinking", label: "Overthinking" },
  { id: "low_mood", label: "Low mood" },
  { id: "loneliness", label: "Loneliness" },
  { id: "anger", label: "Anger" },
  { id: "shame", label: "Shame" },
  { id: "focus", label: "Focus" },
  { id: "sleep", label: "Sleep" },
  { id: "confidence", label: "Confidence" },
  { id: "relationships", label: "Relationships" },
  { id: "motivation", label: "Motivation" },
  { id: "gratitude", label: "Gratitude" },
  { id: "self_awareness", label: "Self-awareness" },
] as const;

export const PRIMARY_CONTEXT_OPTIONS = [
  { id: "student", label: "Student" },
  { id: "working_full_time", label: "Working full-time" },
  { id: "building_something", label: "Building something" },
  { id: "looking_for_work", label: "Looking for work" },
  { id: "caregiving_home", label: "Caregiving or home responsibilities" },
  { id: "creative_work", label: "Creative work" },
  { id: "other", label: "Other" },
  { id: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export const AGE_RANGE_OPTIONS = [
  { id: "18_24", label: "18-24" },
  { id: "25_34", label: "25-34" },
  { id: "35_44", label: "35-44" },
  { id: "45_54", label: "45-54" },
  { id: "55_plus", label: "55+" },
  { id: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export const REFLECTION_TONE_OPTIONS = [
  { id: "gentle_supportive", label: "Gentle and supportive" },
  { id: "direct_practical", label: "Direct and practical" },
  { id: "deep_reflective", label: "Deep and reflective" },
  { id: "light_simple", label: "Light and simple" },
  { id: "motivating", label: "Motivating" },
  { id: "neutral", label: "Neutral" },
] as const;

export const THEME_OPTIONS = [
  {
    id: "warm_cream",
    label: "Warm Cream",
    vibe: "Soft, familiar, reflective.",
    colors: ["#FDFCFB", "#F5F1ED", "#E87461", "#F0B45E"],
  },
  {
    id: "midnight_calm",
    label: "Midnight Calm",
    vibe: "Quiet, private, low-light.",
    colors: ["#1A1816", "#2D2A26", "#FF8A75", "#F4D7A1"],
  },
  {
    id: "soft_peach",
    label: "Soft Peach",
    vibe: "Warm, gentle, emotionally light.",
    colors: ["#FFF1EA", "#F2A278", "#7B4639"],
  },
  {
    id: "forest",
    label: "Forest",
    vibe: "Grounded, steady, spacious.",
    colors: ["#F2F3EA", "#6E8B6B", "#314635"],
  },
  {
    id: "sky_blue",
    label: "Sky Blue",
    vibe: "Clear, calm, and spacious.",
    colors: ["#F5FAFF", "#3B82C4", "#253746"],
  },
] as const;
```

## Current Implementation Gaps

- Most option answers currently store user-facing labels instead of stable IDs.
- Theme IDs currently use hyphens, while this spec recommends underscores.
- Reflection tone is currently multi-select; this spec recommends single-select.
- Reflection tone copy does not explicitly say it is a communication style preference, not personality typing.
- Option descriptions are not rendered, although `OnboardingOptionCard` already supports a `description` prop.
- Options currently live inside `OnboardingV2Screen.tsx`; this spec recommends moving them to `onboardingV2.constants.ts`.
- The theme picker copy mentions implementation detail about future full previews. Product copy should be warmer before Phase 3.
- The AI/privacy sheet includes `Not now`. This is only safe if it returns to `personalization_complete` and preserves draft state.
- The placeholder CTA currently shows a Phase 2 note. That is acceptable in development but should not be exposed in production.

## Recommended Small Copy Changes

- Age subtitle:
  - Current: `A broad range is enough. You can also skip this.`
  - Recommended: `Used only to tune prompt tone. You can skip this.`
- Reflection tone helper:
  - Add: `This is just a communication style preference, not a personality type.`
- Theme subtitle:
  - Current: `We'll save the preference now and apply it once the theme system supports full previews.`
  - Recommended: `Choose the atmosphere you want Journal.IO to open with.`
- Day-to-day context option:
  - Current: `Caregiving/home responsibilities`
  - Recommended: `Caregiving or home responsibilities`

## Do Not Implement Yet

- Do not build the first guided reflection engine.
- Do not create or save the first entry.
- Do not trigger first analysis.
- Do not build Mind Map generating, reveal, or explanation screens.
- Do not build goals or reminder setup in this phase.
- Do not show or wire paywall logic.
- Do not call `/onboarding/complete`.
- Do not write onboarding v2 draft data to user, journal, reminder, or subscription records in Phase 2.1.
- Do not change RevenueCat product IDs, offering IDs, entitlement IDs, API keys, or purchase logic.
- Do not redesign Home or bottom navigation.

## Phase 3 Dependencies

- Decide whether final `reflectionTone` is `string` or `string[]`.
- Convert option selections from labels to stable IDs.
- Move option constants out of `OnboardingV2Screen.tsx`.
- Define where local draft state is passed when the first guided reflection starts.
- Define when the first saved entry triggers analysis.
- Define the first analysis response shape and how it seeds Mind Map.
- Define the exact point where onboarding becomes complete and `/onboarding/complete` is called.
- Confirm privacy consent requirements with existing legal/privacy logic.
- Confirm whether theme preference is only local for Phase 3 or persisted later.

## Risks

- Label-based payloads are brittle for analytics, AI prompts, localization, and backend persistence.
- Multi-select tone can create conflicting prompt instructions.
- If `Not now` dismisses the disclaimer without a safe destination, users could get stuck before the first reflection.
- If theme preference is applied before the theme system supports it, the app may introduce visual drift.
- If `/onboarding/complete` is called before the first real entry is saved, users may skip the intended value sequence and hit paywall too early.
- If support focus areas are treated as clinical conditions, the product may violate the non-diagnostic positioning.

## Code Match Summary

Matches current Phase 2 implementation:

- Overall screen order.
- Welcome copy.
- Personalization complete copy.
- Bottom sheet title and body points.
- Placeholder copy and no `/onboarding/complete` behavior.
- Mascot-free book/logo hero approach.
- Local-only draft state.
- Consent hard gate controlled by `REQUIRE_ONBOARDING_V2_PRIVACY_CONSENT`.

Does not fully match current Phase 2 implementation:

- Stable option IDs are not yet used for most selections.
- Reflection tone should become single-select.
- Theme IDs should use canonical underscore IDs.
- Some helper copy should be refined before Phase 3.
- Options should move to a constants file before AI/persistence work begins.
