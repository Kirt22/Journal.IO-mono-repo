import mongoose, { Model, Document } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";
import { applyEncryptedSchemaPaths } from "../helpers/fieldEncryption.schema.helpers";
import type { JadeMessageBlock, JadeMessageStatus } from "../types/askJade.types";

/**
 * One turn in an Ask Jade conversation.
 *
 * `status` records how the reply came to exist, which the client renders
 * differently:
 *   - `ok`            — a normal model reply
 *   - `fallback`      — the model was unreachable; a deterministic line was
 *                       stored so the transcript stays consistent and the user
 *                       can retry on that bubble
 *   - `support_first` — a safety signal was detected, so a deterministic
 *                       support-first reply was stored and no model was called
 */
export interface IJadeMessage extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  /** Monotonic within a session; allocated atomically, never read-then-write. */
  seq: number;
  role: "user" | "assistant";
  text: string;
  status: JadeMessageStatus;
  blocks: JadeMessageBlock[];
  aiModel: string | null;
  tokensEstimated: number;
  createdAt: Date;
  updatedAt: Date;
}

const jadeMessageSchema = new mongoose.Schema<IJadeMessage>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "jade_sessions",
      required: true,
    },
    seq: { type: Number, required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["ok", "fallback", "support_first", "product_fact"],
      default: "ok",
      required: true,
    },
    blocks: { type: mongoose.Schema.Types.Mixed, default: [] },
    aiModel: { type: String, default: null },
    tokensEstimated: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ✅ Indexes
jadeMessageSchema.index({ sessionId: 1, seq: 1 }, { unique: true });
// Serves both the privacy paths and the per-user turn counting that enforces
// the rate limits, so neither needs a separate counter collection.
jadeMessageSchema.index({ userId: 1, createdAt: -1 });

applyEncryptedSchemaPaths(jadeMessageSchema, [{ path: "text" }, { path: "blocks" }]);

export const jadeMessageModel: Model<IJadeMessage> =
  connectMongoDB.model<IJadeMessage>("jade_messages", jadeMessageSchema);
