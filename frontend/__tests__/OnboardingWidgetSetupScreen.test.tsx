import React from 'react';
import { AccessibilityInfo } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingWidgetSetupScreen from '../src/screens/onboarding/OnboardingWidgetSetupScreen';
import { setWidgetEnabled } from '../src/services/widgetService';
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

jest.mock('../src/services/widgetService', () => ({
  setWidgetEnabled: jest.fn(async () => 'enabled'),
}));

jest.mock('../src/services/revenueCatService', () => ({
  primeFreeTrialDays: jest.fn(),
}));

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

function render(onActivated = jest.fn()) {
  return {
    onActivated,
    root: ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ThemeProvider modeOverride="light">
          <OnboardingWidgetSetupScreen onActivated={onActivated} />
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
    jest.advanceTimersByTime(2500);
  });

  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (setWidgetEnabled as jest.Mock).mockResolvedValue('enabled');
  jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockResolvedValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('a plain tap does not advance — the gesture has to be a long press', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render();
  });
  await settleScreen();

  await act(async () => {
    rendered.root.root
      .findByProps({ accessibilityLabel: 'Streak widget preview' })
      .props.onPress();
    await Promise.resolve();
  });

  expect(rendered.onActivated).not.toHaveBeenCalled();
  expect(setWidgetEnabled).not.toHaveBeenCalled();

  await act(async () => {
    rendered.root.unmount();
  });
});

test('a long press enables the streak widget and advances', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render();
  });
  await settleScreen();

  await act(async () => {
    rendered.root.root
      .findByProps({ accessibilityLabel: 'Streak widget preview' })
      .props.onLongPress({ nativeEvent: { pageX: 195, pageY: 400 } });
    await Promise.resolve();
  });

  expect(setWidgetEnabled).toHaveBeenCalledWith({
    kind: 'JournalStreakWidget',
    enabled: true,
    userId: 'user-1',
    hasPremiumAccess: false,
  });

  await act(async () => {
    jest.advanceTimersByTime(400);
    await Promise.resolve();
  });

  expect(rendered.onActivated).toHaveBeenCalledTimes(1);
  expect(rendered.onActivated).toHaveBeenCalledWith(true);

  await act(async () => {
    rendered.root.unmount();
  });
});

test('offers no skip — the long press is the only way forward', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render();
  });
  await settleScreen();

  // The screen used to reveal an "I'll add it later" action after 6s. Give it
  // well past that window and confirm nothing appears.
  await act(async () => {
    jest.advanceTimersByTime(10000);
    await Promise.resolve();
  });

  expect(
    rendered.root.root.findAllByProps({
      accessibilityLabel: 'Skip adding the widget',
    }),
  ).toHaveLength(0);
  expect(rendered.onActivated).not.toHaveBeenCalled();

  await act(async () => {
    rendered.root.unmount();
  });
});
