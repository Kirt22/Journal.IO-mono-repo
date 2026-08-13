/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AskJadeScreen from '../src/screens/jade/AskJadeScreen';
import {
  getJadeSessionThread,
  getJadeSessions,
  sendJadeMessage,
} from '../src/services/askJadeService';
import { resetAppStore, useAppStore } from '../src/store/appStore';
import { resetConnectivityForTests } from '../src/services/connectivityService';
import { ApiError } from '../src/utils/apiClient';

jest.mock('../src/services/askJadeService', () => ({
  deleteJadeSession: jest.fn(async () => undefined),
  getJadeSessionThread: jest.fn(),
  getJadeSessions: jest.fn(async () => ({
    sessions: [],
    pagination: { nextCursor: null, hasMore: false },
  })),
  sendJadeMessage: jest.fn(),
}));

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const roots: ReactTestRenderer.ReactTestRenderer[] = [];

const createRoot = (element: React.ReactElement) => {
  const root = ReactTestRenderer.create(element);
  roots.push(root);
  return root;
};

const flushAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const renderScreen = (
  props: Partial<React.ComponentProps<typeof AskJadeScreen>> = {},
) => (
  <SafeAreaProvider initialMetrics={safeAreaMetrics}>
    <AskJadeScreen
      isPremium
      onBack={jest.fn()}
      onUpgrade={jest.fn()}
      {...props}
    />
  </SafeAreaProvider>
);

const mount = async (
  props: Partial<React.ComponentProps<typeof AskJadeScreen>> = {},
) => {
  let root: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    root = createRoot(renderScreen(props));
    await flushAsyncWork();
  });
  return root!;
};

const message = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  seq: 1,
  role: 'assistant' as const,
  text: 'Your entries suggest those two often show up together.',
  status: 'ok' as const,
  blocks: [],
  createdAt: '2026-08-11T10:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  resetConnectivityForTests('online');
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
});

afterEach(() => {
  ReactTestRenderer.act(() => {
    roots.splice(0).forEach(root => root.unmount());
  });
  jest.useRealTimers();
});

test('a free user sees the locked card instead of the composer, and never fetches a thread', async () => {
  const root = await mount({ isPremium: false });

  expect(
    root.root.findAllByProps({ testID: 'ask-jade-locked' }).length,
  ).toBeGreaterThan(0);
  expect(root.root.findAllByProps({ testID: 'ask-jade-input' })).toHaveLength(
    0,
  );
  expect(getJadeSessions).not.toHaveBeenCalled();
  expect(root.root.findAllByProps({ testID: 'ask-jade-more' })).toHaveLength(0);
  expect(
    root.root.findAllByProps({ accessibilityLabel: 'Previous chats' }),
  ).toHaveLength(0);

  const tree = JSON.stringify(root.toJSON());
  expect(tree).toContain('Ask Jade is part of Premium');
});

test('the locked card routes to the paywall with the Ask Jade placement', async () => {
  const onUpgrade = jest.fn();
  const root = await mount({ isPremium: false, onUpgrade });

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Upgrade to Premium' })
      .props.onPress();
  });

  expect(onUpgrade).toHaveBeenCalled();
});

test('a premium user with no history sees the invitation and starter prompts', async () => {
  const root = await mount();

  expect(
    root.root.findAllByProps({ testID: 'ask-jade-empty' }).length,
  ).toBeGreaterThan(0);
  expect(getJadeSessions).toHaveBeenCalled();
  expect(root.root.findByProps({ testID: 'ask-jade-more' })).toBeTruthy();

  const tree = JSON.stringify(root.toJSON());
  expect(tree).toContain("Ask me anything you've been writing about.");
  expect(tree).toContain('Show me my mood trends as a graph.');
  expect(tree).not.toContain('Why do I keep doing this?');
  const starterLabels = new Set(
    root.root
      .findAll(
        node =>
          typeof node.props.accessibilityLabel === 'string' &&
          node.props.accessibilityLabel.startsWith('Use starter prompt:'),
      )
      .map(node => node.props.accessibilityLabel),
  );
  expect(starterLabels.size).toBe(3);
});

test('keeps the composer inside the bottom safe area', async () => {
  const root = await mount();

  expect(
    root.root.findByProps({ testID: 'ask-jade-safe-area' }).props.edges,
  ).toEqual(['top', 'bottom', 'left', 'right']);
});

test('keeps the empty title to one fitted line', async () => {
  const root = await mount();
  const title = root.root.findByProps({
    children: "Ask me anything you've been writing about.",
  });

  expect(title.props.adjustsFontSizeToFit).toBe(true);
  expect(title.props.minimumFontScale).toBe(0.82);
  expect(title.props.numberOfLines).toBe(1);
});

test('a starter prompt fills and enables the composer without sending', async () => {
  const root = await mount();

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({
        accessibilityLabel:
          'Use starter prompt: Show me my mood trends as a graph.',
      })
      .props.onPress();
  });

  expect(root.root.findByProps({ testID: 'ask-jade-input' }).props.value).toBe(
    'Show me my mood trends as a graph.',
  );
  expect(
    root.root.findByProps({ testID: 'ask-jade-send' }).props.disabled,
  ).toBe(false);
  expect(sendJadeMessage).not.toHaveBeenCalled();
});

test('the waiting bubble renders three individually animated dots', async () => {
  ReactTestRenderer.act(() => {
    useAppStore.setState({
      jadeMessages: [
        message({ id: 'u1', role: 'user', text: 'What keeps repeating?' }),
      ],
      isSendingJadeMessage: true,
    });
  });

  const root = await mount();

  expect(
    root.root.findAllByProps({ testID: 'ask-jade-typing' }).length,
  ).toBeGreaterThan(0);
  expect(
    new Set(
      root.root
        .findAll(
          node =>
            typeof node.props.testID === 'string' &&
            node.props.testID.startsWith('ask-jade-thinking-dot-'),
        )
        .map(node => node.props.testID),
    ),
  ).toEqual(
    new Set([
      'ask-jade-thinking-dot-1',
      'ask-jade-thinking-dot-2',
      'ask-jade-thinking-dot-3',
    ]),
  );
});

test('a newly submitted optimistic message gets the entrance wrapper', async () => {
  (sendJadeMessage as jest.Mock).mockReturnValue(new Promise(() => undefined));
  const root = await mount();

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ testID: 'ask-jade-input' })
      .props.onChangeText('Hello');
  });
  ReactTestRenderer.act(() => {
    root.root.findByProps({ testID: 'ask-jade-send' }).props.onPress();
  });

  const optimisticMessageIds = new Set(
    root.root
      .findAll(
        node =>
          typeof node.props.testID === 'string' &&
          node.props.testID.startsWith('ask-jade-message-local-'),
      )
      .map(node => node.props.testID),
  );
  expect(optimisticMessageIds.size).toBe(1);
});

test('sending shows the message immediately and reveals the reply progressively', async () => {
  (sendJadeMessage as jest.Mock).mockResolvedValue({
    sessionId: 'session-1',
    title: 'Why do I keep overeating',
    userMessage: message({
      id: 'u1',
      seq: 1,
      role: 'user',
      text: 'Why do I overeat?',
    }),
    reply: message({
      id: 'a1',
      seq: 2,
      blocks: [
        {
          type: 'text',
          text: 'Your entries suggest those two often show up together.',
        },
        {
          type: 'list',
          style: 'bulleted',
          items: ['One new-reply point'],
        },
      ],
    }),
    limits: { turnsUsedToday: 1, turnsPerDay: 40, resetAt: null },
  });

  const root = await mount();

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ testID: 'ask-jade-input' })
      .props.onChangeText('Why do I overeat?');
  });

  await ReactTestRenderer.act(async () => {
    root.root.findByProps({ testID: 'ask-jade-send' }).props.onPress();
    await flushAsyncWork();
  });

  expect(sendJadeMessage).toHaveBeenCalledWith(
    expect.objectContaining({ text: 'Why do I overeat?' }),
  );
  expect(root.root.findAllByProps({ testID: 'jade-list-block' })).toHaveLength(
    0,
  );

  // The reply arrives whole and is typed out, so mid-reveal only part is shown.
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(2000);
    await flushAsyncWork();
  });

  const tree = JSON.stringify(root.toJSON());
  expect(tree).toContain('Why do I overeat?');
  expect(tree).toContain('often show up together');
  expect(tree).toContain('One new-reply point');
});

test('a failed send keeps the text and offers a retry rather than losing it', async () => {
  (sendJadeMessage as jest.Mock).mockRejectedValue(
    new ApiError('Something went wrong.', { status: 500 }),
  );

  const root = await mount();

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ testID: 'ask-jade-input' })
      .props.onChangeText('Are you there?');
  });

  await ReactTestRenderer.act(async () => {
    root.root.findByProps({ testID: 'ask-jade-send' }).props.onPress();
    await flushAsyncWork();
  });

  // Losing what someone just wrote is the worst possible failure here.
  expect(root.root.findByProps({ testID: 'ask-jade-input' }).props.value).toBe(
    'Are you there?',
  );
  expect(JSON.stringify(root.toJSON())).toContain('tap to retry');
});

test('a 403 mid-session flips the screen to locked, because entitlements can lapse', async () => {
  (sendJadeMessage as jest.Mock).mockRejectedValue(
    new ApiError('Premium required.', {
      status: 403,
      code: 'PREMIUM_REQUIRED',
    }),
  );

  const root = await mount();

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ testID: 'ask-jade-input' })
      .props.onChangeText('Hello');
  });

  await ReactTestRenderer.act(async () => {
    root.root.findByProps({ testID: 'ask-jade-send' }).props.onPress();
    await flushAsyncWork();
  });

  expect(
    root.root.findAllByProps({ testID: 'ask-jade-locked' }).length,
  ).toBeGreaterThan(0);
});

test('going offline disables sending before the request is attempted', async () => {
  const root = await mount();

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ testID: 'ask-jade-input' })
      .props.onChangeText('Hello');
  });

  await ReactTestRenderer.act(async () => {
    resetConnectivityForTests('offline');
    await flushAsyncWork();
  });

  expect(
    root.root.findByProps({ testID: 'ask-jade-send' }).props.disabled,
  ).toBe(true);
  expect(JSON.stringify(root.toJSON())).toContain("You're offline");
});

test('hitting the turn limit blocks further sends until it resets', async () => {
  const root = await mount();

  await ReactTestRenderer.act(async () => {
    useAppStore.setState({
      jadeLimitResetAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    await flushAsyncWork();
  });

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ testID: 'ask-jade-input' })
      .props.onChangeText('Hello');
  });

  expect(
    root.root.findAllByProps({ testID: 'ask-jade-limit' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.root.findByProps({ testID: 'ask-jade-send' }).props.disabled,
  ).toBe(true);
});

test('crisis copy is shown at once, never typed out a word at a time', async () => {
  (getJadeSessionThread as jest.Mock).mockResolvedValue({
    session: {
      id: 'session-1',
      title: 'Heavy night',
      lastMessagePreview: '',
      messageCount: 2,
      lastMessageAt: '2026-08-11T10:00:00.000Z',
    },
    messages: [
      message({
        id: 'a1',
        seq: 2,
        status: 'support_first',
        text: 'Please reach out to a crisis line right now.',
      }),
    ],
    pagination: { nextCursor: null, hasMore: false },
  });

  const root = await mount();

  await ReactTestRenderer.act(async () => {
    await useAppStore.getState().openJadeSession('session-1');
    await flushAsyncWork();
  });

  // No timers advanced: the whole message must already be on screen.
  expect(JSON.stringify(root.toJSON())).toContain(
    'Please reach out to a crisis line right now.',
  );
});

test('renders a stored reply and its rich blocks immediately without replaying the reveal', async () => {
  ReactTestRenderer.act(() => {
    useAppStore.setState({
      jadeMessages: [
        message({
          id: 'rich-1',
          blocks: [
            { type: 'text', text: 'Here is what your check-ins suggest.' },
            {
              type: 'list',
              style: 'numbered',
              items: [
                'Mood was steadier midweek.',
                'Two days had no check-in.',
              ],
            },
            {
              type: 'mood_trend',
              title: 'Mood trend · 7 days',
              dataState: 'ready',
              updatedAt: '2026-08-14T00:00:00.000Z',
              rangeDays: 7,
              points: [
                {
                  dateKey: '2026-08-13',
                  label: 'Aug 13',
                  mood: 'okay',
                  score: 3,
                },
                {
                  dateKey: '2026-08-14',
                  label: 'Aug 14',
                  mood: 'good',
                  score: 4,
                },
              ],
            },
          ],
        }),
      ],
    });
  });

  const root = await mount();
  expect(
    root.root.findAllByProps({ testID: 'jade-list-block' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.root.findAllByProps({ testID: 'jade-mood_trend-block' }).length,
  ).toBeGreaterThan(0);
  expect(JSON.stringify(root.toJSON())).toContain('Mood was steadier midweek.');
});

test('a stored fallback restores the preceding message without auto-sending', async () => {
  ReactTestRenderer.act(() => {
    useAppStore.setState({
      jadeMessages: [
        message({ id: 'u1', seq: 1, role: 'user', text: 'Show my mood graph' }),
        message({
          id: 'a1',
          seq: 2,
          status: 'fallback',
          text: "I couldn't reach my thoughts just then.",
        }),
      ],
    });
  });

  const root = await mount();
  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Edit and retry your message' })
      .props.onPress();
  });

  expect(root.root.findByProps({ testID: 'ask-jade-input' }).props.value).toBe(
    'Show my mood graph',
  );
  expect(sendJadeMessage).not.toHaveBeenCalled();
});
