import { request } from "../src/utils/apiClient";
import { syncOnboardingReminderRecordPreference } from "../src/services/remindersService";

jest.mock("../src/utils/apiClient", () => ({
  request: jest.fn(),
}));

const requestMock = request as jest.Mock;

const buildReminder = (overrides: Record<string, unknown> = {}) => ({
  reminderId: "reminder-1",
  type: "daily_journal",
  enabled: true,
  time: "20:00",
  timezone: "Asia/Kolkata",
  skipIfCompletedToday: true,
  includeWeekends: true,
  streakWarnings: true,
  createdAt: "2026-04-03T10:00:00.000Z",
  updatedAt: "2026-04-03T10:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  requestMock.mockReset();
});

test("creates a daily reminder record from an onboarding preference", async () => {
  const createdReminder = buildReminder({
    time: "20:00",
  });

  requestMock
    .mockResolvedValueOnce({
      data: {
        reminders: [],
      },
    })
    .mockResolvedValueOnce({
      data: createdReminder,
    });

  const result = await syncOnboardingReminderRecordPreference("Evening", {
    enabled: true,
    timezone: "Asia/Kolkata",
  });

  expect(result).toEqual(createdReminder);
  expect(requestMock).toHaveBeenNthCalledWith(1, "/reminders", {
    method: "GET",
  });
  expect(requestMock).toHaveBeenNthCalledWith(2, "/reminders", {
    method: "POST",
    body: JSON.stringify({
      type: "daily_journal",
      enabled: true,
      time: "20:00",
      timezone: "Asia/Kolkata",
      skipIfCompletedToday: true,
      includeWeekends: true,
      streakWarnings: true,
    }),
  });
});

test("stores the selected onboarding reminder time as disabled when permission is unavailable", async () => {
  const existingReminder = buildReminder();
  const updatedReminder = buildReminder({
    enabled: false,
    time: "08:00",
  });

  requestMock
    .mockResolvedValueOnce({
      data: {
        reminders: [existingReminder],
      },
    })
    .mockResolvedValueOnce({
      data: updatedReminder,
    });

  const result = await syncOnboardingReminderRecordPreference("morning", {
    enabled: false,
    timezone: "Asia/Kolkata",
  });

  expect(result).toEqual(updatedReminder);
  expect(requestMock).toHaveBeenNthCalledWith(2, "/reminders/reminder-1", {
    method: "PATCH",
    body: JSON.stringify({
      enabled: false,
      time: "08:00",
      timezone: "Asia/Kolkata",
      skipIfCompletedToday: true,
      includeWeekends: true,
      streakWarnings: true,
    }),
  });
});

test("disables an existing reminder when onboarding selects no reminders", async () => {
  const existingReminder = buildReminder();
  const updatedReminder = buildReminder({
    enabled: false,
  });

  requestMock
    .mockResolvedValueOnce({
      data: {
        reminders: [existingReminder],
      },
    })
    .mockResolvedValueOnce({
      data: updatedReminder,
    });

  const result = await syncOnboardingReminderRecordPreference("none", {
    enabled: false,
    timezone: "Asia/Kolkata",
  });

  expect(result).toEqual(updatedReminder);
  expect(requestMock).toHaveBeenNthCalledWith(2, "/reminders/reminder-1", {
    method: "PATCH",
    body: JSON.stringify({
      enabled: false,
      timezone: "Asia/Kolkata",
    }),
  });
});
