import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  aggregateRecurringPatterns,
  buildUserReflectionMemory,
  loadRelevantEntryInsights,
  normalizeEntryThemes,
  toThemeId,
  type LoadedEntryInsight,
} from "./entryInsight.service";
import { entryInsightModel } from "../../schema/entryInsight.schema";
import { patternEdgeModel } from "../../schema/patternEdge.schema";
import { patternNodeModel } from "../../schema/patternNode.schema";
import { userMemoryModel } from "../../schema/userMemory.schema";

const insight = (
  overrides: Partial<LoadedEntryInsight> & { themes: LoadedEntryInsight["themes"] }
): LoadedEntryInsight => ({
  journalId: "j",
  entryType: "guided",
  contextSummary: "",
  emotionalTone: "",
  dominantRegionId: "self_reflection_identity",
  entryCreatedAt: new Date(),
  ...overrides,
});

test("toThemeId slugifies a label to a stable id", () => {
  assert.equal(toThemeId("Seeks reassurance under stress"), "seeks-reassurance-under-stress");
  assert.equal(toThemeId("Uses  fitness   to cope!"), "uses-fitness-to-cope");
  assert.equal(toThemeId("   "), "theme");
});

test("normalizeEntryThemes trims, dedupes by id, and clamps confidence", () => {
  const themes = normalizeEntryThemes([
    {
      label: "Avoids conflict",
      rationale: "You step back when tension rises.",
      evidenceQuote: "I just went quiet again",
      confidence: 1.4,
    },
    {
      // Same slug as the first — should be dropped as a duplicate.
      label: "avoids conflict",
      rationale: "duplicate",
      evidenceQuote: "dup",
      confidence: 0.5,
    },
    {
      label: "Uses fitness to cope",
      rationale: "The gym steadies you.",
      evidenceQuote: "the gym is where I reset",
      confidence: -0.2,
    },
  ]);

  assert.equal(themes.length, 2);
  assert.equal(themes[0]?.id, "avoids-conflict");
  assert.equal(themes[0]?.confidence, 1); // clamped to max 1
  assert.equal(themes[1]?.confidence, 0.5); // invalid → default 0.5
});

test("aggregateRecurringPatterns ranks by occurrences then confidence", () => {
  const insights: LoadedEntryInsight[] = [
    insight({
      themes: [
        {
          id: "seeks-validation",
          label: "Seeks validation",
          rationale: "r1",
          evidenceQuote: "q1",
          confidence: 0.6,
        },
        {
          id: "avoids-conflict",
          label: "Avoids conflict",
          rationale: "r2",
          evidenceQuote: "q2",
          confidence: 0.5,
        },
      ],
    }),
    insight({
      themes: [
        {
          id: "seeks-validation",
          label: "Seeks validation",
          rationale: "stronger rationale",
          evidenceQuote: "stronger quote",
          confidence: 0.9,
        },
      ],
    }),
  ];

  const patterns = aggregateRecurringPatterns(insights, 5);

  assert.equal(patterns.length, 2);
  // seeks-validation recurs twice, so it ranks first.
  assert.equal(patterns[0]?.id, "seeks-validation");
  assert.equal(patterns[0]?.occurrences, 2);
  // The higher-confidence occurrence supplies the representative rationale/quote.
  assert.equal(patterns[0]?.rationale, "stronger rationale");
  assert.equal(patterns[0]?.evidenceQuote, "stronger quote");
  assert.equal(patterns[1]?.id, "avoids-conflict");
  assert.equal(patterns[1]?.occurrences, 1);
});

test("aggregateRecurringPatterns respects the limit", () => {
  const insights: LoadedEntryInsight[] = [
    insight({
      themes: Array.from({ length: 6 }, (_, index) => ({
        id: `theme-${index}`,
        label: `Theme ${index}`,
        rationale: "r",
        evidenceQuote: "q",
        confidence: 0.5,
      })),
    }),
  ];

  assert.equal(aggregateRecurringPatterns(insights, 3).length, 3);
});

const entryTarget = entryInsightModel as unknown as {
  find: (query: unknown) => unknown;
};
const originalFind = entryTarget.find;

afterEach(() => {
  entryTarget.find = originalFind;
});

const mockFindReturning = (rows: unknown[]) => {
  const chain = {
    sort: () => chain,
    limit: () => chain,
    select: () => chain,
    lean: () => chain,
    exec: async () => rows,
  };
  entryTarget.find = () => chain;
};

test("loadRelevantEntryInsights ranks by cosine similarity and drops weak matches", async () => {
  mockFindReturning([
    {
      journalId: "identical",
      entryType: "guided",
      contextSummary: "identical match",
      emotionalTone: "steady",
      themes: [],
      dominantRegionId: "self_reflection_identity",
      entryCreatedAt: new Date("2026-01-01"),
      embedding: [1, 0, 0],
    },
    {
      journalId: "orthogonal",
      entryType: "open_ended",
      contextSummary: "unrelated",
      emotionalTone: "flat",
      themes: [],
      dominantRegionId: "self_reflection_identity",
      entryCreatedAt: new Date("2026-01-02"),
      embedding: [0, 1, 0],
    },
    {
      journalId: "close",
      entryType: "guided",
      contextSummary: "close match",
      emotionalTone: "warm",
      themes: [],
      dominantRegionId: "self_reflection_identity",
      entryCreatedAt: new Date("2026-01-03"),
      embedding: [0.9, 0.1, 0],
    },
  ]);

  const results = await loadRelevantEntryInsights({
    userId: "u1",
    queryEmbedding: [1, 0, 0],
  });

  // Orthogonal (similarity 0) is dropped by the minScore filter.
  assert.deepEqual(
    results.map(row => row.journalId),
    ["identical", "close"]
  );
  assert.ok(results[0]!.similarity >= results[1]!.similarity);
  assert.ok(results[0]!.similarity > 0.99);
});

test("loadRelevantEntryInsights returns [] for an empty query embedding", async () => {
  let called = false;
  entryTarget.find = () => {
    called = true;
    return { sort: () => ({}) };
  };

  const results = await loadRelevantEntryInsights({
    userId: "u1",
    queryEmbedding: [],
  });

  assert.deepEqual(results, []);
  assert.equal(called, false);
});

// ── buildUserReflectionMemory: the pattern graph replaces recurring themes ───

const nodeTarget = patternNodeModel as unknown as { find: (query: unknown) => unknown };
const edgeTarget = patternEdgeModel as unknown as { find: (query: unknown) => unknown };
const memoryTarget = userMemoryModel as unknown as { findOne: (query: unknown) => unknown };

const originalNodeFind = nodeTarget.find;
const originalEdgeFind = edgeTarget.find;
const originalMemoryFindOne = memoryTarget.findOne;

afterEach(() => {
  nodeTarget.find = originalNodeFind;
  edgeTarget.find = originalEdgeFind;
  memoryTarget.findOne = originalMemoryFindOne;
});

const listChain = (rows: unknown[]) => {
  const chain: Record<string, unknown> = {};
  chain.sort = () => chain;
  chain.select = () => chain;
  chain.limit = () => chain;
  chain.lean = () => chain;
  chain.exec = async () => rows;
  return chain;
};

const stubGraph = ({ nodes, edges }: { nodes: unknown[]; edges: unknown[] }) => {
  nodeTarget.find = () => listChain(nodes);
  edgeTarget.find = () => listChain(edges);
};

const stubRollingMemory = (narrative: string) => {
  memoryTarget.findOne = () => ({
    lean: () => ({
      exec: async () => ({
        narrative,
        structured: { ongoingThreads: [], keyRelationships: [], sensitiveTopics: [] },
        entriesCoveredThrough: null,
        entriesCoveredCount: 0,
        version: "user-memory-v1",
        aiModel: null,
      }),
    }),
  });
};

const graphNode = (key: string, label: string, occurrences: number) => ({
  key,
  label,
  kind: "pattern",
  occurrences,
  strength: occurrences,
});

const graphEdge = (overrides: Record<string, unknown> = {}) => ({
  fromKey: "eats-while-watching-shows",
  toKey: "eating-past-fullness",
  type: "reinforces",
  source: "ai_inferred",
  rationale: "Attention is on the screen, so the signal that they are full lands late.",
  confidence: 0.8,
  observations: 4,
  strength: 4,
  lagSamplesHours: [],
  ...overrides,
});

const themedInsight = (label: string, occurrences: number) =>
  Array.from({ length: occurrences }, () => ({
    journalId: "j",
    entryType: "guided",
    contextSummary: "",
    emotionalTone: "",
    dominantRegionId: "self_reflection_identity",
    entryCreatedAt: new Date(),
    themes: [
      { id: toThemeId(label), label, rationale: "Because of X.", evidenceQuote: "q", confidence: 0.8 },
    ],
  }));

test("buildUserReflectionMemory swaps recurring themes for the graph once it is established", async () => {
  entryTarget.find = () => listChain(themedInsight("eats while watching shows", 4));
  stubRollingMemory("They have been navigating a demanding stretch at work.");
  stubGraph({
    nodes: [
      graphNode("eats-while-watching-shows", "eats while watching shows", 6),
      graphNode("eating-past-fullness", "eating past fullness at night", 9),
      graphNode("long-screen-evenings", "long screen-heavy evenings", 4),
    ],
    edges: [graphEdge()],
  });

  const memory = await buildUserReflectionMemory("user-1");

  assert.match(memory, /Patterns that keep showing up/);
  assert.match(memory, /How these appear to connect/);
  assert.match(memory, /the signal that they are full lands late/);
  assert.doesNotMatch(
    memory,
    /Recurring themes across their entries/,
    "the flat theme list is superseded, not stacked on top of it"
  );
  assert.ok(memory.length <= 2200, `memory was ${memory.length} chars`);
});

test("buildUserReflectionMemory falls back to recurring themes before the graph exists", async () => {
  entryTarget.find = () => listChain(themedInsight("seeks reassurance under stress", 3));
  stubRollingMemory("");
  stubGraph({ nodes: [], edges: [] });

  const memory = await buildUserReflectionMemory("user-1");

  assert.match(memory, /Recurring themes across their entries/);
  assert.doesNotMatch(memory, /How these appear to connect/);
  assert.ok(memory.length <= 2200, `memory was ${memory.length} chars`);
});

test("buildUserReflectionMemory stays within its budget when every layer is full", async () => {
  const longSummary = "They kept circling the same evening routine and how it ends. ".repeat(6);
  entryTarget.find = () =>
    listChain(
      Array.from({ length: 40 }, (_, index) => ({
        journalId: `j${index}`,
        entryType: "guided",
        contextSummary: longSummary,
        emotionalTone: "tired but honest",
        dominantRegionId: "self_reflection_identity",
        entryCreatedAt: new Date(),
        themes: [
          {
            id: `theme-${index}`,
            label: `pattern number ${index} that keeps showing up`,
            rationale: longSummary,
            evidenceQuote: longSummary,
            confidence: 0.9,
          },
        ],
      }))
    );
  stubRollingMemory(longSummary.repeat(4));
  stubGraph({
    nodes: Array.from({ length: 12 }, (_, index) =>
      graphNode(`key-${index}`, `a long behavioural pattern label number ${index}`, 9 - index)
    ),
    edges: Array.from({ length: 12 }, (_, index) =>
      graphEdge({
        fromKey: "key-0",
        toKey: `key-${index + 1}`,
        rationale: longSummary,
      })
    ),
  });

  const memory = await buildUserReflectionMemory("user-1");

  // Six shipped call sites share this budget; overflowing it would silently
  // truncate the rolling narrative rather than the graph.
  assert.ok(memory.length <= 2200, `memory was ${memory.length} chars`);
});
