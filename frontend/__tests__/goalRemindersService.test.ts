/**
 * @format
 */

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(async () => undefined),
    requestPermission: jest.fn(async () => ({ authorizationStatus: 1 })),
    getNotificationSettings: jest.fn(async () => ({ authorizationStatus: 1 })),
    getTriggerNotificationIds: jest.fn(async () => [] as string[]),
    cancelTriggerNotifications: jest.fn(async () => undefined),
    createTriggerNotification: jest.fn(async () => undefined),
  },
  AndroidImportance: { HIGH: 'HIGH', DEFAULT: 'DEFAULT' },
  AuthorizationStatus: { DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
  RepeatFrequency: { WEEKLY: 'WEEKLY', DAILY: 'DAILY' },
  TriggerType: { TIMESTAMP: 'TIMESTAMP' },
}));

import {
  GOAL_REMINDER_BUDGET,
  buildGoalNotificationId,
  cancelAllGoalReminders,
  syncGoalReminderNotifications,
} from '../src/services/goalRemindersService';
import type { SavedGoal } from '../src/services/goalsService';

const mockNotifee = require('@notifee/react-native').default;

// 2026-08-05 is a Wednesday. Local noon so "today at 21:00" is still ahead.
const NOW = new Date(2026, 7, 5, 12, 0, 0);

const makeGoal = (overrides: Partial<SavedGoal> & { id: string }): SavedGoal => ({
  title: `Goal ${overrides.id}`,
  description: null,
  icon: 'target',
  iconSource: 'fixed',
  frequency: 'daily',
  status: 'active',
  reminderEnabled: true,
  reminderTime: '21:00',
  lastCompletedLocalDate: null,
  isCompletedForPeriod: false,
  createdAt: new Date(2026, 7, 4, 9, 0, 0).toISOString(),
  updatedAt: new Date(2026, 7, 4, 9, 0, 0).toISOString(),
  ...overrides,
});

/** The ids actually handed to notifee, in scheduling order. */
const scheduledIds = () =>
  mockNotifee.createTriggerNotification.mock.calls.map(
    (call: [{ id: string }, unknown]) => call[0].id,
  );

const scheduledTimestamps = (goalId: string) =>
  mockNotifee.createTriggerNotification.mock.calls
    .filter((call: [{ id: string }, unknown]) => call[0].id.includes(goalId))
    .map((call: [unknown, { timestamp: number }]) => call[1].timestamp);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  jest.clearAllMocks();
  mockNotifee.getNotificationSettings.mockResolvedValue({
    authorizationStatus: 1,
  });
  mockNotifee.getTriggerNotificationIds.mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

test('schedules discrete, non-repeating triggers for a daily goal', async () => {
  await syncGoalReminderNotifications([makeGoal({ id: 'g1' })]);

  expect(mockNotifee.createTriggerNotification).toHaveBeenCalled();

  const [, trigger] = mockNotifee.createTriggerNotification.mock.calls[0];

  // Repeating triggers cannot be conditional: on iOS notifee drops the date part
  // of the timestamp, so "every day except today" is inexpressible.
  expect(trigger.repeatFrequency).toBeUndefined();
  expect(trigger.type).toBe('TIMESTAMP');

  // First occurrence is today at 21:00, because now is 12:00.
  expect(new Date(trigger.timestamp).getHours()).toBe(21);
  expect(new Date(trigger.timestamp).getDate()).toBe(5);
});

test("skips today's occurrence when the goal is already done today", async () => {
  await syncGoalReminderNotifications([
    makeGoal({
      id: 'g1',
      frequency: 'daily',
      lastCompletedLocalDate: '2026-08-05',
      isCompletedForPeriod: true,
    }),
  ]);

  const days = scheduledTimestamps('g1').map(
    (timestamp: number) => new Date(timestamp).getDate(),
  );

  // Today (the 5th) is absent; tomorrow onwards is scheduled.
  expect(days).not.toContain(5);
  expect(days).toContain(6);
});

test('skips this week for a weekly goal already done this week', async () => {
  const doneThisWeek = makeGoal({
    id: 'g1',
    frequency: 'weekly',
    // Created on a Tuesday, so the anchor weekday is Tuesday.
    createdAt: new Date(2026, 7, 4, 9, 0, 0).toISOString(),
    lastCompletedLocalDate: '2026-08-05',
    isCompletedForPeriod: true,
  });

  await syncGoalReminderNotifications([doneThisWeek]);

  const dates = scheduledTimestamps('g1').map(
    (timestamp: number) => new Date(timestamp),
  );

  expect(dates.length).toBeGreaterThan(0);
  // Anchored to the creation weekday (Tuesday), and never inside the week that
  // is already satisfied (week of Sun 2026-08-02).
  for (const date of dates) {
    expect(date.getDay()).toBe(2);
    expect(date.getTime()).toBeGreaterThan(new Date(2026, 7, 8).getTime());
  }
});

test('schedules nothing for goals that cannot have a reminder', async () => {
  await syncGoalReminderNotifications([
    makeGoal({ id: 'archived', status: 'archived' }),
    makeGoal({ id: 'toggled-off', reminderEnabled: false }),
    makeGoal({ id: 'no-time', reminderTime: null }),
    // No cadence to generate occurrences from, and it completes permanently.
    makeGoal({ id: 'as-needed', frequency: 'as_needed' }),
  ]);

  expect(mockNotifee.createTriggerNotification).not.toHaveBeenCalled();
});

test('cancels everything when notification permission is not granted', async () => {
  mockNotifee.getNotificationSettings.mockResolvedValue({
    authorizationStatus: 0,
  });
  mockNotifee.getTriggerNotificationIds.mockResolvedValue([
    buildGoalNotificationId('g1', 0),
    'journal-daily-reminder-3',
  ]);

  await syncGoalReminderNotifications([makeGoal({ id: 'g1' })]);

  expect(mockNotifee.createTriggerNotification).not.toHaveBeenCalled();
  // Only goal reminders are cleared — the daily journal reminder is untouched.
  expect(mockNotifee.cancelTriggerNotifications).toHaveBeenCalledWith([
    buildGoalNotificationId('g1', 0),
  ]);
});

test('never requests permission during a sync', async () => {
  await syncGoalReminderNotifications([makeGoal({ id: 'g1' })]);

  // Permission is only ever asked for on explicit intent, in the goal sheet.
  expect(mockNotifee.requestPermission).not.toHaveBeenCalled();
});

test('respects the budget and gives every goal its next occurrence first', async () => {
  const goals = Array.from({ length: GOAL_REMINDER_BUDGET + 1 }, (_, index) =>
    makeGoal({
      id: `g${index}`,
      // Staggered times so the sort order is deterministic and a naive
      // "sort all occurrences by timestamp" would starve the late ones.
      reminderTime: index % 2 === 0 ? '08:00' : '21:00',
      createdAt: new Date(2026, 7, 4, 9, index).toISOString(),
    }),
  );

  await syncGoalReminderNotifications(goals);

  const ids = scheduledIds();

  expect(ids).toHaveLength(GOAL_REMINDER_BUDGET);
  // Round-robin by occurrence index: with more goals than budget, every
  // scheduled notification is a *first* occurrence and no goal gets two.
  expect(ids.every((id: string) => id.endsWith('-0'))).toBe(true);
  expect(new Set(ids).size).toBe(GOAL_REMINDER_BUDGET);
});

test('sweeps stale goal notifications that are no longer wanted', async () => {
  mockNotifee.getTriggerNotificationIds.mockResolvedValue([
    // Left over from a deleted goal.
    buildGoalNotificationId('deleted-goal', 0),
    // Left over from a longer horizon on a previous app version.
    buildGoalNotificationId('g1', 3),
    'journal-weekly-ai-nudge-1',
  ]);

  await syncGoalReminderNotifications([
    makeGoal({ id: 'g1', reminderTime: '21:00' }),
  ]);

  const cancelled = mockNotifee.cancelTriggerNotifications.mock.calls.flat(2);

  expect(cancelled).toContain(buildGoalNotificationId('deleted-goal', 0));
  // Not a goal reminder — must survive.
  expect(cancelled).not.toContain('journal-weekly-ai-nudge-1');
});

test('a failed sync never throws into the caller', async () => {
  mockNotifee.getTriggerNotificationIds.mockRejectedValue(new Error('boom'));

  // A reminder sync must not break the goal mutation that triggered it.
  await expect(
    syncGoalReminderNotifications([makeGoal({ id: 'g1' })]),
  ).resolves.toBeUndefined();
});

test('cancelAllGoalReminders only clears goal-prefixed ids', async () => {
  mockNotifee.getTriggerNotificationIds.mockResolvedValue([
    buildGoalNotificationId('g1', 0),
    buildGoalNotificationId('g2', 1),
    'journal-daily-reminder-0',
    'journal-free-trial-ending-reminder',
  ]);

  await cancelAllGoalReminders();

  expect(mockNotifee.cancelTriggerNotifications).toHaveBeenCalledWith([
    buildGoalNotificationId('g1', 0),
    buildGoalNotificationId('g2', 1),
  ]);
});

test('the notification body names the goal and carries its id', async () => {
  await syncGoalReminderNotifications([
    makeGoal({
      id: 'g1',
      title: 'Journal every evening',
      icon: 'journal',
      description: 'One honest line.',
    }),
  ]);

  const [notification] = mockNotifee.createTriggerNotification.mock.calls[0];

  expect(notification.title).toContain('Journal every evening');
  expect(notification.body).toBe('One honest line.');
  expect(notification.data).toEqual({ kind: 'goal-reminder', goalId: 'g1' });
});
