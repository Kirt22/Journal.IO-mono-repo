/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AppState, Platform } from 'react-native';

jest.mock('../src/utils/devLaunchConfig.json', () => ({
  stage: 'onboarding',
  activeTab: 'home',
  email: null,
  apiBaseUrl: 'http://192.168.1.226:3001/api/v1',
  enableBiometricLockForTesting: false,
}));

import BiometricLockOverlay from '../src/components/BiometricLockOverlay';
import { useAppStore, resetAppStore } from '../src/store/appStore';
import { ThemeProvider } from '../src/theme/provider';

const testPlatform = Platform as typeof Platform & { OS: string };
const originalOS = Platform.OS;
const originalAppState = AppState.currentState;

let appStateListener: ((state: string) => void) | null = null;

function renderOverlay() {
  return ReactTestRenderer.create(
    <ThemeProvider modeOverride="light">
      <BiometricLockOverlay />
    </ThemeProvider>,
  );
}

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
      typeof node.props?.onPress === 'function' && extractText(node).includes(label),
  );

  if (!matches.length) {
    throw new Error(`Unable to find pressable with label: ${label}`);
  }

  return matches[0];
}

function setLockedPremiumSession(overrides: Partial<ReturnType<typeof useAppStore.getState>> = {}) {
  ReactTestRenderer.act(() => {
    useAppStore.setState({
      hasBootstrappedAuthGate: true,
      session: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          userId: 'user-123',
          name: 'Alex',
          phoneNumber: null,
          email: 'alex@example.com',
          isPremium: true,
          journalingGoals: [],
          avatarColor: '#8E4636',
          profileSetupCompleted: true,
          onboardingCompleted: true,
          profilePic: null,
        },
      },
      biometricLockEnabled: true,
      biometricLockIsAvailable: true,
      biometricLockIsSupported: true,
      biometricLockType: 'face_id',
      ...overrides,
    });
  });
}

beforeEach(() => {
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
  jest.clearAllMocks();
  appStateListener = null;
  Object.defineProperty(testPlatform, 'OS', {
    configurable: true,
    value: 'ios',
  });
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    appStateListener = listener as (state: string) => void;
    return { remove: jest.fn() } as never;
  });
});

afterEach(() => {
  Object.defineProperty(testPlatform, 'OS', {
    configurable: true,
    value: originalOS,
  });
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: originalAppState,
  });
  jest.restoreAllMocks();
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
});

test('prompts on authenticated cold launch when the app starts locked', async () => {
  const unlockAppWithBiometrics = jest.fn(async () => ({
    status: 'success',
    availability: {
      biometryType: 'face_id',
      isAvailable: true,
      isSupported: true,
      label: 'Face ID lock',
      reason: 'available',
      message: '',
    },
  }));

  setLockedPremiumSession({
    isBiometricAppLocked: true,
    unlockAppWithBiometrics: unlockAppWithBiometrics as never,
  });

  await ReactTestRenderer.act(async () => {
    renderOverlay();
    await Promise.resolve();
  });

  expect(unlockAppWithBiometrics).toHaveBeenCalledTimes(1);
});

test('covers immediately but skips Face ID during a brief foreground return', async () => {
  let now = 1_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const unlockAppWithBiometrics = jest.fn(async () => ({
    status: 'success',
    availability: {
      biometryType: 'face_id',
      isAvailable: true,
      isSupported: true,
      label: 'Face ID lock',
      reason: 'available',
      message: '',
    },
  }));
  const lockAppWithBiometrics = jest.fn();

  setLockedPremiumSession({
    isBiometricAppLocked: false,
    lockAppWithBiometrics: lockAppWithBiometrics as never,
    unlockAppWithBiometrics: unlockAppWithBiometrics as never,
  });

  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderOverlay();
    await Promise.resolve();
  });

  ReactTestRenderer.act(() => {
    appStateListener?.('background');
  });
  expect(extractText(root!.toJSON())).toContain('Journal.IO is locked');

  now += 30_000;
  await ReactTestRenderer.act(async () => {
    appStateListener?.('active');
    await Promise.resolve();
  });

  expect(lockAppWithBiometrics).not.toHaveBeenCalled();
  expect(unlockAppWithBiometrics).not.toHaveBeenCalled();
  expect(extractText(root!.toJSON())).not.toContain('Journal.IO is locked');
});

test('requires Face ID after the foreground grace period expires', async () => {
  let now = 1_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const unlockAppWithBiometrics = jest.fn(async () => ({
    status: 'success',
    availability: {
      biometryType: 'face_id',
      isAvailable: true,
      isSupported: true,
      label: 'Face ID lock',
      reason: 'available',
      message: '',
    },
  }));
  const lockAppWithBiometrics = jest.fn(() => {
    useAppStore.setState({ isBiometricAppLocked: true });
  });

  setLockedPremiumSession({
    isBiometricAppLocked: false,
    lockAppWithBiometrics: lockAppWithBiometrics as never,
    unlockAppWithBiometrics: unlockAppWithBiometrics as never,
  });

  await ReactTestRenderer.act(async () => {
    renderOverlay();
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    appStateListener?.('background');
    now += 60_000;
    appStateListener?.('active');
    await Promise.resolve();
  });

  expect(lockAppWithBiometrics).toHaveBeenCalledTimes(1);
  expect(unlockAppWithBiometrics.mock.calls.length).toBeGreaterThanOrEqual(1);
});

test('does not re-prompt when the system Face ID sheet changes app state', async () => {
  const unlockAppWithBiometrics = jest.fn(async () => ({
    status: 'cancelled',
    availability: {
      biometryType: 'face_id',
      isAvailable: true,
      isSupported: true,
      label: 'Face ID lock',
      reason: 'available',
      message: '',
    },
  }));

  setLockedPremiumSession({
    isBiometricAppLocked: true,
    isBiometricAuthenticating: true,
    unlockAppWithBiometrics: unlockAppWithBiometrics as never,
  });

  await ReactTestRenderer.act(async () => {
    renderOverlay();
    await Promise.resolve();
  });

  const authenticationAttemptsBeforeSystemPromptTransition =
    unlockAppWithBiometrics.mock.calls.length;

  ReactTestRenderer.act(() => {
    appStateListener?.('inactive');
    useAppStore.setState({
      isBiometricAppLocked: true,
      isBiometricAuthenticating: false,
      biometricLockFailureReason: 'cancelled',
    });
    appStateListener?.('active');
  });

  expect(unlockAppWithBiometrics).toHaveBeenCalledTimes(
    authenticationAttemptsBeforeSystemPromptTransition,
  );
});

test('keeps the overlay visible after a cancelled unlock and lets the user try again', async () => {
  const unlockAppWithBiometrics = jest.fn(async () => {
    useAppStore.setState({
      isBiometricAppLocked: true,
      biometricLockFailureReason: 'cancelled',
      biometricLockFailureMessage: 'Face ID was cancelled.',
    });

    return {
      status: 'cancelled',
      availability: {
        biometryType: 'face_id',
        isAvailable: true,
        isSupported: true,
        label: 'Face ID lock',
        reason: 'available',
        message: '',
      },
      message: 'Face ID was cancelled.',
    };
  });

  setLockedPremiumSession({
    isBiometricAppLocked: true,
    unlockAppWithBiometrics: unlockAppWithBiometrics as never,
  });

  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderOverlay();
    await Promise.resolve();
  });

  expect(extractText(root!.toJSON())).toContain('Try again');
  expect(root!.root.findByProps({ accessibilityLabel: 'Face ID' })).toBeTruthy();
  const promptAttemptsBeforeRetry = unlockAppWithBiometrics.mock.calls.length;

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root!, 'Try again').props.onPress();
    await Promise.resolve();
  });

  expect(unlockAppWithBiometrics.mock.calls.length).toBeGreaterThan(
    promptAttemptsBeforeRetry,
  );
  expect(extractText(root!.toJSON())).toContain('Journal.IO is locked');
});

test('offers sign out when biometrics become unavailable after setup', async () => {
  const signOut = jest.fn(async () => undefined);
  const unlockAppWithBiometrics = jest.fn(async () => ({
    status: 'unavailable',
    availability: {
      biometryType: 'face_id',
      isAvailable: false,
      isSupported: true,
      label: 'Face ID lock',
      reason: 'temporarily_unavailable',
      message: 'Face ID is not available right now.',
    },
    message: 'Face ID is not available right now.',
  }));

  setLockedPremiumSession({
    isBiometricAppLocked: true,
    biometricLockFailureReason: 'unavailable',
    biometricLockFailureMessage: 'Face ID is not available right now.',
    unlockAppWithBiometrics: unlockAppWithBiometrics as never,
    signOut: signOut as never,
  });

  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderOverlay();
    await Promise.resolve();
  });

  expect(extractText(root!.toJSON())).toContain('Sign out');

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root!, 'Sign out').props.onPress();
    await Promise.resolve();
  });

  expect(signOut).toHaveBeenCalledTimes(1);
});
