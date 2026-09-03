/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, AppState, Platform, Switch } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AccountScreen from '../src/screens/profile/AccountScreen';
import SettingsScreen from '../src/screens/profile/SettingsScreen';
import { deleteAccount } from '../src/services/privacyService';
import { triggerHaptic } from '../src/services/hapticsService';
import { resetAppStore, useAppStore } from '../src/store/appStore';
import {
  openDeviceBrowserUrl,
  openExternalUrl,
} from '../src/utils/legalLinks';

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

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

jest.mock('../src/utils/legalLinks', () => ({
  LEGAL_URLS: {
    privacyPolicy: 'https://api.journalio.app/privacy',
    termsOfService: 'https://api.journalio.app/terms',
    privacyChoices: 'https://api.journalio.app/privacy-choices',
    supportPage: 'https://api.journalio.app/support',
  },
  openDeviceBrowserUrl: jest.fn(async () => undefined),
  openExternalUrl: jest.fn(async () => undefined),
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

const setSession = (
  isPremium: boolean,
  options: {
    biometricLockEnabled?: boolean;
    biometricLockIsAvailable?: boolean;
    biometricLockIsSupported?: boolean;
    biometricLockType?: 'face_id' | 'touch_id' | null;
    refreshBiometricLockState?: () => Promise<void>;
  } = {},
) => {
  useAppStore.setState({
    session: {
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
      user: {
        userId: 'user-test',
        name: 'Journal User',
        phoneNumber: null,
        email: 'journal@example.com',
        createdAt: '2026-06-30T00:00:00.000Z',
        isPremium,
        journalingGoals: [],
        avatarColor: null,
        profileSetupCompleted: true,
        onboardingCompleted: true,
        profilePic: null,
      },
    },
    biometricLockEnabled: options.biometricLockEnabled ?? false,
    biometricLockIsAvailable: options.biometricLockIsAvailable ?? true,
    biometricLockIsSupported: options.biometricLockIsSupported ?? true,
    biometricLockType:
      'biometricLockType' in options ? options.biometricLockType! : 'face_id',
    refreshBiometricLockState:
      options.refreshBiometricLockState ??
      (jest.fn(async () => undefined) as never),
  });
};

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
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
  jest.restoreAllMocks();
});

test('locks premium privacy controls for free users', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onOpenPaywall = jest.fn();
  const onOpenBiometricLock = jest.fn();

  ReactTestRenderer.act(() => {
    setSession(false);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <SettingsScreen
          onBack={jest.fn()}
          onOpenPrivacy={jest.fn()}
          onOpenHidePreviewsPaywall={onOpenPaywall}
          onOpenBiometricLock={onOpenBiometricLock}
          onOpenBiometricLockPaywall={onOpenPaywall}
          onSignOut={jest.fn()}
          currentThemePreference="system"
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>,
    );
  });

  const renderedText = extractText(root!.toJSON());

  expect(renderedText).toContain('Privacy & Data');
  expect(renderedText).toContain('More');
  expect(renderedText).toContain('Widgets');
  expect(renderedText).toContain('Haptics');
  expect(renderedText).toContain('About & Legal');
  expect(renderedText).toContain('Privacy Policy');
  expect(renderedText).toContain('Terms of Service');
  expect(renderedText).toContain('Privacy Choices');
  expect(renderedText).toContain('Credits');
  expect(renderedText).toContain('Community');
  expect(renderedText).toContain('Instagram');
  expect(renderedText).toContain('TikTok');
  expect(renderedText).toContain('@journalio.app');
  expect(renderedText).toContain('Support');
  expect(renderedText).toContain('Help Center');
  expect(renderedText.indexOf('About & Legal')).toBeLessThan(
    renderedText.indexOf('Community'),
  );
  expect(renderedText.indexOf('Community')).toBeLessThan(
    renderedText.indexOf('Support'),
  );
  expect(renderedText.indexOf('Instagram')).toBeLessThan(
    renderedText.indexOf('TikTok'),
  );
  expect(renderedText).toContain('Account');
  expect(renderedText).toContain('Manage account');
  expect(renderedText).not.toContain('Subscription');
  expect(renderedText.indexOf('Account')).toBeLessThan(
    renderedText.indexOf('Personalisation'),
  );
  expect(renderedText).toContain('Export data');
  expect(renderedText).toContain('Hide entries');
  expect(renderedText).toContain('Face ID lock');
  expect(renderedText).toContain('Keep Journal.IO private');
  expect(renderedText).toContain('Mask journal previews');
  expect(renderedText.indexOf('Face ID lock')).toBeLessThan(
    renderedText.indexOf('Hide entries'),
  );
  expect(renderedText.indexOf('Hide entries')).toBeLessThan(
    renderedText.indexOf('Export data'),
  );

  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ accessibilityLabel: 'Unlock Hide Journal Previews' })
      .props.onPress();
    root!.root
      .findByProps({ accessibilityLabel: 'Unlock Face ID lock' })
      .props.onPress();
  });

  expect(onOpenPaywall).toHaveBeenCalledTimes(2);
  expect(onOpenBiometricLock).not.toHaveBeenCalled();
});

test('opens the Face ID detail screen for premium iPhone users', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onOpenBiometricLock = jest.fn();
  const onOpenSubscription = jest.fn();

  ReactTestRenderer.act(() => {
    setSession(true, {
      biometricLockEnabled: false,
      biometricLockType: 'face_id',
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
          onOpenSubscription={onOpenSubscription}
          onSignOut={jest.fn()}
          currentThemePreference="system"
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>,
    );
  });

  expect(extractText(root!.toJSON())).toContain('Face ID lock');
  expect(extractText(root!.toJSON())).toContain('Subscription');
  expect(root!.root.findAllByType(Switch)).toHaveLength(2);

  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ accessibilityLabel: 'Open Face ID lock' })
      .props.onPress();
    root!.root
      .findByProps({ accessibilityLabel: 'Open subscription' })
      .props.onPress();
  });

  expect(onOpenBiometricLock).toHaveBeenCalledTimes(1);
  expect(onOpenSubscription).toHaveBeenCalledTimes(1);
});

test('updates haptics and opens policy and support pages', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onSignOut = jest.fn(async () => undefined);
  const onOpenWidgets = jest.fn();

  ReactTestRenderer.act(() => {
    setSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <SettingsScreen
          onBack={jest.fn()}
          onOpenPrivacy={jest.fn()}
          onOpenHidePreviewsPaywall={jest.fn()}
          onOpenBiometricLock={jest.fn()}
          onOpenWidgets={onOpenWidgets}
          onSignOut={onSignOut}
          currentThemePreference="system"
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await root!.root
      .findByProps({ accessibilityLabel: 'Enable haptics' })
      .props.onValueChange(false);
  });

  expect(useAppStore.getState().hapticsEnabled).toBe(false);
  expect(triggerHaptic).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityLabel: 'Open widgets' }).props.onPress();
    root!.root
      .findByProps({ accessibilityLabel: 'Open privacy policy' })
      .props.onPress();
    root!.root
      .findByProps({ accessibilityLabel: 'Open terms of service' })
      .props.onPress();
    root!.root
      .findByProps({ accessibilityLabel: 'Open privacy choices' })
      .props.onPress();
    root!.root
      .findByProps({ accessibilityLabel: 'Open Credits' })
      .props.onPress();
    root!.root
      .findByProps({ accessibilityLabel: 'Open Instagram' })
      .props.onPress();
    root!.root
      .findByProps({ accessibilityLabel: 'Open TikTok' })
      .props.onPress();
    root!.root
      .findByProps({ accessibilityLabel: 'Open Help Center' })
      .props.onPress();
  });

  expect(onOpenWidgets).toHaveBeenCalledTimes(1);

  expect(openExternalUrl).toHaveBeenNthCalledWith(
    1,
    'https://api.journalio.app/privacy',
    'Privacy Policy',
  );
  expect(openExternalUrl).toHaveBeenNthCalledWith(
    2,
    'https://api.journalio.app/terms',
    'Terms of Service',
  );
  expect(openExternalUrl).toHaveBeenNthCalledWith(
    3,
    'https://api.journalio.app/privacy-choices',
    'Privacy Choices',
  );
  expect(openExternalUrl).toHaveBeenNthCalledWith(
    4,
    'https://api.journalio.app/support',
    'Help Center',
  );
  expect(openDeviceBrowserUrl).toHaveBeenNthCalledWith(1, 'https://icons8.com');
  expect(openDeviceBrowserUrl).toHaveBeenNthCalledWith(
    2,
    'https://www.instagram.com/journalio.app/',
  );
  expect(openDeviceBrowserUrl).toHaveBeenNthCalledWith(
    3,
    'https://www.tiktok.com/@journalio.app',
  );
  expect(triggerHaptic).toHaveBeenCalledWith('legal');

  await ReactTestRenderer.act(async () => {
    await root!.root.findByProps({ accessibilityLabel: 'Sign out' }).props.onPress();
  });

  expect(onSignOut).toHaveBeenCalledTimes(1);
});

test('shows a Touch ID label on supported Touch ID devices', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    setSession(true, {
      biometricLockEnabled: true,
      biometricLockType: 'touch_id',
    });
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <SettingsScreen
          onBack={jest.fn()}
          onOpenPrivacy={jest.fn()}
          onOpenHidePreviewsPaywall={jest.fn()}
          onOpenBiometricLock={jest.fn()}
          onSignOut={jest.fn()}
          currentThemePreference="system"
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>,
    );
  });

  expect(extractText(root!.toJSON())).toContain('Touch ID lock');
});

test('keeps the biometric detail entry available on unsupported iPhones', async () => {
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
        <SettingsScreen
          onBack={jest.fn()}
          onOpenPrivacy={jest.fn()}
          onOpenHidePreviewsPaywall={jest.fn()}
          onOpenBiometricLock={jest.fn()}
          onSignOut={jest.fn()}
          currentThemePreference="system"
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>,
    );
  });

  const renderedText = extractText(root!.toJSON());

  expect(renderedText).toContain('Biometric lock');
  expect(renderedText).toContain('Keep Journal.IO private');
  expect(root!.root.findAllByType(Switch)).toHaveLength(2);
});

test('hides the biometric row on Android', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  Object.defineProperty(testPlatform, 'OS', {
    configurable: true,
    value: 'android',
  });

  ReactTestRenderer.act(() => {
    setSession(true, {
      biometricLockEnabled: true,
      biometricLockType: 'face_id',
    });
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <SettingsScreen
          onBack={jest.fn()}
          onOpenPrivacy={jest.fn()}
          onOpenHidePreviewsPaywall={jest.fn()}
          onOpenBiometricLock={jest.fn()}
          onSignOut={jest.fn()}
          currentThemePreference="system"
          onToggleTheme={jest.fn()}
        />
      </SafeAreaProvider>,
    );
  });

  const renderedText = extractText(root!.toJSON());

  expect(renderedText).not.toContain('Face ID lock');
  expect(renderedText).not.toContain('Touch ID lock');
  expect(renderedText).not.toContain('Biometric lock');
});

test('initiates account deletion from Manage account', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onSignOut = jest.fn(async () => undefined);
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const promptSpy = jest.spyOn(Alert, 'prompt').mockImplementation(jest.fn());

  ReactTestRenderer.act(() => {
    setSession(false);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <AccountScreen onBack={jest.fn()} onSignOut={onSignOut} />
      </SafeAreaProvider>,
    );
  });

  ReactTestRenderer.act(() => {
    findPressableByLabel(root!, 'Delete account').props.onPress();
  });

  expect(promptSpy.mock.calls[0]?.[1]).toBe(
    'All journals and account data will be permanently deleted.\n\nThis action cannot be undone.\n\nType DELETE to continue.',
  );
  expect(promptSpy.mock.calls[0]?.[1]).not.toContain(
    'does not cancel an active App Store subscription',
  );

  const promptActions = promptSpy.mock.calls[0]?.[2] as unknown as Array<{
    text?: string;
    onPress?: (value?: string) => void;
  }>;
  const continueAction = promptActions?.find(
    action => action.text === 'Continue',
  );

  await ReactTestRenderer.act(async () => {
    await continueAction?.onPress?.('delete');
  });

  expect(deleteAccount).not.toHaveBeenCalled();

  const finalActions = alertSpy.mock.calls[0]?.[2];
  expect(finalActions?.map(action => action.text)).toEqual([
    'Cancel',
    'Delete',
  ]);

  const destructiveAction = finalActions?.find(
    action => action.style === 'destructive',
  );

  await ReactTestRenderer.act(async () => {
    await destructiveAction?.onPress?.();
  });

  expect(deleteAccount).toHaveBeenCalledTimes(1);
  expect(onSignOut).toHaveBeenCalledTimes(1);

  alertSpy.mockRestore();
  promptSpy.mockRestore();
});

test('explains subscription management before premium account deletion', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const promptSpy = jest.spyOn(Alert, 'prompt').mockImplementation(jest.fn());

  ReactTestRenderer.act(() => {
    setSession(true);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <AccountScreen onBack={jest.fn()} onSignOut={jest.fn()} />
      </SafeAreaProvider>,
    );
  });

  ReactTestRenderer.act(() => {
    findPressableByLabel(root!, 'Delete account').props.onPress();
  });

  expect(promptSpy.mock.calls[0]?.[1]).toBe(
    'All journals and account data will be permanently deleted.\n\nYour App Store subscription will not be cancelled.\n\nThis action cannot be undone.\n\nType DELETE to continue.',
  );

  alertSpy.mockRestore();
  promptSpy.mockRestore();
});

test('uses the typed fallback before the final deletion alert on Android', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onSignOut = jest.fn(async () => undefined);
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

  Object.defineProperty(testPlatform, 'OS', {
    configurable: true,
    value: 'android',
  });

  ReactTestRenderer.act(() => {
    setSession(false);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <AccountScreen onBack={jest.fn()} onSignOut={onSignOut} />
      </SafeAreaProvider>,
    );
  });

  ReactTestRenderer.act(() => {
    findPressableByLabel(root!, 'Delete account').props.onPress();
  });

  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ accessibilityLabel: 'Type DELETE to confirm' })
      .props.onChangeText('DELETE');
  });

  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ accessibilityLabel: 'Continue account deletion' })
      .props.onPress();
  });

  expect(deleteAccount).not.toHaveBeenCalled();
  expect(alertSpy.mock.calls[0]?.[0]).toBe('Are you sure?');

  const destructiveAction = alertSpy.mock.calls[0]?.[2]?.find(
    action => action.style === 'destructive',
  );

  await ReactTestRenderer.act(async () => {
    await destructiveAction?.onPress?.();
  });

  expect(deleteAccount).toHaveBeenCalledTimes(1);
  expect(onSignOut).toHaveBeenCalledTimes(1);

  alertSpy.mockRestore();
});
