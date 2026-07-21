# Journal.IO Redesign Technical Audit

Audit date: 2026-06-26
Scope: local monorepo inspection only. No app logic, data, migrations, or production systems were changed. No `.env` values, API keys, tokens, connection strings, real user PII, receipts, device tokens, or journal content were inspected or printed.

## 1. Monorepo Map

Root folders observed:

- `.agents`
- `.codex`
- `.git`
- `Journal.io assets`
- `backend`
- `docs`
- `frontend`

Primary app folders:

- Frontend: `frontend`
- Backend: `backend`
- Docs: `docs`

Package managers and lockfiles:

- Frontend npm: `frontend/package.json`, `frontend/package-lock.json`
- Frontend CocoaPods/Bundler: `frontend/ios/Podfile.lock`, `frontend/Gemfile.lock`
- Backend npm: `backend/package.json`, `backend/package-lock.json`

Frontend stack:

- React Native version: `0.82.1` in `frontend/package.json`
- React version: `19.1.1`
- Navigation: `@react-navigation/native`, `@react-navigation/native-stack`
- State management: `zustand`
- Local persistence: `@react-native-async-storage/async-storage`, `react-native-keychain`
- RevenueCat: `react-native-purchases`, `react-native-purchases-ui`
- Notifications/reminders: `@notifee/react-native`
- Native auth: `@invertase/react-native-apple-authentication`, `@react-native-google-signin/google-signin`
- Animation: React Native `Animated`; no separate Reanimated dependency found
- Haptics: no explicit haptics library found in `frontend/package.json`
- AI/OpenAI client library: none on frontend; frontend calls backend APIs
- TanStack Query: expected by repo guidance but not found in `frontend/package.json`

Backend stack:

- Framework: Express 5 via `express` in `backend/package.json`
- Database: MongoDB through `mongoose`
- Validation: `zod`
- Auth/session: `jsonwebtoken`, `google-auth-library`, Apple token verification in auth service
- AI/OpenAI: direct `fetch` to OpenAI Responses API in `backend/src/helpers/openai.helpers.ts`
- RevenueCat backend integration: `backend/src/config/revenueCat.config.ts`, `backend/src/services/revenuecat/*`, `backend/src/services/paywall/*`

## 2. Current App Launch Flow

The launch decision is centered in the Zustand app store and navigation root:

- `frontend/src/App.tsx:14` defines `AppBootstrapper`.
- `frontend/src/App.tsx:20` calls `bootstrapAuthGate()` on startup.
- `frontend/src/App.tsx:99` renders `AppNavigator`.
- `frontend/src/navigation/AppNavigator.tsx:225` defines `getInitialRouteName(stage)`.
- `frontend/src/navigation/appFlow.ts:1` defines `FlowStage`.
- `frontend/src/store/appStore.ts:561` defines `bootstrapAuthGate`.

Current app stage values are defined in `frontend/src/navigation/appFlow.ts:1`:

- `onboarding`
- `paywall`
- `hosted-paywall`
- `lifetime-offer`
- `auth`
- `sign-in`
- `forgot-password`
- `reset-password`
- `create-account`
- `verify-email`
- `profile`
- `main-app`
- `new-entry`
- `journal-detail`
- `journal-edit`
- `complete`

Stage persistence:

- The current stage itself is not directly persisted as a durable enum.
- Durable gates are persisted through AsyncStorage and Keychain:
- `journalio.installSeen`, `journalio.onboardingCompleted`, `journalio.onboardingData`, `journalio.hideJournalPreviews`, `journalio.postAuthPaywallSeen` in `frontend/src/utils/appStorage.ts:4`.
- Auth tokens are stored in Keychain service `journalio.auth.tokens` in `frontend/src/utils/keychainStorage.ts:8`.
- Cached auth user is stored under `journalio.auth.user` in `frontend/src/utils/authSessionCache.ts:4`.

Cold launch restoration:

- `bootstrapAuthGate()` loads preview preference at `frontend/src/store/appStore.ts:566`.
- First install clears tokens/cache/onboarding data and sends users to `onboarding` at `frontend/src/store/appStore.ts:577`.
- If tokens exist, it calls `getProfile()` and hydrates session at `frontend/src/store/appStore.ts:594`.
- Successful token/profile restoration sets local onboarding completed from `profile.onboardingCompleted`, caches the user, syncs reminders, and enters `main-app` at `frontend/src/store/appStore.ts:613`.
- Unauthorized profile fetch clears tokens/cache at `frontend/src/store/appStore.ts:628`.
- Network fallback uses cached user and enters `main-app` or `profile` at `frontend/src/store/appStore.ts:633`.
- Without valid tokens, local `onboardingCompleted` and stored onboarding data determine `auth` vs `onboarding` at `frontend/src/store/appStore.ts:664`.

After onboarding completes:

- `completeOnboarding(data)` at `frontend/src/store/appStore.ts:713` stores local onboarding data and `journalio.onboardingCompleted = true`.
- It syncs local reminder preference, waits briefly, sets stage to `auth`, and resets navigation to `AuthChoice` at `frontend/src/store/appStore.ts:736`.

After auth completes:

- Apple, Google, email sign-up, verification, and sign-in all pass old onboarding context when available and generally mark `onboardingCompleted: true`.
- Apple auth: `frontend/src/store/appStore.ts:964`.
- Google auth: `frontend/src/store/appStore.ts:1034`.
- Email sign-up: `frontend/src/store/appStore.ts:1119`.
- Email verification: `frontend/src/store/appStore.ts:1154`.
- Email sign-in: `frontend/src/store/appStore.ts:1237`.
- Post-auth destination is `profile` when `profileSetupCompleted` is false, otherwise `main-app`, via `getPostAuthDestinationStage()` at `frontend/src/store/appStore.ts:424`.
- A post-auth paywall can interrupt via `shouldShowPostAuthPaywall()` at `frontend/src/store/appStore.ts:434`.

Paywall dismissal or purchase success:

- Hosted paywall fallback and exit-offer transitions are handled in `frontend/src/store/appStore.ts:763`, `frontend/src/store/appStore.ts:799`, and `frontend/src/store/appStore.ts:745`.
- Native/custom paywall purchase success calls update profile/premium sync logic in `frontend/src/screens/profile/PaywallScreen.tsx:936`.
- Hosted RevenueCat paywall success calls `completePremiumActivation()` in `frontend/src/screens/profile/HostedRevenueCatPaywallScreen.tsx:280`.
- Lifetime paywall success calls `completePremiumActivation()` in `frontend/src/screens/profile/LifetimeOfferPaywallScreen.tsx:608`.

Logout:

- `signOut()` at `frontend/src/store/appStore.ts:1344` best-effort calls backend logout, cancels free-trial reminders, clears tokens, cached auth user, and stored onboarding data, resets journal slice, and moves to `auth`.
- It does not clear the `journalio.onboardingCompleted` flag directly.

Other navigation roots or equivalents:

- `frontend/src/navigation/AppNavigator.tsx` is the current root navigator.
- `frontend/src/navigation/routes.tsx:91` contains an `AppFlowRoutes` stage switch that appears older/equivalent and should be checked before redesign to avoid stale routing drift.
- `frontend/src/screens/main/MainAppShell.tsx:112` wires Home, New Entry, Journal detail/edit, Insights, Settings/Profile, and paywall screens inside the main app shell.

## 3. Current Onboarding Implementation

Main onboarding screen:

- `frontend/src/screens/onboarding/OnboardingScreen.tsx`

Types and services:

- `frontend/src/types/onboarding.ts:1` defines `OnboardingCompletionData`.
- `frontend/src/services/onboardingService.ts:24` defines `generateOnboardingDemoAnalysis()`.
- `backend/src/services/onboarding/onboarding.routes.ts:8` exposes `POST /onboarding/demo-analysis`.
- `backend/src/services/onboarding/onboarding.service.ts:153` generates deterministic demo analysis.

Step count and constants:

- `TOTAL_STEPS = 12` at `frontend/src/screens/onboarding/OnboardingScreen.tsx:58`.
- Privacy step is `8`, journal demo is `9`, AI reflection is `10`, breathing pause is `11`, rating step is `12` at `frontend/src/screens/onboarding/OnboardingScreen.tsx:59`.

Current step order:

- Step 1: welcome/value proposition, `OnboardingScreen.tsx:879`.
- Step 2: age range, `OnboardingScreen.tsx:929`.
- Step 3: journaling experience, `OnboardingScreen.tsx:983`.
- Step 4: journaling goals, `OnboardingScreen.tsx:1042`.
- Step 5: support focus areas, `OnboardingScreen.tsx:1119`.
- Step 6: reminder preference, `OnboardingScreen.tsx:1191`.
- Step 7: AI comfort, `OnboardingScreen.tsx:1267`.
- Step 12: excitement/rating, `OnboardingScreen.tsx:1399`.
- Step 8: privacy consent, `OnboardingScreen.tsx:1566`.
- Step 9: journal demo, `OnboardingScreen.tsx:1701`.
- Step 10: demo AI reflection, `OnboardingScreen.tsx:1861`.
- Step 11: breathing pause, `OnboardingScreen.tsx:1964`.

Validation rules:

- `canProceed` is defined at `frontend/src/screens/onboarding/OnboardingScreen.tsx:432`.
- Age range is required on step 2.
- Journaling experience is required on step 3.
- Privacy consent is required on step 8.
- Journal demo mood and thoughts are required on step 9.
- AI reflection waits for a minimum display timer on step 10.
- Breathing pause waits for a minimum display timer on step 11.
- Goals, support focus, reminder, AI comfort, and rating are not hard-required beyond defaults.

Current payload:

- `OnboardingCompletionData` at `frontend/src/types/onboarding.ts:1` has `ageRange`, `journalingExperience`, `goals`, `supportFocusAreas`, `reminderPreference`, `aiComfort`, and `privacyConsent`.
- `buildOnboardingContext(data)` maps this to backend `AuthOnboardingContext` in `frontend/src/store/appStore.ts:162`.

Local storage:

- `saveOnboardingCompleted()` and `saveStoredOnboardingData()` are in `frontend/src/utils/appStorage.ts:49` and `frontend/src/utils/appStorage.ts:61`.
- Stored key names are in `frontend/src/utils/appStorage.ts:4`.

Backend submission:

- There is no standalone `completeOnboarding` backend endpoint today.
- Onboarding data is sent during auth calls as `onboardingContext` and `onboardingCompleted: true`.
- Backend validator for auth onboarding context is `backend/src/services/auth/auth.validators.ts:24`.
- Backend sanitization is `sanitizeOnboardingContext()` at `backend/src/services/auth/auth.service.ts:440`.

Reminder sync during onboarding:

- Step 6 calls `requestAndSyncOnboardingReminderPreference(selectedReminder)` at `frontend/src/screens/onboarding/OnboardingScreen.tsx:702`.
- Local notification scheduling is in `frontend/src/services/reminderNotificationsService.ts:378`.
- After auth, backend reminder record sync happens through `syncReminderStateAfterAuth()` in `frontend/src/store/appStore.ts:192`, which calls `syncOnboardingReminderRecordPreference()` in `frontend/src/services/remindersService.ts:92`.

Privacy consent:

- `agreedToPrivacy` state starts at `OnboardingScreen.tsx:323`.
- Privacy consent is required by `canProceed` at `OnboardingScreen.tsx:447`.
- Legal links render in the privacy step at `OnboardingScreen.tsx:1638`.
- The value is passed in final onboarding payload at `OnboardingScreen.tsx:762`.

AI demo analysis:

- Frontend service `generateOnboardingDemoAnalysis()` posts to `/onboarding/demo-analysis` in `frontend/src/services/onboardingService.ts:24`.
- Backend route is unprotected at `backend/src/services/onboarding/onboarding.routes.ts:8`.
- Backend generation is deterministic and does not call OpenAI in `backend/src/services/onboarding/onboarding.service.ts:153`.

Breathing pause:

- Controlled by `BREATHING_STEP` and `BREATHING_WAIT_SECONDS` at `OnboardingScreen.tsx:62`.
- Timer/animation state is managed around `OnboardingScreen.tsx:584`.
- Full-screen render begins at `OnboardingScreen.tsx:1964`.

Rating/excitement screen:

- Step constant `RATING_STEP = 12` at `OnboardingScreen.tsx:63`.
- Custom testimonial/rating UI starts at `OnboardingScreen.tsx:1399`.
- Native rating prompt is called from `requestNativeAppRating()` at `OnboardingScreen.tsx:803`.
- Rating alert trigger is `handleSelectExcitementRating()` at `OnboardingScreen.tsx:826`.

Completion stage change:

- `handleContinue()` submits final payload at `OnboardingScreen.tsx:757`.
- Store action `completeOnboarding()` moves stage to `auth` at `frontend/src/store/appStore.ts:736`.

## 4. Current Auth Implementation

Auth screens:

- `frontend/src/screens/auth/AuthChoiceScreen.tsx`
- `frontend/src/screens/auth/CreateAccountScreen.tsx`
- `frontend/src/screens/auth/SignInScreen.tsx`
- `frontend/src/screens/auth/ForgotPasswordScreen.tsx`
- `frontend/src/screens/auth/ResetPasswordScreen.tsx`
- `frontend/src/screens/auth/VerifyEmailScreen.tsx`
- `frontend/src/screens/auth/SetupProfileScreen.tsx`

Providers:

- Email/password sign-up, verification, sign-in, reset.
- Google mobile auth via `frontend/src/config/googleSignIn.ts`.
- Apple auth via `frontend/src/config/appleSignIn.ts`.

Token/session storage:

- Access and refresh tokens are stored in Keychain by `saveTokens()` at `frontend/src/utils/keychainStorage.ts:14`.
- Tokens are restored by `getTokens()` at `frontend/src/utils/keychainStorage.ts:23`.
- Cached profile/session user is stored by `saveCachedAuthUser()` at `frontend/src/utils/authSessionCache.ts:45`.

Backend profile fetch:

- `getProfile()` calls `GET /users/profile` at `frontend/src/services/userService.ts:16`.
- Backend route is `backend/src/services/user/user.routes.ts:17`.
- Controller is `getProfileController()` at `backend/src/services/user/user.controllers.ts:12`.
- Service is `getProfile()` at `backend/src/services/user/user.service.ts:66`.

Auth state restore:

- Startup restore is `bootstrapAuthGate()` at `frontend/src/store/appStore.ts:561`.
- It prefers live profile from tokens, then cached user on network fallback, then local onboarding status.

Logout clears:

- `signOut()` at `frontend/src/store/appStore.ts:1344`.
- Backend logout route is `POST /auth/logout` at `backend/src/services/auth/auth.routes.ts:78`.
- Keychain tokens, cached auth user, stored onboarding data, weekly notifications, and recent journal slice are cleared.

User profile fields:

- Frontend `AuthUser` type is in `frontend/src/services/authService.ts:3`.
- Backend user payload is built in `buildUserPayload()` at `backend/src/services/auth/auth.service.ts:620` and `buildUserProfilePayload()` at `backend/src/services/user/user.service.ts:36`.
- Profile includes `onboardingCompleted`, `isPremium`, subscription metadata, `revenueCatAppUserId`, `profileSetupCompleted`, `journalingGoals`, `avatarColor`, `profilePic`, and `aiOptIn`.
- Profile payload does not currently include `createdAt`, `journalCount`, or derived journal-entry existence.

## 5. Backend User Model And Auth Routes

User schema/model:

- File: `backend/src/schema/user.schema.ts`
- Interface `IUser`: `user.schema.ts:14`
- Schema `userSchema`: `user.schema.ts:73`
- Model collection name: `users` at `user.schema.ts:174`

Auth files:

- Routes: `backend/src/services/auth/auth.routes.ts`
- Controllers: `backend/src/services/auth/auth.controllers.ts`
- Validators: `backend/src/services/auth/auth.validators.ts`
- Services: `backend/src/services/auth/auth.service.ts`

Auth routes:

- `POST /auth/sign_up_with_email`: `auth.routes.ts:32`
- `POST /auth/resend_email_verification`: `auth.routes.ts:37`
- `POST /auth/verify_email`: `auth.routes.ts:42`
- `POST /auth/sign_in_with_email`: `auth.routes.ts:47`
- `POST /auth/request_password_reset`: `auth.routes.ts:52`
- `POST /auth/reset_password`: `auth.routes.ts:57`
- `POST /auth/google/mobile`: `auth.routes.ts:62`
- `POST /auth/apple/mobile`: `auth.routes.ts:67`
- `POST /auth/register_from_googleOAuth`: `auth.routes.ts:72`
- `POST /auth/refresh`: `auth.routes.ts:77`
- `POST /auth/logout`: `auth.routes.ts:78`

User routes:

- `GET /users/profile`: `backend/src/services/user/user.routes.ts:17`
- `PATCH /users/premium-status`: `user.routes.ts:24`
- `PATCH /users/profile`: `user.routes.ts:31`

Current user fields relevant to redesign:

- Onboarding: `onboardingCompleted`, `onboardingContext` in `user.schema.ts:129`.
- Premium/subscription: `isPremium`, `premiumPlanKey`, `premiumActivatedAt`, `premiumProductId`, `premiumExpiresAt`, `premiumWillRenew`, `premiumVerifiedAt`, `premiumRevenueCatRequestDate`, `premiumSource`.
- RevenueCat customer ID: `revenueCatAppUserId`.
- Reminder preference: only inside `onboardingContext.reminderPreference`; real reminders are in the `reminders` collection.
- Privacy/AI consent: `aiOptIn` and `onboardingContext.privacyConsentAccepted`.
- Created timestamp: schema uses `{ timestamps: true }` at `user.schema.ts:135`.
- Deleted/account deletion: no `deletedAt` on user schema; privacy deletion likely hard-deletes or is handled elsewhere.

Feasibility of requested fields:

- `onboardingCompleted`: already exists.
- `onboardingVersion`: can be added safely as optional.
- `onboardingCompletedAt`: can be added safely as optional.
- `onboardingPayload`: can be added, but should be sanitized and versioned; avoid storing raw first-reflection transcript here.
- `firstReflectionId`: can be added as `ObjectId` or string reference once journal/reflection creation flow is defined.
- `personalGoals`: can be added as structured user-level goals; likely separate collection if goals become editable/tracked.
- `preferredTheme`: can be added as enum.
- `reflectionTone`: can be added as enum.
- `primaryContext`: can be added as optional non-sensitive setup field.

## 6. Current Journal Model And Journal Routes

Journal schema/model:

- File: `backend/src/schema/journal.schema.ts`
- Interface `IJournal`: `journal.schema.ts:4`
- Schema `journalSchema`: `journal.schema.ts:19`
- Model collection name: `journals` at `journal.schema.ts:44`

Journal fields:

- `content`: `journal.schema.ts:20`
- `userId`: `journal.schema.ts:21`
- `type`: `journal.schema.ts:22`
- `title`: `journal.schema.ts:23`
- `aiPrompt`: `journal.schema.ts:24`
- `tags`: `journal.schema.ts:25`
- `images`: `journal.schema.ts:26`
- `isFavorite`: `journal.schema.ts:27`
- `createdAt` and `updatedAt`: timestamps enabled at `journal.schema.ts:35`

Indexes:

- `userId`: `journal.schema.ts:37`
- `{ userId, createdAt }`: `journal.schema.ts:38`
- `type`: `journal.schema.ts:39`
- `createdAt`: `journal.schema.ts:40`
- `{ _id, title }`: `journal.schema.ts:41`

Routes:

- `GET /journal/get_journals`: `backend/src/services/journal/journal.routes.ts:14`
- `POST /journal/create_journal`: `journal.routes.ts:26`
- `GET /journal/get_journal_details`: `journal.routes.ts:38`
- `POST /journal/edit_journal`: `journal.routes.ts:50`
- `POST /journal/toggle_favorite`: `journal.routes.ts:62`
- `DELETE /journal/delete_journal`: `journal.routes.ts:74`
- `POST /journal/suggest_tags`: `journal.routes.ts:86`
- `POST /journal/quick_analysis`: `journal.routes.ts:93`

Controller/service files:

- `backend/src/services/journal/journal.controllers.ts`
- `backend/src/services/journal/journal.service.ts`
- `backend/src/services/journal/journal.validators.ts`
- `backend/src/types/journal.types.ts`

Current create behavior:

- Controller: `createJournalController()` at `journal.controllers.ts:41`.
- Service: `createJournal()` at `journal.service.ts:1040`.
- Frontend service: `createJournalEntry()` at `frontend/src/services/journalService.ts:11`.

Mood and tags:

- Journal mood is not a first-class field.
- New Entry stores mood as a tag, e.g. `mood:good`, in `frontend/src/screens/NewEntryScreen.tsx:386`.
- Backend helper `getMoodTag()` is at `backend/src/services/journal/journal.service.ts:372`.
- Tags are an array of strings on the journal document.

Schema support for requested redesign fields:

- `selectedMood`: not supported as first-class field.
- `inferredMood`: not supported.
- `finalMood`: not supported.
- `reflectionTranscript`: not supported.
- `entryAnalysis`: not supported on journal document.
- `mindMapNode`: not supported.
- `mindMapThemes`: not supported except loosely via tags.
- `generatedTitle`: not supported as separate provenance field; `title` exists.
- `cleanContent`: not supported as separate generated entry text; `content` exists.

## 7. Current AI Services And Endpoints

Frontend AI-related calls:

- Writing prompts: `getWritingPrompts()` in `frontend/src/services/promptsService.ts:16`, calls `GET /prompts/writing`.
- Journal tag suggestions: `suggestJournalTags()` in `frontend/src/services/journalService.ts:120`, calls `POST /journal/suggest_tags`.
- Journal quick analysis/mirror-like analysis: `getJournalQuickAnalysis()` in `frontend/src/services/journalService.ts:139`, calls `POST /journal/quick_analysis`.
- Onboarding demo analysis: `generateOnboardingDemoAnalysis()` in `frontend/src/services/onboardingService.ts:24`, calls `POST /onboarding/demo-analysis`.
- Weekly insights/action plans: `frontend/src/services/insightsService.ts` and UI in `frontend/src/screens/InsightsScreen.tsx`; backend AI weekly analysis is in `backend/src/services/insights/insights.service.ts`.

Backend AI helpers and services:

- OpenAI helper: `backend/src/helpers/openai.helpers.ts`
- Default model selection: `backend/src/helpers/openai.helpers.ts:36`
- AI access check: `canUseOpenAiForUser()` at `openai.helpers.ts:63`
- Structured OpenAI request: `requestStructuredOpenAi()` at `openai.helpers.ts:88`
- Journal AI tags: `generateOpenAiJournalTags()` at `backend/src/services/journal/journal.service.ts:481`
- Journal quick analysis: `generateOpenAiJournalQuickAnalysis()` at `journal.service.ts:964`
- Writing prompts: `generateAiWritingPrompts()` at `backend/src/services/prompts/prompts.service.ts:95`
- Weekly analysis enhancement: `generateAiAnalysisEnhancement()` at `backend/src/services/insights/insights.service.ts:2324`
- Onboarding demo: deterministic only, `backend/src/services/onboarding/onboarding.service.ts:153`

Current prompts:

- Journal tags system prompt: `journal.service.ts:499`.
- Journal quick analysis system prompt: `journal.service.ts:995`.
- Writing prompts system prompt: `prompts.service.ts:112`.
- Weekly analysis system prompt: `insights.service.ts:2370`.

Current fallback behavior:

- OpenAI unavailable or ineligible users return deterministic fallback for writing prompts and tag suggestions.
- Journal quick analysis requires premium and AI opt-in, then can combine heuristic baseline with optional OpenAI enhancement.
- Onboarding demo analysis is deterministic and should remain available without premium.
- OpenAI helper parses strict JSON schema and logs errors; debug raw output logging is controlled by `OPENAI_DEBUG_LOGS` and `NODE_ENV` in `openai.helpers.ts:37`, which should be reviewed before redesign because raw AI output can contain sensitive journal-derived text.

Premium gating:

- `canUseOpenAiForUser()` requires OpenAI configured, `user.isPremium`, and `user.aiOptIn !== false` in `backend/src/helpers/openai.helpers.ts:63`.
- Tag suggestions require premium in `suggestJournalTags()` at `backend/src/services/journal/journal.service.ts:1214`.
- Quick analysis requires premium and AI opt-in in `ensureQuickAnalysisAccess()` at `journal.service.ts:545`.
- Weekly AI analysis has premium checks in `backend/src/services/insights/insights.service.ts`.

Support for requested AI functions:

- `generateReflectionFollowUp`: not present; can reuse structured OpenAI helper and journal validation style.
- `inferMoodFromEntry`: not present; can be deterministic first, OpenAI-enhanced for premium or onboarding-safe depending product choice.
- `generateEntryMirror`: partially covered by `quick_analysis`; needs new response shape for Mirror tab.
- `generateEntryTitle`: not present.
- `suggestJournalTags`: already exists as frontend/backend API.
- `generateOnboardingMindMapPreview`: not present.
- `generatePersonalGoals`: not present.

## 8. Current Writing Prompts And New Entry Screen

Current screen:

- `frontend/src/screens/NewEntryScreen.tsx`

Current state variables:

- State block starts at `NewEntryScreen.tsx:238`.
- Includes `title`, `content`, `selectedMood`, `showPrompts`, `tagInput`, `selectedTags`, `suggestedTags`, `selectedPrompt`, `writingPrompts`, `isLoadingPrompts`, `promptsError`, `isSaving`, `error`, `hasRequestedInitialPrompts`, and `isAutoTagging`.

Current validation:

- Save requires non-empty `content` at `NewEntryScreen.tsx:383`.
- Auto-tag requires non-empty content at `NewEntryScreen.tsx:501`.

Current save behavior:

- `handleSave()` starts at `NewEntryScreen.tsx:382`.
- Creates `optimisticTags` including `mood:${selectedMood}` at `NewEntryScreen.tsx:386`.
- Calls `createJournalEntry()` at `NewEntryScreen.tsx:398`.
- Updates local recent-entry store with `addRecentJournalEntry()` at `NewEntryScreen.tsx:405`.
- Skips today's reminder at `NewEntryScreen.tsx:326`.
- Cancels weekly insight notifications at `NewEntryScreen.tsx:416`.
- Returns home via `returnHomeFromJournalFlow()` at `NewEntryScreen.tsx:418`.

API calls:

- Create journal: `frontend/src/services/journalService.ts:11`.
- Writing prompts: `frontend/src/services/promptsService.ts:16`.
- AI tags: `frontend/src/services/journalService.ts:120`.

Manual tags:

- Add/remove handlers are `handleAddTag()` and `handleRemoveTag()` at `NewEntryScreen.tsx:434`.
- Tags UI starts around `NewEntryScreen.tsx:940`.

AI tags:

- `handleAutoTag()` starts at `NewEntryScreen.tsx:483`.
- Premium lock opens paywall with placement `new_entry_auto_tag_locked` at `NewEntryScreen.tsx:489`.
- Backend 403 is mapped to premium message at `NewEntryScreen.tsx:520`.

Mood selector:

- Mood type and options are at `NewEntryScreen.tsx:51` and `NewEntryScreen.tsx:128`.
- Mood UI starts at `NewEntryScreen.tsx:687`.

Prompt loading:

- `loadWritingPrompts()` is at `NewEntryScreen.tsx:457`.
- It calls `/prompts/writing` through `getWritingPrompts()`.
- Backend route is `GET /prompts/writing` in `backend/src/services/prompts/prompts.routes.ts:9`.

Premium gating:

- New entry AI tags are premium-gated in frontend by `session.user.isPremium` at `NewEntryScreen.tsx:485`.
- Backend enforces premium in `suggestJournalTags()` at `backend/src/services/journal/journal.service.ts:1214`.

Navigation/local updates:

- Save returns to Home, not detail, at `NewEntryScreen.tsx:418`.
- Local recent-entry slice is `frontend/src/store/slices/journalSlice.ts`.
- `openNewEntry()` is in `frontend/src/store/appStore.ts:1437`.

Reminder/streak update:

- Reminder skip happens client-side through `maybeSkipTodaysReminder()` at `NewEntryScreen.tsx:326`.
- Backend journal create syncs insights through `syncJournalCreatedInsights()` at `backend/src/services/journal/journal.service.ts:1054`.
- Streak is maintained separately under mood/check-in and stats services; journal create does not directly update a streak field on journal.

## 9. RevenueCat And Paywall Setup

Frontend RevenueCat config:

- `frontend/src/config/revenueCat.ts`
- Entitlement ID: `Journal.IO Pro` at `revenueCat.ts:1`.
- Product IDs:
- `app.journalio.premium.weekly` at `revenueCat.ts:4`.
- `app.journalio.premium.yearly` at `revenueCat.ts:5`.
- `app.journalio.premium.yearly.exit` at `revenueCat.ts:6`.
- `app.journalio.premium.lifetime` at `revenueCat.ts:7`.
- Offering IDs:
- `journalio_offering_other_screens_standard` at `revenueCat.ts:10`.
- `journalio_offering_post_onboarding_exit` at `revenueCat.ts:11`.
- `journalio_offering_lifetime` at `revenueCat.ts:12`.

API key handling:

- Public client key env var names are `REVENUECAT_ANDROID_API_KEY` and `REVENUECAT_IOS_API_KEY` in `frontend/src/config/env.ts`.
- Values are intentionally not printed in this report.
- Backend secret env var names are `REVENUECAT_WEBHOOK_AUTH_TOKEN`, `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_APP_ID`, and `REVENUECAT_ALLOWED_WEBHOOK_ENVIRONMENTS` in `backend/src/config/revenueCat.config.ts:30`.
- Values are intentionally not printed in this report.

Frontend service:

- `frontend/src/services/revenueCatService.ts`
- `configureRevenueCat()` at `revenueCatService.ts:765`.
- `syncRevenueCatIdentity()` at `revenueCatService.ts:828`.
- `getRevenueCatOfferings()` at `revenueCatService.ts:878`.
- `purchaseRevenueCatPackage()` at `revenueCatService.ts:1084`.
- `restoreRevenueCatPurchases()` at `revenueCatService.ts:1119`.
- `presentRevenueCatHostedPaywall()` at `revenueCatService.ts:1152`.
- `refreshRevenueCatEntitlementState()` at `revenueCatService.ts:1282`.
- Customer-info listener at `revenueCatService.ts:1305`.

Paywall screens/components:

- `frontend/src/screens/profile/PaywallScreen.tsx`
- `frontend/src/screens/profile/HostedRevenueCatPaywallScreen.tsx`
- `frontend/src/screens/profile/LifetimeOfferPaywallScreen.tsx`
- Shared copy/helpers: `frontend/src/screens/profile/paywallShared.ts`

Backend paywall routes:

- `GET /paywall/config`: `backend/src/services/paywall/paywall.routes.ts`
- `POST /paywall/events`
- `POST /paywall/purchase-sync`
- `POST /paywall/entitlement-sync`

Backend RevenueCat config:

- Product IDs and entitlement mirror frontend in `backend/src/config/revenueCat.config.ts:1`.
- Production env assertions are in `backend/src/config/revenueCat.config.ts:50`.
- App startup calls `assertRevenueCatProductionConfiguration()` in `backend/src/app.ts`.

Paywall placement:

- Current app flow is onboarding first, then auth, then possible `post_auth` paywall.
- `shouldShowPostAuthPaywall()` returns true for signed-in non-premium users at `frontend/src/store/appStore.ts:434`.
- Hosted paywall is used unless placement is `profile_upgrade_banner`, `post_auth`, or `post_auth_exit_offer` at `frontend/src/store/appStore.ts:512`.

Restore purchases:

- Frontend restore function is `restoreRevenueCatPurchases()` at `frontend/src/services/revenueCatService.ts:1119`.
- Paywall restore handlers exist in `PaywallScreen.tsx:1105`, `HostedRevenueCatPaywallScreen.tsx`, and `LifetimeOfferPaywallScreen.tsx:730`.

Sandbox/test handling:

- Backend allowed environments default to `PRODUCTION` and `SANDBOX` in `backend/src/config/revenueCat.config.ts:47`.
- Webhook persistence uses `backend/src/schema/revenueCatWebhookEvent.schema.ts`.

Exit-offer/old discount logic:

- Exit offer product ID is `app.journalio.premium.yearly.exit`.
- Exit offering ID is `journalio_offering_post_onboarding_exit`.
- Paywall store logic tracks `post_auth_exit_offer` in `frontend/src/store/appStore.ts:504`.

## 10. Reminder And Notification Logic

Reminder preference type:

- Onboarding values are `morning`, `afternoon`, `evening`, and `none` in `frontend/src/screens/onboarding/OnboardingScreen.tsx:179`.
- Backend reminder type enum currently only supports `daily_journal` in `backend/src/services/reminders/reminders.validators.ts:5`.

Onboarding setup:

- Reminder step renders at `OnboardingScreen.tsx:1191`.
- Step 6 local notification sync is triggered at `OnboardingScreen.tsx:702`.

Local notification code:

- File: `frontend/src/services/reminderNotificationsService.ts`
- Notifee import: `reminderNotificationsService.ts:1`.
- Daily channel constants: `reminderNotificationsService.ts:12`.
- Permission request: `requestReminderPermission()` at `reminderNotificationsService.ts:119`.
- Schedule daily notification: `syncReminderNotifications()` at `reminderNotificationsService.ts:230`.
- Onboarding preference sync: `syncOnboardingReminderPreference()` at `reminderNotificationsService.ts:331`.
- Stored reminder sync: `syncStoredDailyReminderNotifications()` at `reminderNotificationsService.ts:359`.

Backend reminder storage:

- Schema: `backend/src/schema/reminder.schema.ts`
- Model collection: `reminders`.
- Routes: `backend/src/services/reminders/reminders.routes.ts`
- Service: `backend/src/services/reminders/reminders.service.ts`
- Unique index `{ userId, type }` at `reminder.schema.ts:68`.

Reminder API routes:

- `GET /reminders`: `reminders.routes.ts:19`.
- `POST /reminders`: `reminders.routes.ts:26`.
- `PATCH /reminders/:reminderId`: `reminders.routes.ts:33`.
- `DELETE /reminders/:reminderId`: `reminders.routes.ts:40`.

Sync after onboarding/auth:

- `syncReminderStateAfterAuth()` in `frontend/src/store/appStore.ts:192`.
- `syncOnboardingReminderRecordPreference()` maps onboarding choice to backend record in `frontend/src/services/remindersService.ts:92`.
- Existing users with no current onboarding data use `syncStoredDailyReminderNotifications()` at `appStore.ts:218`.

Existing-user preservation:

- Backend reminder records are independent from old onboarding payload and should be preserved.
- Local scheduled notifications are refreshed from stored backend reminder settings on launch/auth.

## 11. Native Review Prompt

Current native review support:

- Frontend service: `frontend/src/services/appRatingService.ts`
- `requestAppRating()` starts at `appRatingService.ts:27`.
- iOS native module: `frontend/ios/JournalFrontend/AppRatingModule.swift:6`.
- iOS uses `SKStoreReviewController.requestReview(in:)` at `AppRatingModule.swift:27`.
- Android native module: `frontend/android/app/src/main/java/com/journalfrontend/AppRatingModule.kt:9`.
- Android uses Play Core ReviewManager around `AppRatingModule.kt:16`.

Current trigger:

- Onboarding imports `requestAppRating` at `frontend/src/screens/onboarding/OnboardingScreen.tsx:47`.
- Custom rating screen appears during onboarding step 12 at `OnboardingScreen.tsx:1399`.
- `handleSelectExcitementRating()` triggers a custom alert and possible native prompt at `OnboardingScreen.tsx:826`.

Safe redesign trigger:

- Do not trigger native review during onboarding.
- Add a persisted one-time key, probably user-scoped, e.g. `journalio.reviewPrompt.firstHomeShown.<userId>` or backend profile flag.
- Trigger only after the new-user flow reaches Home after Paywall dismissal/purchase, with a short delay, and only if the user completed new onboarding version.
- Keep Apple/Google native review calls behind existing `requestAppRating()`; do not add a new rating library.

## 12. MongoDB Schema And Collection Audit

Live database inspection:

- Model/schema files were inspected first.
- Safe live database access was not available: MongoDB MCP was not connected.
- No connection string or `.env` value was inspected.
- Approximate document counts and sanitized live samples were therefore not collected.

Relevant collections from schema files:

- `users`: `backend/src/schema/user.schema.ts`; has user identity, onboarding, premium, RevenueCat customer ID, OAuth IDs, timestamps, and partial unique indexes.
- `journals`: `backend/src/schema/journal.schema.ts`; has `userId`, `content`, `title`, `type`, `aiPrompt`, `tags`, `images`, `isFavorite`, timestamps, and journal query indexes.
- `mood_checkins`: `backend/src/schema/mood.schema.ts`; has `userId`, `mood`, `moodDateKey`, timestamps, and unique `{ userId, moodDateKey }`.
- `insights`: `backend/src/schema/insights.schema.ts`; has `userId`, aggregate counts/maps, AI analysis cache fields, timestamps, and unique `userId`.
- `reminders`: `backend/src/schema/reminder.schema.ts`; has `userId`, `type`, `enabled`, `time`, `timezone`, reminder behavior booleans, timestamps, and unique `{ userId, type }`.
- `streaks`: `backend/src/schema/streak.schema.ts`; has `userId`, `streak`, date range fields, and timestamps.
- `stats`: `backend/src/schema/stat.schema.ts`; has `userId`, `journalsWritten`, `totalWordsWritten`, and timestamps.
- `paywall_configs`: `backend/src/schema/paywallConfig.schema.ts`; global paywall config with thresholds, cooldowns, placements, and timestamps.
- `paywall_events`: `backend/src/schema/paywallEvent.schema.ts`; paywall analytics events with userId, placement/template/offering, metadata, timestamps, and 90-day TTL.
- `paywall_offerings`: `backend/src/schema/paywallOffering.schema.ts`; offering metadata and RevenueCat IDs.
- `paywall_templates`: `backend/src/schema/paywallTemplate.schema.ts`; paywall copy, placements, and visible offering keys.
- `revenuecat_webhook_events`: `backend/src/schema/revenueCatWebhookEvent.schema.ts`; webhook idempotency and processing state; no raw receipt values observed in schema.
- `admin_configs`: `backend/src/schema/adminConfig.schema.ts`; global admin config with `homeSummerOfferVisible`.
- `behavourial_pattern.schema.ts`: file exists but appears empty.

Relationships:

- Most user-owned collections use `userId` ObjectId references to `users`.
- Journal-derived aggregates live in `insights`.
- Paywall events reference users but are analytics-like and TTL-limited.
- RevenueCat webhook events reference app user IDs/customer IDs and should be treated as sensitive operational data.

Created/updated timestamps:

- Present on `users`, `journals`, `mood_checkins`, `insights`, `reminders`, `streaks`, `stats`, paywall config/offering/template/event schemas, webhook events, and admin configs.

## 13. Existing User Migration Risk

Places that assume onboarding happens before auth:

- `bootstrapAuthGate()` starts unknown/no-token users at onboarding unless local onboarding complete exists.
- `completeOnboarding()` sends users to auth, not home.
- Auth actions pass `onboardingContext` from local onboarding data into sign-up/sign-in/social auth.
- Backend auth service stores onboarding context during auth create/sign-in.
- Reminder setup is split: local notifications during onboarding, backend reminder record after auth.
- Paywall is post-auth, not post-onboarding-first-reflection.
- Native rating prompt is currently inside onboarding.

Local storage keys at risk:

- `journalio.onboardingCompleted`
- `journalio.onboardingData`
- `journalio.installSeen`
- `journalio.postAuthPaywallSeen`
- `journalio.auth.user`
- Keychain token service `journalio.auth.tokens`

Existing old-onboarded users:

- Users with local `journalio.onboardingCompleted = true` but no backend token currently land in auth.
- After auth, backend gets old onboarding context only if local `journalio.onboardingData` still exists.
- Logout clears stored onboarding data but not necessarily the completion flag, making old users likely return to auth.

Signed-in users missing new onboarding fields:

- Today, token/profile restoration sends them directly to `main-app` if profile fetch succeeds.
- New auth-first flow must avoid pushing existing signed-in users into new onboarding unless migration rules explicitly say so.

Users with journal entries but missing `onboardingCompleted`:

- Backend profile does not include `journalCount`.
- Migration guard cannot rely only on profile payload unless backend adds journal count/existence or a migration endpoint.
- Safer backend migration can infer by journal existence using `journalModel.exists({ userId })`.

Premium users:

- Premium status is present on profile.
- Premium users should be treated as migrated/onboarded to avoid blocking paid access.

App stage stale states:

- Since stage is not directly persisted, stale string risk is mostly from cached auth user/onboarding flags, not a saved `stage`.
- If a user updates while locally in `auth` or `onboarding`, current bootstrap will still route by tokens and local onboarding flags.

Safest migration strategy:

- Add backend optional onboarding version fields first.
- Add a migration guard that treats existing users as onboarded if any old safe signal exists: old local onboarding flag, app previously reached main/home, journal count > 0, journal existence, user created before release date, premium entitlement, or existing reminder record.
- Keep old `onboardingContext` readable.
- Do not require new onboarding for signed-in users on first launch after update.
- For users who truly have no data and no old flag, route to new onboarding after auth.
- Add local one-time migration that maps old `journalio.onboardingCompleted` to new versioned state without deleting old keys immediately.

## 14. Mind Map Feasibility Analysis

Data that can become nodes now:

- Moods from `mood_checkins.mood`.
- Journal mood tags like `mood:good`.
- Tags from `journals.tags`.
- AI/deterministic quick analysis themes from `quick_analysis`, if persisted in a new field or collection.
- Onboarding support focus areas from `users.onboardingContext.supportFocusAreas`.
- Journaling goals from `users.journalingGoals` and `users.onboardingContext.goals`.
- Weekly insights aggregate topics from `insights.tagCounts` and `insights.moodCounts`.

Data that should not become nodes without stronger safety rules:

- Raw people/relationship names extracted from journal text.
- Sensitive inferred traits or clinical labels.
- Any safety classifier internals.

Data that can become edges:

- Same tag across entries.
- Same mood across entries.
- Tag co-occurrence in a single entry.
- Mood-to-tag co-occurrence.
- Time recurrence across date buckets.
- Goal-to-entry relation if a journal is linked to onboarding/personal goals.
- Support-focus-to-theme relation.

Server-side storage recommendation:

- Store canonical mind map nodes and edges server-side per user.
- Store provenance references to entry IDs but not raw journal excerpts.
- Store generation version and last rebuilt timestamp.
- Store low-risk metadata only.

Client-side computation recommendation:

- Client can compute layout positions, filtering, zoom state, selected node state, and lightweight display grouping.
- Do not rely on client-only computation for canonical node strength or privacy-sensitive extraction.

Onboarding-generated preview:

- Generate a temporary preview from first guided reflection plus setup answers.
- Store only after auth/onboarding completion, linked to `firstReflectionId`.
- If user does not consent to AI analysis, use deterministic goals/mood/tag preview only.

Later additions:

- Rebuild stronger connections after multiple entries.
- Add weekly and monthly map snapshots.
- Add user-editable hidden/merged nodes.

Proposed Mind Map v1 schema:

- Collection: `mind_map_snapshots` or `mind_maps`.
- `userId`
- `version`
- `nodes`: `{ id, label, type, strength, entryIds, firstSeenAt, lastSeenAt, metadata }`
- `edges`: `{ id, sourceNodeId, targetNodeId, type, strength, entryIds, firstSeenAt, lastSeenAt, metadata }`
- `generatedFrom`: `{ journalEntryIds, moodCheckInIds, onboardingVersion }`
- `createdAt`, `updatedAt`, `rebuiltAt`

Needed endpoints:

- `GET /mind-map`
- `POST /mind-map/rebuild` or internal rebuild service
- Optional `PATCH /mind-map/nodes/:nodeId` for hide/rename later

## 15. Proposed New Route And Service List

Current route style uses `/api/v1` prefix from `backend/src/routes/index.ts:42`, then resource routers. Journal routes currently use snake-style action names such as `/create_journal`; newer recommendations can be cleaner but should be consistent within each router.

Frontend service recommendations:

- Add reflection APIs to `frontend/src/services/journalService.ts` or new `frontend/src/services/reflectionService.ts`.
- Add onboarding completion APIs to `frontend/src/services/onboardingService.ts`.
- Add mind map APIs to new `frontend/src/services/mindMapService.ts`.

Suggested frontend functions:

- `generateReflectionFollowUp(payload)`
- `inferMoodFromEntry(payload)`
- `generateEntryMirror(payload)`
- `generateEntryTitle(payload)`
- `generateOnboardingMindMapPreview(payload)`
- `generatePersonalGoals(payload)`
- `completeOnboarding(payload)`
- `createJournalEntry(payload)` should extend existing `createJournalEntry()` rather than duplicate it.

Backend placement:

- Journal reflection endpoints should live under `backend/src/services/journal` or a new `backend/src/services/reflection` if the flow becomes large.
- Onboarding endpoints should live under `backend/src/services/onboarding`.
- Mind map endpoints should live under new `backend/src/services/mind-map` or `backend/src/services/mindMap` depending repo naming preference.

Suggested backend endpoints, adapted to existing `/api/v1`:

- `POST /api/v1/journal/reflection/follow-up`
- `POST /api/v1/journal/reflection/infer-mood`
- `POST /api/v1/journal/reflection/mirror`
- `POST /api/v1/journal/reflection/title`
- `POST /api/v1/onboarding/complete`
- `POST /api/v1/onboarding/mind-map-preview`
- `POST /api/v1/onboarding/personal-goals`
- `GET /api/v1/mind-map`
- `POST /api/v1/mind-map/rebuild`

Validation pattern:

- Add Zod validators matching `backend/src/services/journal/journal.validators.ts`.
- Use `validateRequest()` middleware from `backend/src/middleware/validateRequest.middleware.ts`.
- Use `verifyJwtToken` for all personalized endpoints except any intentionally anonymous demo endpoint.

## 16. Implementation Constraints

TypeScript:

- Backend strict mode is enabled at `backend/tsconfig.json:37`.
- Backend also uses `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` at `backend/tsconfig.json:25`.
- Frontend extends React Native TypeScript config at `frontend/tsconfig.json:2`.

API client:

- Frontend request helper is in `frontend/src/services/api.ts`.
- Service files own API calls; screens should not call fetch directly.

Error handling:

- Backend response helper `apiResponse()` is at `backend/src/helpers/commonHelper.helpers.ts:1`.
- Validation middleware returns standard error payloads at `backend/src/middleware/validateRequest.middleware.ts`.
- Existing error format mostly uses `{ success, message, data }`, while AGENTS says error key should be `error`; be careful not to drift further.

Theme:

- Theme colors/types are in `frontend/src/theme/theme.ts`.
- Light/dark palettes are static and calm, with primary coral `#E87461`.

Animation:

- Existing screens use React Native `Animated`.
- No separate haptics dependency found.

Navigation:

- React Navigation v7 native-stack.
- Navigation root is `frontend/src/navigation/AppNavigator.tsx`.

Store pattern:

- Zustand store is `frontend/src/store/appStore.ts`.
- Journal recent-entry slice is `frontend/src/store/slices/journalSlice.ts`.

Backend validation/auth:

- Zod validators per service.
- Auth middleware `verifyJwtToken` at `backend/src/middleware/verifyJwtToken.middleware.ts`.

Subscription/premium gating:

- Backend gate uses `user.isPremium` and `user.aiOptIn` via `backend/src/helpers/openai.helpers.ts`.
- Frontend local gate uses `session.user.isPremium` before showing paywall or locked cards.

Mongo/Mongoose:

- Schemas live in `backend/src/schema`.
- Service files own database orchestration.
- Indexes are explicit and conservative.

Test setup:

- Backend has service/validator tests including insights and paywall.
- Frontend package includes Jest config/dependencies, but no TanStack Query setup observed.

## 17. Recommended Phased Implementation Plan

Phase 1: backend onboarding fields and auth-first migration guard

- Likely files: `backend/src/schema/user.schema.ts`, `backend/src/services/user/user.service.ts`, `backend/src/services/auth/auth.service.ts`, `backend/src/services/auth/auth.validators.ts`, `backend/src/schema/journal.schema.ts` only if adding migration journal existence helper, `frontend/src/store/appStore.ts`, `frontend/src/utils/appStorage.ts`.
- Backend: add optional versioned onboarding fields; expose profile-safe migration signals or computed `journalCount`.
- Frontend: add local migration helper; change bootstrap to auth-first without trapping existing users.
- Migration risk: high.
- Test checklist: existing signed-in user, signed-out old onboarded user, premium user, user with journals/no onboarding flag, first install, logout.

Phase 2: replace onboarding with personalized setup

- Likely files: `frontend/src/screens/onboarding/OnboardingScreen.tsx`, `frontend/src/types/onboarding.ts`, `frontend/src/services/onboardingService.ts`, `backend/src/services/onboarding/*`, docs/API spec.
- Backend: add `POST /onboarding/complete`.
- Frontend: new auth-first onboarding state and screens; keep old local payload readable.
- Migration risk: medium-high.
- Test checklist: required/optional fields, reminder, privacy consent, AI opt-out, back navigation, cold launch resume.

Phase 3: first guided reflection inside onboarding

- Likely files: new/refactored onboarding reflection components, `frontend/src/services/journalService.ts`, `backend/src/services/journal/*`, `backend/src/schema/journal.schema.ts`.
- Backend: add reflection follow-up/title/mood endpoints and journal create extensions.
- Frontend: guided reflection state machine and save-first-entry behavior.
- Migration risk: medium.
- Test checklist: empty/short input, AI unavailable fallback, AI opt-out, premium decision, firstReflectionId link.

Phase 4: Reflect/Mirror entry screen

- Likely files: `frontend/src/screens/NewEntryScreen.tsx`, possible new `frontend/src/screens/journal/ReflectScreen.tsx`, `frontend/src/screens/journal/EntryDetailScreen.tsx`, `frontend/src/services/journalService.ts`, `backend/src/services/journal/*`.
- Backend: persist analysis/mirror or separate entry analysis records.
- Frontend: tab UI, guided AI reflection, Open Write, mood tracking, text-only entry generation.
- Migration risk: medium.
- Test checklist: Reflect tab, Mirror tab, manual write, save, edit, delete, AI fail, premium/AI opt-in gates.

Phase 5: Mind Map preview in onboarding

- Likely files: onboarding screen/components, `frontend/src/services/mindMapService.ts`, `backend/src/services/onboarding/*`, new schemas.
- Backend: generate/store preview from setup plus first reflection.
- Frontend: preview UI and fallback empty state.
- Migration risk: medium.
- Test checklist: no entry, AI opt-out, low-signal reflection, privacy copy, preview regeneration.

Phase 6: real Mind Map v1

- Likely files: new `frontend/src/screens/MindMapScreen.tsx`, navigation files, new backend `mind-map` service, new schema file.
- Backend: canonical node/edge schema, GET, rebuild, journal-create sync hook.
- Frontend: visual map layout, node details, empty state, loading/error.
- Migration risk: medium-high due to data correctness/privacy.
- Test checklist: user ownership, empty map, map from old entries, rebuild idempotency, no raw journal leakage.

Phase 7: rating prompt trigger and analytics

- Likely files: `frontend/src/services/appRatingService.ts`, `frontend/src/store/appStore.ts`, `frontend/src/utils/appStorage.ts`, `frontend/src/screens/onboarding/OnboardingScreen.tsx`.
- Backend: optional analytics endpoint if desired; otherwise local-only.
- Frontend: remove onboarding trigger; add one-time post-home trigger.
- Migration risk: low-medium.
- Test checklist: prompt only once, not during auth/paywall, new users only, native module fallback.

## 18. Final Checklist

Files likely needing changes:

- `frontend/src/store/appStore.ts`
- `frontend/src/navigation/appFlow.ts`
- `frontend/src/navigation/AppNavigator.tsx`
- `frontend/src/screens/onboarding/OnboardingScreen.tsx`
- `frontend/src/types/onboarding.ts`
- `frontend/src/services/onboardingService.ts`
- `frontend/src/screens/NewEntryScreen.tsx`
- `frontend/src/services/journalService.ts`
- `backend/src/schema/user.schema.ts`
- `backend/src/schema/journal.schema.ts`
- `backend/src/services/auth/auth.service.ts`
- `backend/src/services/auth/auth.validators.ts`
- `backend/src/services/user/user.service.ts`
- `backend/src/services/onboarding/*`
- `backend/src/services/journal/*`
- New `backend/src/services/mind-map/*` or equivalent.
- New `backend/src/schema/mind_map.schema.ts` or equivalent.
- New `frontend/src/services/mindMapService.ts`.
- New Mind Map screen/components.
- `docs/AI_API_SPEC.md`, `docs/AI_UI_UX_CONTEXT.md`, `docs/AI_ARCHITECTURE.md`, `docs/SCREEN_IMPLEMENTATION_STATUS.md` when implementation begins.

Files that should not be touched casually:

- `.env` files and any local secret-bearing config.
- Existing native signing/key files.
- RevenueCat API key values.
- Mongo connection strings.
- Existing user/journal data.
- Unrelated generated iOS/Android assets.
- Payment product identifiers unless RevenueCat/App Store products are intentionally being changed.

Open questions:

- Should first guided reflection be saved as a normal journal entry immediately, or as draft/reflection transcript until final confirmation?
- Should AI reflection during onboarding be free for all users, or deterministic/free with premium-enhanced Mirror after paywall?
- Should Mind Map v1 be available before purchase or be premium-gated?
- What is the release date cutoff for treating old users as migrated?
- Should `journalCount` be exposed on `/users/profile` for migration and personalization?
- Should personal goals be user-level mutable settings or generated onboarding artifacts?

Missing data:

- Live MongoDB document counts and sanitized sample shapes were not collected because no safe database connection was active.
- Figma redesign source was not fetched during this audit because this request was architectural/code audit only and explicitly said not to implement yet.
- No production RevenueCat/dashboard configuration was inspected.

Primary risks:

- Auth-first redesign breaks current assumption that onboarding data exists before auth.
- Reminder flow currently schedules local reminders before a backend user exists.
- Paywall is currently post-auth; new flow wants paywall after onboarding/reflection/goals/reminder.
- Rating prompt currently happens during onboarding and should move.
- Journal mood is currently tag-based, not schema-based.
- AI analysis is split across deterministic heuristics, premium OpenAI, and cached weekly insights.
- User profile lacks `createdAt` and `journalCount`, limiting safe migration decisions on frontend.
- Mind Map requires new persistence to avoid recomputing sensitive inferences client-side.
- Existing `routes.tsx` may be stale but still present, raising navigation drift risk.
- OpenAI debug logging should be reviewed to ensure no journal-derived raw output is printed outside safe local debug flows.

Recommended implementation order:

- Add versioned onboarding fields and migration guards first.
- Make auth-first routing safe without changing onboarding UI.
- Add backend `completeOnboarding` and profile migration signals.
- Replace onboarding UI.
- Add first guided reflection and journal schema extensions.
- Add Reflect/Mirror entry experience.
- Add Mind Map preview, then full Mind Map v1.
- Move rating prompt to one-time post-home trigger.
