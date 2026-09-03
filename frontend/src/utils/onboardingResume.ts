import type { OnboardingV2Draft } from "../types/onboarding";

/**
 * Where to drop a user back into onboarding after they close the app mid-flow.
 *
 * The v2 journey saves a real journal entry at its first guided reflection —
 * roughly step two of fifteen — and schedules a reminder a few steps later.
 * Both used to read as "this account has finished onboarding", so closing the
 * app anywhere after the reflection landed the user on Home with no name, no
 * reminders, no widget setup, no commitment, and the paywall skipped. Those
 * inferences are gone (see `isOnboardingCompleteForCurrentVersion` and the
 * server's `shouldTreatAsExistingUser`), which means a relaunch correctly
 * returns to onboarding — and this is what stops that from meaning "start over".
 *
 * Route names mirror `RootStackParamList` in `../navigation/navigation`. They
 * are plain strings here so the storage layer can read this without pulling the
 * navigator in behind it.
 */

export type OnboardingResumeRouteName =
  | "FirstGuidedReflection"
  | "OnboardingReminders"
  | "OnboardingWidgetSetup"
  | "OnboardingCommitment"
  | "OnboardingTrialIntro"
  | "OnboardingTrialTimeline";

export type OnboardingResumePoint = {
  routeName: OnboardingResumeRouteName;
  /**
   * Whose journey this is. The draft holds personal answers, so a resume point
   * is only ever honoured for the account that wrote it — never inherited by
   * whoever signs in next on the same device.
   */
  userId: string;
  displayName?: string;
  draft: OnboardingV2Draft;
};

/**
 * Current route -> the checkpoint we can actually re-enter it from.
 *
 * Everything between the reflection and the streak summary is driven by AI
 * payloads that were built in memory and cannot be rebuilt from disk, so those
 * steps check-point back to the reflection itself. The closing steps only ever
 * need `{ displayName, draft }`, so each of those resumes exactly where it was.
 *
 * The questionnaire (`Onboarding`) is deliberately absent: nothing is written
 * anywhere until the first reflection, so restarting it loses nothing, and
 * resuming into a half-answered form is worse than a clean run.
 */
const RESUME_CHECKPOINTS: Record<string, OnboardingResumeRouteName> = {
  FirstGuidedReflection: "FirstGuidedReflection",
  FirstReflectionAnalysis: "FirstGuidedReflection",
  FirstReflectionGoals: "FirstGuidedReflection",
  FirstReflectionMindMapLoading: "FirstGuidedReflection",
  FirstReflectionMindMap: "FirstGuidedReflection",
  FirstReflectionMindMapShare: "FirstGuidedReflection",
  FirstReflectionRating: "FirstGuidedReflection",
  FirstReflectionStreak: "FirstGuidedReflection",
  OnboardingReminders: "OnboardingReminders",
  OnboardingWidgetSetup: "OnboardingWidgetSetup",
  OnboardingWidgetActivated: "OnboardingWidgetSetup",
  OnboardingCommitment: "OnboardingCommitment",
  OnboardingTrialIntro: "OnboardingTrialIntro",
  OnboardingTrialTimeline: "OnboardingTrialTimeline",
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string");

const isOnboardingV2Draft = (value: unknown): value is OnboardingV2Draft => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  // Only the fields `createInitialOnboardingV2Draft` always seeds are required.
  // Everything else is genuinely optional part-way through the questionnaire,
  // and a stricter check here would silently discard a resumable draft.
  return (
    candidate.version === 2 &&
    isStringArray(candidate.whatBringsYouHere) &&
    isStringArray(candidate.supportFocusAreas) &&
    isStringArray(candidate.reflectionTone) &&
    typeof candidate.privacyConsent === "boolean"
  );
};

const isOnboardingResumePoint = (
  value: unknown
): value is OnboardingResumePoint => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.routeName === "string" &&
    RESUME_CHECKPOINTS[candidate.routeName] === candidate.routeName &&
    typeof candidate.userId === "string" &&
    Boolean(candidate.userId) &&
    (candidate.displayName === undefined ||
      typeof candidate.displayName === "string") &&
    isOnboardingV2Draft(candidate.draft)
  );
};

/**
 * Reduce a live route + params to something we can store and later re-enter.
 * Returns `null` for any route outside the journey, or one we have no draft for
 * — there is nothing worth resuming to in either case.
 */
const resolveOnboardingResumePoint = (
  routeName: string | null | undefined,
  params: unknown,
  userId: string | null | undefined
): OnboardingResumePoint | null => {
  const checkpoint = routeName ? RESUME_CHECKPOINTS[routeName] : undefined;

  if (!checkpoint || !userId || !params || typeof params !== "object") {
    return null;
  }

  const { displayName, draft } = params as {
    displayName?: unknown;
    draft?: unknown;
  };

  if (!isOnboardingV2Draft(draft)) {
    return null;
  }

  return {
    routeName: checkpoint,
    userId,
    ...(typeof displayName === "string" ? { displayName } : {}),
    draft,
  };
};

export {
  RESUME_CHECKPOINTS,
  isOnboardingResumePoint,
  isOnboardingV2Draft,
  resolveOnboardingResumePoint,
};
