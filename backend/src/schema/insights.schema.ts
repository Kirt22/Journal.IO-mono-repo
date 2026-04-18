import mongoose, { Document, Model } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";
import type { MoodValue } from "../types/mood.types";
import type { InsightsAiAnalysisResponse } from "../types/insights.types";

export interface IInsights extends Document {
  toObject(): Record<string, unknown>;
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  totalEntries: number;
  totalWords: number;
  totalFavorites: number;
  dailyJournalCounts: Map<string, number>;
  tagCounts: Map<string, number>;
  moodCounts: Map<MoodValue, number>;
  lastJournalDateKey: string | null;
  lastCalculatedAt: Date | null;
  aiAnalysis: InsightsAiAnalysisResponse | null;
  aiAnalysisStale: boolean;
  aiAnalysisComputedAt: Date | null;
  aiAnalysisWindowEndDateKey: string | null;
  aiAnalysisCacheKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const insightsSchema = new mongoose.Schema<IInsights>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      unique: true,
    },
    totalEntries: { type: Number, required: true, default: 0 },
    totalWords: { type: Number, required: true, default: 0 },
    totalFavorites: { type: Number, required: true, default: 0 },
    dailyJournalCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    tagCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    moodCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    lastJournalDateKey: { type: String, default: null, trim: true },
    lastCalculatedAt: { type: Date, default: null },
    aiAnalysis: { type: mongoose.Schema.Types.Mixed, default: null },
    aiAnalysisStale: { type: Boolean, required: true, default: true },
    aiAnalysisComputedAt: { type: Date, default: null },
    aiAnalysisWindowEndDateKey: { type: String, default: null, trim: true },
    aiAnalysisCacheKey: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

insightsSchema.index({ userId: 1 }, { unique: true });

export const insightsModel: Model<IInsights> = connectMongoDB.model<IInsights>(
  "insights",
  insightsSchema
);
