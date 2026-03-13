import mongoose, { Model, Document } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";

export interface IStat extends Document {
  toObject(): any;
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  journalsWritten: number;
  totalWordsWritten: number;
  createdAt: Date;
  updatedAt: Date;
}

const statSchema = new mongoose.Schema<IStat>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    journalsWritten: { type: Number, required: true, default: 0 },
    totalWordsWritten: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

// ✅ Indexes
statSchema.index({ userId: 1 });

export const statsModel: Model<IStat> = connectMongoDB.model<IStat>(
  "stats",
  statSchema
);
