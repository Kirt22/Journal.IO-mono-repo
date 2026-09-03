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
- the native iOS launch screen is intentionally minimal and is not sourced from Figma: it shows only a centered lowercase `journal.io` wordmark on the appearance-matched app background, with `journal` in the light/dark foreground ink and `.io` in the corresponding coral primary. It has no mascot, illustration, decorative shapes, tagline, footer copy, animation, or alternate startup flow
- iOS bottom navigation is `Home | Entries | Create entry | Insights | Mind Map`; account/profile actions are available from Home settings. Android keeps `Profile` as the fifth tab for this release. The internal route key remains `calendar`; the Entries screen defaults to the `All Entries` list heading and changes it to `Calendar` with a short fade-and-rise transition when calendar mode is selected.
- Home opens with a decorative hero orb above the greeting: a GPU-rendered procedural energy ring drawn by a single Skia `RuntimeEffect` (SkSL), ported from the React Bits `Orb` shader. The rim colour is the active palette's primary so it follows all seven themes; a lavender/violet secondary highlight and a deep plum/indigo inner shade come from `constants/orbPalette.ts`. The centre is always transparent: the reference's background-luminance branch, which filled it with the page colour on light backgrounds, was removed because it read as a solid blob on the warm off-white. The orb itself stays hidden from assistive tech, but it is now the entry point to **Ask Jade**: a `Pressable` wraps it, carrying the button role, the "Ask Jade" label, and a `primaryAction` haptic, and the press target is disabled with pointer events off once the orb has faded on scroll — opacity alone does not stop touches, so without both it would swallow taps meant for the cards passing over it. Touching it surges the shader's own `intensity` uniform (a fast 140ms charge, a 620ms settle), so the ring liquifies and relaxes in its own material; nothing is layered on top of it. The peak stops at 0.6 rather than the component's `activeIntensity` of 1.3, because past roughly 0.7 the warp turns the ring into a six-lobed flower and it stops reading as an orb. Its animated noise, travelling hotspot, and slow breath are one of only two sanctioned ambient loops in the app; the press surge is a one-shot response, not a third loop. Under Reduce Motion the orb renders a static phase and a press leaves it settled while still opening Ask Jade. As Home scrolls, the orb trails the content, shrinks, and dissolves before the first card reaches the top while the cards pass over it; the clock stops once it is offscreen or the app is backgrounded, and resumes from the same phase.
- Home's top bar is **pinned** — it renders through `TabScreenLayout`'s `header` slot, outside the scroll view, so the compact streak pill (fire icon plus the current count, capsule shaped, opens the Streaks screen) and the Search and Settings circles stay in place while the content scrolls beneath them. The old full-width streak card is gone.
- Below the orb sits one block: the date, a permanent greeting, and a tappable tag. The headline is always `{greeting}, {firstName}` with a waving hand and never changes; only the **tag** rotates through the nudge ladder. The block pops in once on entrance with the standard conditional-action spring, and after that only the tag re-animates when the nudge kind changes — popping the whole block would animate a headline that did not move. Under Reduce Motion everything renders settled and the hand does not wave.
- The orb and this block are one hero: both read the same fade curve from `utils/heroScroll.ts`, so they dissolve together as the cards scroll over them rather than the greeting outliving the orb. The greeting takes opacity and translation only — scale is reserved for the orb because it visibly resamples text.
- Nudge priority (`utils/homeNudge.ts`, one at a time, never stacked): a reset streak, then a live streak with no check-in yet, then the missing check-in, then goals left for the period, then an unopened daily reflection, then a quick-thought invitation. Each is one pill-sized label, since the tag is all the nudge gets. Tapping routes contextually — mood and streak scroll to the check-in card, goals opens Goals, reflection scrolls to today's reflection, and the quick-thought tag opens the Quick Thought composer. Copy states what is true and offers a next step; it must not use loss-aversion or achievement language. This row is the intended home for the planned Journal.IO chat surface.
- A reset streak can only be inferred locally: `/mood/today` reports the streak as it stands, so Home compares it against the last value stored in `utils/appStorage.ts`. A fresh install has nothing to compare with and the nudge stays quiet.
- Home includes a Goals card linked to user-owned manual goals. The current iOS Mind Map tab always offers an educational eight-region experience; Free accounts must not request or display hidden personal signals.
- Home mood choices use five visually distinct semantic colors in both themes: Amazing is green, Good is blue, Okay is amber, Bad is orange, and Terrible is crimson.
- Home Quick Note keeps both collapsed and expanded bodies mounted while a short layout animation and crossfade swap them. Save and Close collapse back to the intact compact card without blank intermediate content; the draft clears only after a completed close, and a failed save leaves it in place.
- Home goal rows and Add/Manage actions share a compact 48pt minimum height. Visible goals receive coordinated muted coral, blue, sage, or amber accents from the active theme, with the same current-list assignment used across Home and Manage, while Add Goal uses the primary action color. Completing a Home goal fades its icon/copy, moves the tick to center, fills it solid green, then removes the entire row shell, including any Edit/Archive tray beneath it; the motion and color animations use separate native/JS nodes so the sequence cannot fail during the fill. Manage Goals only animates the green tick fill before regrouping the unchanged row. Manage rows reveal blue Edit plus amber Archive or green Unarchive on left swipe with a matching rounded seam; Delete never appears in swipe actions and is available only through a confirmed action while editing an archived goal.
- The goal editor previews the final icon beside the title. Automatic mode is represented by the leading X tile and follows title edits while avoiding icons already used by other goals; choosing any catalog icon switches to fixed mode. Frequency, icon, reminder-card, reminder-detail, and time-menu changes use restrained expansion/selection motion and settle immediately under Reduce Motion.
- Tapping the bottom-navigation `New` action opens a slide-up choice sheet using the checked-in Guided and Open-ended PNG artwork. Guided reflection is Premium-only: Free users see an inline `PRO` lock and the tap opens the contextual paywall without entering the flow. Open-ended writing remains available to everyone.
- Authenticated iOS post-entry flow is platform-specific. Premium Guided and open-ended entries both show the shared Session Analysis presentation, including a quick read, detected topic tags, one five-value mood badge, and the top reflection centers. Open-ended entries then move through optional journal-context goals, the per-entry Mind Map, and Home; Guided keeps its existing guided value chain. Android keeps both entry types as save-then-Home flows.
- Free iOS open-ended entries preserve the post-save value beat with a local obscured representative Session Analysis preview and Pro prompt. This preview does not request personal analysis, calculate personal topics/mood, expose entry evidence, or offer goals; `Not now` returns Home.
- the open-ended composer now concentrates on title, writing, optional prompt insertion, and save. Manual mood selection, manual tags, and Auto-tag UI are omitted; saved-entry analysis derives `detectedTopics` and `detectedMood` separately from user-authored content.
- Home account settings opens the existing Profile hub in a root `slide_from_bottom` modal, matching the legal browser modal presentation. The hub keeps account, subscription, privacy, and support controls; its old Settings row is replaced in-place by the Personalisation controls, and its Recent Achievements and Emergency Contact cards are omitted.
- Profile-modal detail views use a nested React Navigation native stack with a short fade transition, while the root sheet presentation and theme-transition overlay remain unchanged. The Settings modal and its detail views use a centered, regular-weight 16px title. Settings adds `More` for a device-local Haptics switch plus Privacy Policy, Terms of Service, and Privacy Choices links, followed by Credits, which opens Icons8 in the device browser with the shared haptic preference applied. `Support` opens Help Center in the existing in-app legal browser, whose legal title is centered; Help Center contains the established support-ticket form. The modal hides Recent Achievements and Emergency Contact, and ends with an authenticated Sign out action using the existing export-style label-collapse loader.
- The persisted Settings Haptics toggle controls the shared preference-aware haptics service. App-rendered buttons, cards, toggles, options, navigation, and feature controls use `HapticPressable` or `HapticSwitch`; the source audit prevents raw native controls from bypassing the preference. Completed swipe/tab and swipe-tray state changes also use the service, while blank-content touches, ordinary scrolling, automatic transitions, and passive animation remain silent. The Auth entrance, streak flame, and deliberate entry-card double-tap favorite gesture are the documented exceptions.
- Face ID/Touch ID app lock is Premium-only with no feature-specific development bypass; it follows the global effective Premium value. A Free Settings tap opens the contextual paywall directly. An enabled lock covers the app immediately whenever it leaves the foreground, but an unlocked app returning within 60 seconds removes that cover without another prompt; cold launch, longer absence, and any already-cancelled/failed lock still require authentication. The failed Face ID card uses the dedicated Face ID artwork.
- Ask Jade keeps its centered header title with equal-width side slots. For free users, the previous-chats menu and its circular surface are both absent; the right slot is an invisible layout spacer only. Opening a saved chat renders its complete stored prose and rich blocks immediately, skips the new-reply typewriter, and jumps to the bottom without scroll animation. Every completed user or Jade message exposes small explicit Copy and Share controls below its bubble; a newly revealed Jade response withholds both controls until the reveal finishes, and message bubbles have no long-press copy gesture. The blank-chat state keeps three starter prompts, including a mood-trend graph example that makes Jade's statistics capability discoverable.
- App-wide loading-action update, 2026-07-21: every existing async action that renders a loader inside its own button or interactive card now uses one `ButtonLoadingContent` transition. The complete normal content collapses horizontally before the compact themed loader appears, while the control bounds, theme, haptics, API timing, and specialized Lifetime purchase loader remain unchanged. The resting label stays mounted for accessibility, parent actions report busy/disabled state, failures reverse cleanly, and Reduce Motion uses immediate settled states. Passive screen and card loaders are intentionally unaffected.
- App-wide generic loader update, 2026-08-13: every React Native `ActivityIndicator` and the mood widget's SwiftUI `ProgressView` use the shared journal.io expanding-arc loader derived from the supplied motion reference. The arc keeps each surface's existing theme color, compact/large bounds, loading copy, API timing, and state transitions; Reduce Motion shows a static arc. Existing shimmer skeletons, Ask Jade thinking dots, staged Mind Map copy, and other purposeful waiting treatments remain unchanged.
- Onboarding wordmark update, 2026-07-21: the welcome surfaces use the shared static, theme-aware `journal.io` wordmark banner instead of the square app icon or mascot. The wordmark keeps the existing gentle welcome float but does not replay the Auth entrance animation.

---

# 3) Onboarding Experience

The production fallback onboarding sequence uses the existing 12-step flow while onboarding v2 remains feature-flagged.

Phase 2 product-revamp note:

- a new premium, mascot-free onboarding v2 shell exists behind `ENABLE_ONBOARDING_V2`
- the v2 shell starts after auth only when the backend profile still needs onboarding and the flag is enabled
- as of 2026-08-14 the flag is `true` in every build, so v2 is the shipping flow; v1 (`OnboardingScreen`) stays in the tree only as a revert target
- Phase 3A refines v2 into a compact semi-guided setup followed by the first real guided reflection: intro, referral source, age, occupation, AI tone, current support focus, theme color, reflection ready, AI/privacy bottom sheet, guided first-entry writing, and session analysis
- referral, age, occupation, and AI tone use compact cards with forward-only card reveal animation; support focus is multi-select with a `Skip` action and conditional Continue button
- the v2 theme picker applies the selected global app theme preference live through the centralized theme provider; every onboarding setup screen after intro has a small back arrow, while the first guided reflection itself hides the top back button and guards hardware back with a leave-confirmation sheet
- when the v2 Theme step first opens, it must already select Cream for the active light app appearance and Midnight for the active dark app appearance; the active appearance follows the system by default and respects an in-app developer/theme override. Returning to the step preserves any explicit user selection, and the automatic default remains haptic-free
- the First Guided Reflection top bar uses the shared wider compact `journal.io` wordmark banner instead of a separate book-and-text badge; the banner stays centered between equal spacers and introduces no new motion
- the V2 onboarding welcome wordmark keeps its existing gentle float but has no circular glow/background behind it; icon-based onboarding heroes retain their existing glow treatment
- V2 onboarding begins with its standalone welcome (`Ready to begin?`) and moves to a separate required display-name step (`Hey! What do we call you?`). The name field prefills an authenticated provider name when available but never opens the keyboard automatically. Tapping outside or pressing the keyboard Done control dismisses the keyboard without advancing; only the visible Continue action validates and advances. The next referral step starts directly with that first name in its prompt, and final V2 completion persists the chosen name through the existing profile update rather than marking the profile complete early.
- v2 now replaces the temporary first-reflection placeholder with a real first guided reflection that saves one journal entry, then shows post-entry onboarding value screens before routing to Home
- Phase 3A does not call `/onboarding/complete`; after the first entry is saved, the mobile session marks journal-existence metadata locally and relies on the backend's existing journal-existence onboarding-complete heuristic on the next profile fetch
- the first guided reflection asks three direct daily prompts (`What was one good or exciting thing that happened today?`, `What was one hurdle or stressful moment you faced today?`, and `What would you like to carry into tomorrow?`) through a focused horizontal pager. Every unlocked page keeps its prompt and editable answer together above the keyboard; users can swipe back to revise an earlier local answer, then return to the current question. Writing starts from a faint unboxed `Write` affordance, which hides the two action buttons until keyboard Done, blur, editing end, or dismissal. Blank-content taps and drags dismiss the keyboard; core prompt changes reset the keyboard before focusing the next input so its iOS Done control refreshes reliably. `Go deeper` only appears on the third page after the three answers are complete.
- core pager answers remain local-only until finishing the entry. `Go deeper` crossfades the three-question pager into the complete static transcript without an empty intermediate frame. Journal.IO replies are 45-70 words, while each separate 6-14 word AI follow-up replaces the old generic optional prompt above the borderless `Write` input. The assistant card contains reflection copy only; the orange follow-up prompt reveals independently and is stored with the thread turn.
- the first core page starts with an enabled `Exit` action; typing any content changes it to `Finish entry`. Exit opens a calm animated confirmation sheet with secondary Exit and highlighted orange Cancel actions, and completes its downward close before leaving. The optional deeper step keeps `Finish entry` plus a dynamic primary action that becomes `Suggest` when empty and `Go deeper` when the user writes optional text. If `canGoDeeper` is false, the deeper action is omitted.
- suggestion choices in the optional deeper step now act like user requests in a guided reflection thread: the selected request appears inline with a short upward fade after the sheet slides down, `/guided-reflection/go-deeper` generates a Journal.IO response, and the response reveals with a client-side typewriter effect. The Suggest sheet uses the same explicit slide-up and slide-down lifecycle as the other reflection bottom sheets rather than a fade transition.
- first onboarding reflection value is generated through `/guided-reflection/first-summary`, `/guided-reflection/go-deeper`, and the post-save `/guided-reflection/session-analysis` endpoint, not `/journal/quick_analysis`; `Finish entry` uses a minimalist in-button progress sequence (`Saving your entry`, `Noticing patterns`, `Preparing analysis`) rather than a standalone loader screen
- after local onboarding-only goal suggestions, the post-entry path is `Mind Map loader -> first-reflection Mind Map -> Mind Map share card -> streak -> reminders -> post-auth paywall -> Home`. The loader rotates three supportive messages at a calm 1.4-second pace for at least 3.2 seconds without haptics; the full-screen Mind Map reuses the interactive 3D renderer with all eight session-analysis regions and clearly labels the result as a first-reflection signal rather than a trend. The optional share screen shows the actual warm 4:5 export card, reveals its title, card, one restrained wobble, and actions in sequence, and opens the native share sheet from `Share now`. Cancelling the sheet stays on the share screen; a completed share advances to rating, and `Maybe later` also advances without sharing. Reduce Motion removes the wobble. The streak preserves current local goal edits/selections and stages its card-free flame celebration before reminders. Non-Premium users see the existing dismissible `post_auth` paywall; Premium users go directly Home.
- `/guided-reflection/goal-suggestions` may generate zero to four safe, practical, non-clinical starter goals for the Phase 3C onboarding screen. Goals start unselected and must be direct low-effort actions tied to a concrete entry detail or a plausible broadly useful contextual experiment, without claiming a speculative hidden cause. Active and archived saved goals both prevent repeated or paraphrased actions; changed timing, duration, meal, or trigger does not make the same core action new, and the UI shows a calm continue state when everything is already covered. Titles are capped at 30 characters and descriptions at 96 characters; the minimalist card presentation also limits title/description lines for compact phone widths, separates header/body/edit sections with subtle dividers, aligns the selection circle in the header, and centers the edit action. The editor separates its title and detail fields clearly, and its frequency chips use the same restrained selection spring as the cards. The card stack reveals one goal at a time without text typing; selection, the primary-action label, and the goal editor sheet use subtle motion. The suggestion endpoint does not save a selection, schedule reminders, or update streak state. Onboarding selections remain local-only; authenticated guided and open-ended post-analysis journeys render this same goals mode, while open-ended suggestions still come from the saved-entry `/goals/suggestions` endpoint and explicitly accepted titles persist through Goals CRUD.
- the first Mind Map is session-only and built from safe `brainSessionMap` region scores returned by first-reflection analysis; it reuses the production 3D renderer but never calls the aggregate `GET /insights/mind-map`. Its selected card and detail sheet present each normalized signal as a rounded score out of 100 with the same `Low`/`Balanced`/`High`/`Very High` tier treatment used by the aggregate Mind Map, while remaining explicit that this is a reflection signal rather than brain activity. The user-opened `AI signal` sheet may show up to three short evidence phrases from that user's current reflection; `About this area` contains concise static, non-clinical education. The model view omits anatomical lobe labels and pin tooltips contain only the mapped area plus percentage.
- the onboarding Mind Map remains separate from the later aggregate Insights Mind Map; the production screen reads `GET /insights/mind-map`, while onboarding consumes only the current first-reflection session data
- session analysis preserves the established card hierarchy and behavior: `Session Analysis`, `Most Noticed Center`, expandable `Center Breakdown`, the Mind Map build message, and Continue. One `Topics Detected` card is added after the breakdown with up to five topic chips and no explanatory definitions; inferred mood remains structured metadata rather than changing this screen. Guided and Premium open-ended flows use this hierarchy, while Free open-ended entries use the local locked preview.
- after goals, every iOS post-entry path reaches a per-session Mind Map before Home. Regular guided and open-ended entries carry the already-generated `sessionAnalysis.brainSessionMap` through goals, show the same 3.2-second loader and interactive layout used by onboarding, and use session-specific labels (`YOUR SESSION MIND MAP` and `SESSION SIGNAL`). Selected-region cards and their detail sheets use rounded scores out of 100 plus the aggregate Mind Map's fixed score tiers; the normalized session score payload remains unchanged. Personalized session cards expose one compact explicit share icon and no long-press sharing gesture or gesture hint. A restored route may reload `/journal/session_analysis` by journal ID, but the normal path does not repeat AI analysis. This session-only experience never mounts or requests the aggregate Insights `MindMapScreen`. Android retains the current direct-to-Home behavior because Mind Map routes are not registered there.
- AI reflection copy is evidence-led and slightly challenge-forward when the writing genuinely contains both sides: approximately 55% of attention goes to friction or unresolved difficulty and 45% to strengths or progress. The interface keeps a steady, constructive tone, but it does not hide difficult material or force the inferred mood to a positive value.
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
7. Privacy and trust:
   - user data control
   - no data selling
   - disclose that eligible AI-supported features process journal content according to the privacy policy without presenting an account-level on/off control
   - the consent sentence should link directly to the hosted public privacy policy and terms pages used for app-store review, and the onboarding flow should open those links through the app's root-stack modal route rather than sending users to Safari
   - export/delete controls
   - explicit agreement checkbox
8. First-entry demo:
   - collect a lightweight mood selection, one-word feeling, optional gentle hurdle, and short reflection in a centered questionnaire
   - require mood plus at least one written thought before continuing
   - show a loading state in the Continue button while the demo reflection is generated
9. AI reflection demo:

- call `POST /onboarding/demo-analysis` to generate a deterministic, supportive sample analysis from the questionnaire state
- mention keywords noticed from the demo entry, including mood, the one-word feeling, the hurdle, and prominent thought terms, with a short description for why each keyword was noticed
- keep copy non-clinical and uncertainty-aware, and do not save the demo entry or call the stored journal AI pipeline
- keep the screen centered without decorative circular glow backgrounds

10. Breathing pause:

- show a full-screen, calm, slow pulsing breath screen for 5 seconds using text connected to the AI reflection
- hide onboarding progress, back controls, and step counter on this interlude
- animate the breathing screen in with a soft fade/slide transition from the AI reflection step
- show only one `I feel calmer` button, disabled until the 5-second pause is complete

11. Excitement rating:

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
- existing users should be treated as onboarded/migrated by the backend and should not replay onboarding after update, except when the explicit debug-only `replayOnboarding` control is enabled for local testing

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
- on app launch, a valid stored session from the current installation should fetch the backend profile before deciding whether onboarding v2 is needed; a fresh reinstall must discard residual secure credentials and begin at Auth
- backend reachability is determined through the shared `/ready` probe, not inferred from an empty API payload
- while backend reachability is checking or unavailable, signed-out users and every pre-main flow (Auth, verification, onboarding, profile setup, and paywall) show `ConnectivitySplash`: the existing theme-aware ink/bubble backdrop with the compact static journal.io wordmark centered on it, not a loader. The compact mark matches the 160x44 wordmark in the iOS launch storyboard and the backdrop matches its background colour, so the native launch image hands off to it without a visible jump; on Android, which has no splash theme, this is the launch surface. The mark never plays the ink-current intro, which belongs to the Auth entrance. An already-mounted pre-main screen remains mounted beneath the splash so local form progress is not discarded
- the splash stays wordless for 5 seconds, then fades in one muted `Waiting for connection` line and a single ghost `Retry` control that re-probes readiness through the shared deduped probe; reconnecting retracts the copy, Reduce Motion skips the fade, and the surface emits no haptic of its own — only the retry press speaks. A boot that resolves inside the 5-second window therefore never announces a failure that did not happen
- one rule governs the whole area: a full-screen surface means the user is not yet authenticated, and the offline banner plus disabled actions means they are inside the app. Ask Jade counts as an authenticated surface, so losing connection there shows the banner and the screen's own offline copy rather than a full-screen takeover
- when real stored tokens and a previously server-verified profile exist on the current installation, temporary offline launch may open the authenticated shell with that cached profile and a calm global offline banner; a fresh reinstall must never use a residual profile cache or tokens for offline access. Server-backed controls are disabled, cached content stays readable, and an unhydrated collection must say it is unavailable offline rather than presenting a false empty state
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
- connectivity failures defer to the shared full-screen connectivity splash or authenticated offline banner instead of stacking an Auth error dialog over the connectivity state
- auth error feedback settles immediately when Reduce Motion is enabled and does not emit haptics; the hosted reset-password page remains outside this native feedback contract
- signed-in session state should not be cleared unless the user logs out, the backend rejects the session as unauthorized, or a fresh reinstall is detected

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
- keep contextual locked-feature paywalls simpler than the post-auth flow; explicit feature gates open the backend-selected full-screen in-app paywall instead of replaying the post-auth 3-step sequence
- stack a contextual paywall above its caller so dismissing it restores the exact locked surface and its state: paid Widgets return to Widgets, Entry Detail insights return to the same entry, and the Guided Reflection gate returns to the originating tab with the entry chooser closed
- when a contextual gate originates in a native React Native sheet, finish the sheet's native dismissal before presenting the paywall so a late modal callback cannot close or obscure the new route
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
- iOS exposes three focused Home Screen widget types from one native WidgetKit extension: Streak in small and medium sizes, a small Quick Thought launcher, and a medium Mood Check-in widget
- Streak is free; tapping either size opens the in-app Streaks screen. The small size shows current, best, and this-month counts. The medium size keeps those counts on the left and shows a 30-day activity grid on the right instead of the current-week activity row.
- Quick Thought is Premium and opens the focused in-app quick composer after any required auth, onboarding, or biometric gate; widget URLs never contain draft text
- iOS 17+ Mood Check-in buttons save directly without opening the app, while iOS 15/16 opens Home with a validated suggested mood that still requires an in-app confirmation
- Mood Check-in is Premium, uses the existing five values and once-per-local-day guard, animates the completed checkmark, retains the selected mood icon until local midnight, opens Home when the completed widget is tapped, and never queues an offline write
- direct mood widget actions remain available when the separate Journal.IO biometric overlay is enabled; the biometric settings guidance must disclose that narrow exception without implying that journal content is exposed
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

- Home recent entries and Entries history cards should use the same entry presentation
- show the entry-type icon and date on the left, keep the favorite star on the right, then the title, compact content preview, and tags
- guided reflections use the supplied yoga artwork, open-ended journals use the journal artwork, and Quick Thoughts use the existing neutral book placeholder
- the favorite star is tappable and updates the saved favorite state
- Quick Thoughts persist a separate immutable `entryKind: quick_thought`; legacy records without it may fall back to the exact historical `Quick Thought` title
- All Entries and selected-date Calendar cards reveal explicit Favorite/Unfavorite and Delete actions when swiped left; card swipes must not trigger the surrounding list/calendar mode swipe
- All Entries loads the newest page first and appends older cursor pages near the end of the list; Calendar fetches complete date-bounded pages for the visible month rather than treating the first list page as the whole month
- Delete always uses the established native confirmation and does not remove the card until the authenticated request succeeds
- opening an entry card, Favorite/Unfavorite actions, and opening the Delete prompt emit shared haptics; on All Entries and selected-date Calendar cards, a second card tap within 300ms emits one primary-action cue, then favorites an unfavorited entry with one centered large-star flight into the top-right star. An existing favorite only replays a restrained filled-star pulse and never unfavorites; a single tap opens the entry after that 300ms recognition window
- Reduce Motion settles card swipes and favorite state immediately without the traveling-star or pulse animation
- guided and open-ended entry chips use the persisted `detectedTopics` from saved-entry analysis, render human-readable labels, and never fall back to user-authored or reserved metadata tags. Full detail/edit rows show all stored topics while compact Home, Entries, Calendar, and Search cards show at most three. Quick Thoughts keep their existing non-`mood:` raw tags because they do not receive Session Analysis
- hide all reserved `onboarding:` tags from entry cards, entry screens, Search filters, and Insights popular topics. New first guided reflections no longer write the historical `onboarding:first-reflection` marker
- keep the Home preview slightly shorter than Entries
- do not seed Home or Entries with fake journal entries at runtime; empty states should render until real local or backend-backed entries exist
- entry detail and edit screens do not render a prompt-used card. The stored `aiPrompt` remains available to backend analysis and editing contracts but is not part of the saved-entry presentation
- successful new-entry and journal-edit saves should return the user to Home and clear stale detail/editor state so back navigation cannot reveal unavailable entry screens
- on iOS, eligible journal detail replaces the old on-demand Quick Analysis card with a read-only `Session insights` surface. Its calm segmented control switches between `Analysis` and the exact saved session `Mind Map`, with a short fade-and-rise content transition and Reduce Motion support
- the Analysis view shows the saved session narrative, major insight, dominant center, expandable center breakdown, and topics. The Mind Map view reuses the production interactive renderer, region selection, recenter control, and detail sheet against the same saved `brainSessionMap` payload generated for that session
- selecting a different point in the session Mind Map updates the brain highlight immediately, then transitions the Session Signal card through a short fade-down and fade-and-rise so its score, region, and insight never snap; repeated selections interrupt cleanly and Reduce Motion updates immediately
- after session analysis resolves, its five-value mood emoji crossfades into the date row in place of the placeholder date icon. Quick Notes show no Session insights, and Free users see the existing local Premium gate without requesting personal analysis
- Android retains the existing on-demand Quick Analysis surface for this iOS-first release

The first screen after setup should make journaling and check-in easy within one scroll.

Mood tracker copy should feel direct and calm, using "How are you feeling today?" for the prompt and clearly indicating when today's check-in is already logged.
Home must refresh today's mood on foreground/focus so an App Intent save performed while React Native was suspended is reflected without requiring a reconnect event.

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
- tapping the Home hero orb opens **Ask Jade**, a premium chat surface over the user's own patterns. Every orb tap starts a blank conversation; previous sessions remain available from the centered screen header. Free users reach the screen and see a locked card there, which then opens the `ask_jade_locked` placement — the screen owns the locked state so the upgrade prompt arrives with context, matching the Insights precedent rather than punching straight out to the paywall. The orb stops accepting taps once it has faded on scroll
- keep the Ask Jade composer inside the bottom safe area. Present previous chats in the shared rounded-sheet style with a stationary fading scrim and no duplicate close control; rows reveal a confirmed destructive action only after a left swipe. Starter prompts should populate and focus the composer with a restrained transition, newly sent user messages should settle into the transcript, and the three thinking dots should alternate visibility until Jade responds. These temporary animations render at rest under Reduce Motion
- Jade speaks in the same non-clinical, uncertainty-aware voice as guided reflection and is explicitly scoped to the user's own reflections: asked for anything unrelated (code, trivia, news), it says warmly that it only works with what they have written and offers the nearest thing it can do. It never names a condition or trait, even if the user names one first
- Ask Jade renders structured points as quiet bullet/number rows and explicit-request statistics as full-width themed cards. Supported visuals are overview stats, mood trend, mood distribution, and writing activity; ordinary reflective replies stay prose-only. Prose reveals first, then rich blocks appear together without passive chart animation. Charts expose synthesized accessibility summaries and never rely on color alone
- a stored fallback bubble offers `Edit and retry`, restoring the preceding user turn to the composer without sending automatically. Safety replies remain immediate. Product privacy replies are deterministic and accurately describe the current runtime encryption mode rather than promising universal or end-to-end encryption
- after repeated premium-intent actions, eligible free users may also see an interruptive paywall on a later Insights entry if backend cooldown rules allow it
- for premium users, AI Analysis should be based on the most recent closed premium-week window in the user’s local timezone
- if the current premium week is still open, show a supportive collecting state with progress toward the 4-active-day minimum, remaining days, and a reminder that quick analysis is available on individual entries
- if the most recent closed premium week ended with only 0-3 active journal days, show an insufficient-data recap instead of a partial weekly report
- keep AI-analysis copy concise and easy to skim; prefer a few strong signals over dense paragraphs
- make the primary AI-analysis read visual-first: hero summary, compact metric strip, emotion trend chart, theme breakdown, signal cards, short action trio, and a concise app-support card
- on iOS, Premium users should also see an `Explore your Mind Map` CTA from the `AI Analysis` tab; Android should not expose this route in the current release
- the production Mind Map screen should open full-screen with a back button, `Latest week` and `All reflections` range control, drag-to-rotate 3D interaction, pinch zoom, and a visible recenter action
- the 3D model should read as a calm stylized solid brain divided into 8 fixed reflection regions with subtle seam boundaries, not a medical visualization
- the detail surface should live in a bottom sheet with a collapsed strongest-signal preview and an expanded internal scroll area so 3D gestures and detail scrolling do not compete
- region copy should consistently say `reflection signal` or `patterns in your writing`, and the screen must keep a visible disclaimer that this is not a medical or literal brain-activity measure
- if `Hide Journal Previews` is enabled, evidence snippets inside the Mind Map detail sheet should be masked while non-sensitive region labels, ordering, and scores remain visible
- while the aggregate Mind Map panel is loading, show two theme-aware shimmer cards that mirror the selected-region and region-list groups; a failed load becomes a centered error card with Retry, and Retry returns to shimmer before the next resolved panel state fades upward. This temporary motion has no haptics and is static under Reduce Motion.
- personalized ready-state aggregate, per-session, and per-entry Mind Maps support sharing from the selected card through a small explicit share icon. Mind Map cards do not share on long press and show no gesture hint; educational, building, loading, error, gated, and support-first states never expose sharing
- the shared export is a fixed warm 4:5 PNG containing only the `journal.io` wordmark, a static focused brain snapshot and marker, product-facing region label, rounded score out of 100, and at most two lines of supportive insight. It excludes username, date, anatomical label, tier, evidence, raw journal text, and medical claims. The WebGL brain is rasterized before the native card capture so the platform share sheet cannot receive a blank WebView image
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
- onboarding reminders are optional: the dedicated final setup screen first presents a branded permission card after a one-shot, reduced-motion-aware bell animation. Its Allow action opens the real system notification prompt; approval reveals the four time choices in an animated bottom sheet, while `Continue without a reminder` remains available and keeps the preference optional
- enabling reminders must request system notification permission and then schedule local device notifications with Notifee
- when device notification permission is unavailable, show an actionable, theme-aware helper card at the top of Reminders that opens the operating system's app-settings page; do not imply that the app can grant the permission itself
- changing time, weekday coverage, or streak-warning behavior must re-sync the local notification schedule
- skip-on-entry behavior should suppress the current day's reminder after a journal entry is saved when that toggle is enabled
- include loading and recoverable error states without replacing the core Make structure

Settings and privacy expectations:

- The shared widget walkthrough video uses the supplied White Titanium iPhone frame artwork in both onboarding and Settings > Widgets. The video is clipped into the artwork's display area with the Figma-defined 90px inner corner radius scaled to the rendered frame height; do not draw a separate device border, shadow, or Dynamic Island over it.
- Settings > More includes a Widgets destination with an `Active widgets` area that starts empty on each device and an `All widgets` catalog beneath it. The empty card centers only `No active widgets`. Both sections use equal full-width, native-style sample previews instead of descriptive management rows; the Streak preview uses its richer medium layout with aligned left-side stats and visible 12-point 30-day activity cells, while one activation still enables both native sizes. The native medium Streak widget uses the same larger activity cells in a fixed-width panel that expands toward the center. Preview cards and the instruction row use a visible theme-aware outline and restrained elevation so they remain distinct in light mode. Long-pressing an available preview activates it and moves it out of the catalog into the active list; swiping an active preview left reveals an explicit Remove action, and the swipe alone is never destructive. Streak is free, while free users see strongly blurred Mood Check-in and Quick Thought previews behind a compact yellow lock-icon Premium purchase handoff. The Mood Check-in preview title is text-only. Inactive `systemSmall` Streak and Quick Thought widgets use a dedicated vertical enable state so their icon, title, helper copy, and action remain legible within small WidgetKit margins. A compact blue question-mark image-led `How to add a widget` row opens the iOS Home Screen setup steps and explains that iOS lists every compiled Journal.IO widget type. Device-local activation controls whether a placed widget shows live content. Widget configurations and supported families must remain static because WidgetKit caches gallery descriptors at install/update time; returning an empty runtime descriptor set can leave the Journal.IO selector blank, and iOS provides no supported API for dynamically adding or removing gallery types.
- Settings should lead with an `Account` list, followed by `Personalisation`: `Manage account` opens a detail surface with the stored email, joined date, and danger-zone deletion action. On iOS, deletion opens an Apple-native typed `DELETE` prompt that briefly says journals and account data will be permanently deleted, with `This action cannot be undone.` on its own line, followed by a minimal native `Are you sure?` alert with horizontally aligned `Cancel` and `Delete` actions before any request is sent; Android retains the same sequence through a themed fallback sheet and final alert. `Subscription` appears in this list only for verified Premium users and opens the current membership summary. `About me`, `Theme`, and `Notifications` each open their own detail surface.
- Place a matching `Privacy & Data` row list immediately after `Personalisation`. On iOS, order it as biometric app lock, `Hide entries`, then `Export data`; Android omits the biometric row and keeps the remaining controls in the same order.
- The iOS app-lock row opens an in-modal detail screen rather than exposing a switch inline. It uses the short supporting copy `Keep Journal.IO private`, adapts between `Face ID lock` and `Touch ID lock`, and remains available to open even when device authentication has not been configured.
- on iOS, the Personalisation detail views stay inside the Home account modal with a short in-modal transition and back history; Android retains its native settings stack route behavior
- `About me` may update the account name and show only the user's stored onboarding selections, never journal content or inferred AI details
- the Theme row should show the current resolved theme colour and preference; the Theme detail surface uses a simple selectable list with colour dots, not a dropdown
- the Notifications row should show the current On/Off status and open the existing reminder controls
- changing theme from the Settings theme selector should use the same tap-origin ripple transition as the Home header toggle
- `Hide entries` should be a premium-gated control in Settings; free users should see it as a locked upgrade entry point instead of an active toggle
- locked `Hide entries` taps should log a premium-intent event and open the backend-controlled `settings_hide_previews_locked` paywall placement
- the iOS biometric detail screen is premium-gated in production: Free users always see a shared Premium upgrade card that opens the `settings_biometric_lock_locked` placement, regardless of device capability. Premium users see an unavailable card when iOS does not support Face ID/Touch ID or a tappable permission card that opens iPhone app settings when a supported biometric cannot authenticate. The local app-lock switch card always remains visible, but stays disabled until the user has Premium access and biometric authentication is available.
- when the local biometric lock is enabled, the authenticated app shell should cover content immediately on cold launch and whenever the app returns from inactive/background until the user confirms Face ID, Touch ID, or device passcode; cancelling keeps the overlay visible with a `Try again` action instead of repeatedly forcing prompts
- a lightweight device-level privacy toggle may hide journal-card preview content in shared list surfaces such as Home, Entries, and Search
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

Type direction (implemented in `src/theme/typography.ts`):

- display (>= 22px): Bricolage Grotesque SemiBold / Bold
- headline and UI: Schibsted Grotesk SemiBold
- body and entry prose: Schibsted Grotesk Regular

Both families are contemporary grotesques, chosen to match the blunt, warm,
non-clinical voice the insight copy is written in. Weights stop at 700; display
type carries negative tracking and captions carry positive tracking.

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
