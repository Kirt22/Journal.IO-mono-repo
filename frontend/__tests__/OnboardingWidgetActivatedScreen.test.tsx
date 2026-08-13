import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingWidgetActivatedScreen from '../src/screens/onboarding/OnboardingWidgetActivatedScreen';
import { ADD_WIDGET_STEPS } from '../src/screens/profile/widgetInstructions';
import { ThemeProvider } from '../src/theme/provider';

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
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

function render(didEnableWidget: boolean, onContinue = jest.fn()) {
  return {
    onContinue,
    root: ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ThemeProvider modeOverride="light">
          <OnboardingWidgetActivatedScreen
            didEnableWidget={didEnableWidget}
            onContinue={onContinue}
          />
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
    jest.advanceTimersByTime(2000);
  });

  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

test('claims the widget is active only when it was actually enabled', async () => {
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render(true);
  });
  await settleScreen();

  expect(extractText(rendered.root.toJSON())).toContain(
    'Your streak widget is active',
  );

  await act(async () => {
    rendered.root.unmount();
  });
});

test('falls back to a headline that does not over-claim when enabling failed', async () => {
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render(false);
  });
  await settleScreen();

  const text = extractText(rendered.root.toJSON());

  expect(text).toContain('Add your streak widget');
  expect(text).not.toContain('Your streak widget is active');

  await act(async () => {
    rendered.root.unmount();
  });
});

test('keeps the screen to title, subtitle, phone, and Continue', async () => {
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render(true);
  });
  await settleScreen();

  const text = extractText(rendered.root.toJSON());

  // The recording carries the walkthrough; the written steps only appear if it
  // cannot play.
  ADD_WIDGET_STEPS.forEach(step => {
    expect(text).not.toContain(step);
  });
  expect(
    rendered.root.root.findAllByProps({ testID: 'add-widget-demo-video' })
      .length,
  ).toBeGreaterThanOrEqual(1);
  expect(text).toContain("Here's how to put it on your Home Screen.");
  expect(text).toContain('Continue');

  await act(async () => {
    rendered.root.unmount();
  });
});

test('continue hands control back to the navigator', async () => {
  const onContinue = jest.fn();
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render(true, onContinue);
  });
  await settleScreen();

  await act(async () => {
    rendered.root.root
      .findByProps({ accessibilityLabel: 'Continue' })
      .props.onPress();
    await Promise.resolve();
  });

  expect(onContinue).toHaveBeenCalledTimes(1);

  await act(async () => {
    rendered.root.unmount();
  });
});
