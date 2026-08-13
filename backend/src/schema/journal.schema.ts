import mongoose, { Model, Document } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";
import {
  DETECTED_MOODS,
  ENTRY_TOPIC_TAXONOMY,
  type DetectedMood,
  type EntryTopic,
} from "../helpers/entryMetadata.helpers";
import type { GuidedReflectionSessionAnalysisResponse } from "../services/guided-reflection/guided-reflection.service";
import { applyEncryptedSchemaPaths } from "../helpers/fieldEncryption.schema.helpers";

export type JournalSessionAnalysisSource =
  | "guided"
  | "open_ended"
  | "legacy_backfill";

export type JournalSessionAnalysisSnapshot = {
  analysis: GuidedReflectionSessionAnalysisResponse;
  source: JournalSessionAnalysisSource;
  version: number;
  generatedAt: Date;
};

export interface IJournal extends Document {
  toObject(): any;
  _id: mongoose.Types.ObjectId;
  content: string;
  userId: mongoose.Types.ObjectId;
  type: "open_ended" | "guided";
  entryKind?: "journal" | "quick_thought";
  title: string;
  aiPrompt: string | null;
  tags: string[];
  detectedTopics: EntryTopic[];
  detectedMood: DetectedMood | null;
  sessionAnalysisSnapshot?: JournalSessionAnalysisSnapshot | null;
  images: string[] | null;
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
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    type: {
      type: String,
      enum: ["open_ended", "guided"],
      default: "open_ended",
      required: true,
    },
    entryKind: {
      type: String,
      enum: ["journal", "quick_thought"],
    },
    title: { type: mongoose.Schema.Types.Mixed, default: "Untitled", required: true },
    aiPrompt: { type: mongoose.Schema.Types.Mixed, default: null },
    tags: { type: mongoose.Schema.Types.Mixed, default: [] },
    detectedTopics: {
      type: [String],
      enum: ENTRY_TOPIC_TAXONOMY,
      default: [],
    },
    detectedMood: {
      type: String,
      enum: DETECTED_MOODS,
      default: null,
    },
    sessionAnalysisSnapshot: {
      type: new mongoose.Schema<JournalSessionAnalysisSnapshot>(
        {
          analysis: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
          },
          source: {
            type: String,
            enum: ["guided", "open_ended", "legacy_backfill"],
            required: true,
          },
          version: { type: Number, default: 1, required: true },
          generatedAt: { type: Date, default: Date.now, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
    images: { type: mongoose.Schema.Types.Mixed, default: [] },
    isFavorite: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ✅ Indexes
journalSchema.index({ userId: 1 });
journalSchema.index({ userId: 1, createdAt: -1 });
journalSchema.index({ type: 1 });
journalSchema.index({ createdAt: -1 });

applyEncryptedSchemaPaths(
  journalSchema.path("sessionAnalysisSnapshot")?.schema || new mongoose.Schema({}),
  [{ path: "analysis" }]
);

applyEncryptedSchemaPaths(journalSchema, [
  { path: "content" },
  { path: "title" },
  { path: "aiPrompt" },
  { path: "tags" },
  { path: "images" },
]);

export const journalModel: Model<IJournal> = connectMongoDB.model<IJournal>(
  "journals",
  journalSchema
);
