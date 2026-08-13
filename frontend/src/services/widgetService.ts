import type { MoodCheckIn, MoodStatusResponse } from './moodService';
import {
  getCurrentStreakSummary,
  getStreakHistory,
  type StreakCurrentSummary,
  type StreakHistory,
} from './streaksService';
import { ApiError, getResolvedApiBaseUrl, request } from '../utils/apiClient';
import {
  MOOD_WIDGET_KIND,
  QUICK_THOUGHT_WIDGET_KIND,
  STREAK_WIDGET_KIND,
  clearMoodSession,
  clearSession,
  configureMoodSession,
  getOrCreateInstallationId,
  getWidgetPreferences,
  getWidgetStatus,
  isWidgetBridgeAvailable,
  reloadWidgets,
  updateMoodSnapshot,
  updateStreakSnapshot,
  updateWidgetPreferences,
  type WidgetKind,
  type WidgetPreferences,
  type WidgetStatus,
} from './widgetBridge';

type WidgetSessionResponse = {
  widgetToken: string;
  expiresAt: string;
};

type MoodWidgetConnectionResult =
  | 'connected'
  | 'disabled'
  | 'premium-required'
  | 'unavailable'
  | 'failed';

type WidgetActivationResult =
  | 'enabled'
  | 'disabled'
  | 'premium-required'
  | 'unavailable'
  | 'failed';

type ProvisionOperation = {
  epoch: number;
  promise: Promise<MoodWidgetConnectionResult>;
  userId: string;
};

let provisionInFlight: ProvisionOperation | null = null;
let provisionedUserId: string | null = null;
let sessionGenerationCounter = 0;
let sessionLifecycleEpoch = 0;
let nativeMutationChain = Promise.resolve();
const SESSION_ROTATION_WINDOW_MS = 24 * 60 * 60 * 1_000;

const createSessionGeneration = () => {
  sessionGenerationCounter = (sessionGenerationCounter + 1) % 1_000;
  return Date.now() * 1_000 + sessionGenerationCounter;
};

const enqueueNativeMutation = <T>(mutation: () => Promise<T>) => {
  const result = nativeMutationChain.then(mutation, mutation);
  nativeMutationChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};

const buildMoodSnapshot = (
  status: MoodStatusResponse,
  lastActionStatus: 'idle' | 'saved' = 'idle',
) => ({
  moodDateKey: status.moodCheckIn?.moodDateKey ?? null,
  selectedMood: status.moodCheckIn?.mood ?? null,
  hasCheckedInToday: Boolean(status.moodCheckIn),
  authState: 'ready' as const,
  lastActionStatus,
});

const isConfiguredSessionFresh = (expiresAt: string | null) => {
  if (!expiresAt) {
    return true;
  }

  const expiryTime = Date.parse(expiresAt);
  return (
    Number.isFinite(expiryTime) &&
    expiryTime > Date.now() + SESSION_ROTATION_WINDOW_MS
  );
};

const getWidgetManagementState = async (): Promise<WidgetStatus> =>
  getWidgetStatus();

const ensureMoodWidgetSession = async ({
  userId,
  hasPremiumAccess,
  force = false,
  todayStatus,
}: {
  userId: string;
  hasPremiumAccess: boolean;
  force?: boolean;
  todayStatus?: MoodStatusResponse | null;
}): Promise<MoodWidgetConnectionResult> => {
  if (!isWidgetBridgeAvailable()) {
    return 'unavailable';
  }

  if (!hasPremiumAccess) {
    return 'premium-required';
  }

  if (
    provisionInFlight?.epoch === sessionLifecycleEpoch &&
    provisionInFlight.userId === userId
  ) {
    return provisionInFlight.promise;
  }

  if (
    (provisionedUserId && provisionedUserId !== userId) ||
    (provisionInFlight?.epoch === sessionLifecycleEpoch &&
      provisionInFlight.userId !== userId)
  ) {
    await clearMoodWidgetSessionLocal();
  }

  const operationEpoch = sessionLifecycleEpoch;
  const isCurrentOperation = () => operationEpoch === sessionLifecycleEpoch;
  let operation!: ProvisionOperation;
  const promise = (async () => {
    try {
      const status = await getWidgetStatus();

      if (!isCurrentOperation()) {
        return 'failed';
      }

      if (!status.isAvailable) {
        return 'unavailable';
      }

      if (!status.enabledKinds.includes(MOOD_WIDGET_KIND)) {
        return 'disabled';
      }

      if (
        !force &&
        provisionedUserId === userId &&
        status.hasConfiguredSession &&
        isConfiguredSessionFresh(status.expiresAt)
      ) {
        if (todayStatus) {
          await enqueueNativeMutation(async () => {
            if (!isCurrentOperation()) {
              return;
            }

            await updateMoodSnapshot(buildMoodSnapshot(todayStatus));
            await reloadWidgets(MOOD_WIDGET_KIND);
          });
        }

        return 'connected';
      }

      const installationId = await getOrCreateInstallationId();

      if (!isCurrentOperation()) {
        return 'failed';
      }

      const response = await request<WidgetSessionResponse>('/widgets/session', {
        method: 'POST',
        body: JSON.stringify({ platform: 'ios', installationId }),
      });

      if (!isCurrentOperation()) {
        return 'failed';
      }

      await enqueueNativeMutation(async () => {
        if (!isCurrentOperation()) {
          return;
        }

        await configureMoodSession({
          widgetToken: response.data.widgetToken,
          expiresAt: response.data.expiresAt,
          apiBaseUrl: getResolvedApiBaseUrl({ requireHttpsInRelease: true }),
          sessionGeneration: createSessionGeneration(),
          moodDateKey: todayStatus?.moodCheckIn?.moodDateKey ?? null,
          selectedMood: todayStatus?.moodCheckIn?.mood ?? null,
          hasCheckedInToday: Boolean(todayStatus?.moodCheckIn),
        });

        if (!isCurrentOperation()) {
          return;
        }

        provisionedUserId = userId;
        await reloadWidgets(MOOD_WIDGET_KIND);
      });

      return isCurrentOperation() ? 'connected' : 'failed';
    } catch (error) {
      if (!isCurrentOperation()) {
        return 'failed';
      }

      if (error instanceof ApiError && error.status === 401) {
        await clearMoodWidgetConnectionLocal('reconnectRequired');
      } else if (error instanceof ApiError && error.status === 403) {
        await clearMoodWidgetConnectionLocal('premiumRequired');
      } else {
        await enqueueNativeMutation(async () => {
          if (!isCurrentOperation()) {
            return;
          }

          await updateMoodSnapshot({
            moodDateKey: null,
            selectedMood: null,
            hasCheckedInToday: false,
            lastActionStatus: 'failed',
          }).catch(() => undefined);
        });
      }

      return 'failed';
    } finally {
      if (provisionInFlight === operation) {
        provisionInFlight = null;
      }
    }
  })();

  operation = { epoch: operationEpoch, promise, userId };
  provisionInFlight = operation;
  return promise;
};

const syncMoodWidgetTodayStatus = async (
  status: MoodStatusResponse,
  userId: string,
) => {
  if (!isWidgetBridgeAvailable() || provisionedUserId !== userId) {
    return;
  }

  const operationEpoch = sessionLifecycleEpoch;
  const widgetStatus = await getWidgetStatus();

  if (
    operationEpoch !== sessionLifecycleEpoch ||
    provisionedUserId !== userId ||
    !widgetStatus.enabledKinds.includes(MOOD_WIDGET_KIND) ||
    !widgetStatus.hasPremiumAccess ||
    !widgetStatus.hasConfiguredSession
  ) {
    return;
  }

  await enqueueNativeMutation(async () => {
    if (
      operationEpoch !== sessionLifecycleEpoch ||
      provisionedUserId !== userId
    ) {
      return;
    }

    await updateMoodSnapshot(buildMoodSnapshot(status));
    await reloadWidgets(MOOD_WIDGET_KIND);
  });
};

const syncMoodWidgetAfterMoodSave = async (
  moodCheckIn: MoodCheckIn,
  userId: string,
) => {
  if (!isWidgetBridgeAvailable() || provisionedUserId !== userId) {
    return;
  }

  const operationEpoch = sessionLifecycleEpoch;
  const widgetStatus = await getWidgetStatus();

  if (
    operationEpoch !== sessionLifecycleEpoch ||
    provisionedUserId !== userId ||
    !widgetStatus.enabledKinds.includes(MOOD_WIDGET_KIND) ||
    !widgetStatus.hasPremiumAccess ||
    !widgetStatus.hasConfiguredSession
  ) {
    return;
  }

  await enqueueNativeMutation(async () => {
    if (
      operationEpoch !== sessionLifecycleEpoch ||
      provisionedUserId !== userId
    ) {
      return;
    }

    await updateMoodSnapshot({
      moodDateKey: moodCheckIn.moodDateKey,
      selectedMood: moodCheckIn.mood,
      hasCheckedInToday: true,
      authState: 'ready',
      lastActionStatus: 'saved',
    });
    await reloadWidgets(MOOD_WIDGET_KIND);
  });
};

async function clearMoodWidgetConnectionLocal(
  authState: 'signedOut' | 'reconnectRequired' | 'premiumRequired' = 'signedOut',
) {
  sessionLifecycleEpoch += 1;
  provisionedUserId = null;
  await enqueueNativeMutation(async () => {
    await clearMoodSession().catch(() => undefined);
    await updateMoodSnapshot({
      moodDateKey: null,
      selectedMood: null,
      hasCheckedInToday: false,
      authState,
      lastActionStatus: 'idle',
    }).catch(() => undefined);
    await reloadWidgets(MOOD_WIDGET_KIND).catch(() => undefined);
  });
}

async function clearMoodWidgetSessionLocal(
  authState: 'signedOut' | 'reconnectRequired' = 'signedOut',
) {
  sessionLifecycleEpoch += 1;
  provisionedUserId = null;
  await enqueueNativeMutation(async () => {
    await clearSession().catch(() => undefined);
    await updateMoodSnapshot({
      moodDateKey: null,
      selectedMood: null,
      hasCheckedInToday: false,
      authState,
      lastActionStatus: 'idle',
    }).catch(() => undefined);
    await reloadWidgets().catch(() => undefined);
  });
}

const toNonNegativeInt = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;

const normalizeActivity = (history?: StreakHistory | null) => {
  const activity = history?.days.map(day => Boolean(day.hasEntry)) ?? [];
  return [
    ...Array(Math.max(0, 30 - activity.length)).fill(false),
    ...activity.slice(-30),
  ];
};

const buildStreakSnapshot = (
  summary: StreakCurrentSummary,
  history?: StreakHistory | null,
) => ({
  currentStreak: toNonNegativeInt(summary.currentStreak),
  bestStreak: toNonNegativeInt(summary.bestStreak),
  thisMonthEntries: toNonNegativeInt(summary.thisMonthEntries),
  totalEntries: toNonNegativeInt(summary.totalEntries),
  hasEntryToday: Boolean(summary.hasEntryToday),
  lastEntryDateKey: summary.lastEntryDateKey ?? null,
  activity30Days: normalizeActivity(history),
  authState: 'ready' as const,
});

const isStreakWidgetEnabled = async (operationEpoch: number) => {
  const status = await getWidgetStatus();

  return (
    operationEpoch === sessionLifecycleEpoch &&
    status.isAvailable &&
    status.enabledKinds.includes(STREAK_WIDGET_KIND)
  );
};

const pushStreakSnapshot = async (
  summary: StreakCurrentSummary,
  history: StreakHistory | null | undefined,
  operationEpoch: number,
) => {
  await enqueueNativeMutation(async () => {
    if (operationEpoch !== sessionLifecycleEpoch) {
      return;
    }

    await updateStreakSnapshot(buildStreakSnapshot(summary, history));
    await reloadWidgets(STREAK_WIDGET_KIND);
  });
};

const syncStreakWidget = async (
  summary: StreakCurrentSummary,
  history?: StreakHistory | null,
) => {
  if (!isWidgetBridgeAvailable()) {
    return;
  }

  const operationEpoch = sessionLifecycleEpoch;

  if (!(await isStreakWidgetEnabled(operationEpoch))) {
    return;
  }

  await pushStreakSnapshot(summary, history, operationEpoch);
};

const reconcileStreakWidget = async () => {
  if (!isWidgetBridgeAvailable()) {
    return;
  }

  const operationEpoch = sessionLifecycleEpoch;

  if (!(await isStreakWidgetEnabled(operationEpoch))) {
    return;
  }

  const [summary, history] = await Promise.all([
    getCurrentStreakSummary(),
    getStreakHistory(30),
  ]);

  if (operationEpoch !== sessionLifecycleEpoch) {
    return;
  }

  await pushStreakSnapshot(summary, history, operationEpoch);
};

const revokeMoodWidgetSession = async () => {
  try {
    const installationId = await getOrCreateInstallationId();

    await request<{}>('/widgets/session', {
      method: 'DELETE',
      body: JSON.stringify({ platform: 'ios', installationId }),
    });
  } catch {
    // Local credential removal must not depend on the server being reachable.
  } finally {
    await clearMoodWidgetConnectionLocal('signedOut');
  }
};

const disconnectMoodWidget = revokeMoodWidgetSession;

const setWidgetEnabled = async ({
  kind,
  enabled,
  userId,
  hasPremiumAccess,
}: {
  kind: WidgetKind;
  enabled: boolean;
  userId: string;
  hasPremiumAccess: boolean;
}): Promise<WidgetActivationResult> => {
  if (!isWidgetBridgeAvailable()) {
    return 'unavailable';
  }

  const isPremiumWidget =
    kind === MOOD_WIDGET_KIND || kind === QUICK_THOUGHT_WIDGET_KIND;
  if (enabled && isPremiumWidget && !hasPremiumAccess) {
    return 'premium-required';
  }

  try {
    const preferences = await getWidgetPreferences();
    const enabledKinds = enabled
      ? Array.from(new Set([...preferences.enabledKinds, kind]))
      : preferences.enabledKinds.filter(enabledKind => enabledKind !== kind);

    await enqueueNativeMutation(() =>
      updateWidgetPreferences({
        isInitialized: true,
        enabledKinds,
        hasPremiumAccess,
      }),
    );

    if (kind === MOOD_WIDGET_KIND) {
      if (enabled) {
        const connection = await ensureMoodWidgetSession({
          userId,
          hasPremiumAccess,
          force: true,
        });
        if (connection === 'premium-required') {
          return 'premium-required';
        }
        if (connection === 'failed') {
          return 'failed';
        }
      } else {
        await revokeMoodWidgetSession();
      }
    } else if (kind === STREAK_WIDGET_KIND && enabled) {
      await reconcileStreakWidget();
    } else {
      await reloadWidgets(kind);
    }

    return enabled ? 'enabled' : 'disabled';
  } catch {
    return 'failed';
  }
};

const syncWidgetAccessState = async ({
  userId,
  hasPremiumAccess,
}: {
  userId: string;
  hasPremiumAccess: boolean;
}) => {
  if (!isWidgetBridgeAvailable()) {
    return;
  }

  const preferences = await getWidgetPreferences();
  const accessChanged = preferences.hasPremiumAccess !== hasPremiumAccess;
  if (accessChanged) {
    await enqueueNativeMutation(() =>
      updateWidgetPreferences({
        isInitialized: preferences.isInitialized,
        enabledKinds: preferences.enabledKinds,
        hasPremiumAccess,
      }),
    );
  }

  if (!preferences.enabledKinds.includes(MOOD_WIDGET_KIND)) {
    return;
  }

  if (!hasPremiumAccess) {
    if (preferences.hasPremiumAccess) {
      await revokeMoodWidgetSession();
    }
    return;
  }

  await ensureMoodWidgetSession({ userId, hasPremiumAccess });
};

export {
  clearMoodWidgetConnectionLocal,
  clearMoodWidgetSessionLocal,
  disconnectMoodWidget,
  ensureMoodWidgetSession,
  getWidgetManagementState,
  reconcileStreakWidget,
  setWidgetEnabled,
  syncMoodWidgetAfterMoodSave,
  syncMoodWidgetTodayStatus,
  syncStreakWidget,
  syncWidgetAccessState,
};
export type {
  MoodWidgetConnectionResult,
  WidgetActivationResult,
  WidgetPreferences,
  WidgetSessionResponse,
};
