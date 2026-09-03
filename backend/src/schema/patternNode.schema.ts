import mongoose, { Model, Document } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";
import type {
  PatternNodeKind,
  PatternNodeStatus,
  PatternSourceKind,
} from "../helpers/patternGraph.helpers";
import type { ReflectionRegionId } from "../helpers/reflectionMap.helpers";
import { applyEncryptedSchemaPaths } from "../helpers/fieldEncryption.schema.helpers";

/**
 * One behavioural pattern in a user's graph — a node.
 *
 * Nodes are a materialized projection of the themes already extracted per entry
 * (`entry_insights.themes`) plus the themes mined from Ask Jade sessions.
 * `entry_insights` stays the source of truth, so the whole graph can be replayed
 * from it; this collection exists so patterns can be *related* to one another,
 * which counting themes per entry could never express.
 *
 * A node is a pattern the user's own writing keeps showing — usually a
 * behaviour like "eats while watching shows" — carrying why it was noticed and
 * the user's own sentence as evidence. Clinically-worded labels are allowed:
 * the filter that used to reject them dropped the node outright rather than
 * rewording it, which lost the pattern instead of softening it.
 *
 * Row-per-node rather than one embedded array per user: writes arrive from
 * fire-and-forget background work and can overlap, so a read-modify-write of a
 * large embedded array would silently lose updates. Rows give atomic `$inc`
 * upserts and cheap pruning.
 */
export type PatternNodeEvidence = {
  journalId: mongoose.Types.ObjectId | null;
  sessionId: mongoose.Types.ObjectId | null;
  quote: string;
  observedAt: Date;
};

export interface IPatternNode extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** Stable readable slug of the label that created this node (`toThemeId`). */
  key: string;
  keyLookupHash?: string | null;
  /** Phrasing-independent merge key (`toPatternKey`). */
  canonicalKey: string;
  canonicalKeyLookupHash?: string | null;
  kind: PatternNodeKind;
  label: string;
  /** Every slug merged into this node, including `key`. */
  aliases: string[];
  aliasLabels: string[];
  rationale: string;
  evidenceQuote: string;
  evidence: PatternNodeEvidence[];
  regionId: ReflectionRegionId | null;
  sourceKinds: PatternSourceKind[];
  occurrences: number;
  confidence: number;
  /** Derived rank used for prompt selection and pruning (`computeNodeStrength`). */
  strength: number;
  /** Set on member patterns when an umbrella ("god node") groups them. */
  parentNodeId: mongoose.Types.ObjectId | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** Embedding of "label. rationale", used for near-duplicate merging only. */
  embedding: number[];
  hasEmbedding: boolean;
  embeddingCiphertext?: string | null;
  embeddingModel: string | null;
  status: PatternNodeStatus;
  /**
   * A merged node is kept, not deleted, so a wrong merge stays reversible — a
   * silently lost node would corrupt the graph permanently.
   */
  mergedIntoNodeId: mongoose.Types.ObjectId | null;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

const patternNodeEvidenceSchema = new mongoose.Schema<PatternNodeEvidence>(
  {
    journalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "journals",
      default: null,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "jade_sessions",
      default: null,
    },
    quote: { type: mongoose.Schema.Types.Mixed, default: "" },
    observedAt: { type: Date, required: true },
  },
  { _id: false }
);

const patternNodeSchema = new mongoose.Schema<IPatternNode>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    key: { type: mongoose.Schema.Types.Mixed, required: true },
    keyLookupHash: { type: String, default: null },
    canonicalKey: { type: mongoose.Schema.Types.Mixed, required: true },
    canonicalKeyLookupHash: { type: String, default: null },
    kind: {
      type: String,
      enum: ["pattern", "umbrella"],
      default: "pattern",
      required: true,
    },
    label: { type: mongoose.Schema.Types.Mixed, required: true },
    aliases: { type: mongoose.Schema.Types.Mixed, default: [] },
    aliasLabels: { type: mongoose.Schema.Types.Mixed, default: [] },
    rationale: { type: mongoose.Schema.Types.Mixed, default: "" },
    evidenceQuote: { type: mongoose.Schema.Types.Mixed, default: "" },
    evidence: { type: [patternNodeEvidenceSchema], default: [] },
    regionId: { type: String, default: null },
    sourceKinds: { type: [String], default: [] },
    occurrences: { type: Number, default: 0 },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    strength: { type: Number, default: 0 },
    parentNodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "pattern_nodes",
      default: null,
    },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    embeddingCiphertext: { type: String, default: null },
    hasEmbedding: { type: Boolean, default: false, required: true },
    embeddingModel: { type: String, default: null },
    status: {
      type: String,
      enum: ["active", "dormant", "merged"],
      default: "active",
      required: true,
    },
    mergedIntoNodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "pattern_nodes",
      default: null,
    },
    version: { type: String, required: true },
  },
  { timestamps: true }
);

// ✅ Indexes
patternNodeSchema.index({ userId: 1, keyLookupHash: 1 }, { unique: true });
patternNodeSchema.index({ userId: 1, canonicalKeyLookupHash: 1 });
// Multikey — resolves a slug that was previously merged into another node.
patternNodeSchema.index({ userId: 1, aliases: 1 });
patternNodeSchema.index({ userId: 1, strength: -1 });
patternNodeSchema.index({ userId: 1, lastSeenAt: -1 });
patternNodeSchema.index({ userId: 1, hasEmbedding: 1, lastSeenAt: -1 });

applyEncryptedSchemaPaths(patternNodeEvidenceSchema, [{ path: "quote" }]);

applyEncryptedSchemaPaths(patternNodeSchema, [
  { path: "key" },
  { path: "canonicalKey" },
  { path: "label" },
  { path: "aliases" },
  { path: "aliasLabels" },
  { path: "rationale" },
  { path: "evidenceQuote" },
]);

export const patternNodeModel: Model<IPatternNode> =
  connectMongoDB.model<IPatternNode>("pattern_nodes", patternNodeSchema);
