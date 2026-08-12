import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingTrialTimelineScreen from '../src/screens/onboarding/OnboardingTrialTimelineScreen';
import { getReminderPermissionGranted } from '../src/services/reminderNotificationsService';
import {
  getCachedFreeTrialDays,
  getFreeTrialDays,
} from '../src/services/revenueCatService';
import { ThemeProvider } from '../src/theme/provider';

const mockStoreState = {
  session: { user: { userId: 'user-1', isPremium: false } },
};

jest.mock('../src/store/appStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector(mockStoreState),
}));

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

jest.mock('../src/services/reminderNotificationsService', () => ({
  getReminderPermissionGranted: jest.fn(async () => true),
  requestReminderPermission: jest.fn(async () => true),
}));

jest.mock('../src/services/revenueCatService', () => ({
  getCachedFreeTrialDays: jest.fn(() => 7),
  getFreeTrialDays: jest.fn(async () => 7),
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

function render(onContinue = jest.fn(async () => undefined)) {
  return {
    onContinue,
    root: ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ThemeProvider modeOverride="light">
          <OnboardingTrialTimelineScreen onContinue={onContinue} />
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

  // Each node now reveals and then shakes before the next starts, so the
  // entrance runs well past the old 2s window.
  for (let index = 0; index < 4; index += 1) {
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (getReminderPermissionGranted as jest.Mock).mockResolvedValue(true);
  (getCachedFreeTrialDays as jest.Mock).mockReturnValue(7);
  (getFreeTrialDays as jest.Mock).mockResolvedValue(7);
});

afterEach(() => {
  jest.useRealTimers();
});

test('derives the reminder day from the trial length reported by the store', async () => {
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render();
  });
  await settleScreen();

  const text = extractText(rendered.root.toJSON());

  expect(text).toContain('Day 1');
  // 7-day trial, 2-day lead.
  expect(text).toContain('Day 5');
  expect(text).toContain('Day 7');

  await act(async () => {
    rendered.root.unmount();
  });
});

test('picks up a longer trial without re-running the entrance', async () => {
  (getFreeTrialDays as jest.Mock).mockResolvedValue(14);

  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render();
  });
  await settleScreen();

  const text = extractText(rendered.root.toJSON());

  expect(text).toContain('Day 12');
  expect(text).toContain('Day 14');

  await act(async () => {
    rendered.root.unmount();
  });
});

test('promises a reminder only when notifications are actually allowed', async () => {
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render();
  });
  await settleScreen();

  const text = extractText(rendered.root.toJSON());

  expect(text).toContain("We'll remind you");
  expect(
    rendered.root.root.findAllByProps({
      accessibilityLabel: 'Turn on notifications',
    }),
  ).toHaveLength(0);

  await act(async () => {
    rendered.root.unmount();
  });
});

test('softens the copy and offers a fix when notifications were declined', async () => {
  (getReminderPermissionGranted as jest.Mock).mockResolvedValue(false);

  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render();
  });
  await settleScreen();

  const text = extractText(rendered.root.toJSON());

  expect(text).toContain('Set a reminder');
  expect(text).not.toContain("We'll remind you");
  expect(text).toContain('Turn on notifications');

  await act(async () => {
    rendered.root.unmount();
  });
});

test('offers a retry instead of stranding the user when finishing fails', async () => {
  const onContinue = jest.fn(async () => {
    throw new Error('network');
  });

  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render(onContinue);
  });
  await settleScreen();

  await act(async () => {
    rendered.root.root
      .findByProps({ accessibilityLabel: 'Continue' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(onContinue).toHaveBeenCalledTimes(1);
  expect(extractText(rendered.root.toJSON())).toContain(
    'Your reflection is saved.',
  );

  await act(async () => {
    rendered.root.unmount();
  });
});
