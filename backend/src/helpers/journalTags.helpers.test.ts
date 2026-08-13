import assert from "node:assert/strict";
import test from "node:test";
import {
  filterReservedJournalTags,
  isReservedJournalTag,
} from "./journalTags.helpers";

test("filters legacy onboarding metadata while preserving user tags", () => {
  assert.equal(isReservedJournalTag("onboarding:first-reflection"), true);
  assert.equal(isReservedJournalTag(" Onboarding:first:reflection "), true);
  assert.equal(isReservedJournalTag("reflection"), false);
  assert.deepEqual(
    filterReservedJournalTags([
      "anxiety",
      "onboarding:first-reflection",
      "loneliness",
    ]),
    ["anxiety", "loneliness"]
  );
});
