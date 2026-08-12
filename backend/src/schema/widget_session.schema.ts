import mongoose, { Document, Model } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";

export type WidgetPlatform = "ios";

export interface IWidgetSession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  platform: WidgetPlatform;
  installationId: string;
  tokenHash: string;
  sessionVersion: number;
  expiresAt: Date;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const widgetSessionSchema = new mongoose.Schema<IWidgetSession>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    platform: {
      type: String,
      enum: ["ios"],
      required: true,
    },
    installationId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    sessionVersion: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    lastUsedAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

widgetSessionSchema.index(
  { userId: 1, platform: 1, installationId: 1 },
  { unique: true }
);
widgetSessionSchema.index({ userId: 1, lastUsedAt: -1 });
widgetSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const widgetSessionModel: Model<IWidgetSession> =
  connectMongoDB.model<IWidgetSession>("widget_sessions", widgetSessionSchema);
