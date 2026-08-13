import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingCommitmentScreen from '../src/screens/onboarding/OnboardingCommitmentScreen';
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

/**
 * PanResponder derives its gesture state from `event.touchHistory`, so a bare
 * `{ nativeEvent }` stub throws. This is the minimum single-touch history that
 * keeps the centroid math happy.
 */
function makeTouchEvent(x: number, y: number, timeStamp: number) {
  return {
    nativeEvent: {
      locationX: x,
      locationY: y,
      pageX: x,
      pageY: y,
      identifier: 1,
      target: 1,
      timestamp: timeStamp,
      touches: [],
      changedTouches: [],
    },
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: timeStamp,
      touchBank: [
        {
          touchActive: true,
          startPageX: x,
          startPageY: y,
          startTimeStamp: timeStamp,
          currentPageX: x,
          currentPageY: y,
          currentTimeStamp: timeStamp,
          previousPageX: x,
          previousPageY: y,
          previousTimeStamp: timeStamp,
        },
      ],
    },
  };
}

function render(onSigned = jest.fn()) {
  return {
    onSigned,
    root: ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ThemeProvider modeOverride="light">
          <OnboardingCommitmentScreen
            displayName="Kirtan Solanki"
            onSigned={onSigned}
          />
        </ThemeProvider>
      </SafeAreaProvider>,
    ),
  };
}

function findPad(root: ReactTestRenderer.ReactTestRenderer) {
  return root.root.findByProps({ testID: 'commitment-signature-pad' });
}

/**
 * Runs the whole top-down entrance: icon, title, the character-by-character
 * clause, the icon stamp, then the date and pad reveals. Advanced in chunks so
 * each chained animation and the typing interval get a turn to schedule.
 */
async function settleEntrance() {
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });
  }
}

/** Drags horizontally across the pad in `steps` moves of `stepX` points. */
async function drawStroke(
  root: ReactTestRenderer.ReactTestRenderer,
  steps: number,
  stepX: number,
) {
  const pad = findPad(root);

  await act(async () => {
    pad.props.onResponderGrant(makeTouchEvent(20, 90, 1000));
  });

  for (let index = 1; index <= steps; index += 1) {
    await act(async () => {
      pad.props.onResponderMove(
        makeTouchEvent(20 + index * stepX, 90, 1000 + index * 16),
      );
    });
  }

  await act(async () => {
    pad.props.onResponderRelease(
      makeTouchEvent(20 + steps * stepX, 90, 1000 + steps * 16),
    );
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

test('types the clause in rather than showing it all at once', async () => {
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render();
  });

  // Nothing of the clause exists yet — it types after the icon and title land.
  expect(extractText(rendered.root.toJSON())).not.toContain(
    'commit to checking in with myself',
  );

  await settleEntrance();

  expect(extractText(rendered.root.toJSON())).toContain(
    'commit to checking in with myself every day for the next 30 days.',
  );

  await act(async () => {
    rendered.root.unmount();
  });
});

test('shows the dated contract and withholds the action until something is signed', async () => {
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render();
  });
  await settleEntrance();

  const text = extractText(rendered.root.toJSON());

  expect(text).toContain('My commitment');
  expect(text).toContain('Kirtan');
  expect(text).toContain('Sign here');
  expect(text).toContain('Dated');
  expect(
    rendered.root.root.findAllByProps({
      accessibilityLabel: 'Sign my commitment',
    }),
  ).toHaveLength(0);

  await act(async () => {
    rendered.root.unmount();
  });
});

test('a stray dab is not a signature', async () => {
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render();
  });
  await settleEntrance();

  // Well under both the ink-length and ink-width floors.
  await drawStroke(rendered.root, 3, 4);

  expect(
    rendered.root.root.findAllByProps({
      accessibilityLabel: 'Sign my commitment',
    }),
  ).toHaveLength(0);

  await act(async () => {
    rendered.root.unmount();
  });
});

test('a real signature unlocks the action and emits an ISO timestamp', async () => {
  const onSigned = jest.fn();
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render(onSigned);
  });
  await settleEntrance();

  await drawStroke(rendered.root, 20, 10);

  await act(async () => {
    rendered.root.root
      .findByProps({ accessibilityLabel: 'Sign my commitment' })
      .props.onPress();
    await Promise.resolve();
  });

  expect(onSigned).toHaveBeenCalledTimes(1);
  expect(onSigned.mock.calls[0][0]).toMatch(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  );

  await act(async () => {
    rendered.root.unmount();
  });
});

test('clearing the pad locks the action again', async () => {
  let rendered!: ReturnType<typeof render>;

  await act(async () => {
    rendered = render();
  });
  await settleEntrance();

  await drawStroke(rendered.root, 20, 10);

  expect(
    rendered.root.root.findAllByProps({
      accessibilityLabel: 'Sign my commitment',
    }),
  ).not.toHaveLength(0);

  await act(async () => {
    rendered.root.root
      .findByProps({ accessibilityLabel: 'Clear signature' })
      .props.onPress();
    await Promise.resolve();
  });

  // Both controls now fade out rather than vanishing, so they stay mounted
  // until the exit animation finishes.
  await act(async () => {
    jest.advanceTimersByTime(600);
    await Promise.resolve();
  });

  expect(
    rendered.root.root.findAllByProps({
      accessibilityLabel: 'Sign my commitment',
    }),
  ).toHaveLength(0);
  expect(
    rendered.root.root.findAllByProps({
      accessibilityLabel: 'Clear signature',
    }),
  ).toHaveLength(0);
  expect(extractText(rendered.root.toJSON())).toContain('Sign here');

  await act(async () => {
    rendered.root.unmount();
  });
});
