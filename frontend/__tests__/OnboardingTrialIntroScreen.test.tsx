import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingTrialIntroScreen from '../src/screens/onboarding/OnboardingTrialIntroScreen';
import { getCachedFreeTrialDays } from '../src/services/revenueCatService';
import { ThemeProvider } from '../src/theme/provider';

jest.mock('../src/services/revenueCatService', () => ({
  getCachedFreeTrialDays: jest.fn(() => 7),
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

function render(onContinue = jest.fn()) {
  return {
    onContinue,
    root: ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ThemeProvider modeOverride="light">
          <OnboardingTrialIntroScreen onContinue={onContinue} />
        </ThemeProvider>
      </SafeAreaProvider>,
    ),
  };
}

/** Runs both beats and the trailing hold. */
async function settleBeats() {
  for (let index = 0; index < 6; index += 1) {
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (getCachedFreeTrialDays as jest.Mock).mockReturnValue(7);
});

afterEach(() => {
  jest.useRealTimers();
});

test('holds on the first beat before revealing the trial offer', async () => {
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render();
  });

  await act(async () => {
    jest.advanceTimersByTime(600);
    await Promise.resolve();
  });

  const text = extractText(rendered.root.toJSON());

  expect(text).toContain('Ready to start your journey?');
  expect(rendered.onContinue).not.toHaveBeenCalled();

  await act(async () => {
    rendered.root.unmount();
  });
});

test('reveals the offer and then advances itself exactly once', async () => {
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render();
  });
  await settleBeats();

  const text = extractText(rendered.root.toJSON());

  expect(text).toContain('Ready to start your journey?');
  expect(text).toContain('But wait — your first 7 days are free.');
  expect(rendered.onContinue).toHaveBeenCalledTimes(1);

  // Nothing pending should be able to fire it a second time.
  await settleBeats();
  expect(rendered.onContinue).toHaveBeenCalledTimes(1);

  await act(async () => {
    rendered.root.unmount();
  });
});

test('takes the trial length from the shared cache rather than hardcoding it', async () => {
  (getCachedFreeTrialDays as jest.Mock).mockReturnValue(14);

  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render();
  });
  await settleBeats();

  expect(extractText(rendered.root.toJSON())).toContain(
    'But wait — your first 14 days are free.',
  );

  await act(async () => {
    rendered.root.unmount();
  });
});
