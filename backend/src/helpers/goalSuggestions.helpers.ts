import { requestEmbeddings } from "./openai.helpers";

export const GOAL_DUPLICATE_COSINE_THRESHOLD = 0.84;

export type GoalIntent = {
  title: string;
  description?: string | null;
};

const normalizeIntentText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const INTENT_SYNONYMS: ReadonlyArray<[RegExp, string]> = [
  [/\b(journals?|journaling|diary|reflection|reflecting|reflections)\b/g, "reflect"],
  [/\b(stroll|strolling|hike|hiking|walking)\b/g, "walk"],
  [/\b(workout|working out|exercise|exercising|training)\b/g, "exercise"],
  [/\b(meditation|meditating|mindfulness|mindful)\b/g, "meditate"],
  [/\b(breathing|breathwork|breaths)\b/g, "breathe"],
  [/\b(phone|ring|facetime)\b/g, "call"],
  [/\b(tidy|tidying|declutter|decluttering)\b/g, "clean"],
];

const TIMING_TAIL =
  /\b(after|before|when|whenever|during|upon|at|every|each)\b.*$/;
const INTENT_FILLER = new Set([
  "a",
  "an",
  "and",
  "for",
  "five",
  "in",
  "minute",
  "minutes",
  "hour",
  "hours",
  "my",
  "of",
  "one",
  "the",
  "take",
  "ten",
  "short",
  "to",
  "today",
  "tomorrow",
  "weekly",
  "daily",
]);

/** Removes cadence and trigger details so the same action stays the same intent. */
export const canonicalizeGoalIntent = (value: string) => {
  let normalized = normalizeIntentText(value).replace(TIMING_TAIL, "");

  for (const [pattern, replacement] of INTENT_SYNONYMS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized
    .split(" ")
    .filter((token) => token && !/^\d+$/.test(token) && !INTENT_FILLER.has(token))
    .join(" ");
};

const getTokens = (value: string) =>
  new Set(canonicalizeGoalIntent(value).split(" ").filter(Boolean));

const getJaccardSimilarity = (left: Set<string>, right: Set<string>) => {
  if (!left.size || !right.size) {
    return 0;
  }

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  return intersection / (left.size + right.size - intersection);
};

export const areGoalIntentsDeterministicallyDuplicate = (
  left: GoalIntent,
  right: GoalIntent
) => {
  const normalizedLeft = normalizeIntentText(left.title);
  const normalizedRight = normalizeIntentText(right.title);

  if (normalizedLeft && normalizedLeft === normalizedRight) {
    return true;
  }

  const canonicalLeft = canonicalizeGoalIntent(left.title);
  const canonicalRight = canonicalizeGoalIntent(right.title);

  if (
    canonicalLeft.length >= 4 &&
    canonicalLeft === canonicalRight
  ) {
    return true;
  }

  return getJaccardSimilarity(getTokens(left.title), getTokens(right.title)) >= 0.78;
};

export const getGoalIntentEmbeddingText = (goal: GoalIntent) =>
  [goal.title.trim(), goal.description?.trim()]
    .filter(Boolean)
    .join(". ")
    .slice(0, 320);

export const getCosineSimilarity = (left: number[], right: number[]) => {
  if (!left.length || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] || 0;
    const rightValue = right[index] || 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
};

type NoveltyOptions = {
  useEmbeddings?: boolean;
  embeddingRequester?: typeof requestEmbeddings;
};

/**
 * Removes duplicates against every saved goal and earlier accepted candidates.
 * Embeddings are best effort and are never persisted.
 */
export const filterNovelGoalSuggestions = async <T extends GoalIntent>(
  candidates: T[],
  existingGoals: GoalIntent[],
  {
    useEmbeddings = true,
    embeddingRequester = requestEmbeddings,
  }: NoveltyOptions = {}
): Promise<T[]> => {
  const deterministicCandidates: T[] = [];

  for (const candidate of candidates.slice(0, 4)) {
    const isDuplicate = [...existingGoals, ...deterministicCandidates].some(
      (existing) =>
        areGoalIntentsDeterministicallyDuplicate(candidate, existing)
    );

    if (!isDuplicate) {
      deterministicCandidates.push(candidate);
    }
  }

  if (!useEmbeddings || deterministicCandidates.length === 0) {
    return deterministicCandidates;
  }

  const allIntents = [...existingGoals, ...deterministicCandidates];
  // The embeddings endpoint accepts at most 2,048 array inputs. Keep the
  // deterministic result rather than splitting this into multiple network calls.
  if (allIntents.length > 2048) {
    return deterministicCandidates;
  }

  let embeddings: number[][] | null = null;
  try {
    embeddings = await embeddingRequester(
      allIntents.map(getGoalIntentEmbeddingText)
    );
  } catch {
    embeddings = null;
  }

  if (!embeddings || embeddings.length !== allIntents.length) {
    return deterministicCandidates;
  }

  const existingCount = existingGoals.length;
  const accepted: T[] = [];
  const acceptedVectors: number[][] = [];

  for (let index = 0; index < deterministicCandidates.length; index += 1) {
    const vector = embeddings[existingCount + index];
    if (!vector) {
      accepted.push(deterministicCandidates[index]!);
      continue;
    }

    const comparisonVectors = [
      ...embeddings.slice(0, existingCount),
      ...acceptedVectors,
    ];
    const isSemanticDuplicate = comparisonVectors.some(
      (comparison) =>
        getCosineSimilarity(vector, comparison) >=
        GOAL_DUPLICATE_COSINE_THRESHOLD
    );

    if (!isSemanticDuplicate) {
      accepted.push(deterministicCandidates[index]!);
      acceptedVectors.push(vector);
    }
  }

  return accepted;
};
