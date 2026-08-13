import assert from "node:assert/strict";
import test from "node:test";
import {
  createJournalSchema,
  getJournalsSchema,
  getJournalSessionAnalysisSchema,
  suggestJournalTagsSchema,
} from "./journal.validators";

test("getJournalsSchema accepts bounded cursor pagination and date filters", () => {
  const result = getJournalsSchema.safeParse({
    query: {
      limit: "25",
      cursor: "opaque-cursor",
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-09-01T00:00:00.000Z",
    },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.query.limit, 25);
  }
});

test("getJournalsSchema rejects invalid page sizes and reversed ranges", () => {
  assert.equal(
    getJournalsSchema.safeParse({ query: { limit: "51" } }).success,
    false
  );
  assert.equal(
    getJournalsSchema.safeParse({
      query: {
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-08-01T00:00:00.000Z",
      },
    }).success,
    false
  );
});

test("createJournalSchema accepts supported entry kinds", () => {
  assert.equal(
    createJournalSchema.safeParse({
      body: {
        title: "Quick Thought",
        content: "A short note.",
        entryKind: "quick_thought",
      },
    }).success,
    true
  );
  assert.equal(
    createJournalSchema.safeParse({
      body: {
        title: "Quick Thought",
        content: "A short note.",
        entryKind: "quick_note",
      },
    }).success,
    false
  );
});

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

test("getJournalSessionAnalysisSchema requires a journal ID", () => {
  assert.equal(
    getJournalSessionAnalysisSchema.safeParse({
      body: { journalId: "journal-1" },
    }).success,
    true
  );
  assert.equal(
    getJournalSessionAnalysisSchema.safeParse({
      body: { journalId: "   " },
    }).success,
    false
  );
});
