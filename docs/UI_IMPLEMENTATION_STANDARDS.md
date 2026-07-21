# UI Implementation Standards

Use these rules for every Journal.IO mobile UI addition or change. They apply
to interaction and layout as well as colours.

## Visual Foundation

- Use `useTheme()` colour tokens. Do not introduce hardcoded UI colours.
- Use Manrope for headings and DM Sans for body text through the existing app
  typography styles.
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

## Motion And Feedback

- Animate only a meaningful state change, not every render or screen mount.
- Use short opacity plus vertical movement for content reveals. Use the
  onboarding support-selection spring for a conditional primary action:
  `damping: 16`, `stiffness: 220`, `mass: 0.85`, with opacity, 10px upward
  movement, and a small 1.035 scale overshoot.
- The root `HapticInteractionLayer` provides preference-aware feedback for
  tap-like interactions throughout the app. It centrally respects the user's
  device-local Haptics preference, so never call the native haptics module
  directly. Do not trigger haptics for automatic screen transitions, passive
  animation, scroll drags, or long-press text selection.
- The branded Auth entrance is the sole intentional passive-animation haptic
  exception.
  Once on every Auth visit, its cues may use the shared native haptics service,
  while still respecting the global device-local Haptics preference. Use exactly
  three standard cues: one soft pulse at the first ribbon bend, one heavy pulse
  when the rows merge into the final wordmark, and one selection pulse when the
  two-layer action reveal becomes ready. Reduced-motion mode replaces that
  sequence with one soft welcome pulse. Do not emit haptics for the coral `.io`
  sweep, finite logo breath, or animation fail-safe/fallback completion.
- Respect reduced visual noise: no looping motion unless it communicates a
  temporary waiting or ready state. The shared native Auth ink/bubble backdrop
  is the only ambient exception: its three contour lines may run a slow,
  continuous, low-amplitude loop without haptics, and must become static when
  Reduce Motion is enabled.

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
