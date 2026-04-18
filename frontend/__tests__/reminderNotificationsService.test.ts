/**
 * @format
 */

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(async () => undefined),
    requestPermission: jest.fn(async () => ({
      authorizationStatus: 1,
    })),
    getNotificationSettings: jest.fn(async () => ({
      authorizationStatus: 1,
    })),
    cancelTriggerNotifications: jest.fn(async () => undefined),
    createTriggerNotification: jest.fn(async () => undefined),
  },
  AndroidImportance: {
    HIGH: "HIGH",
  },
  AuthorizationStatus: {
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  },
  RepeatFrequency: {
    WEEKLY: "WEEKLY",
  },
  TriggerType: {
    TIMESTAMP: "TIMESTAMP",
  },
}));

import {
  cancelFreeTrialEndingReminder,
  scheduleFreeTrialEndingReminder,
} from "../src/services/reminderNotificationsService";
const mockNotifee = require("@notifee/react-native").default;

beforeEach(() => {
  jest.clearAllMocks();
});

test("schedules the free-trial ending reminder five days after activation", async () => {
  const activatedAt = "2026-04-16T09:30:00.000Z";
  const expectedTimestamp =
    new Date(activatedAt).getTime() + 5 * 24 * 60 * 60 * 1000;

  const scheduled = await scheduleFreeTrialEndingReminder(activatedAt, {
    requestPermission: true,
  });

  expect(scheduled).toBe(true);
  expect(mockNotifee.requestPermission).toHaveBeenCalledTimes(1);
  expect(mockNotifee.cancelTriggerNotifications).toHaveBeenCalledWith([
    "journal-free-trial-ending-reminder",
  ]);
  expect(mockNotifee.createTriggerNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "journal-free-trial-ending-reminder",
      title: "Your free trial ends in 2 days",
    }),
    expect.objectContaining({
      type: "TIMESTAMP",
      timestamp: expectedTimestamp,
    })
  );
});

test("does not schedule the free-trial reminder when permission is denied", async () => {
  mockNotifee.requestPermission.mockResolvedValueOnce({
    authorizationStatus: 0,
  });

  const scheduled = await scheduleFreeTrialEndingReminder(
    "2026-04-16T09:30:00.000Z",
    {
      requestPermission: true,
    }
  );

  expect(scheduled).toBe(false);
  expect(mockNotifee.createTriggerNotification).not.toHaveBeenCalled();
});

test("cancels the free-trial ending reminder by its fixed notification id", async () => {
  await cancelFreeTrialEndingReminder();

  expect(mockNotifee.cancelTriggerNotifications).toHaveBeenCalledWith([
    "journal-free-trial-ending-reminder",
  ]);
});
