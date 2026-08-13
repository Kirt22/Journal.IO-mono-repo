import assert from "node:assert/strict";
import test from "node:test";
import {
  areGoalIntentsDeterministicallyDuplicate,
  canonicalizeGoalIntent,
  filterNovelGoalSuggestions,
  getCosineSimilarity,
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

test("all duplicates can produce an empty suggestion list", async () => {
  const result = await filterNovelGoalSuggestions(
    [{ title: "Reflection after food" }],
    [{ title: "Journal after walking" }],
    { useEmbeddings: false }
  );

  assert.deepEqual(result, []);
});
