import mongoose, { Document, Model } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";

export interface IOnboardingContext {
  ageRange?: string | null;
  journalingExperience?: string | null;
  goals: string[];
  supportFocus: string[];
  reminderPreference?: string | null;
  aiOptIn?: boolean | null;
  privacyConsentAccepted?: boolean | null;
}

export interface IUser extends Document {
  toObject(): Record<string, unknown>;
  _id: mongoose.Types.ObjectId;
  name: string;
  phoneNumber?: string | null;
  email?: string | null;
  passwordHash?: string | null;
  emailVerified: boolean;
  emailVerificationCode?: string | null;
  emailVerificationAttempts: number;
  googleUserId?: string | null;
  authProviders: string[];
  journalingGoals: string[];
  onboardingContext?: IOnboardingContext | null;
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
  lastLoginAt?: Date | null;
  isPremium: boolean;
  premiumPlanKey?: "weekly" | "monthly" | "yearly" | "lifetime" | null;
  premiumActivatedAt?: Date | null;
  premiumSource?: "revenuecat_client_sync" | null;
  lifetimePurchaseRecordedAt?: Date | null;
  lastPaywallEventAt?: Date | null;
  lastInterruptivePaywallAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const onboardingContextSchema = new mongoose.Schema<IOnboardingContext>(
  {
    ageRange: { type: String, default: null, trim: true },
    journalingExperience: { type: String, default: null, trim: true },
    goals: { type: [String], default: [], required: true },
    supportFocus: { type: [String], default: [], required: true },
    reminderPreference: { type: String, default: null, trim: true },
    aiOptIn: { type: Boolean, default: null },
    privacyConsentAccepted: { type: Boolean, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true },
    passwordHash: { type: String, default: null },
    emailVerified: { type: Boolean, default: false, required: true },
    emailVerificationCode: { type: String, default: null },
    emailVerificationAttempts: { type: Number, default: 0, required: true },
    googleUserId: { type: String, default: null },
    authProviders: {
      type: [String],
      enum: ["phone", "google", "email"],
      default: [],
      required: true,
    },
    journalingGoals: {
      type: [String],
      default: [],
      required: true,
    },
    onboardingContext: {
      type: onboardingContextSchema,
      default: null,
    },
    avatarColor: { type: String, default: null },
    profileSetupCompleted: { type: Boolean, default: false, required: true },
    onboardingCompleted: { type: Boolean, default: false, required: true },
    emailPasswordHash: { type: String, default: null },
    emailVerifiedAt: { type: Date, default: null },
    emailVerificationCodeHash: { type: String, default: null },
    emailVerificationExpiresAt: { type: Date, default: null },
    profilePic: { type: String, default: null },
    refreshTokenHash: { type: String, default: null },
    refreshTokenExpiresAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    isPremium: { type: Boolean, default: false, required: true },
    premiumPlanKey: {
      type: String,
      enum: ["weekly", "monthly", "yearly", "lifetime"],
      default: null,
    },
    premiumActivatedAt: { type: Date, default: null },
    premiumSource: {
      type: String,
      enum: ["revenuecat_client_sync"],
      default: null,
    },
    lifetimePurchaseRecordedAt: { type: Date, default: null },
    lastPaywallEventAt: { type: Date, default: null },
    lastInterruptivePaywallAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index(
  { phoneNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { phoneNumber: { $type: "string" } },
  }
);
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
  }
);
userSchema.index(
  { googleUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { googleUserId: { $type: "string" } },
  }
);
userSchema.index({ createdAt: -1 });

export const userModel: Model<IUser> = connectMongoDB.model<IUser>(
  "users",
  userSchema
);
