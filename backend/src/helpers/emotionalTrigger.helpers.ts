import { z } from "zod";
import {
  PATTERN_PROMPT_MIN_CONFIDENCE,
} from "./patternGraph.helpers";

/**
 * Shared vocabulary and AI-contract shapes for emotional triggers.
 *
 * A trigger is the situation, person, time, or thought that comes *right
 * before* an emotional response — "a message from my manager" before "going
 * quiet". The pair (trigger -> response) is the thing the user most often
 * cannot see themselves, and it is what guided reflection now hunts for one
 * question at a time.
 *
 * A trigger is always something that happened in the person's own account —
 * the response it sets off may be named in clinical words if that is how they
 * described it — and
 * `toTriggerPatternLabel` composes the pair into the behaviour-tied-to-trigger
 * phrasing the pattern graph already speaks ("goes quiet after criticism at
 * work"). That is deliberate: triggers enter the graph as ordinary pattern
 * nodes, so no consumer of `pattern_nodes` needs to learn a new shape.
 *
 * Like `patternGraph.helpers`, this module holds only pure functions and schema
 * declarations so both the services and their tests can use it without touching
 * Mongo or OpenAI.
 */

/**
 * The rung a guided question is currently on. The ladder is walked in order and
 * a rung is never skipped: you cannot ask what a response *does* for someone
 * before you know what sets it off.
 *
 *   surface  - a feeling is named but not what preceded it
 *   test     - a candidate trigger is named once, but has not been checked
 *   function - the trigger held up; probe what the response protects or costs
 *   none     - nothing trigger-shaped is on the table yet
 */
export const TRIGGER_STAGES = ["surface", "test", "function", "none"] as const;
export type TriggerStage = (typeof TRIGGER_STAGES)[number];

export const TRIGGER_STATUSES = ["emerging", "recurring", "confirmed"] as const;
export type TriggerStatus = (typeof TRIGGER_STATUSES)[number];

export const TRIGGER_LABEL_MAX = 64;
export const TRIGGER_RESPONSE_MAX = 64;
export const TRIGGER_EVIDENCE_MAX = 180;
export const SESSION_TRIGGERS_MAX = 3;
export const CARRIED_TRIGGERS_MAX = 8;

/**
 * Occurrences a trigger needs before it is spoken about as a pattern rather
 * than a one-off. Deliberately the same gate the pattern graph already uses to
 * decide a node is worth putting in a prompt (`buildPatternGraphMemoryBlock`) —
 * a second, different threshold would mean the analysis and the graph disagree
 * about what counts as established.
 */
export const TRIGGER_RECURRING_MIN_OCCURRENCES = 2;

/**
 * A trigger is only "confirmed" once it has been seen enough times *and* the
 * evidence behind it is strong enough to say out loud.
 */
export const TRIGGER_CONFIRMED_MIN_OCCURRENCES = 3;
export const TRIGGER_CONFIRMED_MIN_CONFIDENCE = PATTERN_PROMPT_MIN_CONFIDENCE;

export type SessionTrigger = {
  trigger: string;
  emotionalResponse: string;
  evidenceQuote: string;
  confidence: number;
  /** How many turns in this one session supported it. Never a lifetime count. */
  sessionOccurrences: number;
};

/**
 * The trigger tuple as the model returns it, declared **once**.
 *
 * The zod parser and the JSON schema below are twins. `guided-reflection.service`
 * already carries a comment about what happens when such a pair drifts
 * (`requestStructuredOpenAi`'s parser returns null and the *entire* payload is
 * lost, not just the bad field), so both are exported from here and every caller
 * reuses them rather than re-declaring the shape.
 */
export const sessionTriggerAiSchema = z.object({
  trigger: z.string().trim().max(TRIGGER_LABEL_MAX),
  emotionalResponse: z.string().trim().max(TRIGGER_RESPONSE_MAX),
  evidenceQuote: z.string().trim().max(TRIGGER_EVIDENCE_MAX),
  confidence: z.number().min(0).max(1),
});

export type SessionTriggerAi = z.infer<typeof sessionTriggerAiSchema>;

export const sessionTriggerJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    trigger: { type: "string", maxLength: TRIGGER_LABEL_MAX },
    emotionalResponse: { type: "string", maxLength: TRIGGER_RESPONSE_MAX },
    evidenceQuote: { type: "string", maxLength: TRIGGER_EVIDENCE_MAX },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["trigger", "emotionalResponse", "evidenceQuote", "confidence"],
} as const;

/**
 * `sessionSignals` is the per-turn trigger state carried through a guided
 * session. The client echoes it back on the next turn, exactly as it already
 * replays `previousDeeperReflections` — guided reflection has no server-side
 * session object, so the thread state lives on the client and is re-validated
 * on arrival.
 */
export const sessionSignalsAiSchema = z.object({
  triggers: z.array(sessionTriggerAiSchema).max(SESSION_TRIGGERS_MAX),
  activeTrigger: z.string().trim().max(TRIGGER_LABEL_MAX),
  triggerStage: z.enum(TRIGGER_STAGES),
});

export const sessionSignalsJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    triggers: {
      type: "array",
      maxItems: SESSION_TRIGGERS_MAX,
      items: sessionTriggerJsonSchema,
    },
    activeTrigger: { type: "string", maxLength: TRIGGER_LABEL_MAX },
    triggerStage: { type: "string", enum: [...TRIGGER_STAGES] },
  },
  required: ["triggers", "activeTrigger", "triggerStage"],
} as const;

export type SessionSignals = {
  triggers: SessionTrigger[];
  activeTrigger: string;
  triggerStage: TriggerStage;
};

export const EMPTY_SESSION_SIGNALS: SessionSignals = {
  triggers: [],
  activeTrigger: "",
  triggerStage: "none",
};

const clampTriggerConfidence = (value: number, fallback = 0.5): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
};

const collapseWhitespace = (value: string, limit: number): string =>
  (value || "").replace(/\s+/g, " ").trim().slice(0, limit);

/**
 * Compose a trigger/response pair into the label the pattern graph stores.
 *
 * The graph's whole vocabulary is "a behaviour tied to its trigger" — the shape
 * Ask Jade's mining prompt already produces ("goes quiet after a disagreement").
 * Composing here rather than adding a `kind: "trigger"` node keeps guided
 * reflection's output mergeable with chat- and journal-sourced nodes: the same
 * trigger surfaced in a chat and in a guided session lands on one node via
 * `toPatternKey`, instead of two that never meet.
 *
 * Returns "" when either half is missing — a response with no trigger is just a
 * mood, and a trigger with no response is just an event.
 */
export const toTriggerPatternLabel = (input: {
  trigger: string;
  emotionalResponse: string;
}): string => {
  const trigger = collapseWhitespace(input.trigger, TRIGGER_LABEL_MAX);
  const response = collapseWhitespace(
    input.emotionalResponse,
    TRIGGER_RESPONSE_MAX
  );

  if (!trigger || !response) {
    return "";
  }

  // "after" reads as the ordering claim the pair actually makes. Skip it when
  // the model already wrote a connective, so we never produce "after after ...".
  const alreadyConnected = /^(after|when|whenever|once|before|during)\b/i.test(
    trigger
  );
  const composed = alreadyConnected
    ? `${response} ${trigger}`
    : `${response} after ${trigger}`;

  return collapseWhitespace(composed, 64);
};

/**
 * Words that carry no identity for a trigger pair — articles, possessives, and
 * the connectives used to join a response to its trigger. Dropping the
 * connectives is what lets "goes quiet after criticism" and "goes quiet when
 * criticised" land on one key.
 */
const TRIGGER_KEY_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "my",
  "me",
  "i",
  "im",
  "of",
  "to",
  "in",
  "on",
  "at",
  "for",
  "from",
  "with",
  "and",
  "it",
  "that",
  "this",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "get",
  "gets",
  "getting",
  "feel",
  "feels",
  "feeling",
  "after",
  "when",
  "whenever",
  "once",
  "before",
  "during",
  "then",
  "some",
  "any",
  "someone",
  "something",
]);

/**
 * Aggressively collapse an English verb inflection: "goes"/"going"/"went" style
 * variance is the single most common way the model re-words the same behaviour
 * between one turn and the next.
 *
 * This is intentionally *not* `stemPatternToken` from `patternGraph.helpers`.
 * That stemmer enforces a 3-character minimum stem, so "goes" becomes "goe"
 * while "going" stays "going" and the two never meet. Relaxing it there is not
 * an option: `toPatternKey` produces the persisted `canonicalKey` of every
 * existing `pattern_nodes` row, and restemming would stop old nodes matching
 * their own key — silently duplicating every user's graph.
 */
const stemTriggerToken = (token: string): string => {
  let stem = token;

  // Stack the strips (unlike the graph's single pass) because this key is
  // session-local and disposable — an over-merge costs one wrong grouping in
  // one session, never a corrupted graph.
  for (let pass = 0; pass < 2; pass += 1) {
    if (stem.endsWith("ss") || stem.length <= 3) {
      break;
    }
    const suffix = ["ance", "ence", "ment", "ing", "ied", "ed", "es", "s"].find(
      candidate =>
        stem.endsWith(candidate) && stem.length - candidate.length >= 2
    );
    if (!suffix) {
      break;
    }
    stem = stem.slice(0, stem.length - suffix.length);
  }

  // "braces"/"bracing" both stem to "brac", but the bare infinitive "brace"
  // keeps its silent e and would split off. Same for isolate/isolates/isolating
  // and freeze/freezes/freezing — all common ways to name a response.
  //
  // The cost is that a rare word like "note" would collapse onto "not". A
  // behaviour label containing both is not a real case, and a wrong grouping
  // here lasts one session.
  if (stem.endsWith("e") && stem.length > 3) {
    stem = stem.slice(0, -1);
  }

  return stem;
};

/**
 * Session-local identity for a trigger pair.
 *
 * Used only to decide whether two things the model said during one session are
 * the *same* trigger. Cross-session identity is the pattern graph's job, and it
 * has a stage this cannot have: after exact/alias/canonical-key misses it falls
 * back to embedding similarity, which catches the re-wordings a stemmer never
 * will. So a split here is recoverable there — but a split here would show the
 * model two weak carried triggers where it should see one strong one, and the
 * next question would be aimed at the wrong rung.
 */
export const toTriggerMergeKey = (label: string): string => {
  const tokens = (label || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter(Boolean)
    .filter(token => !TRIGGER_KEY_STOPWORDS.has(token))
    .map(stemTriggerToken)
    .filter(Boolean);

  if (!tokens.length) {
    return "trigger";
  }

  return [...new Set(tokens)].sort().join("|").slice(0, 64);
};

/**
 * True when a trigger pair is substantial enough to keep — both halves present
 * and composable into a label.
 *
 * The clinical-term check that used to sit here was removed with the graph's:
 * a trigger response the person's own words name is worth recording whether or
 * not the word is a clinical one.
 */
export const isUsableSessionTrigger = (trigger: {
  trigger: string;
  emotionalResponse: string;
}): boolean => Boolean(toTriggerPatternLabel(trigger));

/**
 * Drop any evidence quote the user did not actually write.
 *
 * The model is told to copy a sentence verbatim, and mostly does — but an
 * evidence chip that was paraphrased or invented is worse than none, because it
 * is shown back as the user's own words. Same rule the graph refiner applies to
 * AI-proposed edge evidence: substring-present or discarded.
 *
 * The trigger itself survives; only the unsupported quote is cleared.
 */
export const sanitizeTriggerEvidence = <
  T extends { evidenceQuote: string }
>(
  triggers: T[],
  userWrittenText: string
): T[] => {
  const haystack = (userWrittenText || "").replace(/\s+/g, " ").toLowerCase();

  return (triggers || []).map(trigger => {
    const quote = collapseWhitespace(
      trigger.evidenceQuote,
      TRIGGER_EVIDENCE_MAX
    );
    if (!quote || !haystack.includes(quote.toLowerCase())) {
      return { ...trigger, evidenceQuote: "" };
    }
    return { ...trigger, evidenceQuote: quote };
  });
};

/**
 * Fold newly observed triggers into the ones earlier turns already surfaced.
 *
 * Deduping by `toPatternKey` rather than exact text is what lets "after my
 * manager messaged me" on turn 2 and "when my manager pings me" on turn 4 count
 * as the *same* trigger seen twice — which is the entire basis for saying a
 * trigger is repeating. Keeps the highest-confidence phrasing as
 * representative, matching `applyObservationToNode`'s rule in the graph.
 */
export const mergeSessionTriggers = (
  previous: SessionTrigger[] | undefined,
  incoming: Array<Partial<SessionTrigger>> | undefined
): SessionTrigger[] => {
  const byKey = new Map<string, SessionTrigger>();

  const absorb = (
    candidate: Partial<SessionTrigger>,
    countsAsNewObservation: boolean
  ) => {
    const trigger = collapseWhitespace(
      candidate.trigger || "",
      TRIGGER_LABEL_MAX
    );
    const emotionalResponse = collapseWhitespace(
      candidate.emotionalResponse || "",
      TRIGGER_RESPONSE_MAX
    );

    if (!isUsableSessionTrigger({ trigger, emotionalResponse })) {
      return;
    }

    const normalized: SessionTrigger = {
      trigger,
      emotionalResponse,
      evidenceQuote: collapseWhitespace(
        candidate.evidenceQuote || "",
        TRIGGER_EVIDENCE_MAX
      ),
      confidence: clampTriggerConfidence(candidate.confidence ?? 0.5),
      sessionOccurrences: Math.max(
        1,
        Math.floor(candidate.sessionOccurrences ?? 1)
      ),
    };

    const key = toTriggerMergeKey(
      toTriggerPatternLabel({ trigger, emotionalResponse })
    );
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, normalized);
      return;
    }

    // A repeat of something already carried is what makes it stronger, so the
    // count grows. Re-reading the same carried entry is not new evidence.
    const sessionOccurrences = countsAsNewObservation
      ? existing.sessionOccurrences + normalized.sessionOccurrences
      : Math.max(existing.sessionOccurrences, normalized.sessionOccurrences);

    const better =
      normalized.confidence > existing.confidence ? normalized : existing;

    byKey.set(key, {
      trigger: better.trigger,
      emotionalResponse: better.emotionalResponse,
      evidenceQuote: better.evidenceQuote || existing.evidenceQuote,
      confidence: Math.max(existing.confidence, normalized.confidence),
      sessionOccurrences,
    });
  };

  (previous || []).forEach(item => absorb(item, false));
  (incoming || []).forEach(item => absorb(item, true));

  return [...byKey.values()]
    .sort(
      (left, right) =>
        right.sessionOccurrences - left.sessionOccurrences ||
        right.confidence - left.confidence
    )
    .slice(0, CARRIED_TRIGGERS_MAX);
};

/**
 * How established a trigger is, given what the graph knows about it across all
 * of this user's entries and sessions — not just this session.
 *
 * This is the "enough evidence -> it's a pattern" rule the whole feature turns
 * on, so it lives in one place and both the session analysis and the weekly
 * analysis call it rather than each inventing their own cutoff.
 */
export const classifyTriggerStatus = (input: {
  occurrences: number;
  confidence: number;
}): TriggerStatus => {
  const occurrences = Number.isFinite(input.occurrences)
    ? Math.floor(input.occurrences)
    : 0;
  const confidence = clampTriggerConfidence(input.confidence, 0);

  if (
    occurrences >= TRIGGER_CONFIRMED_MIN_OCCURRENCES &&
    confidence >= TRIGGER_CONFIRMED_MIN_CONFIDENCE
  ) {
    return "confirmed";
  }
  if (occurrences >= TRIGGER_RECURRING_MIN_OCCURRENCES) {
    return "recurring";
  }
  return "emerging";
};

/**
 * Second-person pronouns, which the session analysis must never contain.
 *
 * The analysis is a third-person report *about* a session — "they went quiet
 * after the message" — not a reflection addressed to the reader. The model is
 * told this, but a model told to change voice mid-product reverts under
 * pressure, so every generated and every hand-authored analysis string is
 * checked before it ships.
 *
 * Deliberately not matching "your" inside a quoted sentence is out of scope:
 * evidence quotes are the user's own words and are stored in their own field,
 * never inside the prose this guards.
 */
const SECOND_PERSON_PATTERN =
  /\b(you|your|yours|youre|you're|you've|youve|you'll|youll|you'd|youd|yourself|yourselves)\b/i;

/**
 * True when the text is clean of second-person address.
 *
 * Named for the assertion it makes so call sites read as a guard:
 * `if (!isThirdPersonVoice(text)) { ...fall back... }`.
 */
export const isThirdPersonVoice = (value: string): boolean =>
  !SECOND_PERSON_PATTERN.test(value || "");

/**
 * The failing pronoun, for diagnostics. Returns null when the text is clean.
 * Only ever logged as the matched pronoun — never the surrounding sentence,
 * which is user-derived content.
 */
export const findSecondPersonPronoun = (value: string): string | null => {
  const match = SECOND_PERSON_PATTERN.exec(value || "");
  return match ? match[0].toLowerCase() : null;
};
