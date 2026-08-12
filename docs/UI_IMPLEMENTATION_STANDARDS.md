# UI Implementation Standards

Use these rules for every Journal.IO mobile UI addition or change. They apply
to interaction and layout as well as colours.

## Visual Foundation

- Use `useTheme()` colour tokens. Do not introduce hardcoded UI colours.
- Type comes from `src/theme/typography.ts`. Bricolage Grotesque is the display
  face and Schibsted Grotesk carries UI, body, and entry prose. Both ship as
  static cuts under `src/assets/fonts`, one file per weight, each with its
  PostScript name equal to its filename.
- Do not set `fontFamily` by hand for ordinary text. `src/infrastructure/reactNative.ts`
  wraps `Text` and `TextInput` and resolves the family from `fontWeight`, then
  strips the weight so Android cannot synthesise fake-bold over an already-bold
  file. Text at or above 22px (`DISPLAY_SIZE_THRESHOLD`) switches to the display
  face automatically. Set `fontFamily` explicitly only to opt a specific piece
  of text out of that rule.
- Prefer a `typography` preset (`display`, `title`, `heading`, `body`, `caption`,
  `numeral`, …) over restating size, weight, line height, and tracking inline.
- Weights stop at 700. Do not add `800` or `900`: the cuts do not exist, heavy
  weight on small text is what made the app read loud, and the resolver clamps
  them to Bold anyway.
- Import `Text` and `TextInput` from `../infrastructure/reactNative`, never from
  `react-native` directly, or the type system will not apply.
- Text whose width the app does not control — store-supplied prices, user names,
  entry titles — needs a stated overflow behaviour. Give it `numberOfLines`, and
  where the string must stay whole, shrink it with `adjustsFontSizeToFit` and a
  `minimumFontScale` rather than letting it wrap. Prices go through
  `components/PriceText`, which does this in one place: StoreKit returns each
  storefront's own formatting, so `$59.99` and `Rp 1.499.000` land in the same
  box and nothing in the app gets to choose which.
- A container holding such text uses `minHeight`, not a fixed `height`, so
  content that cannot shrink further grows the container instead of spilling out
  of it. Siblings that must stay the same size should match through the parent's
  stretch behaviour, not through a shared hardcoded height.
- Follow the 4, 8, 12, 16, 20, 24, 32, 40 spacing rhythm.
- Use existing app icons from the current icon set. Icons communicate actions;
  do not add decorative icons without a clear purpose.
- Keep cards, fields, and controls theme-aware through shared components and
  tokens.

## Headers And Sheets

- Detail views presented inside the Account modal use one centered title.
- The Settings modal and its detail views use the legal-browser header treatment:
  a centered 16px regular-weight title, 42px header row, 10px top and 12px
  bottom shell padding, and matching 38px left/right control space.
- Do not place explanatory subtitles in modal headers. Put supporting copy in
  the scrollable body below the header when it is needed.
- Back actions stay on the left. Use an equal right-side spacer so the title is
  visually centered; a root modal may use a close action on the right instead.
- Preserve the active theme across the modal header, body, borders, and native
  presentation backing.
- Theme changes use the shared expanding ripple transition. Keep the current
  palette visible until the ripple covers the screen, then commit the new theme
  beneath it so the transition remains perceptible.
- Native modal sheets need their own `ThemeTransitionOverlay` above the sheet
  content; an app-level overlay renders behind the native modal layer.
- A chat surface keeps the standard non-tab header (back action on the left)
  and may add one identifying icon between the back action and the title, as
  Ask Jade does with its gem. Secondary controls stay on the right. Do not drop
  the back action in favour of swipe-back alone; that is a VoiceOver gap.

## Chat Surfaces

Ask Jade (`screens/jade/AskJadeScreen.tsx`) is the approved pattern for any
conversational surface. Reuse it rather than inventing a second one.

- Transcript is a `ScrollView` with `.map()`, `automaticallyAdjustKeyboardInsets`,
  interactive keyboard dismissal on iOS, and `scrollToEnd` on content-size
  change. There is no `FlatList` anywhere in the app.
- The composer sits below the transcript inside a
  `KeyboardAvoidingView` (`padding` on iOS). The send control uses the shared
  conditional-action spring (`damping: 16`, `stiffness: 220`, `mass: 0.85`) and
  `ButtonLoadingContent` for its in-flight state.
- Replies arrive whole and are revealed word by word on the client; there is no
  streaming transport. This is a temporary waiting state, so the reveal and a
  "thinking" indicator are permitted loops — they are not a third ambient
  animation.
- Safety-sensitive replies are rendered at once, never revealed progressively,
  and carry a distinct destructive-tinted treatment.
- A failed send marks its bubble and returns the text to the composer. Never
  discard what the user wrote.
- Offline disables sending with a quiet notice rather than queueing; the app
  does not replay protected writes after reconnect.

## Motion And Feedback

- Animate only a meaningful state change, not every render or screen mount.
- Use short opacity plus vertical movement for content reveals. Use the
  onboarding support-selection spring for a conditional primary action:
  `damping: 16`, `stiffness: 220`, `mass: 0.85`, with opacity, 10px upward
  movement, and a small 1.035 scale overshoot.
- A press effect on a shader-backed element must drive that element's own
  uniforms, not overlay a separate shape. The Home orb is the reference: a tap
  surges the SkSL `intensity` term so the ring itself warps and settles. A
  generic expanding ring was tried first and read as bolted-on, because a
  hard-edged 2D circle shares nothing with a procedural energy ring. Tune the
  peak by rendering the shader, not by eye — the orb's warp turns the ring into
  a flower well below the value its own `activeIntensity` suggests. A one-shot
  press response is not an ambient loop, so the "do not add a third" rule below
  does not apply to it.
- App-rendered press controls must use `components/HapticPressable`; switches
  must use `components/HapticSwitch`. Both route through the shared persisted
  preference-aware service, and `HapticControlCoverage.test.ts` rejects raw
  native control imports outside those wrappers. Use `hapticEvent={false}` only
  for intentional silent surfaces such as keyboard dismissal or the Haptics
  preference control itself. Never attach haptics to a root touch listener or
  call the native module directly. Completed swipe navigation and action-tray
  state changes may emit one selection cue, but blank content, ordinary scroll
  drags, automatic transitions, passive animation, and text selection stay
  silent.
- The branded Auth entrance and the First Guided Reflection streak-flame
  celebration are the only intentional passive-animation haptic exceptions.
  Once on every Auth visit, its cues may use the shared native haptics service,
  while still respecting the global device-local Haptics preference. Use exactly
  three standard cues: one soft pulse at the first ribbon bend, one heavy pulse
  when the rows merge into the final wordmark, and one selection pulse when the
  two-layer action reveal becomes ready. Reduced-motion mode replaces that
  sequence with one soft welcome pulse. Do not emit haptics for the coral `.io`
  sweep, finite logo breath, or animation fail-safe/fallback completion.
- The streak flame may use one continuous `streakFlame` haptic from its reveal
  through its final settle. It must use the shared service, remain subject to
  the global Haptics preference, and stop when the screen unmounts.
- Respect reduced visual noise: no looping motion unless it communicates a
  temporary waiting or ready state. There are exactly two ambient exceptions,
  both of which must run without haptics and become static under Reduce Motion:
  the shared native Auth ink/bubble backdrop, whose three contour lines may run
  a slow, continuous, low-amplitude loop; and the Home hero orb
  (`components/orb/`), a Skia `RuntimeEffect` whose animated noise, travelling
  hotspot, and slow breath run continuously on the render thread. Do not add a
  third. The orb's clock is an accumulating Reanimated `useFrameCallback`, not a
  free-running one, so pausing it for Reduce Motion, backgrounding, or scrolling
  out of view resumes from the same phase instead of jumping.
- The onboarding widget step (`OnboardingWidgetSetupScreen`) pulses the streak
  widget preview on a loop. This is not a third ambient exception: it is a
  "ready state" cue under the rule above, because the screen has no continue
  button and the pulse is the only affordance telling the user to act. It stops
  the instant they do, runs without haptics, and is static under Reduce Motion.
  Any new looping affordance must clear the same bar.
- A scroll-linked hero may parallax, shrink, and fade as the content scrolls
  over it. Drive it from a single `Animated.Value` fed by an `Animated.event`
  with `useNativeDriver: true` — pass `useAnimatedScroll` to `TabScreenLayout`
  so the list is an `Animated.ScrollView` — and interpolate only `transform`
  and `opacity` so nothing runs per frame on the JS thread. Scroll must never
  emit haptics. Pause any ambient loop once the hero has faded out.

## Forms And Actions

- Keep labels above inputs and use theme-aware input surfaces.
- Native Auth forms use the shared auth-error presentation mapper and feedback
  components. Show only the first prioritized actionable message in one notice
  above the form while keeping every invalid field outlined with the destructive
  theme token; do not stack separate messages beneath multiple fields.
- Keep expected Auth validation, credential, account, verification, and reset
  failures in the shared inline notice. Show provider and non-connectivity
  server failures in the themed dialog instead, without exposing raw backend or
  SDK copy. Provider dialogs offer `Not now` and `Try again`; user cancellation
  stays silent. Connectivity failures defer to the shared gate or offline banner.
- Auth notices enter with a short opacity and 8px upward settle, and Auth dialogs
  use the standard restrained spring. Both settle immediately under Reduce
  Motion, remain accessible alerts, and must not add error haptics.
- When an editable field has a character limit, enforce it with `maxLength` and
  show a quiet, right-aligned count beneath the field.
- Hide a save or continue action until there is a valid user change when that
  makes the next action clearer. Reveal it with the standard conditional-action
  spring; do not reserve empty visual space for it.
- Use the shared `ButtonLoadingContent` primitive for every in-button async
  loading state, including API, purchase, biometric, and device-local actions.
  Keep the control bounds fixed, collapse its complete text/icon/card content
  horizontally from center over 160ms, then reveal its compact themed loader;
  reverse that sequence over 120ms when the action becomes available again.
  Keep the resting label mounted rather than changing it to processing copy,
  retain any approved custom loader, and set the parent action's accessible
  busy and disabled state. Reduce Motion must switch directly between settled
  states.
- Use the shared `JournalLoader` for generic indeterminate waiting states. Its
  round-capped arc expands, contracts, and rotates while retaining the calling
  surface's theme color and the standard 20pt/36pt loader bounds. Reduce Motion
  renders the same arc statically. Purpose-built shimmer placeholders, staged
  loading copy, and conversational thinking indicators remain feature-specific.
- When an expanding or collapsing settings section changes the height of a
  card stack, use layout animation so following cards move with it instead of
  jumping after the section disappears.
- Settings and profile save actions use the active theme primary colour. Pass
  `tone="accent"` to `PrimaryButton`; its default green success tone is not a
  general-purpose save colour.
- Device-permission UI must refresh when the app becomes active again after
  opening system settings, and should avoid duplicating the same instruction in
  multiple cards.
- For compact Premium upgrade prompts, use the shared `PremiumUpgradeCard`
  rather than duplicating a local purchase card; supply the feature-specific
  title, supporting copy, action label, and paywall callback.
- Keep adjacent Settings groups visually consistent: use a small section label
  and the shared bordered row list rather than introducing a heavier card for
  one group.
- Show loading, validation, empty, error, and success states without blocking
  the user from reading existing content.
- Keep touch targets clear, accessible, and large enough for mobile use.

## Connectivity States

- Use the shared backend-readiness state and `/ready` probe. Do not infer that
  the app is online from device Wi-Fi state or that a failed read means the
  underlying collection is empty.
- During checking or offline states, signed-out and pre-main routes use the
  shared Auth ink/bubble backdrop with one centered themed loader. Do not stack
  a connectivity dialog, retry button, or raw network error above that gate.
- Previously verified authenticated sessions remain readable with the shared
  offline banner. Disable server-backed actions and label unhydrated content as
  unavailable offline rather than rendering a normal empty state.
- Keep an already-mounted composer draft in memory when connectivity drops, but
  do not persist it, queue it, submit it automatically, or silently replay any
  protected write after reconnect.
- Reconnect should revalidate cached-profile sessions and refresh affected
  reads. Unauthorized revalidation returns to Auth through the shared session
  cleanup path.

## Implementation Check

- Before coding, inspect the closest existing screen or component for the
  matching pattern.
- Before finishing, verify light and dark themes, compact and large phone
  widths, keyboard behavior for forms, and the relevant accessibility labels.
- Update this document and `docs/AI_UI_UX_CONTEXT.md` when a new reusable UI
  pattern is intentionally approved.
