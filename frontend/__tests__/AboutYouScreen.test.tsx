/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AboutYouScreen from '../src/screens/profile/AboutYouScreen';
import { resetAppStore, useAppStore } from '../src/store/appStore';
import { triggerHaptic } from '../src/services/hapticsService';

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

jest.mock('../src/services/userService', () => ({
  updateProfile: jest.fn(),
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

beforeEach(() => {
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

test('reveals Save name only after the name changes', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <AboutYouScreen onBack={jest.fn()} />
      </SafeAreaProvider>,
    );
  });

  expect(extractText(root!.toJSON())).not.toContain('Save name');
  expect(extractText(root!.toJSON())).toContain('12/60');

  await ReactTestRenderer.act(async () => {
    root!.root
      .findByProps({ accessibilityLabel: 'Your name' })
      .props.onChangeText('Journal Writer');
  });

  expect(extractText(root!.toJSON())).toContain('Save name');
  expect(triggerHaptic).toHaveBeenCalledWith('optionSelected');
});
