import mongoose, { Model, Document } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";
import type {
  UserMemoryOngoingThread,
  UserMemoryStructured,
} from "../types/userMemory.types";
import { applyEncryptedSchemaPaths } from "../helpers/fieldEncryption.schema.helpers";

/**
 * One rolling "long-term memory" document per user. Maintained by
 * userMemory.service.ts as new entry insights accumulate: an AI-summarized
 * narrative of the arc of what the user has been working through across all of
 * their entries, plus a light structured view. This is the whole-history
 * counterpart to the recency-limited per-entry `entry_insights` collection and
 * is injected into guided reflection prompts for premium users.
 *
 * Stores only distilled, user-authored themes — never raw journal text.
 */
export interface IUserMemory extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  narrative: string;
  structured: UserMemoryStructured;
  // The entryCreatedAt of the newest entry insight folded into this memory, so
  // refreshes can cheaply detect whether new entries exist since last update.
  entriesCoveredThrough: Date | null;
  entriesCoveredCount: number;
  version: string;
  aiModel: string | null;
  // ── Pattern graph bookkeeping ────────────────────────────────────────────
  // The graph is the fourth layer of the same long-term memory this document
  // already represents, so its refresh state lives here rather than in a third
  // per-user collection.
  /** entryCreatedAt of the newest insight folded into the graph refinement. */
  graphRefinedThrough: Date | null;
  graphRefinedCount: number;
  graphVersion: string;
  /**
   * Set when something invalidated derived edges (e.g. a journal entry was
   * deleted). The next refinement replays the graph from `entry_insights` plus
   * mined chat themes instead of trusting the incremental state.
   */
  graphRebuildRequestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ongoingThreadSchema = new mongoose.Schema<UserMemoryOngoingThread>(
  {
    label: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: mongoose.Schema.Types.Mixed, default: "" },
  },
  { _id: false }
);

const structuredSchema = new mongoose.Schema<UserMemoryStructured>(
  {
    ongoingThreads: { type: [ongoingThreadSchema], default: [] },
    keyRelationships: { type: mongoose.Schema.Types.Mixed, default: [] },
    sensitiveTopics: { type: mongoose.Schema.Types.Mixed, default: [] },
  },
  { _id: false }
);

const userMemorySchema = new mongoose.Schema<IUserMemory>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      unique: true,
    },
    narrative: { type: mongoose.Schema.Types.Mixed, default: "" },
    structured: {
      type: structuredSchema,
      default: () => ({
        ongoingThreads: [],
        keyRelationships: [],
        sensitiveTopics: [],
      }),
    },
    entriesCoveredThrough: { type: Date, default: null },
    entriesCoveredCount: { type: Number, default: 0 },
    version: { type: String, required: true },
    aiModel: { type: String, default: null },
    graphRefinedThrough: { type: Date, default: null },
    graphRefinedCount: { type: Number, default: 0 },
    graphVersion: { type: String, default: "" },
    graphRebuildRequestedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

applyEncryptedSchemaPaths(ongoingThreadSchema, [
  { path: "label" },
  { path: "status" },
]);

applyEncryptedSchemaPaths(structuredSchema, [
  { path: "keyRelationships" },
  { path: "sensitiveTopics" },
]);

applyEncryptedSchemaPaths(userMemorySchema, [{ path: "narrative" }]);

export const userMemoryModel: Model<IUserMemory> =
  connectMongoDB.model<IUserMemory>("user_memories", userMemorySchema);
