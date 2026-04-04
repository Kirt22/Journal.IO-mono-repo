import mongoose, { Document, Model } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";

export type ReminderType = "daily_journal";

export interface IReminder extends Document {
  toObject(): Record<string, unknown>;
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: ReminderType;
  enabled: boolean;
  time: string;
  timezone: string;
  skipIfCompletedToday: boolean;
  includeWeekends: boolean;
  streakWarnings: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reminderSchema = new mongoose.Schema<IReminder>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    type: {
      type: String,
      enum: ["daily_journal"],
      default: "daily_journal",
      required: true,
    },
    enabled: {
      type: Boolean,
      default: false,
      required: true,
    },
    time: {
      type: String,
      required: true,
      trim: true,
    },
    timezone: {
      type: String,
      required: true,
      trim: true,
    },
    skipIfCompletedToday: {
      type: Boolean,
      default: true,
      required: true,
    },
    includeWeekends: {
      type: Boolean,
      default: true,
      required: true,
    },
    streakWarnings: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  { timestamps: true }
);

reminderSchema.index({ userId: 1, type: 1 }, { unique: true });
reminderSchema.index({ createdAt: -1 });

export const reminderModel: Model<IReminder> = connectMongoDB.model<IReminder>(
  "reminders",
  reminderSchema
);
