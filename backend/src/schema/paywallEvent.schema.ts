import mongoose, { Document, Model } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";
import {
  PAYWALL_OFFERING_KEYS,
  type PaywallOfferingKey,
} from "./paywallOffering.schema";
import {
  PAYWALL_TEMPLATE_KEYS,
  type PaywallTemplateKey,
} from "./paywallTemplate.schema";

export const PAYWALL_EVENT_TYPES = [
  "locked_feature_tap",
  "upgrade_tap",
  "paywall_impression",
  "paywall_dismiss",
  "plan_select",
  "cta_tap",
  "purchase_success",
  "restore_success",
  "purchase_failure",
] as const;

export type PaywallEventType = (typeof PAYWALL_EVENT_TYPES)[number];

export interface IPaywallEvent extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  placementKey: string;
  screenKey?: string | null;
  eventType: PaywallEventType;
  templateKey?: PaywallTemplateKey | null;
  offeringKey?: PaywallOfferingKey | null;
  wasInterruptive: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const paywallEventSchema = new mongoose.Schema<IPaywallEvent>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    placementKey: { type: String, required: true, trim: true, index: true },
    screenKey: { type: String, default: null, trim: true },
    eventType: {
      type: String,
      enum: PAYWALL_EVENT_TYPES,
      required: true,
      index: true,
    },
    templateKey: {
      type: String,
      enum: PAYWALL_TEMPLATE_KEYS,
      default: null,
    },
    offeringKey: {
      type: String,
      enum: PAYWALL_OFFERING_KEYS,
      default: null,
    },
    wasInterruptive: { type: Boolean, required: true, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

paywallEventSchema.index({ userId: 1, createdAt: -1 });
paywallEventSchema.index({ placementKey: 1, createdAt: -1 });

export const paywallEventModel: Model<IPaywallEvent> =
  connectMongoDB.model<IPaywallEvent>("paywall_events", paywallEventSchema);
