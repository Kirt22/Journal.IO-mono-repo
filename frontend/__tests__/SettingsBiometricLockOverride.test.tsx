/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AppState, Platform, Switch } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BiometricLockScreen from '../src/screens/profile/BiometricLockScreen';

jest.mock('../src/utils/devLaunchConfig.json', () => ({
  replayOnboarding: false,
  apiBaseUrl: 'http://192.168.1.226:3001/api/v1',
}));

jest.mock('../src/services/privacyService', () => ({
  deleteAccount: jest.fn(async () => ({
    deletedAccount: true,
  })),
}));

jest.mock('../src/services/paywallService', () => ({
  trackPaywallEvent: jest.fn(async () => undefined),
}));

jest.mock('../src/services/remindersService', () => ({
  getPrimaryDailyReminder: jest.fn(async () => null),
}));

jest.mock('../src/services/reminderNotificationsService', () => ({
  getReminderPermissionGranted: jest.fn(async () => false),
}));

import SettingsScreen from '../src/screens/profile/SettingsScreen';
import { resetAppStore, useAppStore } from '../src/store/appStore';

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

const testPlatform = Platform as typeof Platform & { OS: string };
const originalOS = Platform.OS;

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
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
  jest.clearAllMocks();
  Object.defineProperty(testPlatform, 'OS', {
    configurable: true,
    value: 'ios',
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, __) => {
    return { remove: jest.fn() } as never;
  });
});

afterEach(() => {
  Object.defineProperty(testPlatform, 'OS', {
    configurable: true,
    value: originalOS,
  });
  jest.restoreAllMocks();
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
});

test('keeps biometric lock Premium-only even when stale dev config enables testing', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onOpenBiometricLock = jest.fn();
  const onOpenBiometricLockPaywall = jest.fn();

  ReactTestRenderer.act(() => {
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
      biometricLockEnabled: false,
      biometricLockIsAvailable: true,
      biometricLockIsSupported: true,
      biometricLockType: 'face_id',
      refreshBiometricLockState: jest.fn(async () => undefined) as never,
      setBiometricLockEnabled: jest.fn(async () => ({
        status: 'enabled',
        availability: {
          biometryType: 'face_id',
          isAvailable: true,
          isSupported: true,
          label: 'Face ID lock',
          reason: 'available',
          message: '',
        },
      })) as never,
    });
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <SettingsScreen
          onBack={jest.fn()}
          onOpenPrivacy={jest.fn()}
          onOpenHidePreviewsPaywall={jest.fn()}
          onOpenBiometricLock={onOpenBiometricLock}
          onOpenBiometricLockPaywall={onOpenBiometricLockPaywall}
          onSignOut={jest.fn()}
          currentThemePreference="system"
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>,
    );
  });

  expect(extractText(root!.toJSON())).toContain('Face ID lock');
  expect(root!.root.findAllByType(Switch)).toHaveLength(1);
  expect(
    root!.root.findByProps({ accessibilityLabel: 'Enable haptics' }),
  ).toBeTruthy();
  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ accessibilityLabel: 'Unlock Face ID lock' })
      .props.onPress();
  });
  expect(onOpenBiometricLockPaywall).toHaveBeenCalledTimes(1);
  expect(onOpenBiometricLock).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <BiometricLockScreen onBack={jest.fn()} onOpenPremium={jest.fn()} />
      </SafeAreaProvider>,
    );
  });

  expect(extractText(root!.toJSON())).toContain('Premium privacy');
  expect(root!.root.findAllByType(Switch)).toHaveLength(1);
  expect(root!.root.findByType(Switch).props.disabled).toBe(true);
});
