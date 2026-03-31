import mongoose, { Model, Document } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";

export interface IJournal extends Document {
  toObject(): any;
  _id: mongoose.Types.ObjectId;
  content: string;
  userId: mongoose.Types.ObjectId;
  type: string;
  title: string;
  tags: string[];
  images: [string] | null;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const journalSchema = new mongoose.Schema<IJournal>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    content: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, default: "Untitled", required: true },
    tags: { type: [String], default: [] },
    images: { type: [String], default: [] },
    isFavorite: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ✅ Indexes
journalSchema.index({ userId: 1 });
journalSchema.index({ type: 1 });
journalSchema.index({ createdAt: -1 });
journalSchema.index({ _id: 1, title: 1 });

export const journalModel: Model<IJournal> = connectMongoDB.model<IJournal>(
  "journals",
  journalSchema
);
