import assert from "node:assert/strict";
import test from "node:test";
import { normalizeJournalEntryKind } from "./journalEntryKind.helpers";

test("normalizeJournalEntryKind keeps explicit entry kinds", () => {
  assert.equal(
    normalizeJournalEntryKind("quick_thought", "Renamed thought"),
    "quick_thought"
  );
  assert.equal(normalizeJournalEntryKind("journal", "Quick Thought"), "journal");
});

test("normalizeJournalEntryKind recognizes legacy Quick Thought titles", () => {
  assert.equal(normalizeJournalEntryKind(undefined, "Quick Thought"), "quick_thought");
  assert.equal(normalizeJournalEntryKind(undefined, "Morning note"), "journal");
});
