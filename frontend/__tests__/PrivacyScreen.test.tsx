/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Share } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PrivacyScreen from '../src/screens/profile/PrivacyScreen';
import {
  exportAllEntries,
  type PrivacyExportResponse,
} from '../src/services/privacyService';
import { resetAppStore, useAppStore } from '../src/store/appStore';

jest.mock('../src/services/privacyService', () => ({
  exportAllEntries: jest.fn(async () => ({
    account: { userId: 'user-test' },
    journalEntries: [],
  })),
}));

const safeAreaMetrics = {
  frame: {
    x: 0,
    y: 0,
    width: 390,
    height: 844,
  },
  insets: {
    top: 47,
    bottom: 34,
    left: 0,
    right: 0,
  },
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

function findPressableByLabel(
  root: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  const matches = root.root.findAll(
    node =>
      typeof node.props?.onPress === 'function' &&
      extractText(node).includes(label),
  );

  if (!matches.length) {
    throw new Error(`Unable to find pressable with label: ${label}`);
  }

  return matches[0];
}

beforeEach(() => {
  ReactTestRenderer.act(() => {
    resetAppStore();
    jest.clearAllMocks();

    useAppStore.setState({
      session: {
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        user: {
          userId: 'user-test',
          name: 'Journal User',
          phoneNumber: null,
          email: 'journal@example.com',
          isPremium: false,
          journalingGoals: [],
          avatarColor: null,
          profileSetupCompleted: true,
          onboardingCompleted: true,
          profilePic: null,
        },
      },
    });
  });
});

test('shows only the free data export flow', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <PrivacyScreen onBack={jest.fn()} />
      </SafeAreaProvider>,
    );
  });

  const renderedText = extractText(root!.toJSON());

  expect(renderedText).toContain('Export data');
  expect(renderedText).toContain('Export your data');
  expect(renderedText).toContain('Export all data');
  expect(renderedText).not.toContain('Premium');
  expect(renderedText).not.toContain('Privacy & Terms');
  expect(renderedText).not.toContain('Delete Account');
  expect(renderedText).not.toContain('Help & Support');
});

test('exports data for a free user', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const exportData = {
    account: { userId: 'user-test' },
    journalEntries: [],
  } as unknown as PrivacyExportResponse;
  let resolveExport: (value: PrivacyExportResponse) => void;
  const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({
    action: Share.sharedAction,
  });
  (
    exportAllEntries as jest.MockedFunction<typeof exportAllEntries>
  ).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveExport = resolve;
      }),
  );

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <PrivacyScreen onBack={jest.fn()} />
      </SafeAreaProvider>,
    );
  });

  ReactTestRenderer.act(() => {
    findPressableByLabel(root!, 'Export all data').props.onPress();
  });

  expect(exportAllEntries).toHaveBeenCalledTimes(1);
  expect(
    root!.root.findByProps({ accessibilityLabel: 'Preparing export' }).props
      .disabled,
  ).toBe(true);

  await ReactTestRenderer.act(async () => {
    resolveExport(exportData);
  });

  expect(shareSpy).toHaveBeenCalledWith({
    title: 'Journal.IO export',
    message: JSON.stringify(exportData, null, 2),
  });

  shareSpy.mockRestore();
});
