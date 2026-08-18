import {
  CURRENT_ONBOARDING_VERSION,
  getOnboardingV2ReleaseCutoffDate,
} from "../../config/onboarding.config";
import { hasActivePremiumEntitlement } from "../../helpers/premiumEntitlement.helpers";
import { invalidateUserPersonalizationCache } from "../../helpers/userPersonalization.helpers";
import { journalModel } from "../../schema/journal.schema";
import { reminderModel } from "../../schema/reminder.schema";
import { IUser, userModel } from "../../schema/user.schema";

type UserProfilePayload = {
  userId: string;
  name: string;
  phoneNumber: string | null;
  email: string | null;
  createdAt: string | null;
  isPremium: boolean;
  premiumPlanKey: "weekly" | "monthly" | "yearly" | "lifetime" | null;
  premiumActivatedAt: string | null;
  premiumProductId: string | null;
  premiumExpiresAt: string | null;
  premiumWillRenew: boolean | null;
  premiumVerifiedAt: string | null;
  premiumRevenueCatRequestDate: string | null;
  revenueCatAppUserId: string | null;
  premiumSource: "revenuecat_client_sync" | "revenuecat_verified" | null;
  avatarColor: string | null;
  journalingGoals: string[];
  profileSetupCompleted: boolean;
  onboardingCompleted: boolean;
  onboardingVersion: number | null;
  onboardingCompletedAt: string | null;
  hasJournalEntries: boolean;
  journalCount?: number;
  profilePic: string | null;
  onboardingPreferences: {
    ageRange: string | null;
    journalingExperience: string | null;
    whatBringsYouHere: string[];
    supportFocusAreas: string[];
    reflectionTone: string[];
    reminderPreference: string | null;
  };
};

type UpdateProfileInput = {
  name: string;
  avatarColor?: string | null;
  goals?: string[];
};

type UpdatePremiumStatusInput = {
  isPremium: boolean;
};

type UserJournalProfileMetadata = {
  hasJournalEntries: boolean;
  journalCount?: number;
};

type ExistingUserOnboardingSignals = {
  hasJournalEntries: boolean;
  hasLegacyOnboardingContext: boolean;
  hasCurrentOnboardingVersion: boolean;
  hasReminderRecord: boolean;
  isCreatedBeforeReleaseCutoff: boolean;
  isLegacyOnboardingComplete: boolean;
  isPremium: boolean;
};

const toIsoString = (value?: Date | string | null) => {
  if (!value) {
    return null;
  }

  const parsedDate = value instanceof Date ? value : new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
};

const normalizeSelections = (values?: string[] | null) =>
  Array.from(
    new Set((values || []).map((value) => value.trim()).filter(Boolean))
  );

const getOnboardingPreferences = (user: IUser) => {
  const payload = user.onboardingPayload;
  const context = user.onboardingContext;

  return {
    ageRange: payload?.ageRange || context?.ageRange || null,
    journalingExperience: context?.journalingExperience || null,
    whatBringsYouHere: normalizeSelections(payload?.whatBringsYouHere),
    supportFocusAreas: normalizeSelections(
      payload?.supportFocusAreas || context?.supportFocus
    ),
    reflectionTone: normalizeSelections(payload?.reflectionTone),
    reminderPreference:
      payload?.reminderPreference || context?.reminderPreference || null,
  };
};

const hasLegacyOnboardingContext = (user: IUser) => {
  const context = user.onboardingContext;

  return Boolean(
    context &&
      (context.ageRange ||
        context.journalingExperience ||
        context.reminderPreference ||
        typeof context.privacyConsentAccepted === "boolean" ||
        context.goals?.length ||
        context.supportFocus?.length)
  );
};

const isPremiumUser = (user: IUser) =>
  Boolean(
    user.isPremium ||
      user.premiumPlanKey ||
      user.premiumActivatedAt ||
      user.lifetimePurchaseRecordedAt
  );

const isCreatedBeforeReleaseCutoff = (user: IUser) => {
  const releaseCutoff = getOnboardingV2ReleaseCutoffDate();
  const createdAt = toIsoString(user.createdAt);

  if (!releaseCutoff || !createdAt) {
    return false;
  }

  return new Date(createdAt).getTime() < releaseCutoff.getTime();
};

const getUserJournalProfileMetadata = async (
  userId: string
): Promise<UserJournalProfileMetadata> => {
  const existingJournal = await journalModel.exists({ userId });

  if (!existingJournal) {
    return {
      hasJournalEntries: false,
      journalCount: 0,
    };
  }

  return {
    hasJournalEntries: true,
    journalCount: await journalModel.countDocuments({ userId }),
  };
};

const getExistingUserOnboardingSignals = async (
  user: IUser,
  journalMetadata: UserJournalProfileMetadata
): Promise<ExistingUserOnboardingSignals> => {
  const hasCurrentOnboardingVersion =
    typeof user.onboardingVersion === "number" &&
    user.onboardingVersion >= CURRENT_ONBOARDING_VERSION;
  const reminderRecord = await reminderModel.exists({ userId: user._id });

  return {
    hasJournalEntries: journalMetadata.hasJournalEntries,
    hasLegacyOnboardingContext: hasLegacyOnboardingContext(user),
    hasCurrentOnboardingVersion,
    hasReminderRecord: Boolean(reminderRecord),
    isCreatedBeforeReleaseCutoff: isCreatedBeforeReleaseCutoff(user),
    isLegacyOnboardingComplete: Boolean(user.onboardingCompleted),
    isPremium: isPremiumUser(user),
  };
};

const shouldTreatAsExistingUser = (signals: ExistingUserOnboardingSignals) =>
  signals.hasCurrentOnboardingVersion ||
  signals.isLegacyOnboardingComplete ||
  signals.hasJournalEntries ||
  signals.isPremium ||
  signals.hasLegacyOnboardingContext ||
  signals.isCreatedBeforeReleaseCutoff ||
  signals.hasReminderRecord;

const getLegacyCompletionDate = (user: IUser) =>
  user.onboardingCompletedAt || user.updatedAt || user.createdAt || new Date();

const mergeLegacyMigrationPayload = (user: IUser) => {
  const existingPayload = user.onboardingPayload || {};

  return {
    ...existingPayload,
    version:
      existingPayload.version &&
      existingPayload.version >= CURRENT_ONBOARDING_VERSION
        ? existingPayload.version
        : CURRENT_ONBOARDING_VERSION,
    migratedFromLegacy: true,
  };
};

const lazilyMigrateExistingUserOnboarding = async (
  user: IUser,
  journalMetadata: UserJournalProfileMetadata
) => {
  const signals = await getExistingUserOnboardingSignals(user, journalMetadata);

  if (!shouldTreatAsExistingUser(signals)) {
    return;
  }

  const shouldMarkMigratedFromLegacy = !signals.hasCurrentOnboardingVersion;
  let changed = false;

  // Existing users may predate onboarding v2. We mark them complete lazily so
  // updating the app cannot block journals, premium access, reminders, or login.
  if (!user.onboardingCompleted) {
    user.onboardingCompleted = true;
    changed = true;
  }

  if (!signals.hasCurrentOnboardingVersion) {
    user.onboardingVersion = CURRENT_ONBOARDING_VERSION;
    changed = true;
  }

  if (!user.onboardingCompletedAt) {
    user.onboardingCompletedAt = getLegacyCompletionDate(user);
    changed = true;
  }

  if (
    shouldMarkMigratedFromLegacy &&
    user.onboardingPayload?.migratedFromLegacy !== true
  ) {
    user.onboardingPayload = mergeLegacyMigrationPayload(user);
    changed = true;
  }

  if (!changed) {
    return;
  }

  // This backfill runs on every authenticated profile build, so it sits on both
  // sign-in paths. It is opportunistic by design — the comment above says an app
  // update must not block login — but an unguarded save made it the opposite: a
  // duplicate-key error here escaped as a bare 500 and took sign-in down with it.
  // Swallow only the conflict, and only after recording it; anything else is a
  // real fault and must still surface.
  try {
    await user.save();
  } catch (error) {
    if ((error as { code?: number } | null)?.code === 11000) {
      console.error(
        "[User] onboarding backfill hit a duplicate identity row; leaving the account unmigrated",
        {
          userId: String(user._id),
          keyPattern: (error as { keyPattern?: unknown }).keyPattern,
        }
      );
      return;
    }

    throw error;
  }
};

const buildUserProfilePayload = (
  user: IUser,
  journalMetadata: UserJournalProfileMetadata = {
    hasJournalEntries: false,
  }
): UserProfilePayload => {
  return {
    userId: user._id.toString(),
    name: user.name,
    phoneNumber: user.phoneNumber || null,
    email: user.email || null,
    createdAt: toIsoString(user.createdAt),
    isPremium: hasActivePremiumEntitlement(user),
    premiumPlanKey: user.premiumPlanKey || null,
    premiumActivatedAt: user.premiumActivatedAt?.toISOString() || null,
    premiumProductId: user.premiumProductId || null,
    premiumExpiresAt: user.premiumExpiresAt?.toISOString() || null,
    premiumWillRenew:
      typeof user.premiumWillRenew === "boolean" ? user.premiumWillRenew : null,
    premiumVerifiedAt: user.premiumVerifiedAt?.toISOString() || null,
    premiumRevenueCatRequestDate:
      user.premiumRevenueCatRequestDate?.toISOString() || null,
    revenueCatAppUserId: user.revenueCatAppUserId || null,
    premiumSource: user.premiumSource || null,
    avatarColor: user.avatarColor || null,
    journalingGoals: user.journalingGoals || [],
    profileSetupCompleted: Boolean(user.profileSetupCompleted),
    onboardingCompleted: Boolean(user.onboardingCompleted),
    onboardingVersion:
      typeof user.onboardingVersion === "number"
        ? user.onboardingVersion
        : null,
    onboardingCompletedAt: toIsoString(user.onboardingCompletedAt),
    hasJournalEntries: journalMetadata.hasJournalEntries,
    ...(typeof journalMetadata.journalCount === "number"
      ? { journalCount: journalMetadata.journalCount }
      : {}),
    profilePic: user.profilePic || null,
    onboardingPreferences: getOnboardingPreferences(user),
  };
};

const buildAuthenticatedUserProfilePayload = async (
  user: IUser
): Promise<UserProfilePayload> => {
  const journalMetadata = await getUserJournalProfileMetadata(
    user._id.toString()
  );
  await lazilyMigrateExistingUserOnboarding(user, journalMetadata);

  return buildUserProfilePayload(user, journalMetadata);
};

const getProfile = async (
  userId: string
): Promise<UserProfilePayload | null> => {
  const user = await userModel.findById(userId);

  if (!user) {
    return null;
  }

  return buildAuthenticatedUserProfilePayload(user);
};

const updateProfile = async (
  userId: string,
  input: UpdateProfileInput
): Promise<UserProfilePayload | null> => {
  const user = await userModel.findById(userId);

  if (!user) {
    return null;
  }

  user.name = input.name.trim();
  user.avatarColor = input.avatarColor?.trim() || null;
  if (input.goals) {
    user.journalingGoals = Array.from(
      new Set(input.goals.map((goal) => goal.trim()).filter(Boolean))
    );
  }
  user.profileSetupCompleted = true;
  user.onboardingCompleted = true;

  await user.save();
  invalidateUserPersonalizationCache(userId);

  return buildAuthenticatedUserProfilePayload(user);
};

const updatePremiumStatus = async (
  userId: string,
  input: UpdatePremiumStatusInput
): Promise<UserProfilePayload | null> => {
  const user = await userModel.findById(userId);

  if (!user) {
    return null;
  }

  user.isPremium = input.isPremium;
  user.premiumPlanKey = input.isPremium ? user.premiumPlanKey || null : null;
  user.premiumActivatedAt = input.isPremium
    ? user.premiumActivatedAt || new Date()
    : null;
  user.premiumProductId = input.isPremium
    ? user.premiumProductId || null
    : null;
  user.premiumExpiresAt = input.isPremium
    ? user.premiumExpiresAt || null
    : null;
  user.premiumWillRenew =
    input.isPremium && typeof user.premiumWillRenew === "boolean"
      ? user.premiumWillRenew
      : null;
  user.premiumVerifiedAt = input.isPremium
    ? user.premiumVerifiedAt || null
    : null;
  user.premiumRevenueCatRequestDate = input.isPremium
    ? user.premiumRevenueCatRequestDate || null
    : null;
  user.revenueCatAppUserId = input.isPremium
    ? user.revenueCatAppUserId || null
    : null;
  user.premiumSource = input.isPremium ? user.premiumSource || null : null;
  await user.save();

  return buildAuthenticatedUserProfilePayload(user);
};

export {
  buildAuthenticatedUserProfilePayload,
  buildUserProfilePayload,
  getProfile,
  getUserJournalProfileMetadata,
  normalizeSelections,
  updatePremiumStatus,
  updateProfile,
};
export type {
  UpdatePremiumStatusInput,
  UpdateProfileInput,
  UserProfilePayload,
};
