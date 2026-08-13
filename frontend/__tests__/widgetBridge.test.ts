import { NativeModules, Platform } from 'react-native';
import {
  MOOD_WIDGET_KIND,
  QUICK_THOUGHT_WIDGET_KIND,
  STREAK_WIDGET_KIND,
  clearSession,
  configureMoodSession,
  consumePendingWidgetDeepLink,
  getOrCreateInstallationId,
  getWidgetStatus,
  isWidgetBridgeAvailable,
  reloadWidgets,
  updateMoodSnapshot,
  updateStreakSnapshot,
} from '../src/services/widgetBridge';

const originalWidgetBridge = NativeModules.WidgetBridge;
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

describe('widgetBridge', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });
  });

  afterEach(() => {
    NativeModules.WidgetBridge = originalWidgetBridge;

    if (originalPlatformDescriptor) {
      Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    }
  });

  it('uses the stable WidgetKit kind names', () => {
    expect(QUICK_THOUGHT_WIDGET_KIND).toBe('JournalQuickThoughtWidget');
    expect(MOOD_WIDGET_KIND).toBe('JournalMoodWidget');
    expect(STREAK_WIDGET_KIND).toBe('JournalStreakWidget');
  });

  it('consumes a pending widget deep link from the native bridge', async () => {
    const nativeBridge = {
      consumePendingWidgetDeepLink: jest.fn(
        async () => 'journalio://widget/quick-thought',
      ),
    };
    NativeModules.WidgetBridge = nativeBridge;

    await expect(consumePendingWidgetDeepLink()).resolves.toBe(
      'journalio://widget/quick-thought',
    );
    expect(nativeBridge.consumePendingWidgetDeepLink).toHaveBeenCalledTimes(1);
  });

  it('forwards the streak snapshot to the native bridge', async () => {
    const nativeBridge = {
      getOrCreateInstallationId: jest.fn(async () => 'installation-1'),
      updateStreakSnapshot: jest.fn(async () => undefined),
    };
    NativeModules.WidgetBridge = nativeBridge;

    const streakSnapshot = {
      currentStreak: 7,
      bestStreak: 12,
      thisMonthEntries: 9,
      totalEntries: 48,
      hasEntryToday: true,
      lastEntryDateKey: '2026-07-24',
      authState: 'ready' as const,
    };

    await updateStreakSnapshot(streakSnapshot);

    expect(nativeBridge.updateStreakSnapshot).toHaveBeenCalledWith(streakSnapshot);
  });

  it('ignores streak snapshot writes when the native bridge is absent', async () => {
    NativeModules.WidgetBridge = undefined;

    await expect(
      updateStreakSnapshot({
        currentStreak: 1,
        bestStreak: 1,
        thisMonthEntries: 1,
        totalEntries: 1,
        hasEntryToday: true,
        lastEntryDateKey: '2026-07-24',
      }),
    ).resolves.toBeUndefined();
  });

  it('delegates the exact native bridge contract', async () => {
    const nativeBridge = {
      getOrCreateInstallationId: jest.fn(async () => 'installation-1'),
      getInstalledWidgetKinds: jest.fn(async () => [MOOD_WIDGET_KIND]),
      getWidgetStatus: jest.fn(async () => ({
        isAvailable: true,
        installedKinds: [MOOD_WIDGET_KIND],
        hasConfiguredSession: true,
      })),
      configureMoodSession: jest.fn(async () => undefined),
      updateMoodSnapshot: jest.fn(async () => undefined),
      reloadWidgets: jest.fn(async () => undefined),
      clearSession: jest.fn(async () => undefined),
    };
    NativeModules.WidgetBridge = nativeBridge;
    const configuration = {
      widgetToken: 'scoped-widget-token',
      expiresAt: '2026-08-20T10:00:00.000Z',
      apiBaseUrl: 'https://api.journal.io/api/v1',
      sessionGeneration: 1,
      moodDateKey: '2026-07-22',
      hasCheckedInToday: true,
    };
    const snapshot = {
      moodDateKey: '2026-07-22',
      hasCheckedInToday: true,
      authState: 'ready' as const,
      lastActionStatus: 'saved' as const,
    };

    expect(isWidgetBridgeAvailable()).toBe(true);
    await expect(getOrCreateInstallationId()).resolves.toBe('installation-1');
    await expect(getWidgetStatus()).resolves.toEqual({
      expiresAt: null,
      isAvailable: true,
      installedKinds: [MOOD_WIDGET_KIND],
      hasConfiguredSession: true,
      isInitialized: false,
      enabledKinds: [],
      hasPremiumAccess: false,
      updatedAt: null,
    });
    await configureMoodSession(configuration);
    await updateMoodSnapshot(snapshot);
    await reloadWidgets(MOOD_WIDGET_KIND);
    await clearSession();

    expect(nativeBridge.configureMoodSession).toHaveBeenCalledWith(configuration);
    expect(nativeBridge.updateMoodSnapshot).toHaveBeenCalledWith(snapshot);
    expect(nativeBridge.reloadWidgets).toHaveBeenCalledWith(MOOD_WIDGET_KIND);
    expect(nativeBridge.clearSession).toHaveBeenCalledTimes(1);
  });

  it('reports unavailable safely when the native module is absent', async () => {
    NativeModules.WidgetBridge = undefined;

    expect(isWidgetBridgeAvailable()).toBe(false);
    await expect(getWidgetStatus()).resolves.toEqual({
      expiresAt: null,
      isAvailable: false,
      installedKinds: [],
      hasConfiguredSession: false,
      isInitialized: false,
      enabledKinds: [],
      hasPremiumAccess: false,
      updatedAt: null,
    });
  });
});
