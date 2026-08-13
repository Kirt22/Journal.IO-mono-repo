import mongoose, { Model, Document } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";
import type {
  PatternEdgeSource,
  PatternEdgeType,
} from "../helpers/patternGraph.helpers";
import { applyEncryptedSchemaPaths } from "../helpers/fieldEncryption.schema.helpers";

/**
 * One observed connection between two pattern nodes for a single user.
 *
 * This is the piece the app never had: `aggregateRecurringPatterns` counts how
 * often a theme shows up, but never relates one theme to another. Edges are what
 * let the product move from "you overeat, seen 9x" to "the screen-heavy evenings
 * and the overeating look like the same loop".
 *
 * Three sources, in increasing order of trust required:
 *   - `co_occurrence` — deterministic; two patterns appeared in the same entry.
 *   - `temporal`      — deterministic; one pattern tended to precede another.
 *   - `ai_inferred`   — a model named the mechanism between two patterns we
 *                       already hold. Never allowed to invent an endpoint.
 *
 * An edge is a hedged observation about this user, never a causal claim and
 * never a clinical one.
 */
export type PatternEdgeEvidence = {
  journalId: mongoose.Types.ObjectId | null;
  quote: string;
  observedAt: Date;
};

export interface IPatternEdge extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /**
   * `${type}:${from}->${to}`. Undirected types sort their endpoints so A|B and
   * B|A collapse to a single row (`buildPatternEdgeKey`).
   */
  key: string;
  keyLookupHash?: string | null;
  fromNodeId: mongoose.Types.ObjectId;
  toNodeId: mongoose.Types.ObjectId;
  /** Denormalized so reading a whole graph needs no $lookup. */
  fromKey: string;
  fromKeyLookupHash?: string | null;
  toKey: string;
  toKeyLookupHash?: string | null;
  type: PatternEdgeType;
  directed: boolean;
  source: PatternEdgeSource;
  rationale: string;
  evidence: PatternEdgeEvidence[];
  observations: number;
  /** Lag samples for `precedes` edges; the median is computed on read. */
  lagSamplesHours: number[];
  confidence: number;
  strength: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

const patternEdgeEvidenceSchema = new mongoose.Schema<PatternEdgeEvidence>(
  {
    journalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "journals",
      default: null,
    },
    quote: { type: mongoose.Schema.Types.Mixed, default: "" },
    observedAt: { type: Date, required: true },
  },
  { _id: false }
);

const patternEdgeSchema = new mongoose.Schema<IPatternEdge>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    key: { type: mongoose.Schema.Types.Mixed, required: true },
    keyLookupHash: { type: String, default: null },
    fromNodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "pattern_nodes",
      required: true,
    },
    toNodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "pattern_nodes",
      required: true,
    },
    fromKey: { type: mongoose.Schema.Types.Mixed, required: true },
    fromKeyLookupHash: { type: String, default: null },
    toKey: { type: mongoose.Schema.Types.Mixed, required: true },
    toKeyLookupHash: { type: String, default: null },
    type: {
      type: String,
      enum: [
        "co_occurs",
        "precedes",
        "reinforces",
        "relieves",
        "conflicts_with",
        "context_for",
      ],
      required: true,
    },
    directed: { type: Boolean, default: true },
    source: {
      type: String,
      enum: ["co_occurrence", "temporal", "ai_inferred"],
      required: true,
    },
    rationale: { type: mongoose.Schema.Types.Mixed, default: "" },
    evidence: { type: [patternEdgeEvidenceSchema], default: [] },
    observations: { type: Number, default: 0 },
    lagSamplesHours: { type: [Number], default: [] },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    strength: { type: Number, default: 0 },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    version: { type: String, required: true },
  },
  { timestamps: true }
);

// ✅ Indexes
patternEdgeSchema.index({ userId: 1, keyLookupHash: 1 }, { unique: true });
patternEdgeSchema.index({ userId: 1, strength: -1 });
patternEdgeSchema.index({ userId: 1, fromNodeId: 1 });
patternEdgeSchema.index({ userId: 1, lastSeenAt: -1 });

applyEncryptedSchemaPaths(patternEdgeEvidenceSchema, [{ path: "quote" }]);

applyEncryptedSchemaPaths(patternEdgeSchema, [
  { path: "key" },
  { path: "fromKey" },
  { path: "toKey" },
  { path: "rationale" },
]);

export const patternEdgeModel: Model<IPatternEdge> =
  connectMongoDB.model<IPatternEdge>("pattern_edges", patternEdgeSchema);
