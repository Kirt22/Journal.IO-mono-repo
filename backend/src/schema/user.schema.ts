import mongoose, { Document, Model } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";
import {
  applyEncryptedSchemaPaths,
} from "../helpers/fieldEncryption.schema.helpers";
import { computeLookupHash } from "../helpers/fieldEncryption.helpers";

/**
 * The status a goal can have in the API and the app.
 *
 * Completion is no longer a status: goals recur, so "done" is derived per period
 * from `lastCompletedLocalDate` + `frequency` (see `helpers/goalPeriod.helpers`).
 */
export type GoalStatus = "active" | "archived";

/**
 * The wider set the *database* still accepts.
 *
 * `completed` and `dismissed` are legacy values that must remain valid enum
 * members. Mongoose validates the entire `goals` array on every `user.save()`,
 * and auth/user/onboarding all save the user for unrelated reasons (`lastLoginAt`,
 * profile edits) — so narrowing the stored enum would make *login* throw a
 * ValidationError for anyone still holding one legacy goal. The `pre("validate")`
 * hook below drains these values instead.
 */
export type GoalStatusStored = GoalStatus | "completed" | "dismissed";

export const STORED_GOAL_STATUSES: GoalStatusStored[] = [
  "active",
  "archived",
  "completed",
  "dismissed",
];

export type GoalFrequency = "daily" | "weekly" | "as_needed";

export type GoalIconSource = "automatic" | "fixed";

export const GOAL_ICON_SOURCE_VALUES: GoalIconSource[] = [
  "automatic",
  "fixed",
];

export const GOAL_FREQUENCY_VALUES: GoalFrequency[] = [
  "daily",
  "weekly",
  "as_needed",
];

export interface IStructuredGoal {
  id: string;
  title: string;
  description?: string | null;
  /** Curated key from `helpers/goalIcons.helpers`, not an emoji. */
  icon: string;
  /** Missing only on legacy records that have not been normalized yet. */
  iconSource?: GoalIconSource;
  frequency: GoalFrequency;
  status: GoalStatusStored;
  reminderEnabled: boolean;
  /** "HH:mm", 24-hour. */
  reminderTime?: string | null;
  /**
   * The *client's* local date ("YYYY-MM-DD") of the last completion. Stored as a
   * date key rather than a timestamp because the server has no reliable user
   * timezone, and getting that wrong would reset goals at the wrong hour.
   */
  lastCompletedLocalDate?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOnboardingContext {
  ageRange?: string | null;
  journalingExperience?: string | null;
  goals: string[];
  supportFocus: string[];
  reminderPreference?: string | null;
  privacyConsentAccepted?: boolean | null;
}

export interface IOnboardingPayload {
  version?: number;
  whatBringsYouHere?: string[];
  supportFocusAreas?: string[];
  primaryContext?: string;
  ageRange?: string;
  reflectionTone?: string[];
  preferredTheme?: string;
  reminderPreference?: string;
  privacyConsent?: boolean;
  firstReflectionId?: string;
  firstReflectionSummary?: {
    title?: string;
    theme?: string;
    tags?: string[];
    mindMapNode?: string;
  };
  personalGoals?: string[];
  /** Attribution only — deliberately excluded from the AI personalization profile. */
  referralSource?: string;
  referralSourceOther?: string;
  /** When the user signed the onboarding commitment, if they reached that step. */
  commitmentSignedAt?: Date;
  migratedFromLegacy?: boolean;
}

export interface IUser extends Document {
  toObject(): Record<string, unknown>;
  _id: mongoose.Types.ObjectId;
  name: string;
  phoneNumber?: string | null;
  email?: string | null;
  emailLookupHash?: string | null;
  phoneNumberLookupHash?: string | null;
  passwordHash?: string | null;
  emailVerified: boolean;
  emailVerificationAttempts: number;
  googleUserId?: string | null;
  googleUserIdLookupHash?: string | null;
  appleUserId?: string | null;
  appleUserIdLookupHash?: string | null;
  authProviders: string[];
  journalingGoals: string[];
  goals: IStructuredGoal[];
  onboardingContext?: IOnboardingContext | null;
  onboardingVersion?: number | null;
  onboardingCompletedAt?: Date | null;
  onboardingPayload?: IOnboardingPayload | null;
  /**
   * AI calls this account has spent on the one-time onboarding allowance, which
   * lets the first guided reflection reach the model before the user has been
   * offered the trial. Counts up to ONBOARDING_AI_CALL_CAP and is never reset,
   * so replaying onboarding cannot farm free model calls.
   */
  onboardingAiCallsUsed: number;
  avatarColor?: string | null;
  profileSetupCompleted: boolean;
  onboardingCompleted: boolean;
  emailPasswordHash?: string | null;
  emailVerifiedAt?: Date | null;
  emailVerificationCodeHash?: string | null;
  emailVerificationExpiresAt?: Date | null;
  profilePic?: string | null;
  refreshTokenHash?: string | null;
  refreshTokenExpiresAt?: Date | null;
  widgetSessionVersion: number;
  passwordResetTokenHash?: string | null;
  passwordResetExpiresAt?: Date | null;
  passwordResetRequestedAt?: Date | null;
  lastLoginAt?: Date | null;
  isPremium: boolean;
  premiumPlanKey?: "weekly" | "monthly" | "yearly" | "lifetime" | null;
  premiumActivatedAt?: Date | null;
  premiumProductId?: string | null;
  premiumExpiresAt?: Date | null;
  premiumWillRenew?: boolean | null;
  premiumVerifiedAt?: Date | null;
  premiumRevenueCatRequestDate?: Date | null;
  revenueCatAppUserId?: string | null;
  premiumSource?: "revenuecat_client_sync" | "revenuecat_verified" | null;
  lifetimePurchaseRecordedAt?: Date | null;
  lastPaywallEventAt?: Date | null;
  lastInterruptivePaywallAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const structuredGoalSchema = new mongoose.Schema<IStructuredGoal>(
  {
    id: { type: String, required: true },
    title: { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: mongoose.Schema.Types.Mixed, default: null },
    // Deliberately NOT enum-validated: the curated key list will grow, and a
    // widened list must never make an existing document fail validation. The
    // service coerces unknown keys to the default on read, and the Zod layer
    // rejects bad input with a recoverable 400.
    icon: { type: String, default: "target", required: true },
    iconSource: {
      type: String,
      enum: GOAL_ICON_SOURCE_VALUES,
      default: undefined,
    },
    frequency: {
      type: String,
      enum: GOAL_FREQUENCY_VALUES,
      default: "as_needed",
      required: true,
    },
    status: {
      type: String,
      enum: STORED_GOAL_STATUSES,
      default: "active",
      required: true,
    },
    reminderEnabled: { type: Boolean, default: false, required: true },
    reminderTime: { type: String, default: null },
    lastCompletedLocalDate: { type: String, default: null },
    createdAt: { type: Date, default: Date.now, required: true },
    updatedAt: { type: Date, default: Date.now, required: true },
  },
  { _id: false }
);

const onboardingContextSchema = new mongoose.Schema<IOnboardingContext>(
  {
    ageRange: { type: mongoose.Schema.Types.Mixed, default: null },
    journalingExperience: { type: mongoose.Schema.Types.Mixed, default: null },
    goals: { type: mongoose.Schema.Types.Mixed, default: [], required: true },
    supportFocus: { type: mongoose.Schema.Types.Mixed, default: [], required: true },
    reminderPreference: { type: mongoose.Schema.Types.Mixed, default: null },
    privacyConsentAccepted: { type: Boolean, default: null },
  },
  { _id: false }
);

const onboardingFirstReflectionSummarySchema = new mongoose.Schema<
  NonNullable<IOnboardingPayload["firstReflectionSummary"]>
>(
  {
    title: { type: mongoose.Schema.Types.Mixed, default: undefined },
    theme: { type: mongoose.Schema.Types.Mixed, default: undefined },
    tags: { type: mongoose.Schema.Types.Mixed, default: undefined },
    mindMapNode: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { _id: false }
);

const onboardingPayloadSchema = new mongoose.Schema<IOnboardingPayload>(
  {
    version: { type: Number },
    whatBringsYouHere: { type: mongoose.Schema.Types.Mixed, default: undefined },
    supportFocusAreas: { type: mongoose.Schema.Types.Mixed, default: undefined },
    primaryContext: { type: mongoose.Schema.Types.Mixed, default: undefined },
    ageRange: { type: mongoose.Schema.Types.Mixed, default: undefined },
    reflectionTone: { type: mongoose.Schema.Types.Mixed, default: undefined },
    preferredTheme: { type: mongoose.Schema.Types.Mixed, default: undefined },
    reminderPreference: { type: mongoose.Schema.Types.Mixed, default: undefined },
    privacyConsent: { type: Boolean },
    firstReflectionId: { type: mongoose.Schema.Types.Mixed, default: undefined },
    firstReflectionSummary: {
      type: onboardingFirstReflectionSummarySchema,
      default: undefined,
    },
    personalGoals: { type: mongoose.Schema.Types.Mixed, default: undefined },
    referralSource: { type: mongoose.Schema.Types.Mixed, default: undefined },
    referralSourceOther: { type: mongoose.Schema.Types.Mixed, default: undefined },
    commitmentSignedAt: { type: Date },
    migratedFromLegacy: { type: Boolean },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: mongoose.Schema.Types.Mixed, required: true },
    phoneNumber: { type: mongoose.Schema.Types.Mixed, default: null },
    phoneNumberLookupHash: { type: String, default: null },
    email: { type: mongoose.Schema.Types.Mixed, default: null },
    emailLookupHash: { type: String, default: null },
    passwordHash: { type: String, default: null },
    emailVerified: { type: Boolean, default: false, required: true },
    emailVerificationAttempts: { type: Number, default: 0, required: true },
    googleUserId: { type: mongoose.Schema.Types.Mixed, default: null },
    googleUserIdLookupHash: { type: String, default: null },
    appleUserId: { type: mongoose.Schema.Types.Mixed, default: null },
    appleUserIdLookupHash: { type: String, default: null },
    authProviders: {
      type: [String],
      enum: ["phone", "google", "email", "apple"],
      default: [],
      required: true,
    },
    journalingGoals: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
      required: true,
    },
    goals: {
      type: [structuredGoalSchema],
      default: [],
      required: true,
    },
    onboardingContext: {
      type: onboardingContextSchema,
      default: null,
    },
    onboardingVersion: { type: Number, default: null },
    onboardingCompletedAt: { type: Date, default: null },
    onboardingPayload: {
      type: onboardingPayloadSchema,
      default: null,
    },
    onboardingAiCallsUsed: { type: Number, default: 0, required: true },
    avatarColor: { type: String, default: null },
    profileSetupCompleted: { type: Boolean, default: false, required: true },
    onboardingCompleted: { type: Boolean, default: false, required: true },
    emailPasswordHash: { type: String, default: null },
    emailVerifiedAt: { type: Date, default: null },
    emailVerificationCodeHash: { type: String, default: null },
    emailVerificationExpiresAt: { type: Date, default: null },
    profilePic: { type: mongoose.Schema.Types.Mixed, default: null },
    refreshTokenHash: { type: String, default: null },
    refreshTokenExpiresAt: { type: Date, default: null },
    widgetSessionVersion: { type: Number, default: 0, min: 0, required: true },
    passwordResetTokenHash: { type: String, default: null },
    passwordResetExpiresAt: { type: Date, default: null },
    passwordResetRequestedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    isPremium: { type: Boolean, default: false, required: true },
    premiumPlanKey: {
      type: String,
      enum: ["weekly", "monthly", "yearly", "lifetime"],
      default: null,
    },
    premiumActivatedAt: { type: Date, default: null },
    premiumProductId: { type: String, default: null, trim: true },
    premiumExpiresAt: { type: Date, default: null },
    premiumWillRenew: { type: Boolean, default: null },
    premiumVerifiedAt: { type: Date, default: null },
    premiumRevenueCatRequestDate: { type: Date, default: null },
    revenueCatAppUserId: { type: String, default: null, trim: true },
    premiumSource: {
      type: String,
      enum: ["revenuecat_client_sync", "revenuecat_verified"],
      default: null,
    },
    lifetimePurchaseRecordedAt: { type: Date, default: null },
    lastPaywallEventAt: { type: Date, default: null },
    lastInterruptivePaywallAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/**
 * Drains legacy goal statuses on the way to the database.
 *
 * Goals became recurring, so `completed` is no longer a status — it is derived
 * per period. This hook runs on every `user.save()` from every domain (auth
 * writing `lastLoginAt`, profile edits, onboarding), so a document written
 * before the change self-heals the first time anything touches that user. That
 * is why there is no standalone migration script: this repo has no migration
 * runner, and lazy migration is the established pattern.
 *
 * `completed -> active` is lossless because `as_needed` only ever checks
 * `lastCompletedLocalDate` for presence, never its value — so deriving the date
 * from `updatedAt` in UTC (the one place server timezone math is unavoidable)
 * can be a day out without changing any behaviour.
 */
userSchema.pre("validate", function normalizeLegacyGoalStatuses() {
  const goals = this.goals;

  if (!Array.isArray(goals) || goals.length === 0) {
    return;
  }

  let didChange = false;

  for (const goal of goals) {
    if (!goal) {
      continue;
    }

    if (goal.status === "completed") {
      goal.status = "active";
      goal.frequency = "as_needed";

      if (!goal.lastCompletedLocalDate) {
        const completedAt = goal.updatedAt ?? goal.createdAt ?? new Date();
        goal.lastCompletedLocalDate = new Date(completedAt)
          .toISOString()
          .slice(0, 10);
      }

      didChange = true;
    } else if (goal.status === "dismissed") {
      goal.status = "archived";
      didChange = true;
    }
  }

  if (didChange) {
    this.markModified("goals");
  }

  const normalizedEmail =
    typeof this.email === "string" && this.email.trim()
      ? this.email.trim().toLowerCase()
      : null;
  const normalizedPhoneNumber =
    typeof this.phoneNumber === "string" && this.phoneNumber.trim()
      ? this.phoneNumber.trim()
      : null;
  const normalizedGoogleUserId =
    typeof this.googleUserId === "string" && this.googleUserId.trim()
      ? this.googleUserId.trim()
      : null;
  const normalizedAppleUserId =
    typeof this.appleUserId === "string" && this.appleUserId.trim()
      ? this.appleUserId.trim()
      : null;

  this.emailLookupHash = computeLookupHash({
    value: normalizedEmail,
    path: "users.email",
  });
  this.phoneNumberLookupHash = computeLookupHash({
    value: normalizedPhoneNumber,
    path: "users.phoneNumber",
  });
  this.googleUserIdLookupHash = computeLookupHash({
    value: normalizedGoogleUserId,
    path: "users.googleUserId",
  });
  this.appleUserIdLookupHash = computeLookupHash({
    value: normalizedAppleUserId,
    path: "users.appleUserId",
  });
});

userSchema.index(
  { phoneNumberLookupHash: 1 },
  {
    unique: true,
    partialFilterExpression: { phoneNumberLookupHash: { $type: "string" } },
  }
);
userSchema.index(
  { emailLookupHash: 1 },
  {
    unique: true,
    partialFilterExpression: { emailLookupHash: { $type: "string" } },
  }
);
userSchema.index(
  { googleUserIdLookupHash: 1 },
  {
    unique: true,
    partialFilterExpression: { googleUserIdLookupHash: { $type: "string" } },
  }
);
userSchema.index(
  { appleUserIdLookupHash: 1 },
  {
    unique: true,
    partialFilterExpression: { appleUserIdLookupHash: { $type: "string" } },
  }
);
userSchema.index({ createdAt: -1 });
userSchema.index(
  { passwordResetTokenHash: 1 },
  {
    partialFilterExpression: { passwordResetTokenHash: { $type: "string" } },
  }
);

applyEncryptedSchemaPaths(structuredGoalSchema, [
  { path: "title" },
  { path: "description" },
]);

applyEncryptedSchemaPaths(onboardingContextSchema, [
  { path: "ageRange" },
  { path: "journalingExperience" },
  { path: "goals" },
  { path: "supportFocus" },
  { path: "reminderPreference" },
]);

applyEncryptedSchemaPaths(onboardingFirstReflectionSummarySchema, [
  { path: "title" },
  { path: "theme" },
  { path: "tags" },
  { path: "mindMapNode" },
]);

applyEncryptedSchemaPaths(onboardingPayloadSchema, [
  { path: "whatBringsYouHere" },
  { path: "supportFocusAreas" },
  { path: "primaryContext" },
  { path: "ageRange" },
  { path: "reflectionTone" },
  { path: "preferredTheme" },
  { path: "reminderPreference" },
  { path: "firstReflectionId" },
  { path: "personalGoals" },
  { path: "referralSource" },
  { path: "referralSourceOther" },
]);

applyEncryptedSchemaPaths(userSchema, [
  { path: "name" },
  { path: "phoneNumber" },
  { path: "email" },
  { path: "googleUserId" },
  { path: "appleUserId" },
  { path: "journalingGoals" },
  { path: "profilePic" },
]);

export const userModel: Model<IUser> = connectMongoDB.model<IUser>(
  "users",
  userSchema
);
