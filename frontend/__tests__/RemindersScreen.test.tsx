/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AppState, Switch } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RemindersScreen from '../src/screens/reminders/RemindersScreen';
import {
  createReminder,
  getPrimaryDailyReminder,
} from '../src/services/remindersService';
import {
  getReminderPermissionGranted,
  requestReminderPermission,
  syncReminderNotifications,
} from '../src/services/reminderNotificationsService';
import { triggerHaptic } from '../src/services/hapticsService';

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

jest.mock('../src/services/remindersService', () => ({
  createReminder: jest.fn(async payload => ({
    reminderId: 'reminder-1',
    type: 'daily_journal',
    enabled: payload.enabled,
    time: payload.time,
    timezone: payload.timezone,
    skipIfCompletedToday: payload.skipIfCompletedToday ?? true,
    includeWeekends: payload.includeWeekends ?? true,
    streakWarnings: false,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z',
  })),
  getPrimaryDailyReminder: jest.fn(async () => null),
  updateReminder: jest.fn(),
}));

jest.mock('../src/services/reminderNotificationsService', () => ({
  cancelReminderNotifications: jest.fn(async () => undefined),
  getDefaultReminderTimezone: jest.fn(() => 'Asia/Kolkata'),
  getReminderPermissionGranted: jest.fn(async () => true),
  requestReminderPermission: jest.fn(async () => true),
  syncReminderNotifications: jest.fn(async () => undefined),
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

let appStateListener: ((state: 'active') => void) | null = null;

beforeEach(() => {
  jest.clearAllMocks();
  appStateListener = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    appStateListener = listener as (state: 'active') => void;
    return { remove: jest.fn() } as never;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function extractText(node: unknown): string {
  if (node == null) {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(child => extractText(child)).join('');
  }

  if (typeof node === 'object' && 'children' in node) {
    return extractText((node as { children?: unknown }).children);
  }

  return '';
}

async function flushAsyncWork() {
  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

test('loads the reminders screen and enables a daily reminder', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <RemindersScreen onBack={jest.fn()} />
      </SafeAreaProvider>,
    );
    await Promise.resolve();
  });

  await flushAsyncWork();

  const tree = extractText(root!.toJSON());
  expect(getPrimaryDailyReminder).toHaveBeenCalledTimes(1);
  expect(tree).toContain('Daily Reminders');
  expect(tree).toContain('Reminder Rules');
  expect(tree).toContain('Smart scheduling options');
  expect(tree).not.toContain('Send Test Notification');

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
      time: '20:00',
      timezone: 'Asia/Kolkata',
    }),
  );
  expect(syncReminderNotifications).toHaveBeenCalledWith(
    expect.objectContaining({
      reminderId: 'reminder-1',
      enabled: true,
      time: '20:00',
    }),
  );
  expect(extractText(root!.toJSON())).not.toContain('Daily reminders enabled.');
  expect(extractText(root!.toJSON())).not.toContain('Reminder settings saved.');

  await ReactTestRenderer.act(async () => {
    root!.unmount();
  });
});

test('refreshes notification permission when returning from device settings', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  (getReminderPermissionGranted as jest.Mock).mockResolvedValue(false);

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <RemindersScreen onBack={jest.fn()} />
      </SafeAreaProvider>,
    );
    await Promise.resolve();
  });

  await flushAsyncWork();

  expect(extractText(root!.toJSON())).toContain('Notifications are disabled');

  (getReminderPermissionGranted as jest.Mock).mockResolvedValue(true);

  await ReactTestRenderer.act(async () => {
    appStateListener?.('active');
    await Promise.resolve();
  });

  expect(extractText(root!.toJSON())).not.toContain(
    'Notifications are disabled',
  );

  await ReactTestRenderer.act(async () => {
    root!.unmount();
  });
});

test('reveals Save Changes after a reminder rule is edited', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  (getPrimaryDailyReminder as jest.Mock).mockResolvedValue({
    reminderId: 'reminder-1',
    type: 'daily_journal',
    enabled: true,
    time: '20:00',
    timezone: 'Asia/Kolkata',
    skipIfCompletedToday: true,
    includeWeekends: true,
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <RemindersScreen onBack={jest.fn()} />
      </SafeAreaProvider>,
    );
    await Promise.resolve();
  });

  await flushAsyncWork();

  expect(extractText(root!.toJSON())).not.toContain('Save Changes');

  await ReactTestRenderer.act(async () => {
    root!.root.findAllByType(Switch)[1]?.props.onValueChange(false);
    await Promise.resolve();
  });

  expect(extractText(root!.toJSON())).toContain('Save Changes');
  expect(triggerHaptic).toHaveBeenCalledWith('optionSelected');

  await ReactTestRenderer.act(async () => {
    root!.unmount();
  });
});
