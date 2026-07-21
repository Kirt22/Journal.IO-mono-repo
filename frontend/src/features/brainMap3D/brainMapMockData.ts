import {
  closestBrainContourSliceIndex,
  distanceBetweenBrainMapPoints,
  generateBrainLikeNodePositions3D,
  shapeBrainMapPositionForType3D,
} from "./brainMapLayout3D";
import type {
  BrainMapEdge,
  BrainMapNode,
  BrainMapNodeType,
  BrainMapSnapshot,
} from "./brainMapTypes";

type BrainMapNodeSeed = {
  id: string;
  label: string;
  type: BrainMapNodeType;
  weight: number;
  prominence: number;
  relatedEntryCount?: number;
  explanation: string;
};

type BrainMapEdgeSeed = Omit<BrainMapEdge, "id">;

const CORE_NODE_SEEDS: BrainMapNodeSeed[] = [
  {
    id: "discipline",
    label: "Discipline",
    type: "theme",
    weight: 0.96,
    prominence: 0.98,
    relatedEntryCount: 7,
    explanation:
      "A recurring pattern may be forming around showing up consistently, especially when days feel busy.",
  },
  {
    id: "stress",
    label: "Stress",
    type: "emotion",
    weight: 0.88,
    prominence: 0.92,
    relatedEntryCount: 6,
    explanation:
      "Journal entries suggest stress appears alongside work pressure and uneven sleep.",
  },
  {
    id: "family",
    label: "Family",
    type: "context",
    weight: 0.72,
    prominence: 0.62,
    relatedEntryCount: 4,
    explanation:
      "Family appears as a steady context around support, expectations, and moments of grounding.",
  },
  {
    id: "tomorrow",
    label: "Tomorrow",
    type: "tomorrow",
    weight: 0.9,
    prominence: 0.95,
    relatedEntryCount: 5,
    explanation:
      "Planning for tomorrow appears associated with clearer focus and calmer evening reflections.",
  },
  {
    id: "writing-habit",
    label: "Writing habit",
    type: "habit",
    weight: 0.86,
    prominence: 0.9,
    relatedEntryCount: 8,
    explanation:
      "Writing regularly may be helping separate scattered thoughts into smaller, more workable patterns.",
  },
  {
    id: "self-awareness",
    label: "Self-awareness",
    type: "theme",
    weight: 0.82,
    prominence: 0.88,
    relatedEntryCount: 6,
    explanation:
      "Several reflections point toward noticing reactions earlier and naming what may have influenced them.",
  },
  {
    id: "energy",
    label: "Energy",
    type: "emotion",
    weight: 0.7,
    prominence: 0.68,
    relatedEntryCount: 5,
    explanation:
      "Energy levels may shift with sleep quality, routine, and how much focus the day requires.",
  },
  {
    id: "focus",
    label: "Focus",
    type: "goal",
    weight: 0.8,
    prominence: 0.76,
    relatedEntryCount: 5,
    explanation:
      "Focus appears connected to planning, fewer open loops, and small starts rather than big pushes.",
  },
  {
    id: "confidence",
    label: "Confidence",
    type: "emotion",
    weight: 0.74,
    prominence: 0.7,
    relatedEntryCount: 3,
    explanation:
      "Confidence seems to rise around visible progress and moments where you keep promises to yourself.",
  },
  {
    id: "sleep",
    label: "Sleep",
    type: "habit",
    weight: 0.68,
    prominence: 0.66,
    relatedEntryCount: 4,
    explanation:
      "Sleep appears associated with next-day energy and how manageable work feels.",
  },
  {
    id: "work",
    label: "Work",
    type: "context",
    weight: 0.78,
    prominence: 0.74,
    relatedEntryCount: 6,
    explanation:
      "Work shows up as a frequent context for pressure, focus, and small wins.",
  },
  {
    id: "mood",
    label: "Mood",
    type: "emotion",
    weight: 0.7,
    prominence: 0.63,
    relatedEntryCount: 5,
    explanation:
      "Mood may be influenced by sleep, work rhythm, and whether the day has a clear next step.",
  },
  {
    id: "gratitude",
    label: "Gratitude",
    type: "theme",
    weight: 0.62,
    prominence: 0.56,
    relatedEntryCount: 3,
    explanation:
      "Gratitude appears in small observations rather than large events, which may make it easier to repeat.",
  },
  {
    id: "routine",
    label: "Routine",
    type: "habit",
    weight: 0.76,
    prominence: 0.72,
    relatedEntryCount: 5,
    explanation:
      "Routine appears connected with steadier energy and fewer decisions at the end of the day.",
  },
  {
    id: "boundaries",
    label: "Boundaries",
    type: "goal",
    weight: 0.7,
    prominence: 0.64,
    relatedEntryCount: 3,
    explanation:
      "Boundaries may be emerging as a practical way to protect focus and recover after busy periods.",
  },
  {
    id: "motivation",
    label: "Motivation",
    type: "emotion",
    weight: 0.66,
    prominence: 0.6,
    relatedEntryCount: 4,
    explanation:
      "Motivation appears strongest when the next action is small and connected to a larger goal.",
  },
  {
    id: "calm",
    label: "Calm",
    type: "emotion",
    weight: 0.64,
    prominence: 0.58,
    relatedEntryCount: 3,
    explanation:
      "Calm appears most often around slower evenings, fewer open loops, and a clearer start for tomorrow.",
  },
  {
    id: "momentum",
    label: "Momentum",
    type: "goal",
    weight: 0.68,
    prominence: 0.61,
    relatedEntryCount: 4,
    explanation:
      "Momentum appears connected to small starts that make the next step feel easier to reach.",
  },
  {
    id: "reflection",
    label: "Reflection",
    type: "entry",
    weight: 0.58,
    prominence: 0.52,
    relatedEntryCount: 4,
    explanation:
      "Reflection entries suggest a pattern of slowing down enough to notice what mattered.",
  },
  {
    id: "clarity",
    label: "Clarity",
    type: "theme",
    weight: 0.7,
    prominence: 0.67,
    relatedEntryCount: 4,
    explanation:
      "Clarity seems to grow when thoughts are written down and grouped into smaller next actions.",
  },
];

const GENERATED_NODE_TYPES: BrainMapNodeType[] = [
  "entry",
  "context",
  "emotion",
  "habit",
  "theme",
  "entry",
  "goal",
];

const GENERATED_NODE_SEEDS: BrainMapNodeSeed[] = Array.from(
  { length: 14 },
  (_, index) => {
    const sequence = index + 1;
    const labelPrefix =
      sequence % 3 === 0 ? "Entry" : sequence % 2 === 0 ? "Thought" : "Pattern";

    return {
      id: `${labelPrefix.toLowerCase()}-${String(sequence).padStart(2, "0")}`,
      label: `${labelPrefix} ${String(sequence).padStart(2, "0")}`,
      type: GENERATED_NODE_TYPES[index % GENERATED_NODE_TYPES.length],
      weight: 0.32 + ((index % 8) * 0.035),
      prominence: 0.18 + ((index % 9) * 0.035),
      relatedEntryCount: 1 + (index % 4),
      explanation:
        "This mock point represents a smaller repeated idea that may connect with a broader pattern over time.",
    };
  }
);

const SEMANTIC_EDGE_SEEDS: BrainMapEdgeSeed[] = [
  { from: "discipline", to: "writing-habit", strength: 0.98, reason: "consistent writing" },
  { from: "discipline", to: "routine", strength: 0.9, reason: "daily structure" },
  { from: "discipline", to: "momentum", strength: 0.86, reason: "small starts" },
  { from: "discipline", to: "confidence", strength: 0.82, reason: "kept promises" },
  { from: "stress", to: "work", strength: 0.9, reason: "work pressure" },
  { from: "stress", to: "sleep", strength: 0.84, reason: "rest rhythm" },
  { from: "stress", to: "boundaries", strength: 0.7, reason: "protecting focus" },
  { from: "stress", to: "mood", strength: 0.72, reason: "daily tone" },
  { from: "tomorrow", to: "focus", strength: 0.92, reason: "next-step planning" },
  { from: "tomorrow", to: "clarity", strength: 0.88, reason: "clearer morning" },
  { from: "tomorrow", to: "routine", strength: 0.78, reason: "evening planning" },
  { from: "tomorrow", to: "calm", strength: 0.72, reason: "fewer open loops" },
  { from: "writing-habit", to: "self-awareness", strength: 0.92, reason: "noticing patterns" },
  { from: "writing-habit", to: "reflection", strength: 0.86, reason: "entry rhythm" },
  { from: "self-awareness", to: "clarity", strength: 0.88, reason: "named patterns" },
  { from: "self-awareness", to: "mood", strength: 0.68, reason: "earlier noticing" },
  { from: "family", to: "gratitude", strength: 0.66, reason: "support moments" },
  { from: "family", to: "calm", strength: 0.58, reason: "grounding context" },
  { from: "energy", to: "sleep", strength: 0.82, reason: "rest and energy" },
  { from: "energy", to: "focus", strength: 0.74, reason: "attention capacity" },
  { from: "energy", to: "routine", strength: 0.7, reason: "daily rhythm" },
  { from: "focus", to: "clarity", strength: 0.82, reason: "fewer open loops" },
  { from: "focus", to: "boundaries", strength: 0.68, reason: "protected attention" },
  { from: "confidence", to: "momentum", strength: 0.74, reason: "visible progress" },
  { from: "confidence", to: "gratitude", strength: 0.54, reason: "small wins" },
  { from: "sleep", to: "calm", strength: 0.64, reason: "steady evenings" },
  { from: "work", to: "boundaries", strength: 0.78, reason: "workable limits" },
  { from: "work", to: "routine", strength: 0.62, reason: "structured days" },
  { from: "mood", to: "gratitude", strength: 0.58, reason: "small observations" },
  { from: "routine", to: "calm", strength: 0.72, reason: "less decision load" },
  { from: "motivation", to: "momentum", strength: 0.76, reason: "small action" },
  { from: "motivation", to: "focus", strength: 0.64, reason: "clear next step" },
];

function makeEdgeId(from: string, to: string) {
  return [from, to].sort().join("__");
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

function addEdge(
  edges: BrainMapEdge[],
  connectionCounts: Map<string, number>,
  maxConnectionCounts: Map<string, number>,
  seenEdges: Set<string>,
  edge: BrainMapEdgeSeed
) {
  const edgeId = makeEdgeId(edge.from, edge.to);
  const fromMax = maxConnectionCounts.get(edge.from) ?? 2;
  const toMax = maxConnectionCounts.get(edge.to) ?? 2;

  if (
    edge.from === edge.to ||
    seenEdges.has(edgeId) ||
    (connectionCounts.get(edge.from) ?? 0) >= fromMax ||
    (connectionCounts.get(edge.to) ?? 0) >= toMax
  ) {
    return false;
  }

  seenEdges.add(edgeId);
  connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
  connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  edges.push({
    ...edge,
    id: edgeId,
    strength: rounded(Math.max(0.2, Math.min(1, edge.strength))),
  });

  return true;
}

function getTypeAffinity(firstType: BrainMapNodeType, secondType: BrainMapNodeType) {
  if (firstType === secondType) {
    return 0.22;
  }

  if (
    (firstType === "theme" && secondType === "entry") ||
    (firstType === "entry" && secondType === "theme") ||
    (firstType === "goal" && secondType === "habit") ||
    (firstType === "habit" && secondType === "goal") ||
    (firstType === "emotion" && secondType === "context") ||
    (firstType === "context" && secondType === "emotion")
  ) {
    return 0.16;
  }

  return 0;
}

function createEdges(nodes: BrainMapNode[]) {
  const edges: BrainMapEdge[] = [];
  const seenEdges = new Set<string>();
  const connectionCounts = new Map(nodes.map(node => [node.id, 0]));
  const maxConnectionCounts = new Map(
    nodes.map(node => [
      node.id,
      node.prominence >= 0.92 ? 3 : node.prominence >= 0.56 ? 3 : 2,
    ])
  );
  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const sliceIndexesByNodeId = new Map(
    nodes.map(node => [node.id, closestBrainContourSliceIndex(node.position.z)])
  );

  SEMANTIC_EDGE_SEEDS.forEach(edge => {
    if (nodesById.has(edge.from) && nodesById.has(edge.to)) {
      addEdge(edges, connectionCounts, maxConnectionCounts, seenEdges, edge);
    }
  });

  const nodesByProminence = [...nodes].sort(
    (firstNode, secondNode) => secondNode.prominence - firstNode.prominence
  );

  nodesByProminence.forEach(node => {
    const desiredConnections = maxConnectionCounts.get(node.id) ?? 2;
    const nodeSliceIndex = sliceIndexesByNodeId.get(node.id) ?? 0;
    const candidates = nodes
      .filter(candidateNode => candidateNode.id !== node.id)
      .map(candidateNode => {
        const distance = distanceBetweenBrainMapPoints(
          node.position,
          candidateNode.position
        );
        const candidateSliceIndex =
          sliceIndexesByNodeId.get(candidateNode.id) ?? nodeSliceIndex;
        const sliceGap = Math.abs(nodeSliceIndex - candidateSliceIndex);

        return {
          node: candidateNode,
          score:
            distance -
            candidateNode.prominence * 0.32 -
            getTypeAffinity(node.type, candidateNode.type) +
            sliceGap * 0.36,
          distance,
          sliceGap,
        };
      })
      .sort((firstCandidate, secondCandidate) => firstCandidate.score - secondCandidate.score);

    for (const candidate of candidates) {
      if ((connectionCounts.get(node.id) ?? 0) >= desiredConnections) {
        break;
      }

      if (edges.length >= 54) {
        break;
      }

      if (
        candidate.sliceGap > 1 &&
        node.prominence < 0.78 &&
        candidate.node.prominence < 0.78
      ) {
        continue;
      }

      const strength = Math.max(
        0.22,
        Math.min(
          0.82,
          0.9 -
            candidate.distance * 0.23 -
            candidate.sliceGap * 0.08 +
            node.prominence * 0.12
        )
      );

      addEdge(edges, connectionCounts, maxConnectionCounts, seenEdges, {
        from: node.id,
        to: candidate.node.id,
        strength,
        reason: "nearby pattern cluster",
      });
    }
  });

  return edges.slice(0, 54);
}

const NODE_SEEDS = [...CORE_NODE_SEEDS, ...GENERATED_NODE_SEEDS];
const positions = generateBrainLikeNodePositions3D(
  NODE_SEEDS.length,
  "journal-io-mind-map-mock-snapshot"
);
const nodes: BrainMapNode[] = NODE_SEEDS.map((node, index) => ({
  ...node,
  position: shapeBrainMapPositionForType3D(positions[index], node.type, index),
}));
const edges = createEdges(nodes);

export const brainMapMockSnapshot: BrainMapSnapshot = {
  id: "journal-io-brain-map-dev-snapshot",
  generatedAt: "2026-07-01T00:00:00.000Z",
  nodes,
  edges,
  prominentNodeIds: [...nodes]
    .sort((firstNode, secondNode) => secondNode.prominence - firstNode.prominence)
    .slice(0, 3)
    .map(node => node.id),
};
