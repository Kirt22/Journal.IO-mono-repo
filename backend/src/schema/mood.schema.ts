import mongoose, { Document, Model } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";
import type { MoodValue } from "../types/mood.types";

export interface IMoodCheckIn extends Document {
  toObject(): any;
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  mood: MoodValue;
  moodDateKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const moodCheckInSchema = new mongoose.Schema<IMoodCheckIn>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    mood: {
      type: String,
      required: true,
      enum: ["amazing", "good", "okay", "bad", "terrible"],
    },
    moodDateKey: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

moodCheckInSchema.index({ userId: 1, moodDateKey: 1 }, { unique: true });
moodCheckInSchema.index({ userId: 1, createdAt: -1 });

export const moodCheckInModel: Model<IMoodCheckIn> =
  connectMongoDB.model<IMoodCheckIn>("mood_checkins", moodCheckInSchema);
