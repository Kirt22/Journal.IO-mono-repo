import { ApiError, getResolvedApiBaseUrl, request } from '../src/utils/apiClient';
import {
  clearMoodSession,
  clearSession,
  configureMoodSession,
  QUICK_THOUGHT_WIDGET_KIND,
  getOrCreateInstallationId,
  getWidgetStatus,
  getWidgetPreferences,
  isWidgetBridgeAvailable,
  reloadWidgets,
  updateMoodSnapshot,
  updateWidgetPreferences,
} from '../src/services/widgetBridge';
import {
  clearMoodWidgetSessionLocal,
  disconnectMoodWidget,
  ensureMoodWidgetSession,
  setWidgetEnabled,
  syncMoodWidgetAfterMoodSave,
  syncMoodWidgetTodayStatus,
} from '../src/services/widgetService';

jest.mock('../src/utils/apiClient', () => {
  const actual = jest.requireActual('../src/utils/apiClient');

  return {
    ...actual,
    getResolvedApiBaseUrl: jest.fn(() => 'https://api.journal.io/api/v1'),
    request: jest.fn(),
  };
});

jest.mock('../src/services/widgetBridge', () => ({
  MOOD_WIDGET_KIND: 'JournalMoodWidget',
  QUICK_THOUGHT_WIDGET_KIND: 'JournalQuickThoughtWidget',
  STREAK_WIDGET_KIND: 'JournalStreakWidget',
  clearMoodSession: jest.fn(async () => undefined),
  clearSession: jest.fn(async () => undefined),
  configureMoodSession: jest.fn(async () => undefined),
  getInstalledWidgetKinds: jest.fn(async () => ['JournalMoodWidget']),
  getOrCreateInstallationId: jest.fn(async () => 'installation-1'),
  getWidgetStatus: jest.fn(async () => ({
    isAvailable: true,
    installedKinds: ['JournalMoodWidget'],
    hasConfiguredSession: false,
    isInitialized: true,
    enabledKinds: ['JournalMoodWidget'],
    hasPremiumAccess: true,
  })),
  getWidgetPreferences: jest.fn(async () => ({
    isInitialized: true,
    enabledKinds: ['JournalMoodWidget'],
    hasPremiumAccess: true,
    updatedAt: null,
  })),
  isWidgetBridgeAvailable: jest.fn(() => true),
  reloadWidgets: jest.fn(async () => undefined),
  updateMoodSnapshot: jest.fn(async () => undefined),
  updateStreakSnapshot: jest.fn(async () => undefined),
  updateWidgetPreferences: jest.fn(async (preferences: unknown) => preferences),
}));

const sessionResponse = {
  success: true,
  message: 'Widget session ready',
  data: {
    widgetToken: 'scoped-widget-token',
    expiresAt: '2026-08-20T10:00:00.000Z',
  },
};

describe('widgetService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isWidgetBridgeAvailable as jest.Mock).mockReturnValue(true);
    (getOrCreateInstallationId as jest.Mock).mockResolvedValue('installation-1');
    (getWidgetStatus as jest.Mock).mockResolvedValue({
      isAvailable: true,
      installedKinds: ['JournalMoodWidget'],
      hasConfiguredSession: false,
      isInitialized: true,
      enabledKinds: ['JournalMoodWidget'],
      hasPremiumAccess: true,
    });
    (getWidgetPreferences as jest.Mock).mockResolvedValue({
      isInitialized: true,
      enabledKinds: ['JournalMoodWidget'],
      hasPremiumAccess: true,
      updatedAt: null,
    });
    (getResolvedApiBaseUrl as jest.Mock).mockReturnValue(
      'https://api.journal.io/api/v1',
    );
    (request as jest.Mock).mockResolvedValue(sessionResponse);
  });

  it('does not provision when the mood widget is disabled in the app', async () => {
    (getWidgetStatus as jest.Mock).mockResolvedValue({
      isAvailable: true,
      installedKinds: ['JournalQuickThoughtWidget'],
      hasConfiguredSession: false,
      enabledKinds: [],
      hasPremiumAccess: true,
    });

    await expect(
      ensureMoodWidgetSession({
        userId: 'disabled-user',
        hasPremiumAccess: true,
      }),
    ).resolves.toBe('disabled');
    expect(request).not.toHaveBeenCalled();
    expect(configureMoodSession).not.toHaveBeenCalled();
  });

  it('does not provision interactive mood access for a free user', async () => {
    await expect(
      ensureMoodWidgetSession({
        userId: 'free-user',
        hasPremiumAccess: false,
      }),
    ).resolves.toBe('premium-required');
    expect(request).not.toHaveBeenCalled();
  });

  it('activates Quick Thought through device-local widget preferences', async () => {
    await expect(
      setWidgetEnabled({
        kind: QUICK_THOUGHT_WIDGET_KIND,
        enabled: true,
        userId: 'premium-user',
        hasPremiumAccess: true,
      }),
    ).resolves.toBe('enabled');

    expect(updateWidgetPreferences).toHaveBeenCalledWith({
      isInitialized: true,
      enabledKinds: ['JournalMoodWidget', 'JournalQuickThoughtWidget'],
      hasPremiumAccess: true,
    });
    expect(reloadWidgets).toHaveBeenCalledWith('JournalQuickThoughtWidget');
  });

  it('provisions a scoped session for an enabled Premium mood widget', async () => {
    await expect(
      ensureMoodWidgetSession({
        userId: 'enabled-user',
        hasPremiumAccess: true,
      }),
    ).resolves.toBe('connected');

    expect(request).toHaveBeenCalledWith('/widgets/session', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'ios',
        installationId: 'installation-1',
      }),
    });
    expect(configureMoodSession).toHaveBeenCalledWith(
      expect.objectContaining({
        widgetToken: 'scoped-widget-token',
        expiresAt: '2026-08-20T10:00:00.000Z',
        apiBaseUrl: 'https://api.journal.io/api/v1',
        sessionGeneration: expect.any(Number),
        moodDateKey: null,
        selectedMood: null,
        hasCheckedInToday: false,
      }),
    );
    expect(JSON.stringify((configureMoodSession as jest.Mock).mock.calls)).not.toContain(
      'accessToken',
    );
  });

  it('provisions an enabled widget before iOS installation detection settles', async () => {
    (getWidgetStatus as jest.Mock).mockResolvedValue({
      isAvailable: true,
      installedKinds: [],
      hasConfiguredSession: false,
      enabledKinds: ['JournalMoodWidget'],
      hasPremiumAccess: true,
    });

    await expect(
      ensureMoodWidgetSession({
        userId: 'forced-user',
        hasPremiumAccess: true,
        force: true,
      }),
    ).resolves.toBe('connected');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('pushes only privacy-safe today status into the widget snapshot', async () => {
    await clearMoodWidgetSessionLocal();
    await ensureMoodWidgetSession({
      userId: 'status-user',
      hasPremiumAccess: true,
      force: true,
    });
    (updateMoodSnapshot as jest.Mock).mockClear();
    (reloadWidgets as jest.Mock).mockClear();
    (getWidgetStatus as jest.Mock).mockResolvedValue({
      isAvailable: true,
      installedKinds: ['JournalMoodWidget'],
      hasConfiguredSession: true,
      enabledKinds: ['JournalMoodWidget'],
      hasPremiumAccess: true,
    });

    await syncMoodWidgetTodayStatus(
      {
        moodCheckIn: {
          _id: 'mood-1',
          mood: 'good',
          moodDateKey: '2026-07-22',
          createdAt: '2026-07-22T08:00:00.000Z',
          updatedAt: '2026-07-22T08:00:00.000Z',
        },
        currentStreak: 5,
      },
      'status-user',
    );

    expect(updateMoodSnapshot).toHaveBeenCalledWith({
      moodDateKey: '2026-07-22',
      selectedMood: 'good',
      hasCheckedInToday: true,
      authState: 'ready',
      lastActionStatus: 'idle',
    });
    expect(JSON.stringify((updateMoodSnapshot as jest.Mock).mock.calls)).toContain(
      'good',
    );
  });

  it('marks the snapshot saved after an in-app mood check-in', async () => {
    await clearMoodWidgetSessionLocal();
    await ensureMoodWidgetSession({
      userId: 'save-user',
      hasPremiumAccess: true,
      force: true,
    });
    (updateMoodSnapshot as jest.Mock).mockClear();
    (reloadWidgets as jest.Mock).mockClear();
    (getWidgetStatus as jest.Mock).mockResolvedValue({
      isAvailable: true,
      installedKinds: ['JournalMoodWidget'],
      hasConfiguredSession: true,
      enabledKinds: ['JournalMoodWidget'],
      hasPremiumAccess: true,
    });

    await syncMoodWidgetAfterMoodSave(
      {
        _id: 'mood-2',
        mood: 'okay',
        moodDateKey: '2026-07-22',
        createdAt: '2026-07-22T09:00:00.000Z',
        updatedAt: '2026-07-22T09:00:00.000Z',
      },
      'save-user',
    );

    expect(updateMoodSnapshot).toHaveBeenCalledWith({
      moodDateKey: '2026-07-22',
      selectedMood: 'okay',
      hasCheckedInToday: true,
      authState: 'ready',
      lastActionStatus: 'saved',
    });
  });

  it('revokes by installation and still clears locally when DELETE fails', async () => {
    (request as jest.Mock).mockRejectedValueOnce(new Error('offline'));

    await disconnectMoodWidget();

    expect(request).toHaveBeenCalledWith('/widgets/session', {
      method: 'DELETE',
      body: JSON.stringify({
        platform: 'ios',
        installationId: 'installation-1',
      }),
    });
    expect(clearMoodSession).toHaveBeenCalledTimes(1);
    expect(updateMoodSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ authState: 'signedOut' }),
    );
  });

  it('clears an unauthorized session into reconnect-required state', async () => {
    (request as jest.Mock).mockRejectedValueOnce(
      new ApiError('Expired', { status: 401 }),
    );

    await expect(
      ensureMoodWidgetSession({
        userId: 'unauthorized-user',
        hasPremiumAccess: true,
        force: true,
      }),
    ).resolves.toBe('failed');
    expect(clearMoodSession).toHaveBeenCalled();
    expect(updateMoodSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ authState: 'reconnectRequired' }),
    );
  });

  it('supports explicit local clearing without a server request', async () => {
    await clearMoodWidgetSessionLocal('reconnectRequired');

    expect(request).not.toHaveBeenCalled();
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(reloadWidgets).toHaveBeenCalledWith();
  });

  it('does not restore a stale token when provisioning finishes after local clear', async () => {
    let resolveSession!: (value: typeof sessionResponse) => void;
    (request as jest.Mock).mockReturnValueOnce(
      new Promise<typeof sessionResponse>(resolve => {
        resolveSession = resolve;
      }),
    );

    const provisioning = ensureMoodWidgetSession({
      userId: 'stale-provision-user',
      hasPremiumAccess: true,
      force: true,
    });

    while (!(request as jest.Mock).mock.calls.length) {
      await Promise.resolve();
    }

    const clearing = clearMoodWidgetSessionLocal();
    resolveSession(sessionResponse);

    await expect(provisioning).resolves.toBe('failed');
    await clearing;

    expect(configureMoodSession).not.toHaveBeenCalled();
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it('ignores an old account snapshot that resolves after the widget session is cleared', async () => {
    await clearMoodWidgetSessionLocal();
    await ensureMoodWidgetSession({
      userId: 'old-user',
      hasPremiumAccess: true,
      force: true,
    });
    (updateMoodSnapshot as jest.Mock).mockClear();

    let resolveStatus!: (value: {
      isAvailable: boolean;
      installedKinds: string[];
      hasConfiguredSession: boolean;
      enabledKinds: string[];
      hasPremiumAccess: boolean;
    }) => void;
    (getWidgetStatus as jest.Mock).mockReturnValueOnce(
      new Promise(resolve => {
        resolveStatus = resolve;
      }),
    );

    const staleSync = syncMoodWidgetTodayStatus(
      { moodCheckIn: null, currentStreak: 0 },
      'old-user',
    );
    await Promise.resolve();
    await clearMoodWidgetSessionLocal();
    (updateMoodSnapshot as jest.Mock).mockClear();
    resolveStatus({
      isAvailable: true,
      installedKinds: ['JournalMoodWidget'],
      hasConfiguredSession: true,
      enabledKinds: ['JournalMoodWidget'],
      hasPremiumAccess: true,
    });

    await staleSync;
    expect(updateMoodSnapshot).not.toHaveBeenCalled();
  });
});
