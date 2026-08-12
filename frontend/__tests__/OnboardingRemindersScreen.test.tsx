import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingRemindersScreen from '../src/screens/onboarding/OnboardingRemindersScreen';
import {
  createReminder,
  getPrimaryDailyReminder,
  updateReminder,
} from '../src/services/remindersService';
import {
  cancelReminderNotifications,
  getReminderPermissionGranted,
  requestReminderPermission,
  syncReminderNotifications,
} from '../src/services/reminderNotificationsService';
import { ThemeProvider } from '../src/theme/provider';

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
    skipIfCompletedToday: payload.skipIfCompletedToday,
    includeWeekends: payload.includeWeekends,
  })),
  getPrimaryDailyReminder: jest.fn(async () => null),
  updateReminder: jest.fn(async (reminderId, payload) => ({
    reminderId,
    type: 'daily_journal',
    ...payload,
  })),
}));

jest.mock('../src/services/reminderNotificationsService', () => ({
  cancelReminderNotifications: jest.fn(async () => undefined),
  getDefaultReminderTimezone: jest.fn(() => 'Asia/Kolkata'),
  getReminderPermissionGranted: jest.fn(async () => true),
  requestReminderPermission: jest.fn(async () => true),
  syncReminderNotifications: jest.fn(async () => undefined),
}));

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

function extractText(node: unknown): string {
  if (node == null) {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }

  if (typeof node === 'object' && 'children' in node) {
    return extractText((node as { children?: unknown }).children);
  }

  return '';
}

function render(onComplete = jest.fn(async () => undefined)) {
  return {
    onComplete,
    root: ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ThemeProvider modeOverride="light">
          <OnboardingRemindersScreen onComplete={onComplete} />
        </ThemeProvider>
      </SafeAreaProvider>,
    ),
  };
}

async function settleScreen() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  act(() => {
    jest.advanceTimersByTime(1100);
  });

  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (getPrimaryDailyReminder as jest.Mock).mockResolvedValue(null);
  (requestReminderPermission as jest.Mock).mockResolvedValue(true);
  (getReminderPermissionGranted as jest.Mock).mockResolvedValue(true);
});

afterEach(() => {
  jest.useRealTimers();
});

test('waits for the custom Allow action before requesting notification permission', async () => {
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render();
  });
  await settleScreen();

  expect(extractText(rendered.root.toJSON())).toContain(
    'Would Like to Send You Notifications',
  );
  expect(requestReminderPermission).not.toHaveBeenCalled();

  await act(async () => {
    rendered.root.unmount();
  });
});

test('opens the time sheet after approval and saves the selected daily reminder', async () => {
  const onComplete = jest.fn(async () => undefined);
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render(onComplete);
  });
  await settleScreen();

  await act(async () => {
    rendered.root
      .root.findByProps({ accessibilityLabel: 'Allow reminders' })
      .props.onPress();
    await Promise.resolve();
  });

  expect(requestReminderPermission).toHaveBeenCalledTimes(1);
  expect(extractText(rendered.root.toJSON())).toContain('What time feels right?');

  await act(async () => {
    rendered.root
      .root.findByProps({ accessibilityLabel: 'Evening, 6:00 PM' })
      .props.onPress();
    await Promise.resolve();
  });

  await act(async () => {
    rendered.root
      .root.findByProps({ accessibilityLabel: 'Save reminder' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(createReminder).toHaveBeenCalledWith(
    expect.objectContaining({ enabled: true, time: '18:00', timezone: 'Asia/Kolkata' }),
  );
  expect(syncReminderNotifications).toHaveBeenCalledWith(
    expect.objectContaining({ enabled: true, time: '18:00' }),
  );
  expect(onComplete).toHaveBeenCalledTimes(1);

  await act(async () => {
    rendered.root.unmount();
  });
});

test('keeps a clear skip path after notification permission is declined', async () => {
  const onComplete = jest.fn(async () => undefined);
  (requestReminderPermission as jest.Mock).mockResolvedValue(false);
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render(onComplete);
  });
  await settleScreen();

  await act(async () => {
    rendered.root
      .root.findByProps({ accessibilityLabel: 'Allow reminders' })
      .props.onPress();
    await Promise.resolve();
  });

  expect(extractText(rendered.root.toJSON())).toContain('Notifications are off.');
  expect(createReminder).not.toHaveBeenCalled();

  await act(async () => {
    rendered.root
      .root.findByProps({ accessibilityLabel: 'Continue without a reminder' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(cancelReminderNotifications).toHaveBeenCalledTimes(1);
  expect(onComplete).toHaveBeenCalledTimes(1);

  await act(async () => {
    rendered.root.unmount();
  });
});

test('disables an existing reminder when the user continues without one', async () => {
  const onComplete = jest.fn(async () => undefined);
  (getPrimaryDailyReminder as jest.Mock).mockResolvedValue({
    reminderId: 'existing-reminder',
    type: 'daily_journal',
    enabled: true,
    time: '20:00',
    timezone: 'Asia/Kolkata',
    skipIfCompletedToday: true,
    includeWeekends: true,
  });
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render(onComplete);
  });
  await settleScreen();

  await act(async () => {
    rendered.root
      .root.findByProps({ accessibilityLabel: 'Continue without a reminder' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(updateReminder).toHaveBeenCalledWith(
    'existing-reminder',
    expect.objectContaining({ enabled: false, time: '20:00' }),
  );
  expect(cancelReminderNotifications).toHaveBeenCalledTimes(1);
  expect(onComplete).toHaveBeenCalledTimes(1);

  await act(async () => {
    rendered.root.unmount();
  });
});
