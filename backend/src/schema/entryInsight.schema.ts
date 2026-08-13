import mongoose, { Model, Document } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";
import type { ReflectionRegionId } from "../helpers/reflectionMap.helpers";
import { applyEncryptedSchemaPaths } from "../helpers/fieldEncryption.schema.helpers";

/**
 * One persisted "key insight" per journal entry. This is the source of truth
 * for (a) cross-session memory injected into guided reflections, (b) the Mind
 * Map's recurring patterns, and (c) efficient 30-day / monthly aggregation
 * (querying by entryCreatedAt instead of re-reading raw journal text).
 *
 * A theme is a recurring behavioural/emotional dynamic a thoughtful therapist
 * would notice (e.g. "seeks reassurance under stress"), paired with the reason
 * the AI concluded it and the user's own sentence that supports it. It is never
 * a clinical diagnosis or a named condition.
 */
export type EntryInsightThemeRecord = {
  id: string;
  label: string;
  rationale: string;
  evidenceQuote: string;
  confidence: number;
};

export interface IEntryInsight extends Document {
  toObject(): any;
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  journalId: mongoose.Types.ObjectId;
  entryType: "open_ended" | "guided";
  contextSummary: string;
  emotionalTone: string;
  themes: EntryInsightThemeRecord[];
  dominantRegionId: ReflectionRegionId;
  embedding: number[];
  hasEmbedding: boolean;
  embeddingCiphertext?: string | null;
  embeddingModel: string | null;
  // Mirrors mindmap_entry_scores.clear so aggregation can filter cheaply.
  clear: boolean;
  source: "ai" | "heuristic";
  scorerVersion: string;
  aiModel: string | null;
  entryCreatedAt: Date;
  computedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const entryInsightThemeSchema = new mongoose.Schema<EntryInsightThemeRecord>(
  {
    id: { type: mongoose.Schema.Types.Mixed, required: true },
    label: { type: mongoose.Schema.Types.Mixed, required: true },
    rationale: { type: mongoose.Schema.Types.Mixed, default: "" },
    evidenceQuote: { type: mongoose.Schema.Types.Mixed, default: "" },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
  },
  { _id: false }
);

const entryInsightSchema = new mongoose.Schema<IEntryInsight>(
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
    contextSummary: { type: mongoose.Schema.Types.Mixed, default: "" },
    emotionalTone: { type: mongoose.Schema.Types.Mixed, default: "" },
    themes: { type: mongoose.Schema.Types.Mixed, default: [] },
    dominantRegionId: { type: String, required: true },
    embeddingCiphertext: { type: String, default: null },
    hasEmbedding: { type: Boolean, default: false, required: true },
    embeddingModel: { type: String, default: null },
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
entryInsightSchema.index({ journalId: 1 }, { unique: true });
entryInsightSchema.index({ userId: 1, entryCreatedAt: -1 });
entryInsightSchema.index({ userId: 1, hasEmbedding: 1, entryCreatedAt: -1 });

applyEncryptedSchemaPaths(entryInsightThemeSchema, [
  { path: "id" },
  { path: "label" },
  { path: "rationale" },
  { path: "evidenceQuote" },
]);

applyEncryptedSchemaPaths(entryInsightSchema, [
  { path: "contextSummary" },
  { path: "emotionalTone" },
  { path: "themes" },
]);

export const entryInsightModel: Model<IEntryInsight> =
  connectMongoDB.model<IEntryInsight>("entry_insights", entryInsightSchema);
