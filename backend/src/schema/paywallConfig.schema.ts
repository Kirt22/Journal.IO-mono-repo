import mongoose, { Document, Model } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";
import {
  PAYWALL_TEMPLATE_KEYS,
  type PaywallTemplateKey,
} from "./paywallTemplate.schema";

export type PaywallTriggerMode = "contextual" | "interruptive";

export interface IPaywallPlacementConfig {
  key: string;
  templateKey: PaywallTemplateKey;
  fallbackTemplateKey?: PaywallTemplateKey | null;
  enabled: boolean;
  interruptiveEnabled: boolean;
  interruptiveTemplateKey?: PaywallTemplateKey | null;
}

export interface IPaywallConfig extends Document {
  _id: mongoose.Types.ObjectId;
  key: "global";
  enabled: boolean;
  premiumIntentWindowHours: number;
  premiumIntentThreshold: number;
  interruptiveProbability: number;
  interruptiveCooldownHours: number;
  interruptiveMaxShowsPer30Days: number;
  interruptiveEligibleScreens: string[];
  interruptiveExcludedStages: string[];
  placements: IPaywallPlacementConfig[];
  createdAt: Date;
  updatedAt: Date;
}

const paywallPlacementConfigSchema =
  new mongoose.Schema<IPaywallPlacementConfig>(
    {
      key: { type: String, required: true, trim: true },
      templateKey: {
        type: String,
        enum: PAYWALL_TEMPLATE_KEYS,
        required: true,
      },
      fallbackTemplateKey: {
        type: String,
        enum: PAYWALL_TEMPLATE_KEYS,
        default: null,
      },
      enabled: { type: Boolean, required: true, default: true },
      interruptiveEnabled: { type: Boolean, required: true, default: false },
      interruptiveTemplateKey: {
        type: String,
        enum: PAYWALL_TEMPLATE_KEYS,
        default: null,
      },
    },
    { _id: false }
  );

const paywallConfigSchema = new mongoose.Schema<IPaywallConfig>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ["global"],
      default: "global",
    },
    enabled: { type: Boolean, required: true, default: true },
    premiumIntentWindowHours: { type: Number, required: true, default: 24, min: 1 },
    premiumIntentThreshold: { type: Number, required: true, default: 3, min: 1 },
    interruptiveProbability: {
      type: Number,
      required: true,
      default: 0.3,
      min: 0,
      max: 1,
    },
    interruptiveCooldownHours: { type: Number, required: true, default: 48, min: 1 },
    interruptiveMaxShowsPer30Days: { type: Number, required: true, default: 3, min: 1 },
    interruptiveEligibleScreens: {
      type: [String],
      default: ["home", "insights"],
      required: true,
    },
    interruptiveExcludedStages: {
      type: [String],
      default: [
        "onboarding",
        "auth",
        "sign-in",
        "create-account",
        "verify-email",
        "profile",
        "new-entry",
        "journal-edit",
      ],
      required: true,
    },
    placements: {
      type: [paywallPlacementConfigSchema],
      default: [],
      required: true,
    },
  },
  { timestamps: true }
);

export const paywallConfigModel: Model<IPaywallConfig> =
  connectMongoDB.model<IPaywallConfig>("paywall_configs", paywallConfigSchema);
