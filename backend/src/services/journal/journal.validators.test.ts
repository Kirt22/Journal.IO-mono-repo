import assert from "node:assert/strict";
import test from "node:test";
import { suggestJournalTagsSchema } from "./journal.validators";

test("suggestJournalTagsSchema accepts content with optional selected tags", () => {
  const result = suggestJournalTagsSchema.safeParse({
    body: {
      content: "Today felt calmer after I wrote everything out.",
      selectedTags: ["reflection"],
      mood: "bad",
    },
  });

  assert.equal(result.success, true);
});

test("suggestJournalTagsSchema rejects empty content", () => {
  const result = suggestJournalTagsSchema.safeParse({
    body: {
      content: "   ",
    },
  });

  assert.equal(result.success, false);
});
