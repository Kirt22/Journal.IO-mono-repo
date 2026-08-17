import { requestEmbeddings } from "./openai.helpers";

export const GOAL_DUPLICATE_COSINE_THRESHOLD = 0.84;
/**
 * Merging keeps the specifics of both goals instead of discarding one, so it can
 * safely run at a lower bar than the drop threshold used against saved goals.
 */
export const GOAL_MERGE_COSINE_THRESHOLD = 0.76;
/** A merged title stays scannable on a goal card. */
const MERGED_TITLE_MAX = 38;

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

// "at" is deliberately absent: it reads as a trigger in "at 8pm" but not in
// "look at your budget", and a wrong trigger would be appended to a title.
const TRIGGER_WORDS = "after|before|when|whenever|during|upon|every|each";
const TRIGGER_PHRASE = new RegExp(`\\b(?:${TRIGGER_WORDS})\\b[^.,;:!?]*`, "i");
const TRAILING_TRIGGER = new RegExp(
  `\\s*\\b(?:${TRIGGER_WORDS}|at)\\b[^.,;:!?]*$`,
  "i"
);
const QUANTITY_PHRASE =
  /\b\d[\d,]*\s*(?:minute|min|hour|hr|step|page|session|glass|rep|set|time|day|km|mile)s?\b/i;

const FREQUENCY_RANK: Record<string, number> = {
  daily: 3,
  weekly: 2,
  as_needed: 1,
};

/** Pulls a short "after dinner" / "before bed" clause that can be appended to a title. */
export const extractTriggerPhrase = (value: string | null | undefined) => {
  const match = (value || "").match(TRIGGER_PHRASE);

  if (!match?.[0]) {
    return "";
  }

  return match[0]
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ")
    .replace(/[^a-z0-9)]+$/i, "")
    .toLowerCase();
};

export const extractQuantityPhrase = (value: string | null | undefined) =>
  (value || "").match(QUANTITY_PHRASE)?.[0]?.trim() || "";

const stripTrailingTrigger = (title: string) =>
  title.replace(TRAILING_TRIGGER, "").trim();

const getSpecificityScore = (text: string | null | undefined) =>
  (extractTriggerPhrase(text) ? 1 : 0) + (extractQuantityPhrase(text) ? 1 : 0);

const getFrequency = (goal: GoalIntent) =>
  (goal as { frequency?: unknown }).frequency;

/**
 * True when two suggestions are the same core action at different levels of
 * detail — "Write for 5 minutes" and "Write one line after dinner". Deliberately
 * looser than the duplicate check because the caller merges instead of dropping.
 */
export const areGoalIntentsMergeable = (left: GoalIntent, right: GoalIntent) => {
  if (areGoalIntentsDeterministicallyDuplicate(left, right)) {
    return true;
  }

  const leftTokens = [...getTokens(left.title)];
  const rightTokens = [...getTokens(right.title)];

  if (!leftTokens.length || !rightTokens.length) {
    return false;
  }

  // The first canonical token is the core action. Without this guard "walk after
  // dinner" and "call mum after dinner" would look mergeable.
  if (leftTokens[0] !== rightTokens[0]) {
    return false;
  }

  const isSubset =
    leftTokens.every((token) => rightTokens.includes(token)) ||
    rightTokens.every((token) => leftTokens.includes(token));

  return (
    isSubset ||
    getJaccardSimilarity(new Set(leftTokens), new Set(rightTokens)) >= 0.5
  );
};

/**
 * Folds `extra` into `base` so one goal keeps the duration and the trigger of
 * both. The title is rebuilt (we control that append); descriptions are selected
 * rather than spliced so the copy never turns ungrammatical.
 */
export const mergeGoalIntents = <T extends GoalIntent>(
  base: T,
  extra: T
): T => {
  const quantitySource = extractQuantityPhrase(base.title)
    ? base.title
    : extractQuantityPhrase(extra.title)
    ? extra.title
    : base.title;
  const core = stripTrailingTrigger(quantitySource) || base.title.trim();
  const trigger =
    extractTriggerPhrase(base.title) ||
    extractTriggerPhrase(extra.title) ||
    extractTriggerPhrase(base.description) ||
    extractTriggerPhrase(extra.description);

  let title = core;

  if (trigger && !extractTriggerPhrase(core)) {
    const combined = `${core} ${trigger}`;

    if (combined.length <= MERGED_TITLE_MAX) {
      title = combined;
    }
  }

  // Descriptions are chosen, never spliced: whichever already names a trigger or
  // a quantity is the one that still reads correctly next to the merged title.
  const description = !base.description
    ? extra.description ?? base.description
    : !extra.description
    ? base.description
    : getSpecificityScore(extra.description) >
      getSpecificityScore(base.description)
    ? extra.description
    : base.description;

  const baseFrequency = getFrequency(base);
  const extraFrequency = getFrequency(extra);
  const frequency =
    typeof baseFrequency === "string" && typeof extraFrequency === "string"
      ? (FREQUENCY_RANK[extraFrequency] || 0) > (FREQUENCY_RANK[baseFrequency] || 0)
        ? extraFrequency
        : baseFrequency
      : baseFrequency ?? extraFrequency;

  const merged = { ...base, title } as T;
  const mergedRecord = merged as unknown as Record<string, unknown>;

  if (description !== undefined) {
    mergedRecord["description"] = description;
  }

  if (frequency !== undefined) {
    mergedRecord["frequency"] = frequency;
  }

  return merged;
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
  /** Bounds the work per call. Raised when topping up from the baseline bank. */
  maxCandidates?: number;
};

/**
 * Drops candidates that repeat a saved goal, and folds candidates that overlap
 * each other into a single goal that keeps the specifics of both. Embeddings are
 * best effort and are never persisted.
 */
export const filterNovelGoalSuggestions = async <T extends GoalIntent>(
  candidates: T[],
  existingGoals: GoalIntent[],
  {
    useEmbeddings = true,
    embeddingRequester = requestEmbeddings,
    maxCandidates = 4,
  }: NoveltyOptions = {}
): Promise<T[]> => {
  const deterministicCandidates: T[] = [];

  for (const candidate of candidates.slice(0, maxCandidates)) {
    // A saved goal is never merged into: the user already has it, and suggestions
    // only ever create new goals. The looser mergeable bar is the right one here
    // — "write after dinner" adds nothing when "write for 5 minutes" is saved.
    const repeatsSavedGoal = existingGoals.some((existing) =>
      areGoalIntentsMergeable(candidate, existing)
    );

    if (repeatsSavedGoal) {
      continue;
    }

    const overlapIndex = deterministicCandidates.findIndex((accepted) =>
      areGoalIntentsMergeable(candidate, accepted)
    );

    if (overlapIndex >= 0) {
      deterministicCandidates[overlapIndex] = mergeGoalIntents(
        deterministicCandidates[overlapIndex]!,
        candidate
      );
      continue;
    }

    deterministicCandidates.push(candidate);
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
    const candidate = deterministicCandidates[index]!;
    const vector = embeddings[existingCount + index];

    if (!vector) {
      accepted.push(candidate);
      continue;
    }

    const repeatsSavedGoal = embeddings
      .slice(0, existingCount)
      .some(
        (comparison) =>
          getCosineSimilarity(vector, comparison) >=
          GOAL_DUPLICATE_COSINE_THRESHOLD
      );

    if (repeatsSavedGoal) {
      continue;
    }

    const overlapIndex = acceptedVectors.findIndex(
      (comparison) =>
        getCosineSimilarity(vector, comparison) >= GOAL_MERGE_COSINE_THRESHOLD
    );

    if (overlapIndex >= 0) {
      // The merged text is a near neighbour of the vector we already have, so the
      // kept vector stays representative and no second round-trip is needed.
      accepted[overlapIndex] = mergeGoalIntents(
        accepted[overlapIndex]!,
        candidate
      );
      continue;
    }

    accepted.push(candidate);
    acceptedVectors.push(vector);
  }

  return accepted;
};
