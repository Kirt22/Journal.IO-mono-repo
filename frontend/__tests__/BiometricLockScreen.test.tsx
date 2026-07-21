/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AppState, Linking, Switch } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BiometricLockScreen from '../src/screens/profile/BiometricLockScreen';
import { resetAppStore, useAppStore } from '../src/store/appStore';

jest.mock('../src/utils/devLaunchConfig.json', () => ({
  stage: 'onboarding',
  activeTab: 'home',
  email: null,
  apiBaseUrl: 'http://192.168.1.226:3001/api/v1',
  enableBiometricLockForTesting: false,
}));

jest.mock('../src/services/paywallService', () => ({
  trackPaywallEvent: jest.fn(async () => undefined),
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
    return node.map(extractText).join('');
  }

  if (typeof node === 'object' && 'children' in node) {
    return extractText((node as { children?: unknown }).children);
  }

  return '';
}

function setSession(isPremium: boolean, overrides = {}) {
  useAppStore.setState({
    session: {
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
      user: {
        userId: 'user-test',
        name: 'Journal User',
        phoneNumber: null,
        email: 'journal@example.com',
        isPremium,
        journalingGoals: [],
        avatarColor: null,
        profileSetupCompleted: true,
        onboardingCompleted: true,
        profilePic: null,
        aiOptIn: true,
      },
    },
    biometricLockEnabled: false,
    biometricLockIsAvailable: true,
    biometricLockIsSupported: true,
    biometricLockType: 'face_id',
    refreshBiometricLockState: jest.fn(async () => undefined) as never,
    ...overrides,
  });
}

beforeEach(() => {
  ReactTestRenderer.act(() => {
    resetAppStore();
    setSession(false);
  });
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, __) => {
    return { remove: jest.fn() } as never;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
});

test('shows the Premium card for free users regardless of Face ID availability', async () => {
  const onOpenPremium = jest.fn();
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    setSession(false, {
      biometricLockIsAvailable: false,
      biometricLockIsSupported: false,
      biometricLockType: null,
    });
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <BiometricLockScreen onBack={jest.fn()} onOpenPremium={onOpenPremium} />
      </SafeAreaProvider>,
    );
  });

  expect(extractText(root!.toJSON())).toContain('Premium privacy');

  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ accessibilityLabel: 'Unlock biometric lock' })
      .props.onPress();
  });

  expect(onOpenPremium).toHaveBeenCalledTimes(1);
  expect(root!.root.findAllByType(Switch)).toHaveLength(1);
  expect(root!.root.findByType(Switch).props.disabled).toBe(true);
});

test('shows an unavailable card for Premium users without supported biometrics', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    setSession(true, {
      biometricLockIsAvailable: false,
      biometricLockIsSupported: false,
      biometricLockType: null,
    });
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <BiometricLockScreen onBack={jest.fn()} onOpenPremium={jest.fn()} />
      </SafeAreaProvider>,
    );
  });

  const renderedText = extractText(root!.toJSON());

  expect(renderedText).toContain('Face ID or Touch ID is unavailable');
  expect(root!.root.findAllByType(Switch)).toHaveLength(1);
  expect(root!.root.findByType(Switch).props.disabled).toBe(true);
});

test('opens iPhone settings when a Premium user needs Face ID permission', async () => {
  const openSettings = jest
    .spyOn(Linking, 'openSettings')
    .mockResolvedValue(undefined);
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    setSession(true, {
      biometricLockIsAvailable: false,
      biometricLockIsSupported: true,
      biometricLockType: 'face_id',
    });
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <BiometricLockScreen onBack={jest.fn()} onOpenPremium={jest.fn()} />
      </SafeAreaProvider>,
    );
  });

  expect(extractText(root!.toJSON())).toContain('Allow Face ID');

  await ReactTestRenderer.act(async () => {
    await root!.root
      .findByProps({ accessibilityLabel: 'Allow Face ID for Journal.IO' })
      .props.onPress();
  });

  expect(openSettings).toHaveBeenCalledTimes(1);
  expect(root!.root.findAllByType(Switch)).toHaveLength(1);
  expect(root!.root.findByType(Switch).props.disabled).toBe(true);
});

test('lets Premium users enable Face ID lock from the detail screen', async () => {
  const setBiometricLockEnabled = jest.fn(async () => ({
    status: 'enabled' as const,
    availability: {
      biometryType: 'face_id' as const,
      isAvailable: true,
      isSupported: true,
      label: 'Face ID lock',
      reason: 'available' as const,
      message: '',
    },
  }));
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    setSession(true, {
      setBiometricLockEnabled: setBiometricLockEnabled as never,
    });
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <BiometricLockScreen onBack={jest.fn()} onOpenPremium={jest.fn()} />
      </SafeAreaProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    root!.root.findByType(Switch).props.onValueChange(true);
  });

  expect(setBiometricLockEnabled).toHaveBeenCalledWith(true);
});
