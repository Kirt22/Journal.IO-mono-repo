import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FirstReflectionRatingScreen from '../src/screens/onboarding/FirstReflectionRatingScreen';
import { requestAppRating } from '../src/services/appRatingService';

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

jest.mock('../src/services/appRatingService', () => ({
  requestAppRating: jest.fn(async () => ({ status: 'requested' })),
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
        <FirstReflectionRatingScreen onContinue={onContinue} />
      </SafeAreaProvider>,
    ),
  };
}

async function settleScreen() {
  await act(async () => {
    await Promise.resolve();
  });
  act(() => {
    jest.advanceTimersByTime(4000);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (requestAppRating as jest.Mock).mockResolvedValue({ status: 'requested' });
});

afterEach(() => {
  jest.useRealTimers();
});

test('renders the growth-framed rating copy', async () => {
  let rendered!: ReturnType<typeof render>;
  await act(async () => {
    rendered = render();
  });
  await settleScreen();

  const text = extractText(rendered.root.toJSON());
  expect(text).toContain('How are you liking Journal.IO?');
  expect(text).toContain('be part of the change');
  expect(text).toContain('Rate Journal.IO');

  await act(async () => {
    rendered.root.unmount();
  });
});

test('shows the review on this screen, then continues only on explicit Continue', async () => {
  const onContinue = jest.fn();
  let rendered!: ReturnType<typeof render>;
  await act(async () => {
    rendered = render(onContinue);
  });
  await settleScreen();

  // Tapping Rate opens the native review but must NOT navigate away.
  await act(async () => {
    rendered.root
      .root.findByProps({ accessibilityLabel: 'Rate Journal.IO' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(requestAppRating).toHaveBeenCalledTimes(1);
  expect(onContinue).not.toHaveBeenCalled();

  // The CTA becomes Continue and "Maybe later" is gone.
  expect(() =>
    rendered.root.root.findByProps({ accessibilityLabel: 'Maybe later' }),
  ).toThrow();

  await act(async () => {
    rendered.root
      .root.findByProps({ accessibilityLabel: 'Continue' })
      .props.onPress();
    await Promise.resolve();
  });

  expect(onContinue).toHaveBeenCalledTimes(1);

  await act(async () => {
    rendered.root.unmount();
  });
});

test('continues immediately when no review prompt can be shown', async () => {
  (requestAppRating as jest.Mock).mockResolvedValue({ status: 'unavailable' });
  const onContinue = jest.fn();
  let rendered!: ReturnType<typeof render>;
  await act(async () => {
    rendered = render(onContinue);
  });
  await settleScreen();

  await act(async () => {
    rendered.root
      .root.findByProps({ accessibilityLabel: 'Rate Journal.IO' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(requestAppRating).toHaveBeenCalledTimes(1);
  expect(onContinue).toHaveBeenCalledTimes(1);

  await act(async () => {
    rendered.root.unmount();
  });
});

test('continues without requesting a review when the user skips', async () => {
  const onContinue = jest.fn();
  let rendered!: ReturnType<typeof render>;
  await act(async () => {
    rendered = render(onContinue);
  });
  await settleScreen();

  await act(async () => {
    rendered.root
      .root.findByProps({ accessibilityLabel: 'Maybe later' })
      .props.onPress();
    await Promise.resolve();
  });

  expect(requestAppRating).not.toHaveBeenCalled();
  expect(onContinue).toHaveBeenCalledTimes(1);

  await act(async () => {
    rendered.root.unmount();
  });
});
