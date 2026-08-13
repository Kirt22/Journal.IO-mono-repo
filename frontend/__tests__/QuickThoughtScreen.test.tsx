/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import QuickThoughtScreen from '../src/screens/QuickThoughtScreen';
import { createJournalEntry } from '../src/services/journalService';
import { reconcileStreakWidget } from '../src/services/widgetService';
import { resetAppStore } from '../src/store/appStore';
import {
  reportBackendUnavailable,
  resetConnectivityForTests,
} from '../src/services/connectivityService';

jest.mock('../src/services/journalService', () => ({
  createJournalEntry: jest.fn(async payload => ({
    _id: 'quick-thought-entry',
    title: payload.title,
    content: payload.content,
    type: payload.type || 'open_ended',
    aiPrompt: null,
    images: [],
    tags: payload.tags || [],
    isFavorite: false,
    createdAt: '2026-07-24T08:00:00.000Z',
    updatedAt: '2026-07-24T08:00:00.000Z',
  })),
}));

jest.mock('../src/services/widgetService', () => ({
  reconcileStreakWidget: jest.fn(async () => undefined),
}));

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
  stopHaptics: jest.fn(),
}));

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

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

beforeEach(() => {
  resetConnectivityForTests('online');
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
  (createJournalEntry as jest.Mock).mockClear();
  (reconcileStreakWidget as jest.Mock).mockClear();
});

const renderScreen = async (onClose: () => void) => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <QuickThoughtScreen onClose={onClose} />
      </SafeAreaProvider>,
    );
  });

  return root!;
};

test('focuses the composer immediately on mount', async () => {
  const root = await renderScreen(jest.fn());

  const input = root.root.findByProps({
    placeholder: "What's on your mind?",
  });

  expect(input.props.autoFocus).toBe(true);
  expect(extractText(root.toJSON())).toContain('Quick thought');
});

test('saves a quick thought as an open-ended entry and closes', async () => {
  const onClose = jest.fn();
  const root = await renderScreen(onClose);

  await ReactTestRenderer.act(() => {
    root.root
      .findByProps({ placeholder: "What's on your mind?" })
      .props.onChangeText('A small noticing');
  });

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: 'Save quick thought' })
      .props.onPress();
  });

  expect(createJournalEntry).toHaveBeenCalledWith({
    title: 'Quick Thought',
    content: 'A small noticing',
    type: 'open_ended',
    entryKind: 'quick_thought',
    tags: [],
  });
  expect(reconcileStreakWidget).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('sends selected tags with the saved thought', async () => {
  const onClose = jest.fn();
  const root = await renderScreen(onClose);

  await ReactTestRenderer.act(() => {
    root.root
      .findByProps({ placeholder: "What's on your mind?" })
      .props.onChangeText('Noticed the light this morning');
  });

  await ReactTestRenderer.act(() => {
    root.root.findByProps({ accessibilityLabel: 'gratitude' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: 'Save quick thought' })
      .props.onPress();
  });

  expect(createJournalEntry).toHaveBeenCalledWith(
    expect.objectContaining({
      content: 'Noticed the light this morning',
      entryKind: 'quick_thought',
      tags: ['gratitude'],
    }),
  );
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('does not save an empty thought', async () => {
  const onClose = jest.fn();
  const root = await renderScreen(onClose);

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: 'Save quick thought' })
      .props.onPress();
  });

  expect(createJournalEntry).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

test('blocks saving while offline', async () => {
  ReactTestRenderer.act(() => {
    reportBackendUnavailable();
  });

  const onClose = jest.fn();
  const root = await renderScreen(onClose);

  await ReactTestRenderer.act(() => {
    root.root
      .findByProps({ placeholder: "What's on your mind?" })
      .props.onChangeText('Offline thought');
  });

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: 'Save quick thought' })
      .props.onPress();
  });

  expect(createJournalEntry).not.toHaveBeenCalled();
  expect(extractText(root.toJSON())).toContain("You're offline");
});
