import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { reminderModel } from "../../schema/reminder.schema";
import {
  ReminderConflictError,
  ReminderNotFoundError,
  createReminderForUser,
  deleteReminderForUser,
  getRemindersForUser,
  updateReminderForUser,
} from "./reminders.service";

type QueryResult<T> = {
  exec: () => Promise<T>;
};

const reminderTarget = reminderModel as unknown as {
  find: (...args: unknown[]) => {
    sort: (...sortArgs: unknown[]) => QueryResult<unknown[]>;
  };
  findOne: (...args: unknown[]) => QueryResult<unknown> | Promise<unknown>;
  create: (...args: unknown[]) => Promise<unknown>;
  findOneAndUpdate: (...args: unknown[]) => QueryResult<unknown>;
  findOneAndDelete: (...args: unknown[]) => QueryResult<unknown>;
};

const originalFind = reminderTarget.find;
const originalFindOne = reminderTarget.findOne;
const originalCreate = reminderTarget.create;
const originalFindOneAndUpdate = reminderTarget.findOneAndUpdate;
const originalFindOneAndDelete = reminderTarget.findOneAndDelete;

afterEach(() => {
  reminderTarget.find = originalFind;
  reminderTarget.findOne = originalFindOne;
  reminderTarget.create = originalCreate;
  reminderTarget.findOneAndUpdate = originalFindOneAndUpdate;
  reminderTarget.findOneAndDelete = originalFindOneAndDelete;
});

const buildReminderDocument = (overrides: Record<string, unknown> = {}) => ({
  toObject: () => ({
    _id: "reminder-1",
    type: "daily_journal",
    enabled: true,
    time: "20:00",
    timezone: "Asia/Kolkata",
    skipIfCompletedToday: true,
    includeWeekends: true,
    streakWarnings: true,
    createdAt: new Date("2026-04-03T10:00:00.000Z"),
    updatedAt: new Date("2026-04-03T10:00:00.000Z"),
    ...overrides,
  }),
});

test("getRemindersForUser returns the user's reminders", async () => {
  reminderTarget.find = () => ({
    sort: () => ({
      exec: async () => [buildReminderDocument()],
    }),
  });

  const result = await getRemindersForUser("user-123");

  assert.equal(result.reminders.length, 1);
  assert.ok(result.reminders[0]);
  assert.equal(result.reminders[0]?.time, "20:00");
});

test("createReminderForUser creates a new reminder when none exists", async () => {
  reminderTarget.findOne = () => ({
    exec: async () => null,
  });
  reminderTarget.create = async (payload?: unknown) => {
    const reminderPayload = payload as Record<string, unknown> | undefined;

    return buildReminderDocument({
      enabled: reminderPayload?.enabled ?? true,
      time: reminderPayload?.time ?? "20:00",
      timezone: reminderPayload?.timezone ?? "Asia/Kolkata",
      skipIfCompletedToday: reminderPayload?.skipIfCompletedToday ?? true,
      includeWeekends: reminderPayload?.includeWeekends ?? true,
      streakWarnings: reminderPayload?.streakWarnings ?? true,
    });
  };

  const result = await createReminderForUser("user-123", {
    enabled: true,
    time: "18:00",
    timezone: "Asia/Kolkata",
    includeWeekends: false,
  });

  assert.equal(result.time, "18:00");
  assert.equal(result.includeWeekends, false);
});

test("createReminderForUser rejects duplicate reminder types", async () => {
  reminderTarget.findOne = () => ({
    exec: async () => buildReminderDocument(),
  });

  await assert.rejects(
    () =>
      createReminderForUser("user-123", {
        enabled: true,
        time: "20:00",
        timezone: "Asia/Kolkata",
      }),
    ReminderConflictError
  );
});

test("updateReminderForUser updates an owned reminder", async () => {
  reminderTarget.findOneAndUpdate = () => ({
    exec: async () =>
      buildReminderDocument({
        enabled: false,
        time: "21:00",
      }),
  });

  const result = await updateReminderForUser("user-123", "reminder-1", {
    enabled: false,
    time: "21:00",
  });

  assert.equal(result.enabled, false);
  assert.equal(result.time, "21:00");
});

test("updateReminderForUser throws when no owned reminder exists", async () => {
  reminderTarget.findOneAndUpdate = () => ({
    exec: async () => null,
  });

  await assert.rejects(
    () => updateReminderForUser("user-123", "missing-reminder", { enabled: false }),
    ReminderNotFoundError
  );
});

test("deleteReminderForUser removes an owned reminder", async () => {
  reminderTarget.findOneAndDelete = () => ({
    exec: async () => buildReminderDocument(),
  });

  const result = await deleteReminderForUser("user-123", "reminder-1");

  assert.equal(result.reminderId, "reminder-1");
});

test("deleteReminderForUser throws when no owned reminder exists", async () => {
  reminderTarget.findOneAndDelete = () => ({
    exec: async () => null,
  });

  await assert.rejects(
    () => deleteReminderForUser("user-123", "missing-reminder"),
    ReminderNotFoundError
  );
});
