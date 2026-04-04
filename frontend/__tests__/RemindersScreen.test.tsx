/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { Switch } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import PrimaryButton from "../src/components/PrimaryButton";
import RemindersScreen from "../src/screens/reminders/RemindersScreen";
import {
  createReminder,
  getPrimaryDailyReminder,
} from "../src/services/remindersService";
import {
  requestReminderPermission,
  sendTestReminderNotification,
  syncReminderNotifications,
} from "../src/services/reminderNotificationsService";
import { getCurrentStreakSummary } from "../src/services/streaksService";

jest.mock("../src/services/remindersService", () => ({
  createReminder: jest.fn(async payload => ({
    reminderId: "reminder-1",
    type: "daily_journal",
    enabled: payload.enabled,
    time: payload.time,
    timezone: payload.timezone,
    skipIfCompletedToday: payload.skipIfCompletedToday ?? true,
    includeWeekends: payload.includeWeekends ?? true,
    streakWarnings: payload.streakWarnings ?? true,
    createdAt: "2026-04-03T10:00:00.000Z",
    updatedAt: "2026-04-03T10:00:00.000Z",
  })),
  getPrimaryDailyReminder: jest.fn(async () => null),
  updateReminder: jest.fn(),
}));

jest.mock("../src/services/reminderNotificationsService", () => ({
  cancelReminderNotifications: jest.fn(async () => undefined),
  getDefaultReminderTimezone: jest.fn(() => "Asia/Kolkata"),
  requestReminderPermission: jest.fn(async () => true),
  sendTestReminderNotification: jest.fn(async () => undefined),
  syncReminderNotifications: jest.fn(async () => undefined),
}));

jest.mock("../src/services/streaksService", () => ({
  getCurrentStreakSummary: jest.fn(async () => ({
    currentStreak: 4,
    bestStreak: 7,
    thisMonthEntries: 5,
    totalEntries: 12,
    achievements: [],
  })),
}));

const safeAreaMetrics = {
  frame: {
    x: 0,
    y: 0,
    width: 390,
    height: 844,
  },
  insets: {
    top: 47,
    bottom: 34,
    left: 0,
    right: 0,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

function extractText(node: unknown): string {
  if (node == null) {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(child => extractText(child)).join("");
  }

  if (typeof node === "object" && "children" in node) {
    return extractText((node as { children?: unknown }).children);
  }

  return "";
}

async function flushAsyncWork() {
  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

test("loads the reminders screen and enables a daily reminder", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <RemindersScreen onBack={jest.fn()} />
      </SafeAreaProvider>
    );
    await Promise.resolve();
  });

  await flushAsyncWork();

  const tree = extractText(root!.toJSON());
  expect(getPrimaryDailyReminder).toHaveBeenCalledTimes(1);
  expect(tree).toContain("Daily Reminders");
  expect(tree).toContain("Smart Reminders");

  const switches = root!.root.findAllByType(Switch);

  await ReactTestRenderer.act(async () => {
    switches[0]?.props.onValueChange(true);
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(requestReminderPermission).toHaveBeenCalledTimes(1);
  expect(createReminder).toHaveBeenCalledWith(
    expect.objectContaining({
      enabled: true,
      time: "20:00",
      timezone: "Asia/Kolkata",
    })
  );
  expect(getCurrentStreakSummary).toHaveBeenCalledTimes(1);
  expect(syncReminderNotifications).toHaveBeenCalledWith(
    expect.objectContaining({
      reminderId: "reminder-1",
      enabled: true,
      time: "20:00",
    }),
    expect.objectContaining({
      currentStreak: 4,
    })
  );

  await ReactTestRenderer.act(async () => {
    root!.unmount();
  });
});

test("sends a test reminder notification from the preview card", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <RemindersScreen onBack={jest.fn()} />
      </SafeAreaProvider>
    );
    await Promise.resolve();
  });

  await flushAsyncWork();

  const triggerButton = root!.root.findAllByType(PrimaryButton).find(
    node => node.props.label === "Send Test Notification"
  );

  expect(triggerButton).toBeDefined();

  await ReactTestRenderer.act(async () => {
    triggerButton!.props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(requestReminderPermission).toHaveBeenCalledTimes(1);
  expect(sendTestReminderNotification).toHaveBeenCalledWith("8:00 PM");

  await ReactTestRenderer.act(async () => {
    root!.unmount();
  });
});
