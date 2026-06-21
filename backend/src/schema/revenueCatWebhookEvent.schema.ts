import mongoose, { Document, Model } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";

export type RevenueCatWebhookProcessingState =
  | "processing"
  | "processed"
  | "failed";

export interface IRevenueCatWebhookEvent extends Document {
  _id: mongoose.Types.ObjectId;
  eventKey: string;
  eventId?: string | null;
  eventType: string;
  appId?: string | null;
  appUserId?: string | null;
  originalAppUserId?: string | null;
  transferredFrom: string[];
  transferredTo: string[];
  environment?: string | null;
  processingState: RevenueCatWebhookProcessingState;
  attempts: number;
  deliveryCount: number;
  retryable: boolean;
  safeErrorCode?: string | null;
  firstReceivedAt: Date;
  lastReceivedAt: Date;
  lastAttemptedAt?: Date | null;
  processedAt?: Date | null;
  revenueCatRequestDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const revenueCatWebhookEventSchema = new mongoose.Schema<IRevenueCatWebhookEvent>(
  {
    eventKey: { type: String, required: true, trim: true, unique: true },
    eventId: { type: String, default: null, trim: true },
    eventType: { type: String, required: true, trim: true },
    appId: { type: String, default: null, trim: true },
    appUserId: { type: String, default: null, trim: true },
    originalAppUserId: { type: String, default: null, trim: true },
    transferredFrom: { type: [String], default: [] },
    transferredTo: { type: [String], default: [] },
    environment: { type: String, default: null, trim: true },
    processingState: {
      type: String,
      enum: ["processing", "processed", "failed"],
      default: "processing",
      required: true,
    },
    attempts: { type: Number, default: 0, required: true },
    deliveryCount: { type: Number, default: 1, required: true },
    retryable: { type: Boolean, default: false, required: true },
    safeErrorCode: { type: String, default: null, trim: true },
    firstReceivedAt: { type: Date, required: true },
    lastReceivedAt: { type: Date, required: true },
    lastAttemptedAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
    revenueCatRequestDate: { type: Date, default: null },
  },
  { timestamps: true }
);

revenueCatWebhookEventSchema.index({ processingState: 1, updatedAt: -1 });

export const revenueCatWebhookEventModel: Model<IRevenueCatWebhookEvent> =
  connectMongoDB.model<IRevenueCatWebhookEvent>(
    "revenuecat_webhook_events",
    revenueCatWebhookEventSchema
  );
