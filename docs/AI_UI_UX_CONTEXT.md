# Journal.IO UI / UX Context

This document defines the current design direction for Journal.IO mobile implementation.

It is intended for React Native + TypeScript implementation in this repository.

---

# 1) Experience Goals

The app should feel:

- calm
- private
- reflective
- supportive
- modern without being noisy

The interface should never feel clinical, gamified, or visually overwhelming.

Installed app identity:

- the app icon uses the lowercase `journal.io` wordmark, with ivory `journal`
  and coral `.io` arranged over a deep charcoal background
- the same wordmark artwork is used for iOS default/dark appearances, Android
  regular/night launchers, and the in-app onboarding brand image

---

# 2) Screen Flow (Current Design Context)

The current design flow is:

1. Auth entry (email, Google, or Apple)
2. Onboarding for authenticated users who still need onboarding
3. Create account (email path)
4. Verify email (email path)
5. Sign in (returning users)
6. Post-auth paywall sequence for non-premium users after onboarding is complete
7. Profile setup
8. Home dashboard
9. Supporting flows:
   - new entry
   - entry detail
   - journal edit
   - calendar/history
   - search
   - insights
   - streaks
   - reminders
   - paywall
   - profile
   - settings
   - privacy

Navigation implementation note:

- the mobile shell is now route-based with React Navigation native stack screens rather than stage-swapped full-screen replacements, and the bottom nav remains visible inside the authenticated shell
- pushed main-app screens now keep the native iOS swipe-back gesture, while the tab-style bottom-nav routes stay replace-driven
- the native app is locked to portrait orientation on iOS and Android; screen layouts should assume portrait-first behavior and should not require landscape-specific states
- iOS bottom navigation is `Home | Calendar | Create entry | Insights | Mind Map`; account/profile actions are available from Home settings. Android keeps `Profile` as the fifth tab for this release.
- Home includes a Goals card linked to user-owned manual goals. The current iOS Mind Map tab always offers an educational eight-region experience; Free and AI-off states must not request or display hidden personal signals.
- Home account settings opens the existing Profile hub in a root `slide_from_bottom` modal, matching the legal browser modal presentation. The hub keeps account, subscription, privacy, and support controls; its old Settings row is replaced in-place by the Personalisation controls, and its Recent Achievements and Emergency Contact cards are omitted.
- Profile-modal detail views use a nested React Navigation native stack with a short fade transition, while the root sheet presentation and theme-transition overlay remain unchanged. The Settings modal and its detail views use a centered, regular-weight 16px title. Settings adds `More` for a device-local Haptics switch plus Privacy Policy, Terms of Service, and Privacy Choices links, followed by Credits, which opens Icons8 in the device browser with the shared haptic preference applied. `Support` opens Help Center in the existing in-app legal browser, whose legal title is centered; Help Center contains the established support-ticket form. The modal hides Recent Achievements and Emergency Contact, and ends with an authenticated Sign out action using the existing export-style label-collapse loader.
- A root `HapticInteractionLayer` now supplies the existing preference-aware haptic feedback for tap-like interactions across app screens, navigation, and modals. It ignores drag/scroll gestures and long presses, and the Settings Haptics toggle persists the global on/off preference.
- App-wide loading-action update, 2026-07-21: every existing async action that renders a loader inside its own button or interactive card now uses one `ButtonLoadingContent` transition. The complete normal content collapses horizontally before the compact themed loader appears, while the control bounds, theme, haptics, API timing, and specialized Lifetime purchase loader remain unchanged. The resting label stays mounted for accessibility, parent actions report busy/disabled state, failures reverse cleanly, and Reduce Motion uses immediate settled states. Passive screen and card loaders are intentionally unaffected.
- Onboarding wordmark update, 2026-07-21: the welcome surfaces use the shared static, theme-aware `journal.io` wordmark banner instead of the square app icon or mascot. The wordmark keeps the existing gentle welcome float but does not replay the Auth entrance animation.

---

# 3) Onboarding Experience

The production fallback onboarding sequence uses the existing 12-step flow while onboarding v2 remains feature-flagged.

Phase 2 product-revamp note:

- a new premium, mascot-free onboarding v2 shell exists behind `ENABLE_ONBOARDING_V2`
- the v2 shell starts after auth only when the backend profile still needs onboarding and the flag is enabled
- production remains on the existing onboarding fallback by default while v2 is incomplete
- Phase 3A refines v2 into a compact semi-guided setup followed by the first real guided reflection: intro, referral source, age, occupation, AI tone, current support focus, theme color, reflection ready, AI/privacy bottom sheet, guided first-entry writing, and session analysis
- referral, age, occupation, and AI tone use compact cards with forward-only card reveal animation; support focus is multi-select with a `Skip` action and conditional Continue button
- the v2 theme picker applies the selected global app theme preference live through the centralized theme provider; every onboarding setup screen after intro has a small back arrow, while the first guided reflection itself hides the top back button and guards hardware back with a leave-confirmation sheet
- when the v2 Theme step first opens, it must already select Cream for the active light app appearance and Midnight for the active dark app appearance; the active appearance follows the system by default and respects an in-app developer/theme override. Returning to the step preserves any explicit user selection, and the automatic default remains haptic-free
- the First Guided Reflection top bar uses the shared wider compact `journal.io` wordmark banner instead of a separate book-and-text badge; the banner stays centered between equal spacers and introduces no new motion
- the V2 onboarding welcome wordmark keeps its existing gentle float but has no circular glow/background behind it; icon-based onboarding heroes retain their existing glow treatment
- v2 now replaces the temporary first-reflection placeholder with a real first guided reflection that saves one journal entry, then shows post-entry onboarding value screens before routing to Home
- Phase 3A does not call `/onboarding/complete`; after the first entry is saved, the mobile session marks journal-existence metadata locally and relies on the backend's existing journal-existence onboarding-complete heuristic on the next profile fetch
- the first guided reflection asks three direct daily prompts (`What was one good or exciting thing that happened today?`, `What was one hurdle or stressful moment you faced today?`, and `What would you like to carry into tomorrow?`). Each submitted core answer uses a short composer-send transition and an upward answer reveal before the next prompt; after the third answer, the composer exits gracefully before the authenticated ungated guided-reflection helper begins its short Journal.IO response. The first response uses the same minimal `JOURNAL.IO` assistant card, shimmer placeholder, and client-side typewriter reveal as later deeper responses
- submitted core reflection cards settle to static fully visible content before the next answer begins, so prior prompts and replies never disappear during later prompt transitions; the composer scrolls into view on focus, supports drag-to-dismiss, and exposes the standard iOS keyboard `Done` action
- the optional deeper step uses a two-button composer: `Finish entry` plus a dynamic primary action that becomes `Suggest` when empty and `Go deeper` when the user writes optional text; finishing saves the composed entry directly without a review screen. If fewer than three core prompts are complete, its confirmation sheet animates from the bottom and prioritizes the highlighted `Keep writing` action above `Finish session`.
- suggestion choices in the optional deeper step now act like user requests in a guided reflection thread: the selected request appears inline, `/guided-reflection/go-deeper` generates a Journal.IO response, and the response reveals with a client-side typewriter effect
- first onboarding reflection value is generated through `/guided-reflection/first-summary`, `/guided-reflection/go-deeper`, and the post-save `/guided-reflection/session-analysis` endpoint, not the premium `/journal/quick_analysis` endpoint; `Begin my first reflection` and `Finish entry` use compact in-button loaders rather than standalone loading screens, and native-stack transitions move into the writing and analysis screens before the Phase 3C post-entry value chain; free users are not routed to paywall
- Phase 3C routes the user from session analysis into local onboarding-only goal suggestions and then a dedicated native-stack streak route through fade-from-bottom transitions, before a local lightweight Mind Map preview and a Mind Map explanation screen lead to Home. The streak route keeps current local goal edits/selections and stages a card-free celebration: supplied warm flame shakes first, copy rises in second, then a brief local confetti burst accompanies the fixed bottom `I am excited` action. Selected goals, streak display state, and Mind Map signals are not persisted in this phase
- `/guided-reflection/goal-suggestions` may generate one to four safe, practical, non-clinical starter goals for the Phase 3C onboarding screen. Goals start unselected and must be direct low-effort actions tied to a concrete entry detail rather than a padded fixed count or vague reflection advice. Titles are capped at 30 characters and descriptions at 96 characters; the minimalist card presentation also limits title/description lines for compact phone widths, separates header/body/edit sections with subtle dividers, aligns the selection circle in the header, and centers the edit action. The editor separates its title and detail fields clearly, and its frequency chips use the same restrained selection spring as the cards. The card stack reveals one goal at a time without text typing; selection, the primary-action label, and the goal editor sheet use subtle motion. The endpoint does not save a selected suggestion, schedule reminders, or update streak state. Separate authenticated manual Goals CRUD now exists; onboarding selections remain local-only.
- the first Mind Map preview is local-only and generated from safe session-analysis tags plus selected local goals; it must stay minimalist, use centers/regions/signals/patterns/reflection-map language, avoid clinical/sensitive labels, and must not imply that the onboarding preview itself persists accumulated region activity
- the onboarding preview is separate from the later premium Insights Mind Map; onboarding continues to use local preview data only, while the premium screen reads from `GET /insights/mind-map`
- first guided reflection session analysis keeps a concise `Session analysis` screen heading, then reveals the Session Analysis, Most Noticed Center, and Center Breakdown cards one at a time: each card arrives before its copy reveals. Pattern Observed and Neuroscience Angle cards are intentionally omitted. Center Breakdown initially shows the top three of all eight score rows behind a gentle lower fade; a centered plain-text `Show more`/`Show less` control layout-animates the complete map. Only after the cards finish does the local Mind Map copy arrive, followed by Continue. The generated analysis and center copy remain character-bounded and concise, while all eight scores remain available for the Mind Map preview.
- guided-reflection AI surfaces must handle low-signal or gibberish entries by saying there is not enough clear information for useful reflection/insight rather than inventing patterns; this applies to the first summary, optional go-deeper responses, and session analysis

1. Value introduction:
   - AI-powered insights
   - track your journey
   - private and secure
2. Age range selection:
   - collect a broad age band for personalization
3. Journaling experience:
   - new to journaling
   - occasional journaler
   - regular journaler
   - daily journaler
4. Goal selection:
   - daily reflection
   - mindfulness practice
   - personal growth
   - gratitude journaling
   - mental-health-adjacent support goals framed in non-clinical language
   - habit tracking
5. Support focus areas:
   - stress
   - anxiety / worry phrased supportively
   - sleep
   - focus
   - relationships
   - self-awareness
6. Reminder preference:
   - morning
   - afternoon
   - evening
   - no reminders
7. AI comfort and feature explanation:
   - explain that AI-assisted prompts, summaries, tag suggestions, and Privacy Mode unlock with Premium
   - allow opt-in / opt-out posture without pressure so the preference is ready if the user upgrades later
8. Privacy and trust:
   - user data control
   - no data selling
   - the consent sentence should link directly to the hosted public privacy policy and terms pages used for app-store review, and the onboarding flow should open those links through the app's root-stack modal route rather than sending users to Safari
   - export/delete controls
   - explicit agreement checkbox
9. First-entry demo:
   - collect a lightweight mood selection, one-word feeling, optional gentle hurdle, and short reflection in a centered questionnaire
   - require mood plus at least one written thought before continuing
   - show a loading state in the Continue button while the demo reflection is generated
10. AI reflection demo:

- call `POST /onboarding/demo-analysis` to generate a deterministic, supportive sample analysis from the questionnaire state
- mention keywords noticed from the demo entry, including mood, the one-word feeling, the hurdle, and prominent thought terms, with a short description for why each keyword was noticed
- keep copy non-clinical and uncertainty-aware, and do not save the demo entry or call the stored journal AI pipeline
- keep the screen centered without decorative circular glow backgrounds

11. Breathing pause:

- show a full-screen, calm, slow pulsing breath screen for 5 seconds using text connected to the AI reflection
- hide onboarding progress, back controls, and step counter on this interlude
- animate the breathing screen in with a soft fade/slide transition from the AI reflection step
- show only one `I feel calmer` button, disabled until the 5-second pause is complete

12. Excitement rating:

- show a warm, primary-tinted rating card with a 5-star selector after the demo and breathing pause
- update the supportive message based on the selected rating
- keep the rating block and testimonial card visually centered in the screen
- show testimonials as an individually paged horizontal carousel
- selecting any star should immediately show a Journal.IO rating dialog; choosing `Rate now` should request the native in-app rating prompt through the platform review bridge

Implementation notes:

- use a clear progress indicator
- keep each step focused on one decision or concept
- keep content readable and lightweight despite the deeper flow
- include back/continue actions where appropriate
- onboarding now runs after authentication and completes through `POST /onboarding/complete`
- persist completed onboarding answers locally only as backward-compatible cached context; backend profile state is the authority for routing
- do not trigger native app review during onboarding in Phase 1; the rating prompt belongs to a later rating phase
- existing users should be treated as onboarded/migrated by the backend and should not replay onboarding after update

---

# 4) Authentication and Setup UX

Auth should prioritize low-friction entry:

- auth landing screen with a primary `Continue with Email` CTA
- email create-account flow with:
  - email
  - password
  - confirm password
- verify-email flow with:
  - email confirmation state
  - 6-digit verification code entry
  - resend action with cooldown
  - clear success transition into profile setup
- dedicated sign-in screen for returning email users
- password reset flow for returning email users:
  - sign-in `Forgot password?` opens a dedicated reset-request screen
  - reset request asks for the account email and shows a generic confirmation state after submit
  - password reset emails open the hosted reset page at `https://api.journalio.app/reset-password?token={token}` by default, with an env override available if the product later switches back to an app deep link
  - the hosted reset page asks for a new password and confirmation, then the user returns to sign in from the app
- Google sign-in path
- Apple sign-in path should treat `@privaterelay.appleid.com` addresses as Apple private relay contact addresses and avoid presenting them as the user's real iCloud email
- onboarding goals collected after auth should remain available as profile setup context when applicable
- on app launch, signed-out users should land on Auth before onboarding
- on app launch, a valid stored session should fetch the backend profile before deciding whether onboarding v2 is needed
- backend reachability is determined through the shared `/ready` probe, not inferred from an empty API payload
- while backend reachability is checking or unavailable, signed-out users and every pre-main flow (Auth, verification, onboarding, profile setup, and paywall) show only the existing theme-aware ink/bubble backdrop with a centered loader; an already-mounted pre-main screen remains mounted beneath the gate so local form progress is not discarded
- when real stored tokens and a previously server-verified profile exist, temporary offline launch may open the authenticated shell with that cached profile and a calm global offline banner; server-backed controls are disabled, cached content stays readable, and an unhydrated collection must say it is unavailable offline rather than presenting a false empty state
- New Entry and Journal Edit preserve their current in-memory draft while offline, but journal text is not persisted for this behavior, writes are not queued, and reconnect never submits a draft automatically
- reconnect refreshes affected authenticated reads and revalidates any cached-profile session; an unauthorized profile response clears tokens and the profile cache before returning to Auth
- long-form journal inputs should remain visible above the keyboard, support drag-to-dismiss, and expose an explicit keyboard `Done` action where the platform supports an input accessory
- once onboarding v2 has been completed, future signed-in launches should continue through the normal authenticated app flow, while signed-out launches begin at Auth
- backend profile/migration state, not old local onboarding flags alone, decides whether an authenticated user needs onboarding
- the auth screen is the first entry point for signed-out users and does not show a back affordance
- on every visit to Auth, the landing screen plays the code-native, theme-aware Editorial Ink Current once for that visit: 7 large `journal.io` rows on compact phones, 8 on standard phones, and 9 on large phones travel upward as one phase-offset S ribbon, overlap-collapse into the elevated final wordmark, and finish with one coral `.io` sweep
- all native auth screens share the full-bleed, theme-aware ink/bubble backdrop without a visible card, boundary, shadow, or bitmap; its three contour lines run a slow, continuous, low-amplitude loop without haptics and become static when Reduce Motion is enabled
- only the Auth landing coordinates the shared backdrop with the Editorial Ink Current entrance; follow-up auth screens use the backdrop as quiet atmosphere without replaying the landing wordmark or haptic choreography
- after the landing merge, the subtitle and auth controls arrive through two calm action-reveal layers, and the final wordmark completes one finite 2px breath before becoming static
- when the global device-local Haptics preference is enabled, the shared native haptics service emits exactly three standard cues: a soft pulse at the first ribbon bend, a heavy pulse at the wordmark merge, and a selection pulse when the two action layers are ready; reduced-motion mode shows the complete final screen immediately with one soft welcome pulse, with no haptics for the `.io` sweep, finite breath, or animation fail-safe/fallback completion
- this branded Auth entrance is the sole intentional passive-animation haptic exception; all other automatic transitions and passive animation remain haptic-free
- Sign In and Create Account keep a fixed Back row while vertically centering the remaining body below it; the Auth landing uses the supplied black email PNG, Sign In plays the onboarding-style waving hand once per visit, and Create Account uses the supplied blue create-account PNG
- Forgot Password keeps its Back row fixed while vertically centering both the reset-request form and submitted confirmation in the remaining viewport; the idle `Send Reset Link` action uses the supplied blue chain-link PNG and preserves the existing compact loader while the request is in progress
- the optional native Reset Password screen follows the same fixed Back row and vertically centered body pattern, reveals its hero and form with one short opacity/vertical sequence, then shows an accessible finite success reveal after `POST /auth/reset_password` resolves and automatically returns to Sign In after a brief readable pause; Reduce Motion presents both states settled while preserving the automatic handoff, and this passive transition emits no haptics
- the default hosted reset-password page and non-OTP success-screen backgrounds remain unchanged; the shared backdrop applies to the optional native Reset Password screen and the native OTP verification flow only
- keep this entrance mascot-free and bitmap-free, and do not let its presentation alter authentication handlers, loading states, or navigation behavior
- all native auth forms present validation and expected account/credential/verification/reset failures in one shared animated notice above the form; only the first prioritized actionable message is shown while every invalid field keeps its destructive outline
- provider and non-connectivity server failures use one theme-aware accessible dialog instead of a native alert or stacked inline copy; Google and Apple failures offer `Not now` and `Try again`, retry the same provider, keep user cancellation silent, and never expose raw SDK or backend messages
- connectivity failures defer to the shared full-screen gate or authenticated offline banner instead of stacking an Auth error dialog over the connectivity state
- auth error feedback settles immediately when Reduce Motion is enabled and does not emit haptics; the hosted reset-password page remains outside this native feedback contract
- signed-in session state should not be cleared unless the user logs out or the backend rejects the session as unauthorized

Post-auth setup:

- display name entry
- avatar color selection
- optional lightweight profile customization
- authenticated profile setup should persist the user’s name, avatar color, and selected onboarding context where applicable
- setup should support users arriving from email verification, Google sign-in, or Apple sign-in

Behavioral requirements:

- clear form validation
- loading states on async actions
- recoverable error states
- no dead-end screens

---

# 5) Paywall UX

The premium paywall is now part of the design flow as a dedicated upsell surface.

Paywall expectations:

- feel calm, premium, and trustworthy rather than aggressive
- explain premium value with concise feature copy
- support plan selection, upgrade CTA, restore purchases, and dismiss
- resolve the active paywall from the backend by placement so MongoDB can control template copy, offering mix, lifetime fallback, and interruptive cooldown behavior
- keep two active backend-defined templates:
  - `weekly-standard`
  - `lifetime-launch`
- let each backend template control exactly which pricing cards are visible so some templates can show one offer while others show two
- treat the backend `subheadline` as stored merchandising copy, but do not require the mobile paywall UI to render it
- render the premium preview area from structured backend feature cards with `title`, `body`, and optional `footer` fields instead of treating the feature list as plain strings
- render badges, subtitles, and non-price merchandising copy from backend configuration, but render every purchasable price from the exact RevenueCat package's StoreKit-localized `product.priceString`
- for the dedicated lifetime-offer surface, preserve the fixed Figma Make layout while loading `app.journalio.premium.lifetime` only from `journalio_offering_lifetime`; disable checkout and show a calm unavailable state if that exact package is missing
- use RevenueCat purchase and restore flows for checkout, then call the dedicated backend verification route so the authenticated premium state and purchased plan attribution update from server-verified subscriber data rather than client-authored booleans
- log paywall lifecycle and premium-intent events through the backend paywall events route so placements and cooldowns can be tuned without a client release
- in development builds, support RevenueCat Test Store verification so billing can be checked before App Store / Play Store release
- keep purchase and restore failure copy app-owned and calm; RevenueCat Test Store simulated failures should be described as a declined test purchase with no charge, not shown as raw SDK/store error text
- after any completed purchase from a hosted or in-app paywall, show the shared payment success screen; if RevenueCat purchase completion succeeds before premium entitlement sync catches up, use the success screen with access-updating copy instead of an alert or immediate route continuation
- purchase and restore completion must require the exact `Journal.IO Pro` entitlement and derive backend plan attribution from its active product identifier; if it is absent, keep the user on the current paywall surface and show the shared `No purchases found` dialog
- on authenticated launch and whenever the app returns to the foreground, force-refresh RevenueCat `CustomerInfo` and then call the backend entitlement-sync endpoint; if either request fails, keep the cached membership state rather than treating the failure as proof that the user is free
- use the mascot subtly in the hero area or brand moments
- preserve the existing app aesthetic rather than introducing a separate monetization style
- after every successful post-auth entry for a non-premium user, show a dedicated 3-step post-auth paywall first:
  - free-trial introduction step rendered in-app
  - reminder reassurance step rendered in-app
  - purchase step opened as the hosted RevenueCat main paywall as a full-screen embedded surface
- if the hosted RevenueCat main paywall cannot be opened, fall back to the current in-app purchase step instead of trapping the user
- when the hosted RevenueCat main paywall is used, keep backend placement resolution, paywall-event logging, purchase-sync, and an explicit purchase-progress loading overlay unchanged around that hosted surface
- the Home summer offer card opens the hosted summer target with `post_auth_exit_offer` placement tracking and `journalio_offering_post_onboarding_exit`; both post-auth main and contextual premium gates use `journalio_offering_other_screens_standard`, and the legacy post-onboarding standard offering must not be used because its attached exit behavior is not App Review-safe
- the summer hosted paywall purchases only `app.journalio.premium.yearly.exit`; its comparison value may use the exact normal yearly package only when both packages report the same currency, otherwise the comparison must be hidden
- the app passes the `normal_yearly_price` custom variable to the RevenueCat summer paywall only as a same-currency localized comparison value; when a safe comparison is unavailable, it passes an empty string, and dashboard copy must not contain a hardcoded currency, fixed percentage, or `first year` claim
- while a hosted RevenueCat purchase or restore is in progress, ignore native dismiss callbacks so checkout completion can render the shared payment success screen instead of accidentally advancing the flow early
- if the in-app fallback purchase step is used, free-trial messaging must appear only for the yearly plan and only when RevenueCat reports a real introductory offer for that package
- when a user successfully starts the yearly 7-day free trial from the paywall, the app may request local notification permission and schedule a device-local reminder 2 days before the verified RevenueCat expiration timestamp; this v1 reminder does not require push infrastructure
- if the user dismisses the hosted post-auth main paywall, continue directly into the normal post-auth destination; do not show a spin wheel, exit offer, second paywall, or any other follow-up purchase prompt after the close action
- legacy gift-wheel and custom yearly-discount routes are removed; the summer offer exists only as the manually opened hosted Home offer
- keep the profile upgrade banner and profile-driven upgrade entry points on the separate lifetime-offer surface; the lifetime offer is no longer part of the post-auth dismiss chain and it should stay on the manual purchase flow rather than the hosted RevenueCat presenter
- the free-user profile upgrade banner should explicitly mention `Lifetime Premium`, open the dedicated lifetime-offer surface, show a subtle shimmer loader while fetching lifetime claim data, and then show the backend lifetime purchase count in a compact `claimed` progress bar when available so App Review and users can identify the one-time lifetime IAP from the banner itself
- keep additional contextual placements on locked premium surfaces in Home, Insights, New Entry, Entry Detail, Profile, Subscription, and Settings
- treat privacy-data export as a free account-control surface for every signed-in user; it should never open a paywall
- keep contextual locked-feature paywalls simpler than the post-auth flow; they should open the hosted RevenueCat standard `other screens` purchase surface directly instead of replaying the full 3-step sequence
- if the hosted contextual purchase surface cannot be opened, fall back to the current in-app purchase screen instead of trapping the user
- allow interruptive paywalls only on eligible Home or Insights entries after repeated premium-intent signals; never interrupt while the user is actively writing or editing
- for MVP, keep the paywall as the only real purchase surface; free users entering `Subscription` from Profile should go straight to the hosted standard `other screens` paywall, while premium users can see a lightweight membership-management view that reflects verified expiration and auto-renewal state

---

# 6) Home Dashboard UX

Home should support quick daily engagement:

- greeting + date context
- streak summary
- quick daily mood tracker with a once-per-day guard
- quick note capture
- AI insight card (short and actionable)
- daily prompt card
- recent entries preview
- recent entries should open a detail screen when tapped, with a separate edit screen for changes
- non-premium Home may show a Figma Make-aligned summer offer card to the right of the current-streak card; the card is globally controlled by `GET /admin/home-offer` and opens the hosted exit-offer RevenueCat paywall when claimed
- the Home AI insight card should reuse the same backend `AI Analysis` data shown on the Insights screen, but present it as short rotating snippets rather than full cards
- the Home AI insight card should auto-advance through multiple snippets, keep a small manual next control in the top-right, and open the full `AI Analysis` tab when tapped
- the Home AI insight card should animate smoothly when the snippet changes
- the Home AI insight card should keep the copy compact and should fold supporting labels into the title/body instead of rendering standalone tag chips
- the rotating Home AI insight snippets may change icon and CTA copy per card when that improves scanability without changing the card shell
- AI surfaces should be premium-gated: non-premium users should see locked placeholders for the Home AI insight card and the Insights `AI Analysis` tab, with a clear upgrade handoff
- tapping the locked Home AI card as a free user should log a premium-intent event and open the backend-selected `home_ai_card_locked` paywall placement instead of routing generically to profile or subscription
- after repeated premium-intent actions, eligible free users may see an interruptive paywall on a later Home entry if backend cooldown rules allow it
- for premium users, the Home AI insight card should follow premium-week windows anchored to `premiumActivatedAt` in the user’s local timezone, not account creation time
- while the current 7-day premium week is still open, the Home AI card should show a collecting state with progress toward the 4-active-day minimum and point the user toward quick analysis on saved entries
- if a closed premium week ends with fewer than 4 active journal days, the Home AI card should show a supportive insufficient-data recap and encourage the next week rather than forcing a partial report
- New Entry should keep writing prompts available for everyone, but the `Auto-tag with AI` control should remain visible in a locked premium state for free users, log a premium-intent event, open the `new_entry_auto_tag_locked` paywall placement, and must not call the suggestion API until premium is active
- the Home current-streak card should be API-backed and should use the lightweight `currentStreak` value returned by `GET /mood/today` rather than calling the full streak summary endpoints
- toggling light/dark mode from the Home header should use a tap-origin ripple transition so the new theme expands smoothly from the pressed control instead of snapping instantly

Shared journal-card rule:

- Home recent entries and Calendar history cards should use the same entry presentation
- show the emoji and date on the left, keep the favorite star on the right, then the title, compact content preview, and tags
- the favorite star is tappable and updates the saved favorite state
- quick thoughts should display a dedicated quick-thought title and thought emoji
- if a journal entry has no explicit mood selection, use a placeholder journal emoji
- strip `mood:` tags from the visible tag chips
- keep the Home preview slightly shorter than Calendar
- do not seed Home or Calendar with fake journal entries at runtime; empty states should render until real local or backend-backed entries exist
- entry detail and edit screens should show a stored `aiPrompt` prompt-used card when the journal record includes one
- successful new-entry and journal-edit saves should return the user to Home and clear stale detail/editor state so back navigation cannot reveal unavailable entry screens
- premium journal detail should offer an on-demand `Quick Analysis` card for the saved entry so users can get a visual, scan-first single-entry reflection while the weekly analysis is still collecting or between weekly reports
- quick analysis should feel like the single-entry version of `AI Analysis`: compact hero summary, a small stat strip, pattern chips, three signal cards, and one lightweight next-step card

The first screen after setup should make journaling and check-in easy within one scroll.

Mood tracker copy should feel direct and calm, using "How are you feeling today?" for the prompt and clearly indicating when today's check-in is already logged.

Insights screen expectations:

- fetch the screen data from backend APIs rather than local placeholder constants
- overview should show:
  - total entries
  - current streak
  - average words
  - total favorites
  - 7-day activity graph
  - mood distribution from saved home mood check-ins
  - popular topics derived from the most-used non-`mood:` journal tags
- analysis content may be derived from stored insight aggregates, but should remain supportive and non-clinical
- the `AI Analysis` tab should load from a dedicated backend route instead of reusing overview placeholder text
- the Insights screen should call only the overview API on initial page load; the `AI Analysis` API should be requested only after the user switches to that tab
- the analysis tab should present structured, scan-friendly cards rather than a single text block
- the Overview and `AI Analysis` surfaces should also support horizontal swipe gestures on the content area so users can move between them without only using the segmented control
- for non-premium users, keep the `AI Analysis` tab visible but locked, with a premium explainer instead of AI content
- tapping the locked `AI Analysis` tab as a free user should log a premium-intent event and open the backend-selected `insights_ai_tab_locked` paywall placement
- after repeated premium-intent actions, eligible free users may also see an interruptive paywall on a later Insights entry if backend cooldown rules allow it
- for premium users, AI Analysis should be based on the most recent closed premium-week window in the user’s local timezone
- if the current premium week is still open, show a supportive collecting state with progress toward the 4-active-day minimum, remaining days, and a reminder that quick analysis is available on individual entries
- if the most recent closed premium week ended with only 0-3 active journal days, show an insufficient-data recap instead of a partial weekly report
- keep AI-analysis copy concise and easy to skim; prefer a few strong signals over dense paragraphs
- make the primary AI-analysis read visual-first: hero summary, compact metric strip, emotion trend chart, theme breakdown, signal cards, short action trio, and a concise app-support card
- on iOS, premium users with AI enabled should also see an `Explore your Mind Map` CTA from the `AI Analysis` tab; Android should not expose this route in the current release
- the production Mind Map screen should open full-screen with a back button, `Latest week` and `All reflections` range control, drag-to-rotate 3D interaction, pinch zoom, and a visible recenter action
- the 3D model should read as a calm stylized solid brain divided into 8 fixed reflection regions with subtle seam boundaries, not a medical visualization
- the detail surface should live in a bottom sheet with a collapsed strongest-signal preview and an expanded internal scroll area so 3D gestures and detail scrolling do not compete
- region copy should consistently say `reflection signal` or `patterns in your writing`, and the screen must keep a visible disclaimer that this is not a medical or literal brain-activity measure
- if `Hide Journal Previews` is enabled, evidence snippets inside the Mind Map detail sheet should be masked while non-sensitive region labels, ordering, and scores remain visible
- the sheet should also provide accessible region buttons/list rows so VoiceOver users can use the feature without tapping the 3D mesh
- use one-glance language that feels like a smart, emotionally-aware Gen Z psychologist: warm, current, lightly conversational, and grounded in the user’s own week without sounding clinical or slang-heavy
- Big Five and dark-triad-adjacent heuristics may still exist behind the scenes, but they should not be the main user-facing frame on mobile
- actionable steps should feel lightweight and achievable within the existing journaling habit
- include a card that explains how Journal.IO features can help the user work with the surfaced patterns over time
- include loading and recoverable error states when insight data cannot be fetched

Streaks screen expectations:

- keep the existing Make design intact; replace only the placeholder values with backend data
- load the screen from backend APIs rather than hardcoded constants
- show:
  - current streak
  - best streak
  - this month entries
  - total entries
  - 30-day activity
  - achievements
- the 30-day activity grid should render directly from a backend day-by-day history response
- achievements should come from backend milestone data so the screen does not duplicate unlock logic
- include loading and recoverable error states without redesigning the streak layout

Reminders screen expectations:

- open from the Home header bell inside the main shell so the bottom nav stays visible
- mirror the Make layout with:
  - daily reminder enable card
  - time selector
  - notification preview card
  - smart reminder toggles
  - device-permission helper copy
- load the current reminder from backend reminders CRUD instead of hardcoded local defaults once a reminder exists
- after auth, persist the onboarding reminder preference into the authenticated user's `daily_journal` reminder record and resync any existing stored reminder to local device notifications
- enabling reminders must request system notification permission and then schedule local device notifications with Notifee
- when device notification permission is unavailable, show an actionable, theme-aware helper card at the top of Reminders that opens the operating system's app-settings page; do not imply that the app can grant the permission itself
- changing time, weekday coverage, or streak-warning behavior must re-sync the local notification schedule
- skip-on-entry behavior should suppress the current day's reminder after a journal entry is saved when that toggle is enabled
- include loading and recoverable error states without replacing the core Make structure

Settings and privacy expectations:

- Settings should lead with an `Account` list, followed by `Personalisation`: `Manage account` opens a detail surface with the stored email, joined date, and danger-zone deletion action. On iOS, deletion opens an Apple-native typed `DELETE` prompt that briefly says journals and account data will be permanently deleted, with `This action cannot be undone.` on its own line, followed by a minimal native `Are you sure?` alert with horizontally aligned `Cancel` and `Delete Account` actions before any request is sent; Android retains the same sequence through a themed fallback sheet and final alert. `Subscription` appears in this list only for verified Premium users and opens the current membership summary. `About me`, `Theme`, and `Notifications` each open their own detail surface.
- Place a matching `Privacy & Data` row list immediately after `Personalisation`. On iOS, order it as biometric app lock, `Enable AI analysis`, `Hide entries`, then `Export data`; Android omits the biometric row and keeps the remaining controls in the same order.
- The iOS app-lock row opens an in-modal detail screen rather than exposing a switch inline. It uses the short supporting copy `Keep Journal.IO private`, adapts between `Face ID lock` and `Touch ID lock`, and remains available to open even when device authentication has not been configured.
- on iOS, the Personalisation detail views stay inside the Home account modal with a short in-modal transition and back history; Android retains its native settings stack route behavior
- `About me` may update the account name and show only the user's stored onboarding selections, never journal content or inferred AI details
- the Theme row should show the current resolved theme colour and preference; the Theme detail surface uses a simple selectable list with colour dots, not a dropdown
- the Notifications row should show the current On/Off status and open the existing reminder controls
- the `Privacy Mode` toggle should map to the authenticated user's AI opt-out preference so Home and Insights AI surfaces respond immediately after the setting changes
- changing theme from the Settings theme selector should use the same tap-origin ripple transition as the Home header toggle
- `Enable AI analysis` and `Hide entries` should be premium-gated controls in Settings; free users should see them as locked upgrade entry points instead of active toggles
- locked `Enable AI analysis` and `Hide entries` taps should each log a premium-intent event and open their own backend-controlled paywall placement so merchandising can differ by surface
- the iOS biometric detail screen is premium-gated in production: Free users always see a shared Premium upgrade card that opens the `settings_biometric_lock_locked` placement, regardless of device capability. Premium users see an unavailable card when iOS does not support Face ID/Touch ID or a tappable permission card that opens iPhone app settings when a supported biometric cannot authenticate. The local app-lock switch card always remains visible, but stays disabled until the user has Premium access and biometric authentication is available.
- when the local biometric lock is enabled, the authenticated app shell should cover content immediately on cold launch and whenever the app returns from inactive/background until the user confirms Face ID, Touch ID, or device passcode; cancelling keeps the overlay visible with a `Try again` action instead of repeatedly forcing prompts
- a lightweight device-level privacy toggle may hide journal-card preview content in shared list surfaces such as Home, Calendar, and Search
- the in-modal `Export data` screen contains only the export action and its loading/error state; it does not include legal, account-deletion, or support content

---

# 7) Visual System

Use a warm, low-contrast-safe palette aligned with current design direction.

Core surface tokens:

- `bg.primary`: `#F6F7F2`
- `bg.surface`: `#FFFFFF`
- `text.primary`: `#1C221B`
- `text.secondary`: `#556055`

Semantic accents:

- growth/success: `#2F7A5D`
- alert/destructive: `#C05A4A`
- info: `#2D6FA3`
- primary CTA accent (current design direction): warm coral/peach family

Rules:

- keep accent usage intentional
- avoid overly saturated highlight combinations
- preserve readability over style density
- keep mascot-led illustration moments integrated into the current design language instead of letting them dominate layouts

Theme mode rule:

- the app must support both light and dark themes via system theme detection by default
- the centralized theme provider also supports named app theme preferences from onboarding/settings: Warm Cream, Midnight Calm, Soft Peach, Forest, and Minimal Grey
- use centralized theme tokens (background, foreground, card, accent, border, semantic colors) instead of per-screen ad hoc color definitions

Brand expression rule:

- the mascot/logo asset is now a recurring brand element across onboarding, auth, verify email, paywall, and selected emotional-feedback states
- mascot usage should feel supportive, polished, and premium
- avoid making the app feel childish, noisy, or overly gamified

---

# 8) Typography and Rhythm

Preferred type direction:

- headline: Manrope Semibold
- body: DM Sans Regular

Spacing rhythm:

- 4, 8, 12, 16, 20, 24, 32, 40

Border radius guidance:

- controls: 10-12
- cards: 16-20
- pill elements: full round

---

# 9) Interaction Guidelines

The required implementation checklist for headers, spacing, theme tokens,
icons, haptics, and conditional-action motion lives in
`docs/UI_IMPLEMENTATION_STANDARDS.md`. Treat it as mandatory for all mobile UI
work.

- keep animations subtle and meaningful
- use short transitions for taps, selection, and step changes
- prioritize touch clarity over visual flair
- provide immediate feedback for save, verify, and submit actions
- richer motion is now expected on onboarding, auth, verify-email, and paywall surfaces
- preferred motion patterns include soft floating mascot moments, gentle glow, small scale feedback, and staggered content reveals
- avoid flashy, game-like, or hyperactive motion

Required state handling:

- loading
- success
- empty
- validation error
- network/server error

---

# 10) Reusable Component Expectations

Preferred reusable components include:

- primary and secondary button
- text field / input controls
- onboarding progress indicator
- verification code / segmented code input
- mood selector / mood check-in card
- entry preview card
- insight card
- action list item
- section header row
- paywall plan selector / feature list rows where reuse becomes practical

Implementation rule:

- put reusable components in `frontend/src/components`
- keep screen composition in `frontend/src/screens`
- keep API requests in `frontend/src/services`

---

# 11) Content Tone Rules

All emotionally sensitive content must remain:

- non-clinical
- uncertainty-aware
- behavior-focused

Avoid diagnostic wording or medical claims in UI text and insights.

---

# 12) Accessibility and Usability

Minimum expectations:

- clear text contrast
- readable input labels
- touch targets sized for mobile interaction
- safe-area-aware layouts
- keyboard-safe behavior for forms
- no critical information hidden behind animation timing

Responsive implementation expectations:

- every screen should adapt to compact (`320-359`), standard (`360-429`), and large (`430+`) phone widths
- scale horizontal padding, major title sizing, and key control dimensions by width class
- cap content with a reasonable max width on large phones to preserve readability
- avoid hardcoding one-device-only spacing assumptions

---

# 13) Design-to-Code Guardrails

When converting Figma to code:

1. Implement the smallest complete slice first.
2. Reuse existing repo components and patterns.
3. Do not import a parallel web UI architecture.
4. Match the screen hierarchy and states before polishing visuals.
5. Keep behavior aligned with API contracts and existing backend capabilities.
