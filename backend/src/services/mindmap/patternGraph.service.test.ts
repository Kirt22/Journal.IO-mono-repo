import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import mongoose from "mongoose";
import { entryInsightModel } from "../../schema/entryInsight.schema";
import { patternEdgeModel } from "../../schema/patternEdge.schema";
import { patternNodeModel } from "../../schema/patternNode.schema";
import { userMemoryModel } from "../../schema/userMemory.schema";
import { userModel } from "../../schema/user.schema";
import { encryptFieldValue } from "../../helpers/fieldEncryption.helpers";
import {
  CHAT_CONFIDENCE_FACTOR,
  buildCoOccurrencePairs,
  decryptPatternGraphEntryInsight,
  refinePatternGraph,
  sanitizePatternGraphRefinement,
  toPatternObservation,
  updatePatternGraph,
  upsertPatternEdge,
  upsertPatternObservations,
  type RefinementNodeView,
} from "./patternGraph.service";

type AnyChain = Record<string, unknown>;

const nodeTarget = patternNodeModel as unknown as AnyChain;
const edgeTarget = patternEdgeModel as unknown as AnyChain;
const insightTarget = entryInsightModel as unknown as AnyChain;
const userTarget = userModel as unknown as AnyChain;
const userMemoryTarget = userMemoryModel as unknown as AnyChain;

const originals = {
  nodeFindOne: nodeTarget.findOne,
  nodeFind: nodeTarget.find,
  nodeCreate: nodeTarget.create,
  nodeUpdateMany: nodeTarget.updateMany,
  nodeDeleteMany: nodeTarget.deleteMany,
  edgeFindOne: edgeTarget.findOne,
  edgeCreate: edgeTarget.create,
  edgeFind: edgeTarget.find,
  edgeCountDocuments: edgeTarget.countDocuments,
  edgeDeleteMany: edgeTarget.deleteMany,
  insightFindOne: insightTarget.findOne,
  insightCountDocuments: insightTarget.countDocuments,
  userFindById: userTarget.findById,
  userMemoryFindOne: userMemoryTarget.findOne,
  userMemoryUpdateOne: userMemoryTarget.updateOne,
};

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalFieldEncryptionMode = process.env.FIELD_ENCRYPTION_MODE;
const originalFieldEncryptionActiveKeyId =
  process.env.FIELD_ENCRYPTION_ACTIVE_KEY_ID;
const originalFieldEncryptionKeysJson =
  process.env.FIELD_ENCRYPTION_KEYS_JSON;

afterEach(() => {
  nodeTarget.findOne = originals.nodeFindOne;
  nodeTarget.find = originals.nodeFind;
  nodeTarget.create = originals.nodeCreate;
  nodeTarget.updateMany = originals.nodeUpdateMany;
  nodeTarget.deleteMany = originals.nodeDeleteMany;
  edgeTarget.findOne = originals.edgeFindOne;
  edgeTarget.create = originals.edgeCreate;
  edgeTarget.find = originals.edgeFind;
  edgeTarget.countDocuments = originals.edgeCountDocuments;
  edgeTarget.deleteMany = originals.edgeDeleteMany;
  insightTarget.findOne = originals.insightFindOne;
  insightTarget.countDocuments = originals.insightCountDocuments;
  userTarget.findById = originals.userFindById;
  userMemoryTarget.findOne = originals.userMemoryFindOne;
  userMemoryTarget.updateOne = originals.userMemoryUpdateOne;

  globalThis.fetch = originalFetch;
  if (typeof originalApiKey === "string") {
    process.env.OPENAI_API_KEY = originalApiKey;
  } else {
    delete process.env.OPENAI_API_KEY;
  }
  delete process.env.AI_ALLOW_NON_PREMIUM;
  if (typeof originalFieldEncryptionMode === "string") {
    process.env.FIELD_ENCRYPTION_MODE = originalFieldEncryptionMode;
  } else {
    delete process.env.FIELD_ENCRYPTION_MODE;
  }
  if (typeof originalFieldEncryptionActiveKeyId === "string") {
    process.env.FIELD_ENCRYPTION_ACTIVE_KEY_ID =
      originalFieldEncryptionActiveKeyId;
  } else {
    delete process.env.FIELD_ENCRYPTION_ACTIVE_KEY_ID;
  }
  if (typeof originalFieldEncryptionKeysJson === "string") {
    process.env.FIELD_ENCRYPTION_KEYS_JSON = originalFieldEncryptionKeysJson;
  } else {
    delete process.env.FIELD_ENCRYPTION_KEYS_JSON;
  }
});

const stubUserPremium = (isPremium: boolean) => {
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () =>
          isPremium
            ? {
                isPremium: true,
                premiumPlanKey: "yearly",
                premiumExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
                premiumSource: "revenuecat_verified",
              }
            : { isPremium: false },
      }),
    }),
  });
};

const makeNode = (overrides: Record<string, unknown> = {}) => {
  const node = {
    _id: new mongoose.Types.ObjectId(),
    key: "eats-while-watching-shows",
    canonicalKey: "eat|show|watch",
    label: "eats while watching shows",
    aliases: ["eats-while-watching-shows"],
    aliasLabels: ["eats while watching shows"],
    rationale: "",
    evidenceQuote: "",
    evidence: [] as unknown[],
    sourceKinds: ["journal"],
    occurrences: 1,
    confidence: 0.6,
    strength: 1,
    firstSeenAt: new Date("2026-08-01T00:00:00.000Z"),
    lastSeenAt: new Date("2026-08-01T00:00:00.000Z"),
    embedding: [] as number[],
    version: "pattern-graph-v1",
    saved: false,
    async save() {
      this.saved = true;
      return this;
    },
    ...overrides,
  };
  return node;
};

test("buildCoOccurrencePairs pairs every theme once and never with itself", () => {
  const pairs = buildCoOccurrencePairs(["a", "b", "c", "d"]);

  // C(4,2) = 6 — the primitive aggregateRecurringPatterns never produced.
  assert.equal(pairs.length, 6);
  assert.equal(
    pairs.every(([left, right]) => left !== right),
    true,
    "a pattern must never co-occur with itself"
  );
  assert.deepEqual(pairs[0], ["a", "b"]);
  assert.equal(buildCoOccurrencePairs(["only"]).length, 0);
});

test("toPatternObservation drops labels that name a condition rather than a behaviour", () => {
  const clinical = toPatternObservation({
    label: "anxiety",
    rationale: "They mention worry often.",
    evidenceQuote: "I worry a lot.",
    confidence: 0.9,
    regionId: null,
    sourceKind: "journal",
    journalId: "journal-1",
    sessionId: null,
    observedAt: new Date(),
  });

  assert.equal(clinical, null);

  const behavioural = toPatternObservation({
    label: "eats while watching shows",
    rationale: "Meals happen with a screen on.",
    evidenceQuote: "I put a show on and eat.",
    confidence: 0.9,
    regionId: null,
    sourceKind: "journal",
    journalId: "journal-1",
    sessionId: null,
    observedAt: new Date(),
  });

  assert.notEqual(behavioural, null);
  assert.equal(behavioural?.confidence, 0.9);
});

test("toPatternObservation discounts chat-mined patterns below journalled ones", () => {
  const base = {
    label: "eats while watching shows",
    rationale: "Meals happen with a screen on.",
    evidenceQuote: "I put a show on and eat.",
    confidence: 0.9,
    regionId: null,
    journalId: null,
    observedAt: new Date(),
  };

  const fromChat = toPatternObservation({
    ...base,
    sourceKind: "chat",
    sessionId: "session-1",
  });

  // A chat turn is less considered than a written entry, so it must never
  // outrank one.
  assert.equal(fromChat?.confidence, Number((0.9 * CHAT_CONFIDENCE_FACTOR).toFixed(2)));
});

test("upsertPatternEdge refuses to link a pattern to itself", async () => {
  const node = makeNode();
  edgeTarget.findOne = () => {
    throw new Error("a self-edge must never reach the database");
  };

  await upsertPatternEdge({
    userId: "user-1",
    type: "co_occurs",
    source: "co_occurrence",
    fromNode: node as never,
    toNode: node as never,
    rationale: "",
    confidence: 0.7,
    observedAt: new Date(),
    journalId: "journal-1",
    evidenceQuote: null,
    lagHours: null,
  });
});

test("upsertPatternObservations folds a repeat theme into the existing node", async () => {
  const existing = makeNode({ occurrences: 3, confidence: 0.5 });
  nodeTarget.findOne = () => ({ exec: async () => existing });

  const observation = toPatternObservation({
    label: "eats while watching shows",
    rationale: "Screens are on at every meal.",
    evidenceQuote: "I always have something playing.",
    confidence: 0.9,
    regionId: null,
    sourceKind: "journal",
    journalId: "journal-2",
    sessionId: null,
    observedAt: new Date("2026-08-10T00:00:00.000Z"),
  });
  assert.notEqual(observation, null);

  const nodes = await upsertPatternObservations({
    userId: "user-1",
    observations: [observation!],
  });

  assert.equal(nodes.length, 1);
  assert.equal(existing.occurrences, 4, "a repeat sighting increments the node");
  assert.equal(existing.saved, true);
  assert.equal(
    existing.lastSeenAt.toISOString(),
    "2026-08-10T00:00:00.000Z",
    "lastSeenAt moves forward so recency decay stays honest"
  );
  assert.equal(existing.evidence.length, 1);
});

test("a non-premium user never reaches the embeddings API when resolving a new pattern", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  stubUserPremium(false);

  // Every cheap lookup misses, so only the premium gate stands between this and
  // an embedding call.
  nodeTarget.findOne = () => ({ exec: async () => null });

  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const created = makeNode();
  nodeTarget.create = async () => created;

  const observation = toPatternObservation({
    label: "puts off replying to messages",
    rationale: "Replies pile up for days.",
    evidenceQuote: "I left it unread again.",
    confidence: 0.7,
    regionId: null,
    sourceKind: "journal",
    journalId: "journal-3",
    sessionId: null,
    observedAt: new Date(),
  });

  const nodes = await upsertPatternObservations({
    userId: "free-user",
    observations: [observation!],
  });

  assert.equal(fetchCalled, false, "free users must not trigger model spend");
  assert.equal(nodes.length, 1, "the node is still created deterministically");
});

test("updatePatternGraph does nothing when the entry produced no usable themes", async () => {
  insightTarget.findOne = () => ({
    select: () => ({ lean: () => ({ exec: async () => ({ clear: true, themes: [] }) }) }),
  });
  nodeTarget.findOne = () => {
    throw new Error("no node work should happen without themes");
  };

  await updatePatternGraph({ userId: "user-1", journalId: "journal-1" });
});

test("decryptPatternGraphEntryInsight restores encrypted lean themes", () => {
  process.env.FIELD_ENCRYPTION_MODE = "migration";
  process.env.FIELD_ENCRYPTION_ACTIVE_KEY_ID = "test-key";
  process.env.FIELD_ENCRYPTION_KEYS_JSON = JSON.stringify({
    "test-key": "11".repeat(32),
  });

  const themes = [
    {
      label: "stays online when work feels uncertain",
      rationale: "Checking for more information briefly creates reassurance.",
      evidenceQuote: "I stay online too late.",
      confidence: 0.82,
    },
  ];
  const encryptedThemes = encryptFieldValue(themes, { path: "themes" });

  const insight = decryptPatternGraphEntryInsight({
    clear: true,
    themes: encryptedThemes,
    dominantRegionId: "planning_self_control",
    entryCreatedAt: new Date("2026-08-06T04:30:00.000Z"),
  });

  assert.deepEqual(insight.themes, themes);
});

test("updatePatternGraph swallows failures so a journal entry still saves", async () => {
  insightTarget.findOne = () => {
    throw new Error("mongo is unavailable");
  };

  // The contract that matters most: the graph is a best-effort enhancement and
  // must never surface an error into the entry pipeline.
  await updatePatternGraph({ userId: "user-1", journalId: "journal-1" });
});

const refinementNodes: RefinementNodeView[] = [
  {
    key: "eats-while-watching-shows",
    label: "eats while watching shows",
    rationale: "Meals happen with a screen on.",
    occurrences: 6,
    evidenceQuotes: ["I put a show on and eat without thinking."],
  },
  {
    key: "eating-past-fullness-at-night",
    label: "eating past fullness at night",
    rationale: "Evenings end with more food than intended.",
    occurrences: 9,
    evidenceQuotes: ["I kept going long after I was full."],
  },
  {
    key: "long-screen-heavy-evenings",
    label: "long screen-heavy evenings",
    rationale: "Evenings disappear into screens.",
    occurrences: 1,
    evidenceQuotes: ["I was on my phone until 1am."],
  },
];

const validEdge = {
  fromKey: "eats-while-watching-shows",
  toKey: "eating-past-fullness-at-night",
  type: "reinforces" as const,
  rationale: "Attention is on the screen, so the signal that they are full lands late.",
  evidenceQuote: "",
  confidence: 0.72,
};

test("sanitizePatternGraphRefinement refuses endpoints the model invented", () => {
  const result = sanitizePatternGraphRefinement({
    refinement: {
      edges: [
        validEdge,
        // A pattern that does not exist in this user's graph.
        { ...validEdge, toKey: "doomscrolling-before-bed" },
      ],
      umbrellas: [],
    },
    nodes: refinementNodes,
  });

  assert.equal(result.edges.length, 1, "a hallucinated pattern must never enter the graph");
  assert.equal(result.edges[0]?.toKey, "eating-past-fullness-at-night");
});

test("sanitizePatternGraphRefinement drops self-edges and unexplained links", () => {
  const result = sanitizePatternGraphRefinement({
    refinement: {
      edges: [
        { ...validEdge, toKey: validEdge.fromKey },
        { ...validEdge, rationale: "   " },
      ],
      umbrellas: [],
    },
    nodes: refinementNodes,
  });

  assert.deepEqual(result.edges, []);
});

test("sanitizePatternGraphRefinement keeps only quotes the user actually wrote", () => {
  const result = sanitizePatternGraphRefinement({
    refinement: {
      edges: [
        { ...validEdge, evidenceQuote: "I put a show on and eat" },
        {
          ...validEdge,
          fromKey: "long-screen-heavy-evenings",
          evidenceQuote: "I have no self control at all",
        },
      ],
      umbrellas: [],
    },
    nodes: refinementNodes,
  });

  assert.equal(result.edges[0]?.evidenceQuote, "I put a show on and eat");
  assert.equal(
    result.edges[1]?.evidenceQuote,
    "",
    "a quote the model authored itself must be discarded, not attributed to the user"
  );
});

test("sanitizePatternGraphRefinement rejects clusters named after a condition", () => {
  const result = sanitizePatternGraphRefinement({
    refinement: {
      edges: [],
      umbrellas: [
        {
          label: "anxiety",
          rationale: "Several patterns look like worry.",
          memberKeys: ["eats-while-watching-shows", "eating-past-fullness-at-night"],
          confidence: 0.9,
        },
        {
          label: "binge eating disorder",
          rationale: "The eating patterns cluster together.",
          memberKeys: ["eats-while-watching-shows", "eating-past-fullness-at-night"],
          confidence: 0.9,
        },
      ],
    },
    nodes: refinementNodes,
  });

  assert.deepEqual(result.umbrellas, [], "god nodes must never carry a diagnosis");
});

test("sanitizePatternGraphRefinement accepts a behavioural cluster of established patterns", () => {
  const result = sanitizePatternGraphRefinement({
    refinement: {
      edges: [],
      umbrellas: [
        {
          label: "soothing tension with screens",
          rationale: "Screens are how the evening gets managed.",
          memberKeys: [
            "eats-while-watching-shows",
            "eating-past-fullness-at-night",
            // Seen only once — not established enough to belong to a cluster.
            "long-screen-heavy-evenings",
          ],
          confidence: 0.75,
        },
      ],
    },
    nodes: refinementNodes,
  });

  assert.equal(result.umbrellas.length, 1);
  assert.deepEqual(result.umbrellas[0]?.memberKeys, [
    "eats-while-watching-shows",
    "eating-past-fullness-at-night",
  ]);
});

test("sanitizePatternGraphRefinement drops a low-confidence cluster", () => {
  const result = sanitizePatternGraphRefinement({
    refinement: {
      edges: [],
      umbrellas: [
        {
          label: "soothing tension with screens",
          rationale: "Screens might be how the evening gets managed.",
          memberKeys: ["eats-while-watching-shows", "eating-past-fullness-at-night"],
          confidence: 0.4,
        },
      ],
    },
    nodes: refinementNodes,
  });

  assert.deepEqual(result.umbrellas, []);
});

test("refinePatternGraph never calls the model for a non-premium user", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  stubUserPremium(false);

  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  await refinePatternGraph("free-user");

  assert.equal(fetchCalled, false);
});

test("refinePatternGraph holds off until enough new entries have accumulated", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  stubUserPremium(true);

  userMemoryTarget.findOne = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          graphRefinedThrough: new Date("2026-08-01T00:00:00.000Z"),
          graphRebuildRequestedAt: null,
        }),
      }),
    }),
  });
  // Only one new entry since the last refinement; the default threshold is 5.
  insightTarget.countDocuments = () => ({ exec: async () => 1 });

  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  nodeTarget.find = () => {
    throw new Error("the throttle must short-circuit before loading the graph");
  };

  await refinePatternGraph("premium-user");

  assert.equal(fetchCalled, false, "refinement is the expensive call — it must stay throttled");
});
