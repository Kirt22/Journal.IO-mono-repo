import mongoose, { Model, Document } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";

export interface IStreak extends Document {
  toObject(): any;
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  streak: number;
  streakStartDate: Date;
  streakEndDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const streakSchema = new mongoose.Schema<IStreak>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    streak: { type: Number, required: true, default: 0 },
    streakStartDate: { type: Date, required: true, default: Date.now },
    streakEndDate: { type: Date, default: null },
  },
  { timestamps: true }
);

// ✅ Indexes
streakSchema.index({ userId: 1 });

export const streaksModel: Model<IStreak> = connectMongoDB.model<IStreak>(
  "streaks",
  streakSchema
);
