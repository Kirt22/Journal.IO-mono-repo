import mongoose, { Model, Document } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";
import type { ReflectionRegionId } from "../helpers/reflectionMap.helpers";

export type MindMapEntryRegionScore = {
  id: ReflectionRegionId;
  score: number;
  confidence: number;
};

export interface IMindMapEntryScore extends Document {
  toObject(): any;
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  journalId: mongoose.Types.ObjectId;
  entryType: "open_ended" | "guided";
  regionScores: MindMapEntryRegionScore[];
  dominantRegionId: ReflectionRegionId;
  isFavorite: boolean;
  // `clear` mirrors the global map's clear-entry filter (not low-signal, not
  // safety-flagged, enough words) so aggregation/trends can filter cheaply.
  clear: boolean;
  source: "ai" | "heuristic";
  scorerVersion: string;
  aiModel: string | null;
  entryCreatedAt: Date;
  computedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const regionScoreSchema = new mongoose.Schema<MindMapEntryRegionScore>(
  {
    id: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 1 },
    confidence: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false }
);

const mindMapEntryScoreSchema = new mongoose.Schema<IMindMapEntryScore>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    journalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "journals",
      required: true,
      unique: true,
    },
    entryType: {
      type: String,
      enum: ["open_ended", "guided"],
      default: "open_ended",
      required: true,
    },
    regionScores: { type: [regionScoreSchema], default: [] },
    dominantRegionId: { type: String, required: true },
    isFavorite: { type: Boolean, default: false },
    clear: { type: Boolean, default: true },
    source: {
      type: String,
      enum: ["ai", "heuristic"],
      default: "heuristic",
      required: true,
    },
    scorerVersion: { type: String, required: true },
    aiModel: { type: String, default: null },
    entryCreatedAt: { type: Date, required: true },
    computedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// ✅ Indexes
mindMapEntryScoreSchema.index({ journalId: 1 }, { unique: true });
mindMapEntryScoreSchema.index({ userId: 1, entryCreatedAt: -1 });

export const mindMapEntryScoreModel: Model<IMindMapEntryScore> =
  connectMongoDB.model<IMindMapEntryScore>(
    "mindmap_entry_scores",
    mindMapEntryScoreSchema
  );
