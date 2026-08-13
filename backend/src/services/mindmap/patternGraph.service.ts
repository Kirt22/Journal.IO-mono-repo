import mongoose from "mongoose";
import {
  patternNodeModel,
  type IPatternNode,
} from "../../schema/patternNode.schema";
import {
  patternEdgeModel,
  type IPatternEdge,
} from "../../schema/patternEdge.schema";
import { entryInsightModel } from "../../schema/entryInsight.schema";
import { userMemoryModel } from "../../schema/userMemory.schema";
import {
  canUseOpenAiForUser,
  getOpenAiEmbeddingModel,
  getOpenAiModel,
  requestEmbeddings,
  requestStructuredOpenAi,
} from "../../helpers/openai.helpers";
import {
  computeLookupHash,
  decryptFieldValue,
  encryptFieldValue,
} from "../../helpers/fieldEncryption.helpers";
import { decryptLeanFields } from "../../helpers/fieldEncryption.schema.helpers";
import { AI_EXTRACTION_BALANCE_GUIDANCE } from "../../helpers/aiReflectionBalance.helpers";
import {
  PATTERN_GRAPH_VERSION,
  PATTERN_PRECEDES_MIN_OBSERVATIONS,
  PATTERN_PROMPT_MIN_CONFIDENCE,
  buildPatternEdgeKey,
  medianLagHours,
  computeEdgeStrength,
  computeNodeStrength,
  isClinicalPatternLabel,
  isValidUmbrellaLabel,
  patternGraphRefinementJsonSchema,
  patternGraphRefinementSchema,
  toPatternKey,
  toThemeId,
  type PatternEdgeSource,
  type PatternEdgeType,
  type PatternGraphRefinement,
  type PatternSourceKind,
} from "../../helpers/patternGraph.helpers";
import {
  normalizeReflectionMapText,
  type ReflectionRegionId,
} from "../../helpers/reflectionMap.helpers";

/**
 * The per-user pattern graph.
 *
 * `entry_insights` already extracts up to four behavioural themes per entry, but
 * nothing ever related one theme to another — the product could say "you
 * overeat, seen 9x" and never "the screen-heavy evenings and the overeating look
 * like the same loop". This service materializes those themes into nodes and
 * derives the edges between them.
 *
 * Three derivation tiers, cheapest and most trustworthy first:
 *   1. co-occurrence — deterministic, two patterns in the same entry
 *   2. temporal      — deterministic, one pattern tends to precede another
 *   3. AI-inferred   — a model names the mechanism (see refinePatternGraph)
 *
 * Everything here is best-effort and fire-and-forget from the entry pipeline: a
 * journal entry must save even if the whole graph fails.
 */

const NODE_EVIDENCE_MAX = 3;
const EDGE_EVIDENCE_MAX = 2;
const LAG_SAMPLES_MAX = 8;

/**
 * Deliberately stricter than the 0.84 used for goal-suggestion dedupe: a false
 * goal dupe drops one suggestion, whereas a false node merge silently corrupts
 * the graph for good.
 */
const NODE_MERGE_SIMILARITY = 0.9;

/**
 * A chat turn is less considered than a written entry, so a pattern mined from
 * Ask Jade must never outrank one the user actually journaled about.
 */
export const CHAT_CONFIDENCE_FACTOR = 0.8;

/** How many prior patterns a new one can be linked back to per entry. */
const TEMPORAL_ANTECEDENT_LIMIT = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const TEMPORAL_WINDOW_DAYS = () => {
  const raw = Number(process.env.PATTERN_GRAPH_TEMPORAL_WINDOW_DAYS);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 7;
};

const MAX_NODES = () => {
  const raw = Number(process.env.PATTERN_GRAPH_MAX_NODES);
  return Number.isFinite(raw) && raw >= 20 ? Math.floor(raw) : 240;
};

const MAX_EDGES = () => {
  const raw = Number(process.env.PATTERN_GRAPH_MAX_EDGES);
  return Number.isFinite(raw) && raw >= 50 ? Math.floor(raw) : 600;
};

const DORMANT_AFTER_DAYS = 90;
const DELETE_DORMANT_AFTER_DAYS = 180;
const DELETE_WEAK_EDGE_AFTER_DAYS = 60;

const PATTERN_GRAPH_MODEL = () =>
  process.env.OPENAI_PATTERN_GRAPH_MODEL?.trim() || getOpenAiModel();

/**
 * Refine once this many new entries have accumulated. Default 5 rather than the
 * rolling memory's 1 — this call carries the whole graph, so it is the more
 * expensive of the two.
 */
const REFINE_EVERY = () => {
  const raw = Number(process.env.PATTERN_GRAPH_REFINE_EVERY);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 5;
};

/** How many of the strongest patterns the model is allowed to reason over. */
const REFINE_NODE_LIMIT = 18;
const REFINE_PAIR_LIMIT = 20;
const MAX_UMBRELLAS = 6;
const UMBRELLA_MIN_CONFIDENCE = 0.6;
const UMBRELLA_MIN_MEMBERS = 2;
const UMBRELLA_MEMBER_MIN_OCCURRENCES = 2;

export type PatternObservation = {
  label: string;
  rationale: string;
  evidenceQuote: string;
  confidence: number;
  regionId: ReflectionRegionId | null;
  sourceKind: PatternSourceKind;
  journalId: string | null;
  sessionId: string | null;
  observedAt: Date;
};

type PatternGraphEntryInsight = {
  themes: Array<{
    label: string;
    rationale: string;
    evidenceQuote: string;
    confidence: number;
  }>;
  dominantRegionId: ReflectionRegionId | null;
  entryCreatedAt: Date | string | number | null;
  clear: boolean;
};

export const decryptPatternGraphEntryInsight = (
  rawInsight: Record<string, unknown>
): PatternGraphEntryInsight => {
  const insight = decryptLeanFields(rawInsight, [
    { encryptedPath: "themes" },
  ]) as Record<string, unknown>;
  const entryCreatedAt = insight.entryCreatedAt;

  return {
    themes: Array.isArray(insight.themes)
      ? (insight.themes as PatternGraphEntryInsight["themes"])
      : [],
    dominantRegionId:
      typeof insight.dominantRegionId === "string"
        ? (insight.dominantRegionId as ReflectionRegionId)
        : null,
    entryCreatedAt:
      entryCreatedAt instanceof Date ||
      typeof entryCreatedAt === "string" ||
      typeof entryCreatedAt === "number"
        ? entryCreatedAt
        : null,
    clear: insight.clear === true,
  };
};

const toObjectId = (value: string | null): mongoose.Types.ObjectId | null => {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }
  return new mongoose.Types.ObjectId(value);
};

const clampConfidence = (value: number, fallback = 0.5): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, Number(value.toFixed(2))));
};

const cosineSimilarity = (a: number[], b: number[]): number => {
  const length = Math.min(a.length, b.length);
  if (!length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const isDuplicateKeyError = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === "object" &&
      (error as { code?: number }).code === 11000
  );

const buildPatternNodeLookupHash = (
  userId: string,
  value: string,
  path: "pattern_nodes.key" | "pattern_nodes.canonicalKey"
) =>
  computeLookupHash({
    value,
    path,
    scope: userId,
  });

const buildPatternEdgeLookupHash = (
  userId: string,
  value: string,
  path: "pattern_edges.key" | "pattern_edges.fromKey" | "pattern_edges.toKey"
) =>
  computeLookupHash({
    value,
    path,
    scope: userId,
  });

const readPatternNodeEmbedding = (node: Record<string, unknown>): number[] => {
  const encryptedEmbedding = decryptFieldValue<number[]>(
    node.embeddingCiphertext,
    { path: "pattern_nodes.embedding" }
  );

  if (Array.isArray(encryptedEmbedding) && encryptedEmbedding.length > 0) {
    return encryptedEmbedding;
  }

  return Array.isArray(node.embedding)
    ? node.embedding.filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value)
      )
    : [];
};

/**
 * Normalize a raw theme into a graph observation, dropping anything that names a
 * condition rather than a behaviour. Returns null when the observation should
 * not enter the graph at all.
 */
export const toPatternObservation = (input: {
  label: string;
  rationale: string;
  evidenceQuote: string;
  confidence: number;
  regionId: ReflectionRegionId | null;
  sourceKind: PatternSourceKind;
  journalId: string | null;
  sessionId: string | null;
  observedAt: Date;
}): PatternObservation | null => {
  const label = normalizeReflectionMapText(input.label, 64);
  if (!label || isClinicalPatternLabel(label)) {
    return null;
  }

  const confidence = clampConfidence(input.confidence);

  return {
    label,
    rationale: normalizeReflectionMapText(input.rationale, 220),
    evidenceQuote: normalizeReflectionMapText(input.evidenceQuote, 180),
    confidence:
      input.sourceKind === "chat"
        ? clampConfidence(confidence * CHAT_CONFIDENCE_FACTOR)
        : confidence,
    regionId: input.regionId,
    sourceKind: input.sourceKind,
    journalId: input.journalId,
    sessionId: input.sessionId,
    observedAt: input.observedAt,
  };
};

/**
 * Resolve which node an observation belongs to, cheapest lookup first:
 *   1. exact slug (`toThemeId`)                       — indexed, O(1)
 *   2. alias hit (a slug previously merged in)        — indexed, O(1)
 *   3. phrasing-independent key (`toPatternKey`)      — indexed, O(1)
 *   4. embedding near-duplicate                       — bounded by node count
 *
 * Stages 1-3 are free. Stage 4 costs one embedding and is what stops "avoids
 * conflict" and "shuts down when things get tense" living as separate nodes.
 */
const findExistingNode = async ({
  userId,
  key,
  canonicalKey,
}: {
  userId: string;
  key: string;
  canonicalKey: string;
}): Promise<IPatternNode | null> => {
  const keyLookupHash = buildPatternNodeLookupHash(
    userId,
    key,
    "pattern_nodes.key"
  );
  const canonicalKeyLookupHash = buildPatternNodeLookupHash(
    userId,
    canonicalKey,
    "pattern_nodes.canonicalKey"
  );
  const exact = await patternNodeModel
    .findOne({ userId, keyLookupHash, status: { $ne: "merged" } })
    .exec();
  if (exact) {
    return exact;
  }

  const byAlias = await patternNodeModel
    .findOne({ userId, aliases: key, status: { $ne: "merged" } })
    .exec();
  if (byAlias) {
    return byAlias;
  }

  return patternNodeModel
    .findOne({ userId, canonicalKeyLookupHash, status: { $ne: "merged" } })
    .exec();
};

const applyObservationToNode = (
  node: IPatternNode,
  observation: PatternObservation,
  key: string,
  userId: string
): IPatternNode => {
  node.occurrences += 1;
  node.lastSeenAt =
    observation.observedAt > node.lastSeenAt
      ? observation.observedAt
      : node.lastSeenAt;
  node.firstSeenAt =
    observation.observedAt < node.firstSeenAt
      ? observation.observedAt
      : node.firstSeenAt;

  if (!node.aliases.includes(key)) {
    node.aliases = [...node.aliases, key];
  }
  if (!node.aliasLabels.includes(observation.label)) {
    node.aliasLabels = [...node.aliasLabels, observation.label].slice(0, 6);
  }
  if (!node.sourceKinds.includes(observation.sourceKind)) {
    node.sourceKinds = [...node.sourceKinds, observation.sourceKind];
  }

  // Keep the highest-confidence phrasing as the representative one — the same
  // rule aggregateRecurringPatterns already uses for recurring themes.
  if (observation.confidence > node.confidence) {
    node.label = observation.label;
    node.rationale = observation.rationale;
    if (observation.evidenceQuote) {
      node.evidenceQuote = observation.evidenceQuote;
    }
  }
  node.confidence = clampConfidence((node.confidence + observation.confidence) / 2);

  if (observation.evidenceQuote) {
    node.evidence = [
      {
        journalId: toObjectId(observation.journalId),
        sessionId: toObjectId(observation.sessionId),
        quote: observation.evidenceQuote,
        observedAt: observation.observedAt,
      },
      ...node.evidence,
    ].slice(0, NODE_EVIDENCE_MAX);
  }

  node.strength = computeNodeStrength({
    occurrences: node.occurrences,
    confidence: node.confidence,
    lastSeenAt: node.lastSeenAt,
  });
  node.keyLookupHash = buildPatternNodeLookupHash(
    userId,
    node.key,
    "pattern_nodes.key"
  );
  node.canonicalKeyLookupHash = buildPatternNodeLookupHash(
    userId,
    node.canonicalKey,
    "pattern_nodes.canonicalKey"
  );
  node.version = PATTERN_GRAPH_VERSION;

  return node;
};

const createNode = async ({
  userId,
  observation,
  key,
  canonicalKey,
  embedding,
}: {
  userId: string;
  observation: PatternObservation;
  key: string;
  canonicalKey: string;
  embedding: number[] | null;
}): Promise<IPatternNode | null> => {
  const evidence = observation.evidenceQuote
    ? [
        {
          journalId: toObjectId(observation.journalId),
          sessionId: toObjectId(observation.sessionId),
          quote: observation.evidenceQuote,
          observedAt: observation.observedAt,
        },
      ]
    : [];

  try {
    return await patternNodeModel.create({
      userId,
      key,
      keyLookupHash: buildPatternNodeLookupHash(
        userId,
        key,
        "pattern_nodes.key"
      ),
      canonicalKey,
      canonicalKeyLookupHash: buildPatternNodeLookupHash(
        userId,
        canonicalKey,
        "pattern_nodes.canonicalKey"
      ),
      kind: "pattern",
      label: observation.label,
      aliases: [key],
      aliasLabels: [observation.label],
      rationale: observation.rationale,
      evidenceQuote: observation.evidenceQuote,
      evidence,
      regionId: observation.regionId,
      sourceKinds: [observation.sourceKind],
      occurrences: 1,
      confidence: observation.confidence,
      strength: computeNodeStrength({
        occurrences: 1,
        confidence: observation.confidence,
        lastSeenAt: observation.observedAt,
      }),
      parentNodeId: null,
      firstSeenAt: observation.observedAt,
      lastSeenAt: observation.observedAt,
      embeddingCiphertext: embedding
        ? (encryptFieldValue(embedding, {
            path: "pattern_nodes.embedding",
          }) as string)
        : null,
      hasEmbedding: Boolean(embedding?.length),
      embeddingModel: embedding ? getOpenAiEmbeddingModel() : null,
      status: "active",
      mergedIntoNodeId: null,
      version: PATTERN_GRAPH_VERSION,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      // A concurrent write won the race for this key — fold into that node.
      return patternNodeModel
        .findOne({
          userId,
          keyLookupHash: buildPatternNodeLookupHash(
            userId,
            key,
            "pattern_nodes.key"
          ),
        })
        .exec();
    }
    throw error;
  }
};

/**
 * Fold a batch of observations into the user's nodes, returning the resolved
 * node documents in observation order. Stage-4 embeddings are computed once for
 * the whole batch rather than per observation.
 */
export const upsertPatternObservations = async ({
  userId,
  observations,
}: {
  userId: string;
  observations: PatternObservation[];
}): Promise<IPatternNode[]> => {
  if (!observations.length) {
    return [];
  }

  const resolved: (IPatternNode | null)[] = [];
  const misses: { index: number; observation: PatternObservation; key: string; canonicalKey: string }[] =
    [];

  for (const [index, observation] of observations.entries()) {
    const key = toThemeId(observation.label);
    const canonicalKey = toPatternKey(observation.label);
    const existing = await findExistingNode({ userId, key, canonicalKey });

    if (existing) {
      resolved[index] = await applyObservationToNode(
        existing,
        observation,
        key,
        userId
      ).save();
      continue;
    }

    resolved[index] = null;
    misses.push({ index, observation, key, canonicalKey });
  }

  if (!misses.length) {
    return resolved.filter((node): node is IPatternNode => Boolean(node));
  }

  // Stage 4 — only worth the embedding call when cheaper lookups all missed.
  let embeddings: number[][] | null = null;
  if (await canUseOpenAiForUser(userId)) {
    embeddings = await requestEmbeddings(
      misses.map(miss => `${miss.observation.label}. ${miss.observation.rationale}`.trim())
    );
  }

  const candidates: IPatternNode[] = embeddings
    ? await patternNodeModel
        .find({ userId, status: "active", hasEmbedding: true })
        .limit(MAX_NODES())
        .exec()
    : [];

  for (const [missIndex, miss] of misses.entries()) {
    const embedding = embeddings?.[missIndex] || null;

    let nearest: IPatternNode | null = null;
    let nearestScore = 0;
    if (embedding) {
      for (const candidate of candidates) {
        const candidateEmbedding = readPatternNodeEmbedding(
          candidate as unknown as Record<string, unknown>
        );
        const score = cosineSimilarity(embedding, candidateEmbedding || []);
        if (score > nearestScore) {
          nearestScore = score;
          nearest = candidate;
        }
      }
    }

    if (nearest && nearestScore >= NODE_MERGE_SIMILARITY) {
      resolved[miss.index] = await applyObservationToNode(
        nearest,
        miss.observation,
        miss.key,
        userId
      ).save();
      continue;
    }

    const created = await createNode({
      userId,
      observation: miss.observation,
      key: miss.key,
      canonicalKey: miss.canonicalKey,
      embedding,
    });
    resolved[miss.index] = created;
    if (created && embedding) {
      candidates.push(created);
    }
  }

  return resolved.filter((node): node is IPatternNode => Boolean(node));
};

/**
 * Record one observation of an edge, creating it or strengthening it. Handles
 * the duplicate-key race two concurrent background writes can produce.
 */
export const upsertPatternEdge = async ({
  userId,
  type,
  source,
  fromNode,
  toNode,
  rationale,
  confidence,
  observedAt,
  journalId,
  evidenceQuote,
  lagHours,
}: {
  userId: string;
  type: PatternEdgeType;
  source: PatternEdgeSource;
  fromNode: IPatternNode;
  toNode: IPatternNode;
  rationale: string;
  confidence: number;
  observedAt: Date;
  journalId: string | null;
  evidenceQuote: string | null;
  lagHours: number | null;
}): Promise<void> => {
  if (fromNode._id.equals(toNode._id)) {
    return;
  }

  const oriented = buildPatternEdgeKey(type, fromNode.key, toNode.key);
  // Undirected keys sort their endpoints, so make the stored node ids agree
  // with the stored keys.
  const startsAtFrom = oriented.fromKey === fromNode.key;
  const fromNodeId = startsAtFrom ? fromNode._id : toNode._id;
  const toNodeId = startsAtFrom ? toNode._id : fromNode._id;

  const safeConfidence = clampConfidence(confidence);
  const evidence = evidenceQuote
    ? [
        {
          journalId: toObjectId(journalId),
          quote: normalizeReflectionMapText(evidenceQuote, 180),
          observedAt,
        },
      ]
    : [];

  const apply = async (): Promise<void> => {
    const keyLookupHash = buildPatternEdgeLookupHash(
      userId,
      oriented.key,
      "pattern_edges.key"
    );
    const existing = await patternEdgeModel
      .findOne({ userId, keyLookupHash })
      .exec();

    if (!existing) {
      await patternEdgeModel.create({
        userId,
        key: oriented.key,
        keyLookupHash,
        fromNodeId,
        toNodeId,
        fromKey: oriented.fromKey,
        fromKeyLookupHash: buildPatternEdgeLookupHash(
          userId,
          oriented.fromKey,
          "pattern_edges.fromKey"
        ),
        toKey: oriented.toKey,
        toKeyLookupHash: buildPatternEdgeLookupHash(
          userId,
          oriented.toKey,
          "pattern_edges.toKey"
        ),
        type,
        directed: oriented.directed,
        source,
        rationale: normalizeReflectionMapText(rationale, 220),
        evidence,
        observations: 1,
        lagSamplesHours:
          lagHours !== null && Number.isFinite(lagHours) ? [Number(lagHours.toFixed(1))] : [],
        confidence: safeConfidence,
        strength: computeEdgeStrength({
          observations: 1,
          confidence: safeConfidence,
          lastSeenAt: observedAt,
        }),
        firstSeenAt: observedAt,
        lastSeenAt: observedAt,
        version: PATTERN_GRAPH_VERSION,
      });
      return;
    }

    existing.observations += 1;
    existing.confidence = clampConfidence((existing.confidence + safeConfidence) / 2);
    existing.lastSeenAt =
      observedAt > existing.lastSeenAt ? observedAt : existing.lastSeenAt;

    // A named mechanism always outranks a bare co-occurrence count.
    if (source === "ai_inferred" || !existing.rationale) {
      existing.source = source === "ai_inferred" ? "ai_inferred" : existing.source;
      if (rationale) {
        existing.rationale = normalizeReflectionMapText(rationale, 220);
      }
    }

    if (evidence.length) {
      existing.evidence = [...evidence, ...existing.evidence].slice(0, EDGE_EVIDENCE_MAX);
    }
    if (lagHours !== null && Number.isFinite(lagHours)) {
      existing.lagSamplesHours = [
        Number(lagHours.toFixed(1)),
        ...existing.lagSamplesHours,
      ].slice(0, LAG_SAMPLES_MAX);
    }

    existing.strength = computeEdgeStrength({
      observations: existing.observations,
      confidence: existing.confidence,
      lastSeenAt: existing.lastSeenAt,
    });
    existing.keyLookupHash = keyLookupHash;
    existing.fromKeyLookupHash = buildPatternEdgeLookupHash(
      userId,
      existing.fromKey,
      "pattern_edges.fromKey"
    );
    existing.toKeyLookupHash = buildPatternEdgeLookupHash(
      userId,
      existing.toKey,
      "pattern_edges.toKey"
    );
    existing.version = PATTERN_GRAPH_VERSION;
    await existing.save();
  };

  try {
    await apply();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      // Lost the insert race; the row now exists, so re-apply as an update.
      await apply();
      return;
    }
    throw error;
  }
};

/**
 * Every unordered pair in a set of patterns seen together. Pure and separate
 * from the writes so the pairing itself stays trivially testable.
 */
export const buildCoOccurrencePairs = <T>(nodes: T[]): [T, T][] => {
  const pairs: [T, T][] = [];

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const left = nodes[i];
      const right = nodes[j];
      if (left === undefined || right === undefined) {
        continue;
      }
      pairs.push([left, right]);
    }
  }

  return pairs;
};

/**
 * Tier 1 — every pair of patterns seen in the same entry co-occurs. Purely
 * deterministic, and the primitive the app was missing: themes were already
 * grouped per entry, they were just never paired.
 */
const deriveCoOccurrenceEdges = async ({
  userId,
  nodes,
  observedAt,
  journalId,
}: {
  userId: string;
  nodes: IPatternNode[];
  observedAt: Date;
  journalId: string | null;
}): Promise<void> => {
  for (const [left, right] of buildCoOccurrencePairs(nodes)) {
    await upsertPatternEdge({
      userId,
      type: "co_occurs",
      source: "co_occurrence",
      fromNode: left,
      toNode: right,
      rationale: "",
      confidence: Math.min(left.confidence, right.confidence),
      observedAt,
      journalId,
      evidenceQuote: null,
      lagHours: null,
    });
  }
};

/**
 * Tier 2 — patterns that were live in the days before this entry are recorded as
 * preceding the ones in it. Still deterministic; the ordering is a fact, the
 * meaning of the ordering is not, which is why a `precedes` edge needs
 * PATTERN_PRECEDES_MIN_OBSERVATIONS before it is allowed near a prompt.
 */
const deriveTemporalEdges = async ({
  userId,
  nodes,
  observedAt,
  journalId,
}: {
  userId: string;
  nodes: IPatternNode[];
  observedAt: Date;
  journalId: string | null;
}): Promise<void> => {
  if (!nodes.length) {
    return;
  }

  const windowStart = new Date(observedAt.getTime() - TEMPORAL_WINDOW_DAYS() * DAY_MS);
  const currentIds = new Set(nodes.map(node => node._id.toString()));

  const antecedents = await patternNodeModel
    .find({
      userId,
      status: "active",
      kind: "pattern",
      lastSeenAt: { $gte: windowStart, $lt: observedAt },
      _id: { $nin: nodes.map(node => node._id) },
    })
    .sort({ strength: -1 })
    .limit(TEMPORAL_ANTECEDENT_LIMIT)
    .exec();

  for (const antecedent of antecedents) {
    if (currentIds.has(antecedent._id.toString())) {
      continue;
    }

    const lagHours = (observedAt.getTime() - antecedent.lastSeenAt.getTime()) / HOUR_MS;

    for (const node of nodes) {
      await upsertPatternEdge({
        userId,
        type: "precedes",
        source: "temporal",
        fromNode: antecedent,
        toNode: node,
        rationale: "",
        confidence: Math.min(antecedent.confidence, node.confidence),
        observedAt,
        journalId,
        evidenceQuote: null,
        lagHours,
      });
    }
  }
};

/**
 * Keep the graph from drifting into noise as it grows. A pattern seen once and
 * not again in months is not a pattern; it goes dormant (excluded from reads)
 * rather than being deleted, so a re-emergence can still find it.
 */
export const prunePatternGraph = async (userId: string): Promise<void> => {
  const now = Date.now();
  const dormantBefore = new Date(now - DORMANT_AFTER_DAYS * DAY_MS);
  const deleteBefore = new Date(now - DELETE_DORMANT_AFTER_DAYS * DAY_MS);
  const weakEdgeBefore = new Date(now - DELETE_WEAK_EDGE_AFTER_DAYS * DAY_MS);

  await patternNodeModel
    .updateMany(
      {
        userId,
        status: "active",
        kind: "pattern",
        occurrences: { $lte: 1 },
        lastSeenAt: { $lt: dormantBefore },
      },
      { $set: { status: "dormant" } }
    )
    .exec();

  await patternNodeModel
    .deleteMany({
      userId,
      status: "dormant",
      occurrences: { $lte: 1 },
      lastSeenAt: { $lt: deleteBefore },
    })
    .exec();

  await patternEdgeModel
    .deleteMany({
      userId,
      source: { $ne: "ai_inferred" },
      observations: { $lte: 1 },
      lastSeenAt: { $lt: weakEdgeBefore },
    })
    .exec();

  // An inferred edge that never gets reconfirmed should not ride along in
  // prompts forever.
  await patternEdgeModel
    .deleteMany({
      userId,
      source: "ai_inferred",
      lastSeenAt: { $lt: deleteBefore },
    })
    .exec();

  const edgeCount = await patternEdgeModel.countDocuments({ userId }).exec();
  const edgeCeiling = MAX_EDGES();
  if (edgeCount > edgeCeiling) {
    const surplus = await patternEdgeModel
      .find({ userId })
      .sort({ strength: 1, lastSeenAt: 1 })
      .limit(edgeCount - edgeCeiling)
      .select("_id")
      .lean()
      .exec();
    await patternEdgeModel
      .deleteMany({ _id: { $in: surplus.map(row => row._id) } })
      .exec();
  }
};

/** Flag the graph for a full replay on the next refinement pass. */
export const requestPatternGraphRebuild = async (userId: string): Promise<void> => {
  await userMemoryModel
    .updateOne(
      { userId },
      { $set: { graphRebuildRequestedAt: new Date() } },
      { upsert: false }
    )
    .exec();
};

/**
 * Drop evidence that cited a deleted journal entry and mark the graph for
 * rebuild. Node counts stay as they are until the replay, so a deletion never
 * leaves a dangling quote the user can no longer see the source of.
 */
export const removeJournalFromPatternGraph = async ({
  userId,
  journalId,
}: {
  userId: string;
  journalId: string;
}): Promise<void> => {
  const objectId = toObjectId(journalId);
  if (!objectId) {
    return;
  }

  try {
    await Promise.all([
      patternNodeModel
        .updateMany({ userId }, { $pull: { evidence: { journalId: objectId } } })
        .exec(),
      patternEdgeModel
        .updateMany({ userId }, { $pull: { evidence: { journalId: objectId } } })
        .exec(),
    ]);
    await requestPatternGraphRebuild(userId);
  } catch (error) {
    console.error("Failed to remove journal from pattern graph:", error);
  }
};

export type RefinementNodeView = {
  key: string;
  label: string;
  rationale: string;
  occurrences: number;
  evidenceQuotes: string[];
};

export type SanitizedRefinement = {
  edges: {
    fromKey: string;
    toKey: string;
    type: PatternEdgeType;
    rationale: string;
    evidenceQuote: string;
    confidence: number;
  }[];
  umbrellas: {
    label: string;
    rationale: string;
    memberKeys: string[];
    confidence: number;
  }[];
};

/**
 * Validate a model refinement before any of it is written. Pure, so the rules
 * that actually protect the graph are testable without a database.
 *
 * The model is only ever allowed to *relate* and *group* patterns we already
 * hold. Rejecting endpoints it invented is the single most important guard
 * here: without it a hallucinated pattern would enter the graph as fact and
 * then ride along in every future prompt.
 */
export const sanitizePatternGraphRefinement = ({
  refinement,
  nodes,
}: {
  refinement: PatternGraphRefinement;
  nodes: RefinementNodeView[];
}): SanitizedRefinement => {
  const byKey = new Map(nodes.map(node => [node.key, node]));

  const edges = refinement.edges
    .filter(edge => byKey.has(edge.fromKey) && byKey.has(edge.toKey))
    .filter(edge => edge.fromKey !== edge.toKey)
    .map(edge => {
      // Evidence must be the user's own sentence, already stored on one of the
      // endpoints — the model never gets to author a quote.
      const endpointQuotes = [
        ...(byKey.get(edge.fromKey)?.evidenceQuotes || []),
        ...(byKey.get(edge.toKey)?.evidenceQuotes || []),
      ];
      const quote = normalizeReflectionMapText(edge.evidenceQuote, 180);
      const isGrounded =
        Boolean(quote) && endpointQuotes.some(stored => stored.includes(quote));

      return {
        fromKey: edge.fromKey,
        toKey: edge.toKey,
        type: edge.type,
        rationale: normalizeReflectionMapText(edge.rationale, 220),
        evidenceQuote: isGrounded ? quote : "",
        confidence: clampConfidence(edge.confidence),
      };
    })
    .filter(edge => Boolean(edge.rationale));

  const umbrellas = refinement.umbrellas
    .filter(umbrella => isValidUmbrellaLabel(umbrella.label))
    .filter(umbrella => umbrella.confidence >= UMBRELLA_MIN_CONFIDENCE)
    .map(umbrella => ({
      label: normalizeReflectionMapText(umbrella.label, 48),
      rationale: normalizeReflectionMapText(umbrella.rationale, 220),
      // A cluster can only group patterns that are actually established.
      memberKeys: [...new Set(umbrella.memberKeys)].filter(key => {
        const node = byKey.get(key);
        return Boolean(node && node.occurrences >= UMBRELLA_MEMBER_MIN_OCCURRENCES);
      }),
      confidence: clampConfidence(umbrella.confidence),
    }))
    .filter(umbrella => umbrella.memberKeys.length >= UMBRELLA_MIN_MEMBERS)
    .slice(0, MAX_UMBRELLAS);

  return { edges, umbrellas };
};

const REFINE_SYSTEM_PROMPT = [
  "You are reading a private map of one person's behavioural patterns, drawn only from their own journal entries.",
  "Your job is to relate patterns that already exist in the map and, where it is clearly warranted, group a few of them into a cluster. You never invent a new pattern.",
  "Only use the exact pattern keys given to you. If a connection you can see involves something not in the list, leave it out.",
  AI_EXTRACTION_BALANCE_GUIDANCE,
  "For each connection, name the mechanism in plain behavioural language — what one thing does to the other, in this person's own terms (e.g. 'attention is on the screen, so the signal that they are full lands late').",
  "Write every rationale as an observation held lightly, never a causal fact and never a rule about who they are.",
  "A cluster label must describe what the person DOES, as a short phrase — 'bracing for things going wrong', 'soothing tension with screens'. Never name a feeling, a condition, a diagnosis, or a personality trait. Never output words like anxiety, depression, ADHD, addiction, disorder, or any Big Five trait name; if the obvious label for a cluster is one of those, describe the behaviour instead.",
  "Only propose a cluster when two or more patterns genuinely belong to the same behavioural loop. It is correct and expected to return no clusters.",
  "evidenceQuote must be copied verbatim from the evidence you were given, or left as an empty string. Never write a quote yourself.",
].join(" ");

/**
 * Tier 3 — the one AI pass over the graph. Names the mechanism behind pairs the
 * deterministic tiers only counted, and proposes umbrella clusters ("god
 * nodes"). Premium-gated, throttled, and best-effort: on any failure the graph
 * simply keeps its deterministic edges.
 */
export const refinePatternGraph = async (userId: string): Promise<void> => {
  try {
    if (!(await canUseOpenAiForUser(userId))) {
      return;
    }

    const memory = await userMemoryModel
      .findOne({ userId })
      .select("graphRefinedThrough graphRebuildRequestedAt")
      .lean()
      .exec();

    const refinedThrough = memory?.graphRefinedThrough
      ? new Date(memory.graphRefinedThrough)
      : null;
    const rebuildRequested = Boolean(memory?.graphRebuildRequestedAt);

    if (refinedThrough && !rebuildRequested) {
      const freshCount = await entryInsightModel
        .countDocuments({ userId, clear: true, entryCreatedAt: { $gt: refinedThrough } })
        .exec();
      if (freshCount < REFINE_EVERY()) {
        return;
      }
    }

    const nodes = await patternNodeModel
      .find({ userId, status: "active", kind: "pattern" })
      .sort({ strength: -1 })
      .limit(REFINE_NODE_LIMIT)
      .exec();

    if (nodes.length < 3) {
      return;
    }

    const nodeViews: RefinementNodeView[] = nodes.map(node => ({
      key: node.key,
      label: node.label,
      rationale: node.rationale,
      occurrences: node.occurrences,
      evidenceQuotes: [
        node.evidenceQuote,
        ...node.evidence.map(item => item.quote),
      ].filter(Boolean),
    }));

    const nodeKeys = new Set(nodeViews.map(view => view.key));
    const candidateEdges = await patternEdgeModel
      .find({
        userId,
        source: { $ne: "ai_inferred" },
        observations: { $gte: 2 },
      })
      .sort({ strength: -1 })
      .limit(REFINE_PAIR_LIMIT)
      .lean()
      .exec();

    const candidatePairs = candidateEdges
      .filter(edge => nodeKeys.has(edge.fromKey) && nodeKeys.has(edge.toKey))
      .map(edge => ({
        fromKey: edge.fromKey,
        toKey: edge.toKey,
        seenTogether: edge.observations,
        relation: edge.type,
      }));

    const aiResponse = await requestStructuredOpenAi({
      feature: "pattern graph refinement",
      schemaName: "pattern_graph_refinement",
      schema: patternGraphRefinementJsonSchema,
      parser: patternGraphRefinementSchema,
      model: PATTERN_GRAPH_MODEL(),
      maxOutputTokens: 800,
      reasoningEffort: "low",
      messages: [
        { role: "system", content: REFINE_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            task: "Relate and group these existing patterns.",
            patterns: nodeViews.map(view => ({
              key: view.key,
              label: view.label,
              whyNoticed: view.rationale,
              timesSeen: view.occurrences,
              theirWords: view.evidenceQuotes.slice(0, 2),
            })),
            pairsAlreadySeenTogether: candidatePairs,
          }),
        },
      ],
    });

    if (!aiResponse) {
      return;
    }

    const sanitized = sanitizePatternGraphRefinement({
      refinement: aiResponse,
      nodes: nodeViews,
    });

    await applyPatternGraphRefinement({ userId, nodes, sanitized });

    const newestInsight = await entryInsightModel
      .findOne({ userId, clear: true })
      .sort({ entryCreatedAt: -1 })
      .select("entryCreatedAt")
      .lean()
      .exec();

    await userMemoryModel
      .updateOne(
        { userId },
        {
          $set: {
            graphRefinedThrough: newestInsight?.entryCreatedAt
              ? new Date(newestInsight.entryCreatedAt)
              : new Date(),
            graphVersion: PATTERN_GRAPH_VERSION,
            graphRebuildRequestedAt: null,
          },
          $inc: { graphRefinedCount: 1 },
        },
        { upsert: false }
      )
      .exec();
  } catch (error) {
    console.error("Failed to refine pattern graph:", error);
  }
};

/**
 * Write a validated refinement. Umbrellas are treated as fully derived from the
 * latest pass — any that no longer hold are removed and their members released,
 * so a stale cluster can never linger in prompts.
 */
const applyPatternGraphRefinement = async ({
  userId,
  nodes,
  sanitized,
}: {
  userId: string;
  nodes: IPatternNode[];
  sanitized: SanitizedRefinement;
}): Promise<void> => {
  const byKey = new Map(nodes.map(node => [node.key, node]));
  const now = new Date();

  for (const edge of sanitized.edges) {
    const fromNode = byKey.get(edge.fromKey);
    const toNode = byKey.get(edge.toKey);
    if (!fromNode || !toNode) {
      continue;
    }

    await upsertPatternEdge({
      userId,
      type: edge.type,
      source: "ai_inferred",
      fromNode,
      toNode,
      rationale: edge.rationale,
      confidence: edge.confidence,
      observedAt: now,
      journalId: null,
      evidenceQuote: edge.evidenceQuote || null,
      lagHours: null,
    });
  }

  const keptUmbrellaKeys: string[] = [];

  for (const umbrella of sanitized.umbrellas) {
    const key = toThemeId(umbrella.label);
    keptUmbrellaKeys.push(key);

    const members = umbrella.memberKeys
      .map(memberKey => byKey.get(memberKey))
      .filter((node): node is IPatternNode => Boolean(node));

    if (members.length < UMBRELLA_MIN_MEMBERS) {
      continue;
    }

    const occurrences = members.reduce((total, member) => total + member.occurrences, 0);
    const lastSeenAt = members.reduce(
      (latest, member) => (member.lastSeenAt > latest ? member.lastSeenAt : latest),
      members[0]!.lastSeenAt
    );
    const canonicalKey = toPatternKey(umbrella.label);

    await patternNodeModel
      .updateOne(
        {
          userId,
          keyLookupHash: buildPatternNodeLookupHash(
            userId,
            key,
            "pattern_nodes.key"
          ),
        },
        {
          $set: {
            userId,
            key: encryptFieldValue(key, { path: "key" }),
            keyLookupHash: buildPatternNodeLookupHash(
              userId,
              key,
              "pattern_nodes.key"
            ),
            canonicalKey: encryptFieldValue(canonicalKey, {
              path: "canonicalKey",
            }),
            canonicalKeyLookupHash: buildPatternNodeLookupHash(
              userId,
              canonicalKey,
              "pattern_nodes.canonicalKey"
            ),
            kind: "umbrella",
            label: encryptFieldValue(umbrella.label, { path: "label" }),
            rationale: encryptFieldValue(umbrella.rationale, {
              path: "rationale",
            }),
            occurrences,
            confidence: umbrella.confidence,
            strength: computeNodeStrength({
              occurrences,
              confidence: umbrella.confidence,
              lastSeenAt,
            }),
            lastSeenAt,
            status: "active",
            version: PATTERN_GRAPH_VERSION,
          },
          $setOnInsert: {
            aliases: encryptFieldValue([key], { path: "aliases" }),
            aliasLabels: encryptFieldValue([umbrella.label], {
              path: "aliasLabels",
            }),
            evidenceQuote: encryptFieldValue("", { path: "evidenceQuote" }),
            evidence: [],
            regionId: null,
            sourceKinds: ["journal"],
            parentNodeId: null,
            firstSeenAt: lastSeenAt,
            keyLookupHash: buildPatternNodeLookupHash(
              userId,
              key,
              "pattern_nodes.key"
            ),
            canonicalKeyLookupHash: buildPatternNodeLookupHash(
              userId,
              canonicalKey,
              "pattern_nodes.canonicalKey"
            ),
            embeddingCiphertext: null,
            hasEmbedding: false,
            embeddingModel: null,
            mergedIntoNodeId: null,
          },
        },
        { upsert: true }
      )
      .exec();

    const umbrellaNode = await patternNodeModel
      .findOne({
        userId,
        keyLookupHash: buildPatternNodeLookupHash(
          userId,
          key,
          "pattern_nodes.key"
        ),
      })
      .select("_id")
      .lean()
      .exec();

    if (umbrellaNode) {
      await patternNodeModel
        .updateMany(
          { userId, _id: { $in: members.map(member => member._id) } },
          { $set: { parentNodeId: umbrellaNode._id } }
        )
        .exec();
    }
  }

  const staleUmbrellas = await patternNodeModel
    .find({
      userId,
      kind: "umbrella",
      keyLookupHash: {
        $nin: keptUmbrellaKeys.map((key) =>
          buildPatternNodeLookupHash(userId, key, "pattern_nodes.key")
        ),
      },
    })
      .select("_id")
      .lean()
      .exec();

  if (staleUmbrellas.length) {
    const staleIds = staleUmbrellas.map(row => row._id);
    await patternNodeModel
      .updateMany({ userId, parentNodeId: { $in: staleIds } }, { $set: { parentNodeId: null } })
      .exec();
    await patternNodeModel.deleteMany({ _id: { $in: staleIds } }).exec();
  }
};

/**
 * Fold one journal entry's themes into the graph. Called fire-and-forget from
 * the entry pipeline after AI scoring, so it must never throw.
 */
export const updatePatternGraph = async ({
  userId,
  journalId,
}: {
  userId: string;
  journalId: string;
}): Promise<void> => {
  try {
    const rawInsight = await entryInsightModel
      .findOne({ journalId, userId })
      .select("themes dominantRegionId entryCreatedAt clear")
      .lean()
      .exec();
    const insight = rawInsight
      ? decryptPatternGraphEntryInsight(
          rawInsight as unknown as Record<string, unknown>
        )
      : null;

    if (
      !insight ||
      !insight.clear ||
      !insight.entryCreatedAt ||
      !insight.themes.length
    ) {
      return;
    }

    const observedAt = new Date(insight.entryCreatedAt);
    const observations = insight.themes
      .map(theme =>
        toPatternObservation({
          label: theme.label,
          rationale: theme.rationale,
          evidenceQuote: theme.evidenceQuote,
          confidence: theme.confidence,
          regionId: insight.dominantRegionId,
          sourceKind: "journal",
          journalId,
          sessionId: null,
          observedAt,
        })
      )
      .filter((observation): observation is PatternObservation => Boolean(observation));

    if (!observations.length) {
      return;
    }

    // Tier 2 reads the state *before* this entry's nodes get their lastSeenAt
    // bumped, so antecedents must be derived after the nodes exist but using the
    // entry timestamp as the boundary.
    const nodes = await upsertPatternObservations({ userId, observations });
    if (!nodes.length) {
      return;
    }

    await deriveCoOccurrenceEdges({ userId, nodes, observedAt, journalId });
    await deriveTemporalEdges({ userId, nodes, observedAt, journalId });
    await prunePatternGraph(userId);

    // Tier 3 decides for itself whether enough has changed to be worth a call.
    await refinePatternGraph(userId);
  } catch (error) {
    console.error("Failed to update pattern graph:", error);
  }
};

/**
 * Hard ceiling on the graph's share of a prompt. buildUserReflectionMemory has
 * its own 2200-char budget shared by six call sites, so the graph clamps itself
 * first and can never starve the rolling narrative.
 */
export const PATTERN_GRAPH_MEMORY_MAX = 700;

const PROMPT_NODE_LIMIT = 5;
const PROMPT_EDGE_LIMIT = 4;

const EDGE_PHRASING: Record<PatternEdgeType, string> = {
  co_occurs: "tends to show up alongside",
  precedes: "often comes before",
  reinforces: "appears to feed",
  relieves: "appears to take the edge off",
  conflicts_with: "seems to pull against",
  context_for: "seems to set the scene for",
};

const describeLag = (edge: IPatternEdge): string => {
  const median = medianLagHours(edge.lagSamplesHours || []);
  if (median === null) {
    return "";
  }
  if (median <= 36) {
    return ", usually within a day";
  }
  const days = Math.round(median / 24);
  return `, usually within about ${days} days`;
};

export type PatternGraphMemory = {
  block: string;
  /** True when the graph is established enough to replace recurring themes. */
  hasGraph: boolean;
};

/**
 * The graph's contribution to long-term memory, written in the product's own
 * hedged voice.
 *
 * This deliberately *replaces* the recurring-themes block rather than adding to
 * it: recurring themes are a degenerate graph (nodes with no edges), so the only
 * net growth is the handful of connection lines — which is the part that could
 * never be said before.
 */
export const buildPatternGraphMemoryBlock = async (
  userId: string
): Promise<PatternGraphMemory> => {
  try {
    const { nodes, edges } = await loadPatternGraph({
      userId,
      nodeLimit: 24,
      edgeLimit: 40,
    });

    const patterns = nodes
      .filter(node => node.kind === "pattern")
      .filter(node => node.occurrences >= 2)
      .slice(0, PROMPT_NODE_LIMIT);

    // Below this the graph has nothing the existing recurring-theme aggregation
    // does not already say, so leave that path alone.
    if (patterns.length < 3) {
      return { block: "", hasGraph: false };
    }

    const selectedKeys = new Set(patterns.map(node => node.key));
    const connections = edges
      .filter(edge => edge.confidence >= PATTERN_PROMPT_MIN_CONFIDENCE)
      .filter(edge => selectedKeys.has(edge.fromKey) && selectedKeys.has(edge.toKey))
      // A single ordering is coincidence, not a sequence.
      .filter(
        edge =>
          edge.type !== "precedes" ||
          edge.observations >= PATTERN_PRECEDES_MIN_OBSERVATIONS
      )
      // A named mechanism says far more than a co-occurrence count.
      .sort((left, right) => {
        const leftScore = left.source === "ai_inferred" ? 1 : 0;
        const rightScore = right.source === "ai_inferred" ? 1 : 0;
        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }
        return right.strength - left.strength;
      })
      .slice(0, PROMPT_EDGE_LIMIT);

    const labelByKey = new Map(patterns.map(node => [node.key, node.label]));
    const parts: string[] = [];

    parts.push(
      "Patterns that keep showing up (their own words, never a diagnosis):\n" +
        patterns
          .map(node => `- ${node.label} (seen ${node.occurrences}×)`)
          .join("\n")
    );

    if (connections.length) {
      parts.push(
        "How these appear to connect:\n" +
          connections
            .map(edge => {
              const from = labelByKey.get(edge.fromKey) || edge.fromKey;
              const to = labelByKey.get(edge.toKey) || edge.toKey;
              const detail = edge.rationale ? ` — ${edge.rationale}` : "";
              return `- ${from} ${EDGE_PHRASING[edge.type]} ${to} (seen together ${edge.observations}×${describeLag(edge)})${detail}`;
            })
            .join("\n")
      );
    }

    const umbrellas = nodes.filter(node => node.kind === "umbrella").slice(0, 3);
    if (umbrellas.length) {
      parts.push(
        "Clusters worth holding lightly: " +
          umbrellas.map(node => node.label).join("; ")
      );
    }

    return {
      block: normalizeReflectionMapText(parts.join("\n\n"), PATTERN_GRAPH_MEMORY_MAX),
      hasGraph: true,
    };
  } catch (error) {
    console.error("Failed to build pattern graph memory:", error);
    return { block: "", hasGraph: false };
  }
};

export type LoadedPatternGraph = {
  nodes: IPatternNode[];
  edges: IPatternEdge[];
};

/**
 * Read the strongest slice of a user's graph. Bounded by design — callers inject
 * this into prompts, so the whole graph is never loaded.
 */
export const loadPatternGraph = async ({
  userId,
  nodeLimit = 40,
  edgeLimit = 60,
}: {
  userId: string;
  nodeLimit?: number;
  edgeLimit?: number;
}): Promise<LoadedPatternGraph> => {
  try {
    const [nodes, edges] = await Promise.all([
      patternNodeModel
        .find({ userId, status: "active" })
        .sort({ strength: -1 })
        .limit(nodeLimit)
        .exec(),
      patternEdgeModel
        .find({ userId })
        .sort({ strength: -1 })
        .limit(edgeLimit)
        .exec(),
    ]);

    return { nodes, edges };
  } catch (error) {
    console.error("Failed to load pattern graph:", error);
    return { nodes: [], edges: [] };
  }
};
