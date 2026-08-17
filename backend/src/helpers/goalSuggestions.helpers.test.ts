import assert from "node:assert/strict";
import test from "node:test";
import {
  areGoalIntentsDeterministicallyDuplicate,
  areGoalIntentsMergeable,
  canonicalizeGoalIntent,
  filterNovelGoalSuggestions,
  getCosineSimilarity,
  mergeGoalIntents,
} from "./goalSuggestions.helpers";

test("canonical intent ignores timing and journaling synonyms", () => {
  assert.equal(
    canonicalizeGoalIntent("Journal for 5 minutes after a walk"),
    "reflect"
  );
  assert.equal(
    canonicalizeGoalIntent("5 minutes of reflection after a meal"),
    "reflect"
  );
  assert.equal(
    areGoalIntentsDeterministicallyDuplicate(
      { title: "Journal for 5 minutes after a walk" },
      { title: "5 minutes of reflection after a meal" }
    ),
    true
  );
});

test("different core actions remain novel", () => {
  assert.equal(
    areGoalIntentsDeterministicallyDuplicate(
      { title: "Journal after lunch" },
      { title: "Walk outside after lunch" }
    ),
    false
  );
});

test("filter removes saved and within-batch duplicates without embeddings", async () => {
  const result = await filterNovelGoalSuggestions(
    [
      { title: "Reflect for five minutes after dinner" },
      { title: "Take a short walk outside" },
      { title: "Walk outside for ten minutes" },
    ],
    [{ title: "Journal for five minutes after a walk" }],
    { useEmbeddings: false }
  );

  assert.deepEqual(result.map((goal) => goal.title), [
    "Take a short walk outside",
  ]);
});

test("semantic filtering uses one batch request and the cosine threshold", async () => {
  let requestCount = 0;
  const result = await filterNovelGoalSuggestions(
    [{ title: "Create a calm buffer" }],
    [{ title: "Protect quiet space" }],
    {
      embeddingRequester: async (texts) => {
        requestCount += 1;
        assert.equal(texts.length, 2);
        return [
          [1, 0],
          [0.9, 0.1],
        ];
      },
    }
  );

  assert.equal(requestCount, 1);
  assert.deepEqual(result, []);
  assert.ok(getCosineSimilarity([1, 0], [0.9, 0.1]) >= 0.84);
});

test("embedding failure preserves deterministic novel results", async () => {
  const result = await filterNovelGoalSuggestions(
    [{ title: "Walk outside" }],
    [{ title: "Write one line" }],
    { embeddingRequester: async () => null }
  );

  assert.equal(result.length, 1);
  assert.equal(result[0]?.title, "Walk outside");
});

test("the same core action at two detail levels is mergeable", () => {
  assert.equal(
    areGoalIntentsMergeable(
      { title: "Write for 5 minutes" },
      { title: "Write one line after dinner" }
    ),
    true
  );
});

test("different core actions are never mergeable", () => {
  assert.equal(
    areGoalIntentsMergeable(
      { title: "Walk after dinner" },
      { title: "Call mum after dinner" }
    ),
    false
  );
});

test("merging keeps the duration of one goal and the trigger of the other", () => {
  const merged = mergeGoalIntents(
    {
      title: "Write for 5 minutes",
      description: "Put down a few lines about the day.",
      frequency: "as_needed",
      icon: "journal",
    },
    {
      title: "Write one line after dinner",
      description: "After dinner, write one line about what repeated today.",
      frequency: "daily",
      icon: "mood",
    }
  );

  assert.equal(merged.title, "Write for 5 minutes after dinner");
  // The more specific description wins, and the more frequent cadence survives.
  assert.equal(
    merged.description,
    "After dinner, write one line about what repeated today."
  );
  assert.equal(merged.frequency, "daily");
  assert.equal(merged.icon, "journal");
});

test("merging leaves the title alone when the combination would not fit", () => {
  const merged = mergeGoalIntents(
    { title: "Write a reflective paragraph every single evening" },
    { title: "Write a paragraph before the day is over" }
  );

  assert.equal(merged.title, "Write a reflective paragraph");
});

test("overlapping suggestions collapse into one merged goal", async () => {
  const result = await filterNovelGoalSuggestions(
    [
      { title: "Write for 5 minutes", description: "Put down a few lines." },
      {
        title: "Write one line after dinner",
        description: "After dinner, write one line about the day.",
      },
      { title: "Message one person", description: "Reach out to one friend." },
    ],
    [],
    { useEmbeddings: false }
  );

  assert.deepEqual(result.map((goal) => goal.title), [
    "Write for 5 minutes after dinner",
    "Message one person",
  ]);
});

test("a suggestion that repeats a saved goal is dropped, not merged", async () => {
  const result = await filterNovelGoalSuggestions(
    [{ title: "Write one line after dinner" }, { title: "Walk 20 minutes" }],
    [{ title: "Write for 5 minutes" }],
    { useEmbeddings: false }
  );

  assert.deepEqual(result.map((goal) => goal.title), ["Walk 20 minutes"]);
});

test("semantic overlap between candidates merges instead of dropping", async () => {
  const result = await filterNovelGoalSuggestions(
    [
      { title: "Take a breathing break", description: "Slow down for a moment." },
      {
        title: "Breathe slowly before bed",
        description: "Before bed, take two slow minutes.",
      },
    ],
    [{ title: "Read a chapter" }],
    {
      embeddingRequester: async () => [
        [0, 1],
        [1, 0],
        [0.95, 0.05],
      ],
    }
  );

  assert.equal(result.length, 1);
  assert.equal(result[0]?.title, "Take a breathing break before bed");
});

test("all duplicates can produce an empty suggestion list", async () => {
  const result = await filterNovelGoalSuggestions(
    [{ title: "Reflection after food" }],
    [{ title: "Journal after walking" }],
    { useEmbeddings: false }
  );

  assert.deepEqual(result, []);
});
