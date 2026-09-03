import { z } from "zod";

/**
 * Shared vocabulary, canonicalization, and AI-contract shapes for the per-user
 * pattern graph.
 *
 * The graph is a materialized projection of `entry_insights.themes` (and the
 * themes mined from Ask Jade sessions): each theme is a behavioural pattern
 * node, and edges record how those patterns appear to relate for this one user.
 * A node is a pattern the user's own writing keeps showing. Labels may name a
 * recognised psychological pattern directly; what they may never be is
 * invented, since every node carries the user's own sentence as evidence.
 *
 * This module holds only pure functions and schema declarations so both the
 * graph service and its tests can use it without touching Mongo or OpenAI.
 */

export const PATTERN_GRAPH_VERSION = "pattern-graph-v1";

export const PATTERN_NODE_KINDS = ["pattern", "umbrella"] as const;
export type PatternNodeKind = (typeof PATTERN_NODE_KINDS)[number];

export const PATTERN_NODE_STATUSES = ["active", "dormant", "merged"] as const;
export type PatternNodeStatus = (typeof PATTERN_NODE_STATUSES)[number];

/**
 * Where an observation came from. Guided reflection is its own kind rather than
 * folded into "journal": a guided answer is a direct response to a targeted
 * probe, so it carries more signal than a chat aside but is still single-session
 * self-report, and `toPatternObservation` weights the three differently.
 */
export const PATTERN_SOURCE_KINDS = ["journal", "chat", "guided"] as const;
export type PatternSourceKind = (typeof PATTERN_SOURCE_KINDS)[number];

/**
 * Edge types are deliberately behavioural. `co_occurs` is the only undirected
 * type — everything else reads "from -> to" and its key preserves that order.
 */
export const PATTERN_EDGE_TYPES = [
  "co_occurs",
  "precedes",
  "reinforces",
  "relieves",
  "conflicts_with",
  "context_for",
] as const;
export type PatternEdgeType = (typeof PATTERN_EDGE_TYPES)[number];

export const UNDIRECTED_PATTERN_EDGE_TYPES: readonly PatternEdgeType[] = [
  "co_occurs",
];

export const PATTERN_EDGE_SOURCES = [
  "co_occurrence",
  "temporal",
  "ai_inferred",
] as const;
export type PatternEdgeSource = (typeof PATTERN_EDGE_SOURCES)[number];

export const PATTERN_NODE_LABEL_MAX = 64;
export const PATTERN_UMBRELLA_LABEL_MAX = 48;
export const PATTERN_RATIONALE_MAX = 220;
export const PATTERN_EVIDENCE_MAX = 180;
export const PATTERN_KEY_MAX = 64;

/**
 * Minimum confidence an edge or node needs before it is allowed to reach a
 * model prompt. Weak signal stays stored (it may strengthen later) but never
 * gets spoken back to the user as if it were a real pattern.
 */
export const PATTERN_PROMPT_MIN_CONFIDENCE = 0.55;

/**
 * A single ordering proves nothing. A `precedes` edge has to be observed this
 * many times before it is treated as a real sequence rather than coincidence.
 */
export const PATTERN_PRECEDES_MIN_OBSERVATIONS = 3;

/**
 * Words that carry no identity for a behaviour label. Dropping them is what
 * lets "avoids conflict" and "avoiding the conflict" land on the same key.
 */
const PATTERN_KEY_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "to",
  "of",
  "when",
  "while",
  "my",
  "i",
  "is",
  "are",
  "and",
  "with",
  "for",
  "on",
  "at",
  "in",
  "it",
  "that",
]);

/**
 * Longest-first so "avoidance" strips "ance" rather than nothing. One pass
 * only — stacking strips over-stems fast ("eating" -> "eat" -> ""), and one
 * pass already collapses the phrasings that matter in practice.
 */
const PATTERN_KEY_SUFFIXES = ["ance", "ence", "ment", "ing", "ed", "es", "s"];

const MIN_STEM_LENGTH = 3;

const stemPatternToken = (token: string): string => {
  // "stress"/"stresses" must land together, so never strip a plural marker off
  // a word that genuinely ends in a double s.
  const endsInDoubleS = token.endsWith("ss");

  for (const suffix of PATTERN_KEY_SUFFIXES) {
    if (!token.endsWith(suffix) || token.length - suffix.length < MIN_STEM_LENGTH) {
      continue;
    }
    if (endsInDoubleS && (suffix === "s" || suffix === "es")) {
      continue;
    }
    return token.slice(0, token.length - suffix.length);
  }

  return token;
};

/**
 * Readable, stable slug for a theme label — the identity used by
 * `entry_insights.themes[].id` and by a graph node's `key`.
 *
 * Exact by design: two labels only share an id when they are the same string.
 * `toPatternKey` below is the fuzzy counterpart that decides whether two
 * differently-worded labels are the same *behaviour*.
 */
export const toThemeId = (label: string): string =>
  label
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48) || "theme";

/**
 * Canonical merge key for a behaviour label.
 *
 * `toThemeId` above is an exact slug, so "avoids conflict",
 * "avoiding conflict" and "conflict avoidance" become three separate nodes.
 * This normalizes phrasing instead: strip punctuation, drop stopwords, stem
 * lightly, then **sort the tokens** so word order stops mattering. All three
 * examples above collapse to `avoid|conflict`.
 *
 * The tradeoff of sorting is that "helps partner" and "partner helps" also
 * collapse. Behaviour labels are near-always self-referential ("I do X"), so
 * that ambiguity does not show up in practice, and a wrong merge is recoverable
 * (the loser node is kept with status "merged", never deleted).
 */
export const toPatternKey = (label: string): string => {
  const tokens = label
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter(Boolean)
    .filter(token => !PATTERN_KEY_STOPWORDS.has(token))
    .map(stemPatternToken)
    .filter(Boolean);

  if (!tokens.length) {
    return "pattern";
  }

  return [...new Set(tokens)].sort().join("|").slice(0, PATTERN_KEY_MAX);
};

const tokenizeLabel = (label: string): string[] =>
  label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter(Boolean);

/**
 * God nodes ("umbrellas") are the only place the model invents a *new* name for
 * a group of behaviours, so the label still has to say something.
 *
 * The multi-word rule is what remains of the old guard, and it is about
 * specificity rather than clinical language: a single-token label is a bare
 * state noun that describes nothing the person actually does. "work anxiety"
 * and "bracing for things going wrong" both qualify; "anxiety" does not.
 *
 * The clinical-term filter that used to sit here was removed deliberately —
 * naming a recognised pattern directly is now the product's voice, and
 * filtering those labels out silently dropped the nodes instead of rewording
 * them.
 */
export const isValidUmbrellaLabel = (label: string): boolean =>
  tokenizeLabel(label).length >= 2;

/**
 * Stable edge identity. Undirected types sort their endpoints so A|B and B|A
 * collapse to one row; directed types keep the observed order, because
 * "screen time precedes overeating" is a different claim from its reverse.
 */
export const buildPatternEdgeKey = (
  type: PatternEdgeType,
  fromKey: string,
  toKey: string
): { key: string; fromKey: string; toKey: string; directed: boolean } => {
  const directed = !UNDIRECTED_PATTERN_EDGE_TYPES.includes(type);

  if (directed) {
    return { key: `${type}:${fromKey}->${toKey}`, fromKey, toKey, directed };
  }

  const [left, right] = [fromKey, toKey].sort();
  return {
    key: `${type}:${left}->${right}`,
    fromKey: left ?? fromKey,
    toKey: right ?? toKey,
    directed,
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PATTERN_RECENCY_HALF_LIFE_DAYS = 45;

/**
 * Ranks a node for prompt selection and pruning. Frequency is the base signal,
 * scaled by how confident the extraction was and decayed by how long it has
 * been since the pattern last appeared — so a thing the user worked through
 * months ago quietly falls behind a thing that is live right now.
 *
 * Fully deterministic, so it is cheap to test and never costs a model call.
 */
export const computeNodeStrength = ({
  occurrences,
  confidence,
  lastSeenAt,
  now = new Date(),
}: {
  occurrences: number;
  confidence: number;
  lastSeenAt: Date;
  now?: Date;
}): number => {
  const safeOccurrences = Number.isFinite(occurrences)
    ? Math.max(0, occurrences)
    : 0;
  const safeConfidence = Number.isFinite(confidence)
    ? Math.min(1, Math.max(0, confidence))
    : 0.5;

  const elapsedMs = now.getTime() - lastSeenAt.getTime();
  const daysSinceLastSeen = Number.isFinite(elapsedMs)
    ? Math.max(0, elapsedMs / DAY_MS)
    : 0;
  const recencyBoost = Math.exp(-daysSinceLastSeen / PATTERN_RECENCY_HALF_LIFE_DAYS);

  const strength =
    safeOccurrences *
    (0.55 + 0.45 * safeConfidence) *
    (0.5 + 0.5 * recencyBoost);

  return Number(strength.toFixed(3));
};

/** Same shape as node strength, driven by how often the link was observed. */
export const computeEdgeStrength = ({
  observations,
  confidence,
  lastSeenAt,
  now = new Date(),
}: {
  observations: number;
  confidence: number;
  lastSeenAt: Date;
  now?: Date;
}): number =>
  computeNodeStrength({
    occurrences: observations,
    confidence,
    lastSeenAt,
    now,
  });

/** Median lag in hours across the samples collected for a `precedes` edge. */
export const medianLagHours = (samples: number[]): number | null => {
  const usable = samples.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!usable.length) {
    return null;
  }

  const middle = Math.floor(usable.length / 2);
  if (usable.length % 2 === 1) {
    return Number((usable[middle] ?? 0).toFixed(1));
  }
  return Number((((usable[middle - 1] ?? 0) + (usable[middle] ?? 0)) / 2).toFixed(1));
};

/**
 * The AI refinement contract. The model only ever *relates* nodes we already
 * hold and *groups* them — it never creates a pattern. Every key it returns is
 * checked against the exact key set we sent before anything is written.
 *
 * Note the "" sentinels: the Responses API runs this with `strict: true`, which
 * has no nullable, so absent values are empty strings (same approach as
 * userMemoryJsonSchema).
 */
export const patternGraphEdgeAiSchema = z.object({
  fromKey: z.string().trim().min(1).max(PATTERN_KEY_MAX),
  toKey: z.string().trim().min(1).max(PATTERN_KEY_MAX),
  type: z.enum(PATTERN_EDGE_TYPES),
  rationale: z.string().trim().min(1).max(PATTERN_RATIONALE_MAX),
  evidenceQuote: z.string().trim().max(PATTERN_EVIDENCE_MAX),
  confidence: z.number().min(0).max(1),
});

export const patternGraphUmbrellaAiSchema = z.object({
  label: z.string().trim().min(1).max(PATTERN_UMBRELLA_LABEL_MAX),
  rationale: z.string().trim().min(1).max(PATTERN_RATIONALE_MAX),
  memberKeys: z.array(z.string().trim().min(1).max(PATTERN_KEY_MAX)).min(2).max(8),
  confidence: z.number().min(0).max(1),
});

export const patternGraphRefinementSchema = z.object({
  edges: z.array(patternGraphEdgeAiSchema).max(12),
  umbrellas: z.array(patternGraphUmbrellaAiSchema).max(4),
});

export type PatternGraphRefinement = z.infer<typeof patternGraphRefinementSchema>;

const patternGraphEdgeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    fromKey: { type: "string", minLength: 1, maxLength: PATTERN_KEY_MAX },
    toKey: { type: "string", minLength: 1, maxLength: PATTERN_KEY_MAX },
    type: { type: "string", enum: PATTERN_EDGE_TYPES },
    rationale: { type: "string", minLength: 1, maxLength: PATTERN_RATIONALE_MAX },
    evidenceQuote: { type: "string", maxLength: PATTERN_EVIDENCE_MAX },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: [
    "fromKey",
    "toKey",
    "type",
    "rationale",
    "evidenceQuote",
    "confidence",
  ],
};

const patternGraphUmbrellaJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: {
      type: "string",
      minLength: 1,
      maxLength: PATTERN_UMBRELLA_LABEL_MAX,
    },
    rationale: { type: "string", minLength: 1, maxLength: PATTERN_RATIONALE_MAX },
    memberKeys: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: PATTERN_KEY_MAX },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["label", "rationale", "memberKeys", "confidence"],
};

export const patternGraphRefinementJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    edges: {
      type: "array",
      maxItems: 12,
      items: patternGraphEdgeJsonSchema,
    },
    umbrellas: {
      type: "array",
      maxItems: 4,
      items: patternGraphUmbrellaJsonSchema,
    },
  },
  required: ["edges", "umbrellas"],
} satisfies Record<string, unknown>;
