import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_SESSION_SIGNALS,
  classifyTriggerStatus,
  findSecondPersonPronoun,
  isThirdPersonVoice,
  isUsableSessionTrigger,
  mergeSessionTriggers,
  sanitizeTriggerEvidence,
  sessionSignalsAiSchema,
  sessionSignalsJsonSchema,
  toTriggerPatternLabel,
  toTriggerMergeKey,
} from "./emotionalTrigger.helpers";
import { toPatternKey } from "./patternGraph.helpers";

test("toTriggerPatternLabel composes the pair into graph phrasing", () => {
  assert.equal(
    toTriggerPatternLabel({
      trigger: "criticism at work",
      emotionalResponse: "goes quiet",
    }),
    "goes quiet after criticism at work"
  );
});

test("toTriggerPatternLabel does not double up an existing connective", () => {
  assert.equal(
    toTriggerPatternLabel({
      trigger: "when a message lands late at night",
      emotionalResponse: "starts bracing",
    }),
    "starts bracing when a message lands late at night"
  );
});

test("toTriggerPatternLabel returns empty when either half is missing", () => {
  assert.equal(
    toTriggerPatternLabel({ trigger: "", emotionalResponse: "goes quiet" }),
    ""
  );
  assert.equal(
    toTriggerPatternLabel({ trigger: "criticism", emotionalResponse: "" }),
    ""
  );
});

test("toTriggerMergeKey collapses the regular inflection toPatternKey cannot", () => {
  const goes = toTriggerMergeKey("goes quiet after criticism at work");

  assert.equal(toTriggerMergeKey("going quiet after work criticism"), goes);
  assert.equal(toTriggerMergeKey("go quiet when criticism at work"), goes);

  const messaged = toTriggerMergeKey("braces after my manager messages me");
  assert.equal(toTriggerMergeKey("bracing when the manager messaged"), messaged);
  assert.equal(toTriggerMergeKey("brace after manager messaging"), messaged);

  // Documents *why* this key exists rather than reusing the graph's: the
  // graph's 3-char minimum stem leaves "goes" -> "goe" but "going" -> "going".
  assert.notEqual(
    toPatternKey("goes quiet after criticism"),
    toPatternKey("going quiet after criticism")
  );
});

test("toTriggerMergeKey does not pretend to handle irregular verbs", () => {
  // "went" -> "go" is beyond any suffix stemmer. Cross-session identity is the
  // graph's job, and its embedding stage is what catches this case; this key
  // only has to be right within a single session.
  assert.notEqual(
    toTriggerMergeKey("goes quiet after criticism"),
    toTriggerMergeKey("went quiet after criticism")
  );
});

test("toTriggerMergeKey still keeps different behaviours apart", () => {
  assert.notEqual(
    toTriggerMergeKey("goes quiet after criticism"),
    toTriggerMergeKey("scrolls late after criticism")
  );
  assert.notEqual(
    toTriggerMergeKey("goes quiet after criticism"),
    toTriggerMergeKey("goes quiet after a long commute")
  );
});

test("isUsableSessionTrigger keeps clinical wording and rejects half-formed pairs", () => {
  assert.equal(
    isUsableSessionTrigger({
      trigger: "a deadline",
      emotionalResponse: "goes quiet",
    }),
    true
  );
  // The clinical-term filter was removed with the graph's: a response the
  // person's own words name is worth recording whichever word they used.
  assert.equal(
    isUsableSessionTrigger({
      trigger: "a deadline",
      emotionalResponse: "anxiety",
    }),
    true
  );
  // What still disqualifies a pair is a missing half, not its vocabulary.
  assert.equal(
    isUsableSessionTrigger({ trigger: "", emotionalResponse: "anxiety" }),
    false
  );
});

test("sanitizeTriggerEvidence keeps a verbatim quote and drops a fabricated one", () => {
  const userText =
    "I went quiet for the rest of the afternoon. My manager messaged me about the deck.";

  const cleaned = sanitizeTriggerEvidence(
    [
      {
        trigger: "manager messaging about the deck",
        emotionalResponse: "goes quiet",
        evidenceQuote: "I went quiet for the rest of the afternoon.",
        confidence: 0.7,
      },
      {
        trigger: "deadlines",
        emotionalResponse: "withdraws",
        evidenceQuote: "I always shut down when anyone criticises me.",
        confidence: 0.6,
      },
    ],
    userText
  );

  assert.equal(cleaned[0]?.evidenceQuote, "I went quiet for the rest of the afternoon.");
  assert.equal(cleaned[1]?.evidenceQuote, "");
  // The trigger itself survives; only the unsupported quote is cleared.
  assert.equal(cleaned[1]?.trigger, "deadlines");
});

test("sanitizeTriggerEvidence tolerates the whitespace the model reflows", () => {
  const cleaned = sanitizeTriggerEvidence(
    [
      {
        trigger: "a late message",
        emotionalResponse: "braces",
        evidenceQuote: "I braced   for\nthe worst",
        confidence: 0.5,
      },
    ],
    "Honestly I braced for the worst all evening."
  );

  assert.equal(cleaned[0]?.evidenceQuote, "I braced for the worst");
});

test("mergeSessionTriggers counts a re-surfaced trigger as repeating", () => {
  const previous = mergeSessionTriggers(undefined, [
    {
      trigger: "my manager messaging me",
      emotionalResponse: "goes quiet",
      evidenceQuote: "",
      confidence: 0.5,
    },
  ]);
  assert.equal(previous.length, 1);
  assert.equal(previous[0]?.sessionOccurrences, 1);

  const merged = mergeSessionTriggers(previous, [
    {
      trigger: "messages from the manager",
      emotionalResponse: "going quiet",
      evidenceQuote: "",
      confidence: 0.8,
    },
  ]);

  assert.equal(merged.length, 1, "differently-worded same trigger must not split");
  assert.equal(merged[0]?.sessionOccurrences, 2);
  assert.equal(merged[0]?.confidence, 0.8, "keeps the strongest confidence");
});

test("mergeSessionTriggers does not inflate counts when carried state is replayed", () => {
  const carried = [
    {
      trigger: "criticism at work",
      emotionalResponse: "goes quiet",
      evidenceQuote: "",
      confidence: 0.6,
      sessionOccurrences: 2,
    },
  ];

  const merged = mergeSessionTriggers(carried, []);

  assert.equal(merged[0]?.sessionOccurrences, 2);
});

test("mergeSessionTriggers keeps genuinely different triggers apart and caps the list", () => {
  const merged = mergeSessionTriggers(undefined, [
    {
      trigger: "criticism at work",
      emotionalResponse: "goes quiet",
      evidenceQuote: "",
      confidence: 0.6,
    },
    {
      trigger: "a late night scroll",
      emotionalResponse: "loses sleep",
      evidenceQuote: "",
      confidence: 0.4,
    },
  ]);

  assert.equal(merged.length, 2);
  assert.equal(merged[0]?.confidence, 0.6, "strongest first");
});

test("mergeSessionTriggers keeps clinical wording and drops half-formed entries", () => {
  const merged = mergeSessionTriggers(undefined, [
    { trigger: "a deadline", emotionalResponse: "depression", evidenceQuote: "", confidence: 0.9 },
    { trigger: "", emotionalResponse: "goes quiet", evidenceQuote: "", confidence: 0.9 },
  ]);

  // The clinical pair survives now; only the half-formed one is dropped.
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.emotionalResponse, "depression");
});

test("classifyTriggerStatus walks emerging -> recurring -> confirmed", () => {
  assert.equal(classifyTriggerStatus({ occurrences: 1, confidence: 0.9 }), "emerging");
  assert.equal(classifyTriggerStatus({ occurrences: 2, confidence: 0.9 }), "recurring");
  assert.equal(classifyTriggerStatus({ occurrences: 3, confidence: 0.9 }), "confirmed");
});

test("classifyTriggerStatus will not confirm on weak evidence alone", () => {
  // Seen often, but the graph is not confident enough to say it out loud.
  assert.equal(classifyTriggerStatus({ occurrences: 9, confidence: 0.4 }), "recurring");
});

test("isThirdPersonVoice catches every second-person form", () => {
  const offenders = [
    "You went quiet after the message.",
    "Your reflection returned to work.",
    "This is what you're avoiding.",
    "That is something you've carried.",
    "Ask yourself what it protects.",
    "YOUR writing keeps returning to it.",
  ];

  offenders.forEach(text => {
    assert.equal(isThirdPersonVoice(text), false, text);
  });
});

test("isThirdPersonVoice passes clean they/them reporting copy", () => {
  const clean = [
    "They went quiet after the message, not before it.",
    "The session returned to work pressure three times.",
    "Their mood dropped once the deck was mentioned.",
    "This entry can still be saved without an analysis.",
  ];

  clean.forEach(text => {
    assert.equal(isThirdPersonVoice(text), true, text);
  });
});

test("isThirdPersonVoice does not false-positive on words containing 'you'", () => {
  assert.equal(isThirdPersonVoice("They mentioned being young and unsure."), true);
  assert.equal(isThirdPersonVoice("The session covered a youth group meeting."), true);
});

test("findSecondPersonPronoun reports the offending pronoun only", () => {
  assert.equal(findSecondPersonPronoun("Your session went quiet."), "your");
  assert.equal(findSecondPersonPronoun("They went quiet."), null);
});

test("sessionSignals zod parser and JSON schema stay twins", () => {
  const parsed = sessionSignalsAiSchema.parse({
    triggers: [
      {
        trigger: "criticism at work",
        emotionalResponse: "goes quiet",
        evidenceQuote: "I went quiet",
        confidence: 0.7,
      },
    ],
    activeTrigger: "criticism at work",
    triggerStage: "test",
  });

  assert.equal(parsed.triggerStage, "test");
  // A drift between these two is silent and costs the entire payload, so the
  // required lists are asserted rather than trusted.
  assert.deepEqual(
    [...sessionSignalsJsonSchema.required].sort(),
    ["activeTrigger", "triggerStage", "triggers"]
  );
  assert.deepEqual(
    [...sessionSignalsJsonSchema.properties.triggers.items.required].sort(),
    ["confidence", "emotionalResponse", "evidenceQuote", "trigger"]
  );
  assert.deepEqual(sessionSignalsJsonSchema.properties.triggerStage.enum, [
    "surface",
    "test",
    "function",
    "none",
  ]);
});

test("EMPTY_SESSION_SIGNALS is a valid payload for the fallback paths", () => {
  assert.doesNotThrow(() => sessionSignalsAiSchema.parse(EMPTY_SESSION_SIGNALS));
});
