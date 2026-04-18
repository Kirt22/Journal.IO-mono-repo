import assert from "node:assert/strict";
import test from "node:test";
import {
  getCurrentStreakSchema,
  getStreakHistorySchema,
} from "./streaks.validators";

test("getCurrentStreakSchema accepts an empty GET request payload", () => {
  const result = getCurrentStreakSchema.safeParse({
    body: {},
    query: {},
    params: {},
  });

  assert.equal(result.success, true);
});

test("getStreakHistorySchema accepts a valid days query", () => {
  const result = getStreakHistorySchema.safeParse({
    body: {},
    query: { days: "30" },
    params: {},
  });

  assert.equal(result.success, true);

  if (result.success) {
    assert.equal(result.data.query.days, 30);
  }
});

test("getStreakHistorySchema rejects days below the allowed minimum", () => {
  const result = getStreakHistorySchema.safeParse({
    body: {},
    query: { days: "0" },
    params: {},
  });

  assert.equal(result.success, false);
});

test("getStreakHistorySchema rejects days above the allowed maximum", () => {
  const result = getStreakHistorySchema.safeParse({
    body: {},
    query: { days: "366" },
    params: {},
  });

  assert.equal(result.success, false);
});
