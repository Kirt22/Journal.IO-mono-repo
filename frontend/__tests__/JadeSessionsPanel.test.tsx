/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Modal, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import JadeSessionsPanel from '../src/components/jade/JadeSessionsPanel';
import { ThemeProvider } from '../src/theme/provider';
import type { JadeSessionSummary } from '../src/services/askJadeService';

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

const roots = new Set<ReactTestRenderer.ReactTestRenderer>();

const createRoot = (element: React.ReactElement) => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ThemeProvider modeOverride="light">{element}</ThemeProvider>
      </SafeAreaProvider>,
    );
  });

  roots.add(root);
  return root;
};

/**
 * The sheet renders inside a Modal, which the test renderer does not serialize
 * — so assert against the element tree rather than toJSON().
 */
const expectText = (root: ReactTestRenderer.ReactTestRenderer, text: string) =>
  expect(root.root.findAllByProps({ children: text }).length).toBeGreaterThan(
    0,
  );

const session = (id: string): JadeSessionSummary => ({
  id,
  title: `Chat ${id}`,
  lastMessagePreview: 'We talked about the evenings.',
  messageCount: 4,
  lastMessageAt: '2026-08-11T10:00:00.000Z',
});

const defaultProps = {
  visible: true,
  sessions: [session('a'), session('b')],
  activeSessionId: 'a',
  isLoading: false,
  hasMore: true,
  errorMessage: null as string | null,
  reduceMotion: false,
  onClose: jest.fn(),
  onSelectSession: jest.fn(),
  onNewChat: jest.fn(),
  onLoadMore: jest.fn(),
  onDeleteSession: jest.fn(),
  onRetry: jest.fn(),
};

const render = (props: Partial<typeof defaultProps> = {}) =>
  createRoot(<JadeSessionsPanel {...defaultProps} {...props} />);

const scrollEvent = (offsetY: number) => ({
  nativeEvent: {
    contentOffset: { x: 0, y: offsetY },
    contentSize: { height: 1000, width: 390 },
    layoutMeasurement: { height: 600, width: 390 },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  ReactTestRenderer.act(() => {
    roots.forEach(root => root.unmount());
    roots.clear();
  });
  jest.restoreAllMocks();
});

test('renders each previous chat with its preview', () => {
  const root = render();

  expectText(root, 'Chat a');
  expectText(root, 'Chat b');
  expectText(root, 'We talked about the evenings.');
});

test('uses a stationary scrim and a custom rounded sheet transition', () => {
  const root = render();
  const modal = root.root.findByType(Modal);
  const sheet = root.root.findByProps({ testID: 'jade-sessions-sheet' });
  const sheetStyle = StyleSheet.flatten(sheet.props.style);

  expect(modal.props.animationType).toBe('none');
  expect(
    root.root.findAllByProps({ testID: 'jade-sessions-scrim' }).length,
  ).toBeGreaterThan(0);
  expect(sheetStyle.borderTopLeftRadius).toBe(24);
  expect(sheetStyle.borderTopRightRadius).toBe(24);
  expect(sheetStyle.paddingBottom).toBe(54);
  expect(
    root.root.findAllByProps({ accessibilityLabel: 'Close' }),
  ).toHaveLength(0);
});

test('uses the supplied artwork for the new-chat action', () => {
  const root = render();

  expect(
    root.root.findAllByProps({ testID: 'jade-new-chat-icon' }).length,
  ).toBeGreaterThan(0);
});

test('scrolling near the bottom asks for one more page, not several', () => {
  const onLoadMore = jest.fn();
  const root = render({ onLoadMore });

  const scrollView = root.root.findByProps({ scrollEventThrottle: 16 });

  ReactTestRenderer.act(() => {
    // Well short of the threshold — nothing should be requested yet.
    scrollView.props.onScroll(scrollEvent(0));
  });
  expect(onLoadMore).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => {
    scrollView.props.onScroll(scrollEvent(300));
  });
  expect(onLoadMore).toHaveBeenCalledTimes(1);
});

test('a request already in flight suppresses further page requests', () => {
  const onLoadMore = jest.fn();
  const root = render({ isLoading: true, onLoadMore });

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ scrollEventThrottle: 16 })
      .props.onScroll(scrollEvent(300));
  });

  expect(onLoadMore).not.toHaveBeenCalled();
});

test('reaching the end of the history stops requesting pages', () => {
  const onLoadMore = jest.fn();
  const root = render({ hasMore: false, onLoadMore });

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ scrollEventThrottle: 16 })
      .props.onScroll(scrollEvent(300));
  });

  expect(onLoadMore).not.toHaveBeenCalled();
});

test('starting a new chat is available above the history', () => {
  const onNewChat = jest.fn();
  const root = render({ onNewChat });

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Start a new chat' })
      .props.onPress();
  });

  expect(onNewChat).toHaveBeenCalled();
});

test('selecting a chat hands its id back', () => {
  const onSelectSession = jest.fn();
  const root = render({ onSelectSession });

  ReactTestRenderer.act(() => {
    root.root.findByProps({ accessibilityLabel: 'Chat b' }).props.onPress();
  });

  expect(onSelectSession).toHaveBeenCalledWith('b');
});

test('delete stays behind the swipe action and requires destructive confirmation', () => {
  const onDeleteSession = jest.fn();
  const alertSpy = jest
    .spyOn(Alert, 'alert')
    .mockImplementation(() => undefined);
  const root = render({ onDeleteSession });

  const sessionButton = root.root.findByProps({ accessibilityLabel: 'Chat a' });
  expect(sessionButton.props.accessibilityHint).toBe(
    'Swipe left to reveal delete.',
  );
  expect(sessionButton.props.accessibilityActions).toEqual([
    { name: 'delete', label: 'Delete Chat a' },
  ]);

  ReactTestRenderer.act(() => {
    root.root.findByProps({ testID: 'jade-session-delete-a' }).props.onPress();
  });

  expect(onDeleteSession).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalledWith(
    'Delete chat?',
    'Are you sure you want to delete this chat? This cannot be undone.',
    expect.any(Array),
  );

  const actions = alertSpy.mock.calls[0][2];
  const deleteAction = actions?.find(action => action.text === 'Delete');
  ReactTestRenderer.act(() => {
    deleteAction?.onPress?.();
  });

  expect(deleteAction?.style).toBe('destructive');
  expect(onDeleteSession).toHaveBeenCalledWith('a');
});

test('cancelling the delete alert leaves the chat untouched', () => {
  const onDeleteSession = jest.fn();
  const alertSpy = jest
    .spyOn(Alert, 'alert')
    .mockImplementation(() => undefined);
  const root = render({ onDeleteSession });

  ReactTestRenderer.act(() => {
    root.root.findByProps({ testID: 'jade-session-delete-b' }).props.onPress();
  });

  const actions = alertSpy.mock.calls[0][2];
  const cancelAction = actions?.find(action => action.text === 'Cancel');
  ReactTestRenderer.act(() => {
    cancelAction?.onPress?.();
  });

  expect(cancelAction?.style).toBe('cancel');
  expect(onDeleteSession).not.toHaveBeenCalled();
});

test('a failed page shows the reason and a way to try again', () => {
  const onRetry = jest.fn();
  const root = render({
    errorMessage: "We couldn't load your chats.",
    onRetry,
  });

  expectText(root, "We couldn't load your chats.");
  expectText(root, 'Try again');
});

test('an empty history explains itself rather than showing a blank sheet', () => {
  const root = render({ sessions: [], hasMore: false });

  expectText(root, 'Your chats with Jade will show up here.');
});
