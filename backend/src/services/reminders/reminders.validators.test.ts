import assert from "node:assert/strict";
import test from "node:test";
import {
  createReminderSchema,
  deleteReminderSchema,
  getRemindersSchema,
  updateReminderSchema,
} from "./reminders.validators";

test("createReminderSchema accepts a valid daily reminder payload", () => {
  const result = createReminderSchema.safeParse({
    body: {
      enabled: true,
      time: "20:00",
      timezone: "Asia/Kolkata",
      skipIfCompletedToday: true,
      includeWeekends: false,
      streakWarnings: true,
    },
  });

  assert.equal(result.success, true);
});

test("createReminderSchema rejects invalid time values", () => {
  const result = createReminderSchema.safeParse({
    body: {
      enabled: true,
      time: "8 PM",
      timezone: "Asia/Kolkata",
    },
  });

  assert.equal(result.success, false);
});

test("getRemindersSchema accepts an empty request", () => {
  const result = getRemindersSchema.safeParse({});
  assert.equal(result.success, true);
});

test("updateReminderSchema requires at least one field", () => {
  const result = updateReminderSchema.safeParse({
    body: {},
    params: {
      reminderId: "reminder-1",
    },
  });

  assert.equal(result.success, false);
});

test("deleteReminderSchema requires a reminder id", () => {
  const result = deleteReminderSchema.safeParse({
    params: {
      reminderId: "reminder-1",
    },
  });

  assert.equal(result.success, true);
});
