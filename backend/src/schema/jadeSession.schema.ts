import mongoose, { Model, Document } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";
import { applyEncryptedSchemaPaths } from "../helpers/fieldEncryption.schema.helpers";

/**
 * One Ask Jade conversation.
 *
 * Messages live in their own collection (`jade_messages`) rather than embedded
 * here: a long chat would grow this document without bound and every reply
 * would rewrite the whole thing. This document holds only the denormalized bits
 * the sessions list needs, so that list is one indexed query with no $lookup.
 */
export type JadeMinedTheme = {
  key: string;
  label: string;
  rationale: string;
  evidenceQuote: string;
  confidence: number;
  seq: number;
};

export interface IJadeSession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  messageCount: number;
  lastMessageAt: Date;
  lastMessagePreview: string;
  /**
   * Turns older than the live window, compacted by the model so a long
   * conversation stays coherent without resending every message.
   */
  runningSummary: string;
  summarizedThroughSeq: number;
  status: "active" | "closed";
  minedAt: Date | null;
  minedThroughSeq: number;
  /**
   * Themes mined from this conversation and folded into the pattern graph.
   * Persisted here because chat observations have no `entry_insights` row, and
   * a full graph rebuild has to be able to replay them.
   */
  minedThemes: JadeMinedTheme[];
  aiModel: string | null;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

const jadeMinedThemeSchema = new mongoose.Schema<JadeMinedTheme>(
  {
    key: { type: mongoose.Schema.Types.Mixed, required: true },
    label: { type: mongoose.Schema.Types.Mixed, required: true },
    rationale: { type: mongoose.Schema.Types.Mixed, default: "" },
    evidenceQuote: { type: mongoose.Schema.Types.Mixed, default: "" },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    seq: { type: Number, default: 0 },
  },
  { _id: false }
);

const jadeSessionSchema = new mongoose.Schema<IJadeSession>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    title: { type: mongoose.Schema.Types.Mixed, default: "" },
    messageCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date, required: true },
    lastMessagePreview: { type: mongoose.Schema.Types.Mixed, default: "" },
    runningSummary: { type: mongoose.Schema.Types.Mixed, default: "" },
    summarizedThroughSeq: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
      required: true,
    },
    minedAt: { type: Date, default: null },
    minedThroughSeq: { type: Number, default: 0 },
    minedThemes: { type: [jadeMinedThemeSchema], default: [] },
    aiModel: { type: String, default: null },
    version: { type: String, required: true },
  },
  { timestamps: true }
);

// ✅ Indexes
// Exactly the keyset the paginated sessions list sorts and filters on.
jadeSessionSchema.index({ userId: 1, lastMessageAt: -1, _id: -1 });

applyEncryptedSchemaPaths(jadeMinedThemeSchema, [
  { path: "key" },
  { path: "label" },
  { path: "rationale" },
  { path: "evidenceQuote" },
]);

applyEncryptedSchemaPaths(jadeSessionSchema, [
  { path: "title" },
  { path: "lastMessagePreview" },
  { path: "runningSummary" },
]);

export const jadeSessionModel: Model<IJadeSession> =
  connectMongoDB.model<IJadeSession>("jade_sessions", jadeSessionSchema);
