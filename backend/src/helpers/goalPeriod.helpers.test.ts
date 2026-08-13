import assert from "node:assert/strict";
import test from "node:test";
import {
  getServerFallbackDateKey,
  getWeekStartKey,
  isGoalDoneForPeriod,
  isGoalFrequency,
  isValidLocalDateKey,
} from "./goalPeriod.helpers";

test("isValidLocalDateKey accepts real date keys and rejects the rest", () => {
  assert.equal(isValidLocalDateKey("2026-08-05"), true);
  assert.equal(isValidLocalDateKey("2024-02-29"), true, "leap day is real");

  assert.equal(isValidLocalDateKey("2026-02-30"), false);
  assert.equal(isValidLocalDateKey("2026-13-01"), false);
  assert.equal(isValidLocalDateKey("2026-8-5"), false);
  assert.equal(isValidLocalDateKey("not-a-date"), false);
  assert.equal(isValidLocalDateKey(""), false);
  assert.equal(isValidLocalDateKey(null), false);
  assert.equal(isValidLocalDateKey(20260805), false);
});

test("isGoalFrequency guards the frequency union", () => {
  assert.equal(isGoalFrequency("daily"), true);
  assert.equal(isGoalFrequency("weekly"), true);
  assert.equal(isGoalFrequency("as_needed"), true);
  assert.equal(isGoalFrequency("monthly"), false);
  assert.equal(isGoalFrequency(undefined), false);
});

test("getWeekStartKey snaps to the containing Sunday", () => {
  // 2026-08-05 is a Wednesday; its week starts Sunday 2026-08-02.
  assert.equal(getWeekStartKey("2026-08-05"), "2026-08-02");
  assert.equal(getWeekStartKey("2026-08-02"), "2026-08-02", "Sunday is its own start");
  assert.equal(getWeekStartKey("2026-08-08"), "2026-08-02", "Saturday closes that week");
  assert.equal(getWeekStartKey("2026-08-09"), "2026-08-09", "next Sunday opens a new week");
  assert.equal(getWeekStartKey("bad"), null);
});

test("getWeekStartKey crosses a month boundary", () => {
  // 2026-08-01 is a Saturday, so its week began in July.
  assert.equal(getWeekStartKey("2026-08-01"), "2026-07-26");
});

test("as_needed goals stay done once completed, whatever the date", () => {
  const goal = { frequency: "as_needed" as const, lastCompletedLocalDate: "2019-01-01" };

  assert.equal(isGoalDoneForPeriod(goal, "2026-08-05"), true);
  // The stored value is never compared for as_needed, so even a nonsense date
  // counts. This is what makes the legacy `completed` migration lossless.
  assert.equal(
    isGoalDoneForPeriod({ frequency: "as_needed", lastCompletedLocalDate: "garbage" }, "2026-08-05"),
    true
  );
});

test("daily goals reset the next local day", () => {
  const goal = { frequency: "daily" as const, lastCompletedLocalDate: "2026-08-05" };

  assert.equal(isGoalDoneForPeriod(goal, "2026-08-05"), true);
  assert.equal(isGoalDoneForPeriod(goal, "2026-08-06"), false);
  assert.equal(isGoalDoneForPeriod(goal, "2026-08-04"), false);
});

test("weekly goals reset at the Sunday boundary", () => {
  // Completed Wednesday 2026-08-05 (week of 2026-08-02).
  const goal = { frequency: "weekly" as const, lastCompletedLocalDate: "2026-08-05" };

  assert.equal(isGoalDoneForPeriod(goal, "2026-08-05"), true);
  assert.equal(isGoalDoneForPeriod(goal, "2026-08-08"), true, "still the same week (Sat)");
  assert.equal(isGoalDoneForPeriod(goal, "2026-08-09"), false, "new week starts Sunday");
  assert.equal(isGoalDoneForPeriod(goal, "2026-08-01"), false, "previous week");
});

test("a goal with no completion is never done", () => {
  for (const frequency of ["daily", "weekly", "as_needed"] as const) {
    assert.equal(
      isGoalDoneForPeriod({ frequency, lastCompletedLocalDate: null }, "2026-08-05"),
      false
    );
    assert.equal(isGoalDoneForPeriod({ frequency }, "2026-08-05"), false);
  }
});

test("an unparseable stored date is treated as not done for recurring goals", () => {
  assert.equal(
    isGoalDoneForPeriod({ frequency: "daily", lastCompletedLocalDate: "2026-02-30" }, "2026-08-05"),
    false
  );
  assert.equal(
    isGoalDoneForPeriod({ frequency: "weekly", lastCompletedLocalDate: "nope" }, "2026-08-05"),
    false
  );
});

test("an unknown frequency falls back to as_needed semantics", () => {
  assert.equal(
    isGoalDoneForPeriod(
      { frequency: "monthly" as never, lastCompletedLocalDate: "2019-01-01" },
      "2026-08-05"
    ),
    true
  );
});

test("getServerFallbackDateKey formats a UTC date key", () => {
  assert.equal(getServerFallbackDateKey(new Date("2026-08-05T23:30:00.000Z")), "2026-08-05");
});
