import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const MOOD_WIDGET_KIND = 'JournalMoodWidget';
const QUICK_THOUGHT_WIDGET_KIND = 'JournalQuickThoughtWidget';
const STREAK_WIDGET_KIND = 'JournalStreakWidget';

type WidgetAuthState =
  | 'ready'
  | 'signedOut'
  | 'reconnectRequired'
  | 'premiumRequired';
type WidgetActionStatus = 'idle' | 'saved' | 'failed';
type WidgetMood = 'amazing' | 'good' | 'okay' | 'bad' | 'terrible';
type WidgetKind =
  | typeof MOOD_WIDGET_KIND
  | typeof QUICK_THOUGHT_WIDGET_KIND
  | typeof STREAK_WIDGET_KIND;

type WidgetSessionConfiguration = {
  widgetToken: string;
  expiresAt: string | number;
  apiBaseUrl: string;
  sessionGeneration: number;
  moodDateKey?: string | null;
  selectedMood?: WidgetMood | null;
  hasCheckedInToday?: boolean;
};

type WidgetMoodSnapshot = {
  moodDateKey: string | null;
  selectedMood?: WidgetMood | null;
  hasCheckedInToday: boolean;
  authState?: WidgetAuthState;
  lastActionStatus?: WidgetActionStatus;
};

type WidgetStreakSnapshot = {
  currentStreak: number;
  bestStreak: number;
  thisMonthEntries: number;
  totalEntries: number;
  hasEntryToday: boolean;
  lastEntryDateKey: string | null;
  activity30Days?: boolean[] | null;
  authState?: WidgetAuthState;
};

type WidgetPreferences = {
  isInitialized: boolean;
  enabledKinds: WidgetKind[];
  hasPremiumAccess: boolean;
  updatedAt: string | null;
};

type WidgetStatus = WidgetPreferences & {
  expiresAt: string | null;
  isAvailable: boolean;
  installedKinds: string[];
  hasConfiguredSession: boolean;
};

type NativeWidgetBridge = {
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
  consumePendingWidgetDeepLink?: () => Promise<string | null>;
  getOrCreateInstallationId?: () => Promise<string>;
  getInstalledWidgetKinds?: () => Promise<string[]>;
  getWidgetStatus?: () => Promise<Partial<WidgetStatus>>;
  getWidgetPreferences?: () => Promise<Partial<WidgetPreferences>>;
  updateWidgetPreferences?: (
    preferences: Omit<WidgetPreferences, 'updatedAt'>,
  ) => Promise<Partial<WidgetPreferences>>;
  configureMoodSession?: (
    configuration: WidgetSessionConfiguration,
  ) => Promise<void>;
  updateMoodSnapshot?: (snapshot: WidgetMoodSnapshot) => Promise<void>;
  updateStreakSnapshot?: (snapshot: WidgetStreakSnapshot) => Promise<void>;
  reloadWidgets?: (kind?: string) => Promise<void>;
  clearMoodSession?: () => Promise<void>;
  clearSession?: () => Promise<void>;
};

type WidgetDeepLinkEvent = { url?: unknown };
type WidgetDeepLinkSubscription = { remove: () => void };

const getNativeBridge = () =>
  NativeModules.WidgetBridge as NativeWidgetBridge | undefined;

const consumePendingWidgetDeepLink = async () =>
  (await getNativeBridge()?.consumePendingWidgetDeepLink?.()) ?? null;

const subscribeToPendingWidgetDeepLinks = (
  listener: (url: string) => void,
): WidgetDeepLinkSubscription => {
  const bridge = getNativeBridge();

  if (Platform.OS !== 'ios' || !bridge) {
    return { remove: () => undefined };
  }

  const subscription = new NativeEventEmitter(bridge).addListener(
    'widgetDeepLink',
    (event: WidgetDeepLinkEvent) => {
      if (typeof event.url === 'string') {
        listener(event.url);
      }
    },
  );

  return { remove: () => subscription.remove() };
};

const isWidgetBridgeAvailable = () =>
  Platform.OS === 'ios' && Boolean(getNativeBridge()?.getOrCreateInstallationId);

const getOrCreateInstallationId = async () => {
  const method = getNativeBridge()?.getOrCreateInstallationId;

  if (!method) {
    throw new Error('The iOS widget bridge is not available.');
  }

  return method();
};

const getInstalledWidgetKinds = async () =>
  (await getNativeBridge()?.getInstalledWidgetKinds?.()) ?? [];

const getWidgetStatus = async (): Promise<WidgetStatus> => {
  const bridge = getNativeBridge();

  if (!isWidgetBridgeAvailable() || !bridge) {
    return {
      isAvailable: false,
      installedKinds: [],
      hasConfiguredSession: false,
      expiresAt: null,
      isInitialized: false,
      enabledKinds: [],
      hasPremiumAccess: false,
      updatedAt: null,
    };
  }

  const status = await bridge.getWidgetStatus?.();
  const installedKinds =
    status?.installedKinds ?? (await getInstalledWidgetKinds());

  return {
    expiresAt: typeof status?.expiresAt === 'string' ? status.expiresAt : null,
    isAvailable: status?.isAvailable ?? true,
    installedKinds,
    hasConfiguredSession: status?.hasConfiguredSession ?? false,
    isInitialized: status?.isInitialized ?? false,
    enabledKinds: normalizeWidgetKinds(status?.enabledKinds),
    hasPremiumAccess: status?.hasPremiumAccess ?? false,
    updatedAt: typeof status?.updatedAt === 'string' ? status.updatedAt : null,
  };
};

const normalizeWidgetKinds = (kinds: unknown): WidgetKind[] => {
  if (!Array.isArray(kinds)) {
    return [];
  }

  const supportedKinds = new Set<string>([
    MOOD_WIDGET_KIND,
    QUICK_THOUGHT_WIDGET_KIND,
    STREAK_WIDGET_KIND,
  ]);

  return Array.from(
    new Set(
      kinds.filter(
        (kind): kind is WidgetKind =>
          typeof kind === 'string' && supportedKinds.has(kind),
      ),
    ),
  ).sort();
};

const getWidgetPreferences = async (): Promise<WidgetPreferences> => {
  const preferences = await getNativeBridge()?.getWidgetPreferences?.();

  return {
    isInitialized: preferences?.isInitialized ?? false,
    enabledKinds: normalizeWidgetKinds(preferences?.enabledKinds),
    hasPremiumAccess: preferences?.hasPremiumAccess ?? false,
    updatedAt:
      typeof preferences?.updatedAt === 'string'
        ? preferences.updatedAt
        : null,
  };
};

const updateWidgetPreferences = async (
  preferences: Omit<WidgetPreferences, 'updatedAt'>,
): Promise<WidgetPreferences> => {
  const method = getNativeBridge()?.updateWidgetPreferences;

  if (!method) {
    throw new Error('The iOS widget preferences bridge is not available.');
  }

  const updated = await method(preferences);
  return {
    isInitialized: updated.isInitialized ?? preferences.isInitialized,
    enabledKinds: normalizeWidgetKinds(
      updated.enabledKinds ?? preferences.enabledKinds,
    ),
    hasPremiumAccess:
      updated.hasPremiumAccess ?? preferences.hasPremiumAccess,
    updatedAt: typeof updated.updatedAt === 'string' ? updated.updatedAt : null,
  };
};

const configureMoodSession = async (
  configuration: WidgetSessionConfiguration,
) => {
  const method = getNativeBridge()?.configureMoodSession;

  if (!method) {
    throw new Error('The iOS widget session bridge is not available.');
  }

  await method(configuration);
};

const updateMoodSnapshot = async (snapshot: WidgetMoodSnapshot) => {
  await getNativeBridge()?.updateMoodSnapshot?.(snapshot);
};

const updateStreakSnapshot = async (snapshot: WidgetStreakSnapshot) => {
  await getNativeBridge()?.updateStreakSnapshot?.(snapshot);
};

const reloadWidgets = async (kind?: string) => {
  await getNativeBridge()?.reloadWidgets?.(kind);
};

const clearSession = async () => {
  await getNativeBridge()?.clearSession?.();
};

const clearMoodSession = async () => {
  await getNativeBridge()?.clearMoodSession?.();
};

export {
  MOOD_WIDGET_KIND,
  QUICK_THOUGHT_WIDGET_KIND,
  STREAK_WIDGET_KIND,
  clearMoodSession,
  clearSession,
  configureMoodSession,
  consumePendingWidgetDeepLink,
  getInstalledWidgetKinds,
  getOrCreateInstallationId,
  getWidgetPreferences,
  getWidgetStatus,
  isWidgetBridgeAvailable,
  reloadWidgets,
  subscribeToPendingWidgetDeepLinks,
  updateMoodSnapshot,
  updateStreakSnapshot,
  updateWidgetPreferences,
};
export type {
  WidgetActionStatus,
  WidgetAuthState,
  WidgetMoodSnapshot,
  WidgetMood,
  WidgetKind,
  WidgetPreferences,
  WidgetSessionConfiguration,
  WidgetStatus,
  WidgetStreakSnapshot,
};
