import mongoose, { Document, Model } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";
import type { MoodValue } from "../types/mood.types";
import type {
  InsightsAiAnalysisResponse,
  InsightsMindMapResponse,
} from "../types/insights.types";
import { applyEncryptedSchemaPaths } from "../helpers/fieldEncryption.schema.helpers";

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
  mindMapLatestWeek: InsightsMindMapResponse | null;
  mindMapLatestWeekStale: boolean;
  mindMapLatestWeekComputedAt: Date | null;
  mindMapLatestWeekCacheKey: string | null;
  mindMapMonthly: InsightsMindMapResponse | null;
  mindMapMonthlyStale: boolean;
  mindMapMonthlyComputedAt: Date | null;
  mindMapMonthlyCacheKey: string | null;
  mindMapAllTime: InsightsMindMapResponse | null;
  mindMapAllTimeStale: boolean;
  mindMapAllTimeComputedAt: Date | null;
  mindMapAllTimeCacheKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const insightsSchema = new mongoose.Schema<IInsights>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
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
      type: mongoose.Schema.Types.Mixed,
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
    mindMapLatestWeek: { type: mongoose.Schema.Types.Mixed, default: null },
    mindMapLatestWeekStale: { type: Boolean, required: true, default: true },
    mindMapLatestWeekComputedAt: { type: Date, default: null },
    mindMapLatestWeekCacheKey: { type: String, default: null, trim: true },
    mindMapMonthly: { type: mongoose.Schema.Types.Mixed, default: null },
    mindMapMonthlyStale: { type: Boolean, required: true, default: true },
    mindMapMonthlyComputedAt: { type: Date, default: null },
    mindMapMonthlyCacheKey: { type: String, default: null, trim: true },
    mindMapAllTime: { type: mongoose.Schema.Types.Mixed, default: null },
    mindMapAllTimeStale: { type: Boolean, required: true, default: true },
    mindMapAllTimeComputedAt: { type: Date, default: null },
    mindMapAllTimeCacheKey: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

insightsSchema.index({ userId: 1 }, { unique: true });

applyEncryptedSchemaPaths(insightsSchema, [
  { path: "tagCounts" },
  { path: "aiAnalysis" },
  { path: "mindMapLatestWeek" },
  { path: "mindMapMonthly" },
  { path: "mindMapAllTime" },
]);

export const insightsModel: Model<IInsights> = connectMongoDB.model<IInsights>(
  "insights",
  insightsSchema
);
