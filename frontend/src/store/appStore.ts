import { create } from 'zustand';
import type { BottomNavKey } from '../components/BottomNav';
import type { AuthEntrySource, FlowStage } from '../navigation/appFlow';
import type { PaywallTriggerMode } from '../services/paywallService';
import {
  resendEmailVerification,
  logout,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  verifyEmail,
  type AuthSession,
  type AuthUser,
} from '../services/authService';
import { getAppleSignInCredential } from '../config/appleSignIn';
import { getGoogleIdToken } from '../config/googleSignIn';
import {
  getProfile,
  updatePremiumStatus,
  updateProfile,
} from '../services/userService';
import {
  cancelFreeTrialEndingReminder,
  cancelReminderNotifications,
  getDefaultReminderTimezone,
  getReminderPermissionGranted,
  syncOnboardingReminderPreference,
  syncReminderNotifications,
  syncStoredDailyReminderNotifications,
} from '../services/reminderNotificationsService';
import { syncOnboardingReminderRecordPreference } from '../services/remindersService';
import type { ThemePreference } from '../theme/theme';
import { ApiError } from '../utils/apiClient';
import { CURRENT_ONBOARDING_VERSION } from '../config/onboarding';
import { completeOnboarding as completeOnboardingRequest } from '../services/onboardingService';
import {
  clearTokens,
  getOnboardingCompleted,
  hasSeenInstall,
  getTokens,
  markInstallSeen,
  saveOnboardingCompleted,
  savePostAuthPaywallSeen,
  saveTokens,
} from '../utils/tokenStorage';
import {
  clearStoredOnboardingData,
  getHapticsEnabled,
  getHideJournalPreviews,
  getStoredOnboardingData,
  saveHapticsEnabled,
  saveHideJournalPreviews,
  saveStoredOnboardingData,
} from '../utils/appStorage';
import type { OnboardingCompletionData } from '../types/onboarding';
import {
  clearCachedAuthUser,
  getCachedAuthUser,
  saveCachedAuthUser,
} from '../utils/authSessionCache';
import {
  authenticateBiometricLock,
  canAccessBiometricLock,
  disableBiometricLock as disableBiometricLockService,
  enableBiometricLock as enableBiometricLockService,
  getBiometricLockAvailability,
  readBiometricLockPreference,
  type BiometricLockAuthResult,
  type BiometricLockAuthStatus,
  type BiometricLockType,
  type BiometricLockToggleResult,
} from '../services/biometricLockService';
import devLaunchConfig from '../utils/devLaunchConfig.json';
import {
  goBackOrFallback,
  navigateMainApp,
  navigateRoot,
  replaceMainApp,
  resetRoot,
} from '../navigation/navigation';
import {
  createInitialJournalSliceState,
  createJournalSlice,
  type JournalSliceState,
} from './slices/journalSlice';

const ONBOARDING_EXIT_DELAY_MS = 220;
type SessionValidationState = 'none' | 'verified' | 'cached';
type BiometricAppLockFailureReason = Exclude<
  BiometricLockAuthStatus,
  'success'
>;

const wait = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

const isFlowStage = (value: string): value is FlowStage =>
  value === 'onboarding' ||
  value === 'paywall' ||
  value === 'hosted-paywall' ||
  value === 'lifetime-offer' ||
  value === 'auth' ||
  value === 'sign-in' ||
  value === 'forgot-password' ||
  value === 'reset-password' ||
  value === 'create-account' ||
  value === 'verify-email' ||
  value === 'profile' ||
  value === 'main-app' ||
  value === 'new-entry' ||
  value === 'journal-detail' ||
  value === 'journal-edit' ||
  value === 'complete';

const getInitialStage = (): FlowStage => {
  const launchStage = __DEV__ ? devLaunchConfig.stage : undefined;

  // Onboarding is auth-protected in v2 because the first reflection saves via
  // authenticated APIs. Never let a dev launch config put a tokenless install
  // straight into onboarding before bootstrap has verified a session.
  if (launchStage === 'onboarding') {
    return 'auth';
  }

  if (
    launchStage === 'home' ||
    launchStage === 'calendar' ||
    launchStage === 'insights'
  ) {
    return 'main-app';
  }

  if (launchStage && isFlowStage(launchStage)) {
    return launchStage;
  }

  return 'auth';
};

const getInitialTab = (): BottomNavKey => {
  const launchStage = __DEV__ ? devLaunchConfig.stage : undefined;

  if (
    __DEV__ &&
    (launchStage === 'calendar' || devLaunchConfig.activeTab === 'calendar')
  ) {
    return 'calendar';
  }

  if (launchStage === 'insights' || devLaunchConfig.activeTab === 'insights') {
    return 'insights';
  }

  if (devLaunchConfig.activeTab === 'mindmap') {
    return 'mindmap';
  }

  return 'home';
};

const shouldBypassAuthGateForDevLaunch = () => {
  if (!__DEV__ || !devLaunchConfig.stage) {
    return false;
  }

  return ![
    'onboarding',
    'auth',
    'sign-in',
    'create-account',
    'verify-email',
  ].includes(devLaunchConfig.stage);
};

const normalizeNewEntryPrompt = (value?: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const logReminderSyncWarning = (error: unknown) => {
  if (!__DEV__) {
    return;
  }

  console.warn(
    `[Reminders] Unable to sync reminder state after auth ${
      error instanceof Error ? error.message : 'Unknown reminder sync failure'
    }`,
  );
};

const syncReminderStateAfterAuth = async (
  onboardingData: OnboardingCompletionData | null,
) => {
  try {
    if (!onboardingData?.reminderPreference) {
      await syncStoredDailyReminderNotifications();
      return;
    }

    const preference = onboardingData.reminderPreference;
    const normalizedPreference = preference.trim().toLowerCase();
    const permissionGranted = await getReminderPermissionGranted();
    const savedReminder = await syncOnboardingReminderRecordPreference(
      preference,
      {
        enabled:
          Boolean(normalizedPreference) &&
          normalizedPreference !== 'none' &&
          permissionGranted,
        timezone: getDefaultReminderTimezone(),
      },
    );

    if (!savedReminder || !savedReminder.enabled) {
      await cancelReminderNotifications();
      return;
    }

    await syncReminderNotifications(savedReminder);
  } catch (error) {
    logReminderSyncWarning(error);
  }
};

const readBiometricLockSnapshot = async () => {
  const [availability, enabled] = await Promise.all([
    getBiometricLockAvailability(),
    readBiometricLockPreference(),
  ]);

  return {
    biometricLockEnabled: enabled,
    biometricLockIsAvailable: availability.isAvailable,
    biometricLockIsSupported: availability.isSupported,
    biometricLockType: availability.biometryType,
  };
};

type AppStoreState = {
  stage: FlowStage;
  paywallReturnStage: PaywallExitStage | null;
  activePaywallPlacementKey: string | null;
  activePaywallScreenKey: string | null;
  activePaywallTriggerMode: PaywallTriggerMode;
  activeHostedPaywallTarget: HostedPaywallTarget | null;
  postAuthPaywallStepOverride: PostAuthPaywallStep | null;
  activeTab: BottomNavKey;
  preferredInsightsTab: 'overview' | 'analysis' | null;
  isCompletingOnboarding: boolean;
  onboardingData: OnboardingCompletionData | null;
  pendingEmail: string;
  authSource: AuthEntrySource | null;
  session: AuthSession | null;
  sessionValidationState: SessionValidationState;
  initialProfileName: string;
  themeModeOverride: ThemePreference | null;
  selectedJournalEntryId: string | null;
  pendingNewEntryPrompt: string | null;
  pendingPremiumActivation: boolean;
  hasSeenHomeEntrance: boolean;
  hasBootstrappedAuthGate: boolean;
  hapticsEnabled: boolean;
  hideJournalPreviews: boolean;
  biometricLockEnabled: boolean;
  biometricLockIsAvailable: boolean;
  biometricLockIsSupported: boolean;
  biometricLockType: BiometricLockType;
  isBiometricAppLocked: boolean;
  isBiometricAuthenticating: boolean;
  biometricLockFailureReason: BiometricAppLockFailureReason | null;
  biometricLockFailureMessage: string | null;
  legalBrowserUrl: string | null;
  legalBrowserTitle: string | null;
} & JournalSliceState & {
    bootstrapAuthGate: () => Promise<void>;
    revalidateCachedSession: () => Promise<void>;
    completeOnboarding: (data: OnboardingCompletionData) => Promise<void>;
    finishOnboardingV2FirstReflection: () => Promise<void>;
    continueFromPaywall: (reason?: 'dismiss' | 'continue') => void;
    openHostedPaywall: (target: HostedPaywallTarget) => void;
    continueFromHostedPaywall: (reason?: 'dismiss' | 'continue') => void;
    fallbackFromHostedPaywall: () => void;
    continueFromLifetimeOffer: () => void;
    openLifetimeOffer: (options?: {
      returnStage?: FlowStage;
      screenKey?: string | null;
      triggerMode?: PaywallTriggerMode;
    }) => void;
    openPaywall: (returnStage?: FlowStage) => void;
    openPaywallForPlacement: (options: {
      placementKey: string;
      returnStage?: FlowStage;
      screenKey?: string | null;
      triggerMode?: PaywallTriggerMode;
    }) => void;
    setPaywallContext: (context: {
      placementKey: string | null;
      screenKey?: string | null;
      triggerMode?: PaywallTriggerMode;
    }) => void;
    clearPaywallContext: () => void;
    continueWithEmail: () => Promise<void>;
    continueWithApple: () => Promise<void>;
    continueWithGoogle: () => Promise<void>;
    goToSignIn: () => void;
    goToForgotPassword: () => void;
    goToResetPassword: (token?: string | null) => void;
    goToCreateAccount: () => void;
    createAccount: (payload: {
      email: string;
      password: string;
    }) => Promise<void>;
    finishCreateAccount: () => void;
    resendVerificationCode: () => Promise<void>;
    verifyPendingEmail: (code: string) => Promise<void>;
    finishEmailVerification: () => Promise<void>;
    signIn: (payload: { email: string; password: string }) => Promise<void>;
    completeProfile: (payload: {
      name: string;
      avatarColor: string;
    }) => Promise<void>;
    signOut: () => Promise<void>;
    goBackToAuth: () => void;
    goBackToCreateAccount: () => void;
    skipProfileSetup: () => Promise<void>;
    restartFlow: () => void;
    markHomeEntranceSeen: () => void;
    setActiveTabState: (nextTab: BottomNavKey) => void;
    setActiveTab: (nextTab: BottomNavKey) => void;
    openInsightsTab: (nextTab?: 'overview' | 'analysis') => void;
    clearPreferredInsightsTab: () => void;
    openNewEntry: (options?: { initialPrompt?: string | null }) => void;
    closeNewEntry: () => void;
    openJournalEntry: (entryId: string) => void;
    openJournalEditor: (entryId: string) => void;
    closeJournalEntry: () => void;
    closeJournalEditor: () => void;
    returnHomeFromJournalFlow: () => void;
    setThemeModeOverride: (nextMode: ThemePreference | null) => void;
    setHapticsEnabled: (nextValue: boolean) => Promise<void>;
    setHideJournalPreviews: (nextValue: boolean) => Promise<void>;
    refreshBiometricLockState: () => Promise<void>;
    setBiometricLockEnabled: (
      nextValue: boolean,
    ) => Promise<BiometricLockToggleResult>;
    lockAppWithBiometrics: () => void;
    unlockAppWithBiometrics: () => Promise<BiometricLockAuthResult>;
    clearBiometricAppLockError: () => void;
    openLegalBrowser: (payload: { url: string; title?: string | null }) => void;
    closeLegalBrowser: () => void;
    setSessionAiOptIn: (nextValue: boolean) => void;
    setSessionPremiumStatus: (nextValue: boolean) => Promise<void>;
    setSessionUserProfile: (nextProfile: AuthSession['user']) => void;
  };

type AppStoreSnapshot = Pick<
  AppStoreState,
  | 'stage'
  | 'paywallReturnStage'
  | 'activePaywallPlacementKey'
  | 'activePaywallScreenKey'
  | 'activePaywallTriggerMode'
  | 'activeHostedPaywallTarget'
  | 'postAuthPaywallStepOverride'
  | 'activeTab'
  | 'preferredInsightsTab'
  | 'isCompletingOnboarding'
  | 'onboardingData'
  | 'pendingEmail'
  | 'authSource'
  | 'session'
  | 'sessionValidationState'
  | 'initialProfileName'
  | 'themeModeOverride'
  | 'selectedJournalEntryId'
  | 'pendingNewEntryPrompt'
  | 'pendingPremiumActivation'
  | 'hasSeenHomeEntrance'
  | 'hasBootstrappedAuthGate'
  | 'hapticsEnabled'
  | 'hideJournalPreviews'
  | 'biometricLockEnabled'
  | 'biometricLockIsAvailable'
  | 'biometricLockIsSupported'
  | 'biometricLockType'
  | 'isBiometricAppLocked'
  | 'isBiometricAuthenticating'
  | 'biometricLockFailureReason'
  | 'biometricLockFailureMessage'
  | 'legalBrowserUrl'
  | 'legalBrowserTitle'
  | 'hasHydratedRecentJournalEntries'
  | 'recentJournalEntries'
>;

const createInitialSnapshot = (): AppStoreSnapshot => ({
  stage: getInitialStage(),
  paywallReturnStage: null,
  activePaywallPlacementKey: null,
  activePaywallScreenKey: null,
  activePaywallTriggerMode: 'contextual',
  activeHostedPaywallTarget: null,
  postAuthPaywallStepOverride: null,
  activeTab: getInitialTab(),
  preferredInsightsTab: null,
  isCompletingOnboarding: false,
  onboardingData: null,
  pendingEmail:
    __DEV__ && devLaunchConfig.stage === 'profile'
      ? devLaunchConfig.email || 'debug@example.com'
      : '',
  authSource: __DEV__ && devLaunchConfig.stage === 'profile' ? 'email' : null,
  session: null,
  sessionValidationState: 'none',
  initialProfileName: '',
  themeModeOverride: null,
  selectedJournalEntryId: null,
  pendingNewEntryPrompt: null,
  pendingPremiumActivation: false,
  hasSeenHomeEntrance: false,
  hasBootstrappedAuthGate: false,
  hapticsEnabled: true,
  hideJournalPreviews: false,
  biometricLockEnabled: false,
  biometricLockIsAvailable: false,
  biometricLockIsSupported: false,
  biometricLockType: null,
  isBiometricAppLocked: false,
  isBiometricAuthenticating: false,
  biometricLockFailureReason: null,
  biometricLockFailureMessage: null,
  legalBrowserUrl: null,
  legalBrowserTitle: null,
  ...createInitialJournalSliceState(),
});

const enterHomeWithProfile = (
  set: (partial: Partial<AppStoreState>) => void,
  get: () => AppStoreState,
  updatedProfile: AuthSession['user'],
) => {
  const currentSession = get().session;

  saveCachedAuthUser(updatedProfile).catch(() => undefined);

  set({
    session: currentSession
      ? {
          ...currentSession,
          user: updatedProfile,
        }
      : null,
    sessionValidationState: currentSession ? 'verified' : 'none',
    initialProfileName: updatedProfile.name,
    activeTab: 'home',
    stage: 'main-app',
  });

  resetRoot('MainApp', {
    screen: 'Home',
  });
};

const getSelectedGoals = (state: Pick<AppStoreState, 'onboardingData'>) =>
  state.onboardingData?.goals || [];

const isUnauthorizedProfileError = (error: unknown) =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

const isLegacyMockSession = (tokens: {
  accessToken: string;
  refreshToken: string;
}) =>
  tokens.accessToken.startsWith('mock-access-') ||
  tokens.refreshToken.startsWith('mock-refresh-');

const isAuthenticatedAppStage = (stage: FlowStage) =>
  stage === 'main-app' ||
  stage === 'new-entry' ||
  stage === 'journal-detail' ||
  stage === 'journal-edit';

const syncPendingPremiumIfNeeded = async (
  session: AuthSession,
  pendingPremiumActivation: boolean,
) => {
  if (!pendingPremiumActivation) {
    return session;
  }

  const updatedProfile = await updatePremiumStatus({ isPremium: true });

  return {
    ...session,
    user: updatedProfile,
  };
};

const getPostAuthDestinationStage = (
  session: AuthSession | null,
): PaywallExitStage => {
  if (!session) {
    return 'auth';
  }

  return session.user.profileSetupCompleted ? 'main-app' : 'profile';
};

const shouldShowPostAuthPaywall = (session: AuthSession | null) =>
  Boolean(session && !session.user.isPremium);

const hasCurrentOnboardingVersion = (user: AuthUser | null | undefined) =>
  typeof user?.onboardingVersion === 'number' &&
  user.onboardingVersion >= CURRENT_ONBOARDING_VERSION;

const isAmbiguousLegacyCachedProfile = (user: AuthUser) =>
  user.onboardingVersion === undefined &&
  user.createdAt === undefined &&
  user.hasJournalEntries === undefined;

const isOnboardingCompleteForCurrentVersion = (
  user: AuthUser | null | undefined,
  options: { allowLegacyCacheFallback?: boolean } = {},
) => {
  if (!user) {
    return false;
  }

  if (hasCurrentOnboardingVersion(user)) {
    return true;
  }

  if (
    user.hasJournalEntries ||
    (user.journalCount || 0) > 0 ||
    user.isPremium
  ) {
    return true;
  }

  if (user.onboardingCompleted && user.onboardingVersion == null) {
    return true;
  }

  if (
    options.allowLegacyCacheFallback &&
    isAmbiguousLegacyCachedProfile(user)
  ) {
    return true;
  }

  return false;
};

const resolveAuthenticatedRoute = (
  session: AuthSession | null,
): {
  nextStage: PaywallExitStage | 'paywall' | 'onboarding';
  paywallReturnStage: PaywallExitStage | null;
  showPaywall: boolean;
} => {
  if (!session || !isOnboardingCompleteForCurrentVersion(session.user)) {
    return {
      nextStage: 'onboarding',
      paywallReturnStage: null,
      showPaywall: false,
    };
  }

  const postAuthDestination = getPostAuthDestinationStage(session);
  const showPaywall = shouldShowPostAuthPaywall(session);

  return {
    nextStage: showPaywall ? 'paywall' : postAuthDestination,
    paywallReturnStage: showPaywall ? postAuthDestination : null,
    showPaywall,
  };
};

const resolvePaywallExitStage = (
  state: Pick<AppStoreState, 'session' | 'paywallReturnStage'>,
): PaywallExitStage => {
  if (state.paywallReturnStage) {
    return state.paywallReturnStage;
  }

  return getPostAuthDestinationStage(state.session);
};

const navigateToResolvedStage = (
  state: Pick<
    AppStoreState,
    | 'session'
    | 'paywallReturnStage'
    | 'activeTab'
    | 'stage'
    | 'setActiveTabState'
  >,
) => {
  const nextStage = resolvePaywallExitStage(state);

  switch (nextStage) {
    case 'onboarding':
      resetToOnboarding();
      return;
    case 'auth':
      resetToAuthChoice();
      return;
    case 'sign-in':
      resetRoot('SignIn');
      return;
    case 'forgot-password':
      resetRoot('ForgotPassword');
      return;
    case 'reset-password':
      resetRoot('ResetPassword');
      return;
    case 'create-account':
      resetRoot('CreateAccount');
      return;
    case 'verify-email':
      resetRoot('VerifyEmail');
      return;
    case 'profile':
      resetToProfileSetup();
      return;
    case 'new-entry':
      resetRoot('MainApp', {
        screen: 'NewEntry',
      });
      return;
    case 'journal-detail':
      resetRoot('MainApp', {
        screen: 'EntryDetail',
      });
      return;
    case 'journal-edit':
      resetRoot('MainApp', {
        screen: 'EditEntry',
      });
      return;
    case 'complete':
      resetRoot('Complete');
      return;
    case 'main-app':
    default:
      resetToMainApp(state.setActiveTabState, state.activeTab);
  }
};

type PaywallExitStage = Exclude<
  FlowStage,
  'paywall' | 'hosted-paywall' | 'lifetime-offer'
>;

type HostedPaywallTarget = 'main' | 'exit';
type PostAuthPaywallStep = 'trial' | 'reminder' | 'purchase';

const shouldUseHostedPaywallForPlacement = (placementKey: string) =>
  placementKey !== 'profile_upgrade_banner' &&
  placementKey !== 'post_auth' &&
  placementKey !== 'post_auth_exit_offer';

const getMainAppRouteForTab = (tab: BottomNavKey) => {
  switch (tab) {
    case 'calendar':
      return 'Calendar';
    case 'insights':
      return 'Insights';
    case 'mindmap':
      return 'MindMap';
    case 'profile':
      return 'Profile';
    case 'home':
    default:
      return 'Home';
  }
};

const resetToMainApp = (
  setActiveTabState: AppStoreState['setActiveTabState'],
  tab: BottomNavKey = 'home',
) => {
  const nextRoute = getMainAppRouteForTab(tab);

  resetRoot('MainApp', {
    screen: nextRoute,
  });

  setActiveTabState(tab);
};

const resetToAuthChoice = () => {
  resetRoot('AuthChoice');
};

const resetToOnboarding = () => {
  resetRoot('Onboarding');
};

const resetToProfileSetup = () => {
  resetRoot('SetupProfile');
};

const navigateAuthenticatedRoute = (
  resolution: ReturnType<typeof resolveAuthenticatedRoute>,
) => {
  if (resolution.nextStage === 'onboarding') {
    resetToOnboarding();
    return;
  }

  if (resolution.showPaywall) {
    resetRoot('Paywall');
    return;
  }

  if (resolution.nextStage === 'profile') {
    resetToProfileSetup();
    return;
  }

  resetRoot('MainApp', {
    screen: 'Home',
  });
};

const persistAndRouteAuthenticatedSession = async ({
  set,
  session,
  authSource,
  pendingEmailFallback = '',
  paywallScreenKey,
  onboardingData = null,
}: {
  set: (partial: Partial<AppStoreState>) => void;
  session: AuthSession;
  authSource: AuthEntrySource;
  pendingEmailFallback?: string;
  paywallScreenKey: string;
  onboardingData?: OnboardingCompletionData | null;
}) => {
  const onboardingComplete = isOnboardingCompleteForCurrentVersion(
    session.user,
  );
  const resolution = resolveAuthenticatedRoute(session);

  await saveCachedAuthUser(session.user);
  await saveOnboardingCompleted(onboardingComplete);

  if (onboardingComplete) {
    await syncReminderStateAfterAuth(onboardingData);
  }

  if (resolution.showPaywall) {
    await savePostAuthPaywallSeen(true);
  }

  set({
    authSource,
    pendingEmail: session.user.email || pendingEmailFallback,
    paywallReturnStage: resolution.paywallReturnStage,
    activePaywallPlacementKey: resolution.showPaywall ? 'post_auth' : null,
    activePaywallScreenKey: resolution.showPaywall ? paywallScreenKey : null,
    activePaywallTriggerMode: 'contextual',
    activeHostedPaywallTarget: null,
    postAuthPaywallStepOverride: null,
    session,
    sessionValidationState: 'verified',
    onboardingData,
    initialProfileName: session.user.name || 'Journal User',
    pendingPremiumActivation: false,
    preferredInsightsTab: null,
    activeTab: 'home',
    stage: resolution.nextStage,
  });

  navigateAuthenticatedRoute(resolution);
};

export const useAppStore = create<AppStoreState>((set, get) => ({
  ...createInitialSnapshot(),
  ...createJournalSlice(set as Parameters<typeof createJournalSlice>[0]),
  bootstrapAuthGate: async () => {
    if (get().hasBootstrappedAuthGate) {
      return;
    }

    const [hapticsEnabled, hideJournalPreviews, biometricLockSnapshot] = await Promise.all([
      getHapticsEnabled().catch(() => true),
      getHideJournalPreviews().catch(() => false),
      readBiometricLockSnapshot().catch(() => ({
        biometricLockEnabled: false,
        biometricLockIsAvailable: false,
        biometricLockIsSupported: false,
        biometricLockType: null,
      })),
    ]);

    set({
      hapticsEnabled,
      hideJournalPreviews,
      ...biometricLockSnapshot,
      isBiometricAppLocked: biometricLockSnapshot.biometricLockEnabled,
    });

    if (shouldBypassAuthGateForDevLaunch()) {
      set({ hasBootstrappedAuthGate: true });
      return;
    }

    const installSeen = await hasSeenInstall();

    if (!installSeen) {
      await markInstallSeen();
      await saveOnboardingCompleted(false);
      await savePostAuthPaywallSeen(false);
    }

    let tokens = await getTokens();

    if (tokens && isLegacyMockSession(tokens)) {
      await Promise.all([clearTokens(), clearCachedAuthUser()]);
      tokens = null;
    }

    if (tokens) {
      try {
        const profile = await getProfile();
        const hydratedSession: AuthSession = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: profile,
        };
        const onboardingComplete =
          isOnboardingCompleteForCurrentVersion(profile);
        const nextStage = onboardingComplete ? 'main-app' : 'onboarding';

        await saveOnboardingCompleted(onboardingComplete);
        await savePostAuthPaywallSeen(true);
        await saveCachedAuthUser(profile);
        if (onboardingComplete) {
          await syncReminderStateAfterAuth(null);
        }

        set({
          hasBootstrappedAuthGate: true,
          session: hydratedSession,
          sessionValidationState: 'verified',
          onboardingData: null,
          initialProfileName: profile.name,
          authSource: profile.email ? 'email' : null,
          pendingEmail: profile.email || '',
          paywallReturnStage: null,
          activePaywallPlacementKey: null,
          activePaywallScreenKey: null,
          activePaywallTriggerMode: 'contextual',
          activeHostedPaywallTarget: null,
          postAuthPaywallStepOverride: null,
          preferredInsightsTab: null,
          pendingPremiumActivation: false,
          activeTab: 'home',
          stage: nextStage,
          isBiometricAppLocked:
            biometricLockSnapshot.biometricLockEnabled &&
            canAccessBiometricLock(profile),
          biometricLockFailureReason: null,
          biometricLockFailureMessage: null,
        });
        return;
      } catch (error) {
        if (isUnauthorizedProfileError(error)) {
          await clearTokens();
          await clearCachedAuthUser();
        } else if (error instanceof ApiError && error.isNetworkError) {
          const cachedUser = await getCachedAuthUser();

          if (cachedUser) {
            const hydratedSession: AuthSession = {
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              user: cachedUser,
            };

            set({
              hasBootstrappedAuthGate: true,
              session: hydratedSession,
              sessionValidationState: 'cached',
              onboardingData: null,
              initialProfileName: cachedUser.name,
              authSource: cachedUser.email ? 'email' : null,
              pendingEmail: cachedUser.email || '',
              paywallReturnStage: null,
              activePaywallPlacementKey: null,
              activePaywallScreenKey: null,
              activePaywallTriggerMode: 'contextual',
              activeHostedPaywallTarget: null,
              postAuthPaywallStepOverride: null,
              preferredInsightsTab: null,
              pendingPremiumActivation: false,
              activeTab: 'home',
              isBiometricAppLocked:
                biometricLockSnapshot.biometricLockEnabled &&
                canAccessBiometricLock(cachedUser),
              biometricLockFailureReason: null,
              biometricLockFailureMessage: null,
              stage: isOnboardingCompleteForCurrentVersion(cachedUser, {
                allowLegacyCacheFallback: true,
              })
                ? cachedUser.profileSetupCompleted
                  ? 'main-app'
                  : 'profile'
                : 'onboarding',
            });
            return;
          }

          set({
            hasBootstrappedAuthGate: false,
            session: null,
            sessionValidationState: 'none',
          });
          return;
        }

        set({
          hasBootstrappedAuthGate: true,
          session: null,
          sessionValidationState: 'none',
          onboardingData: null,
          initialProfileName: '',
          authSource: null,
          pendingEmail: '',
          paywallReturnStage: null,
          activePaywallPlacementKey: null,
          activePaywallScreenKey: null,
          activePaywallTriggerMode: 'contextual',
          activeHostedPaywallTarget: null,
          postAuthPaywallStepOverride: null,
          preferredInsightsTab: null,
          activeTab: 'home',
          isBiometricAppLocked: false,
          biometricLockFailureReason: null,
          biometricLockFailureMessage: null,
          stage: 'auth',
        });
        return;
      }
    }

    const onboardingCompleted = await getOnboardingCompleted();
    const storedOnboardingData = onboardingCompleted
      ? await getStoredOnboardingData()
      : null;

    set({
      hasBootstrappedAuthGate: true,
      session: null,
      sessionValidationState: 'none',
      onboardingData: storedOnboardingData,
      initialProfileName: '',
      authSource: null,
      pendingEmail: '',
      paywallReturnStage: null,
      activePaywallPlacementKey: null,
      activePaywallScreenKey: null,
      activePaywallTriggerMode: 'contextual',
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      preferredInsightsTab: null,
      activeTab: 'home',
      isBiometricAppLocked: false,
      biometricLockFailureReason: null,
      biometricLockFailureMessage: null,
      stage: 'auth',
    });
    await clearCachedAuthUser();
    resetToAuthChoice();
  },
  revalidateCachedSession: async () => {
    const currentState = get();

    if (
      currentState.sessionValidationState !== 'cached' ||
      !currentState.session
    ) {
      return;
    }

    try {
      const profile = await getProfile();
      const onboardingComplete =
        isOnboardingCompleteForCurrentVersion(profile);
      const nextStage: FlowStage = !onboardingComplete
        ? 'onboarding'
        : profile.profileSetupCompleted
        ? 'main-app'
        : 'profile';
      const latestStage = get().stage;
      const shouldKeepAuthenticatedRoute =
        nextStage === 'main-app' && isAuthenticatedAppStage(latestStage);

      await Promise.all([
        saveCachedAuthUser(profile),
        saveOnboardingCompleted(onboardingComplete),
      ]);

      set({
        session: {
          ...currentState.session,
          user: profile,
        },
        sessionValidationState: 'verified',
        initialProfileName: profile.name,
        pendingEmail: profile.email || '',
        authSource: profile.email ? 'email' : currentState.authSource,
        ...(shouldKeepAuthenticatedRoute ? {} : { stage: nextStage }),
      });

      if (shouldKeepAuthenticatedRoute || latestStage === nextStage) {
        return;
      }

      if (nextStage === 'onboarding') {
        resetToOnboarding();
      } else if (nextStage === 'profile') {
        resetToProfileSetup();
      } else {
        resetRoot('MainApp', { screen: 'Home' });
      }
    } catch (error) {
      if (!isUnauthorizedProfileError(error)) {
        return;
      }

      await Promise.all([clearTokens(), clearCachedAuthUser()]);
      set({
        session: null,
        sessionValidationState: 'none',
        stage: 'auth',
        onboardingData: null,
        initialProfileName: '',
        pendingEmail: '',
        authSource: null,
        isBiometricAppLocked: false,
      });
      resetToAuthChoice();
    }
  },
  completeOnboarding: async data => {
    const currentSession = get().session;

    if (!currentSession) {
      set({
        isCompletingOnboarding: false,
        onboardingData: null,
        stage: 'auth',
      });
      resetToAuthChoice();
      return;
    }

    set({
      isCompletingOnboarding: true,
      onboardingData: data,
    });

    try {
      const updatedProfile = await completeOnboardingRequest(data);
      const updatedSession: AuthSession = {
        ...currentSession,
        user: updatedProfile,
      };
      const syncOnboardingReminderPromise = syncOnboardingReminderPreference(
        data.reminderPreference,
      ).catch(() => undefined);

      await wait(ONBOARDING_EXIT_DELAY_MS);
      await Promise.all([
        saveOnboardingCompleted(true),
        saveStoredOnboardingData(data),
        saveCachedAuthUser(updatedProfile),
        syncOnboardingReminderPromise,
      ]);
      await persistAndRouteAuthenticatedSession({
        set,
        session: updatedSession,
        authSource: get().authSource || 'email',
        pendingEmailFallback: get().pendingEmail,
        paywallScreenKey: 'onboarding',
        onboardingData: data,
      });

      set({
        isCompletingOnboarding: false,
      });
    } catch (error) {
      set({
        isCompletingOnboarding: false,
      });
      throw error;
    }
  },
  finishOnboardingV2FirstReflection: async () => {
    const currentSession = get().session;

    if (!currentSession) {
      set({
        isCompletingOnboarding: false,
        onboardingData: null,
        stage: 'auth',
      });
      resetToAuthChoice();
      return;
    }

    const currentJournalCount = currentSession.user.journalCount || 0;
    const nextProfile: AuthUser = {
      ...currentSession.user,
      hasJournalEntries: true,
      journalCount: Math.max(currentJournalCount + 1, 1),
    };

    await Promise.all([
      saveOnboardingCompleted(true),
      savePostAuthPaywallSeen(true),
      saveCachedAuthUser(nextProfile),
    ]);

    set({
      session: {
        ...currentSession,
        user: nextProfile,
      },
      initialProfileName: nextProfile.name,
      activeTab: 'home',
      paywallReturnStage: null,
      activePaywallPlacementKey: null,
      activePaywallScreenKey: null,
      activePaywallTriggerMode: 'contextual',
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      stage: 'main-app',
      isBiometricAppLocked:
        get().biometricLockEnabled && canAccessBiometricLock(nextProfile),
      biometricLockFailureReason: null,
      biometricLockFailureMessage: null,
    });

    resetRoot('MainApp', {
      screen: 'Home',
    });
  },
  continueFromPaywall: () => {
    const state = get();

    set(currentState => ({
      paywallReturnStage: null,
      activePaywallPlacementKey: null,
      activePaywallScreenKey: null,
      activePaywallTriggerMode: 'contextual',
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      stage: resolvePaywallExitStage(currentState),
    }));

    navigateToResolvedStage({
      ...state,
      setActiveTabState: get().setActiveTabState,
    });
  },
  openHostedPaywall: target => {
    const state = get();

    set({
      activePaywallPlacementKey:
        target === 'exit'
          ? 'post_auth_exit_offer'
          : state.activePaywallPlacementKey || 'post_auth',
      activePaywallScreenKey:
        target === 'exit' ? 'home' : state.activePaywallScreenKey,
      activePaywallTriggerMode:
        target === 'exit' ? 'contextual' : state.activePaywallTriggerMode,
      activeHostedPaywallTarget: target,
      stage: 'hosted-paywall',
    });

    resetRoot('HostedPaywall');
  },
  continueFromHostedPaywall: () => {
    const state = get();

    set(currentState => ({
      paywallReturnStage: null,
      activePaywallPlacementKey: null,
      activePaywallScreenKey: null,
      activePaywallTriggerMode: 'contextual',
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      stage: resolvePaywallExitStage(currentState),
    }));

    navigateToResolvedStage({
      ...state,
      setActiveTabState: get().setActiveTabState,
    });
  },
  fallbackFromHostedPaywall: () => {
    const state = get();

    if (state.activeHostedPaywallTarget === 'exit') {
      set(currentState => ({
        paywallReturnStage: null,
        activePaywallPlacementKey: null,
        activePaywallScreenKey: null,
        activePaywallTriggerMode: 'contextual',
        activeHostedPaywallTarget: null,
        postAuthPaywallStepOverride: null,
        stage: resolvePaywallExitStage(currentState),
      }));

      navigateToResolvedStage({
        ...state,
        setActiveTabState: get().setActiveTabState,
      });
      return;
    }

    set({
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: 'purchase' as PostAuthPaywallStep,
      stage: 'paywall' as FlowStage,
    });

    resetRoot('Paywall');
  },
  continueFromLifetimeOffer: () => {
    const state = get();

    set(currentState => ({
      paywallReturnStage: null,
      activePaywallPlacementKey: null,
      activePaywallScreenKey: null,
      activePaywallTriggerMode: 'contextual',
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      stage: resolvePaywallExitStage(currentState),
    }));

    navigateToResolvedStage({
      ...state,
      setActiveTabState: get().setActiveTabState,
    });
  },
  openLifetimeOffer: ({
    returnStage,
    screenKey = null,
    triggerMode = 'contextual',
  } = {}) => {
    const currentStage = get().stage;
    const fallbackStage: PaywallExitStage =
      currentStage === 'paywall' ||
      currentStage === 'hosted-paywall' ||
      currentStage === 'lifetime-offer'
        ? getPostAuthDestinationStage(get().session)
        : (currentStage as PaywallExitStage);
    const nextReturnStage: PaywallExitStage =
      returnStage &&
      returnStage !== 'paywall' &&
      returnStage !== 'hosted-paywall' &&
      returnStage !== 'lifetime-offer'
        ? (returnStage as PaywallExitStage)
        : fallbackStage;

    set({
      paywallReturnStage: nextReturnStage,
      activePaywallPlacementKey: 'profile_upgrade_banner',
      activePaywallScreenKey: screenKey,
      activePaywallTriggerMode: triggerMode,
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      stage: 'lifetime-offer',
    });

    resetRoot('LifetimeOffer');
  },
  openPaywall: returnStage => {
    const currentStage = get().stage;
    const fallbackStage: PaywallExitStage =
      currentStage === 'paywall' ||
      currentStage === 'hosted-paywall' ||
      currentStage === 'lifetime-offer'
        ? getPostAuthDestinationStage(get().session)
        : (currentStage as PaywallExitStage);
    const nextReturnStage: PaywallExitStage =
      returnStage &&
      returnStage !== 'paywall' &&
      returnStage !== 'hosted-paywall' &&
      returnStage !== 'lifetime-offer'
        ? (returnStage as PaywallExitStage)
        : fallbackStage;

    set({
      paywallReturnStage: nextReturnStage,
      activePaywallPlacementKey: null,
      activePaywallScreenKey: null,
      activePaywallTriggerMode: 'contextual',
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      stage: 'paywall',
    });

    resetRoot('Paywall');
  },
  openPaywallForPlacement: ({
    placementKey,
    returnStage,
    screenKey = null,
    triggerMode = 'contextual',
  }) => {
    const shouldUseHostedPaywall =
      shouldUseHostedPaywallForPlacement(placementKey);
    const currentStage = get().stage;
    const fallbackStage: PaywallExitStage =
      currentStage === 'paywall' ||
      currentStage === 'hosted-paywall' ||
      currentStage === 'lifetime-offer'
        ? getPostAuthDestinationStage(get().session)
        : (currentStage as PaywallExitStage);
    const nextReturnStage: PaywallExitStage =
      returnStage &&
      returnStage !== 'paywall' &&
      returnStage !== 'hosted-paywall' &&
      returnStage !== 'lifetime-offer'
        ? (returnStage as PaywallExitStage)
        : fallbackStage;

    set({
      paywallReturnStage: nextReturnStage,
      activePaywallPlacementKey: placementKey,
      activePaywallScreenKey: screenKey,
      activePaywallTriggerMode: triggerMode,
      activeHostedPaywallTarget: shouldUseHostedPaywall ? 'main' : null,
      postAuthPaywallStepOverride: null,
      stage: shouldUseHostedPaywall ? 'hosted-paywall' : 'paywall',
    });

    resetRoot(shouldUseHostedPaywall ? 'HostedPaywall' : 'Paywall');
  },
  setPaywallContext: ({
    placementKey,
    screenKey = null,
    triggerMode = 'contextual',
  }) => {
    set({
      activePaywallPlacementKey: placementKey,
      activePaywallScreenKey: screenKey,
      activePaywallTriggerMode: triggerMode,
    });
  },
  clearPaywallContext: () => {
    set({
      activePaywallPlacementKey: null,
      activePaywallScreenKey: null,
      activePaywallTriggerMode: 'contextual',
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
    });
  },
  continueWithEmail: async () => {
    set({
      authSource: 'email',
      stage: 'create-account',
    });

    navigateRoot('CreateAccount');
  },
  continueWithApple: async () => {
    const credential = await getAppleSignInCredential();

    if (!credential) {
      return;
    }

    const response = await signInWithApple({
      identityToken: credential.identityToken,
      nonce: credential.nonce,
      ...(credential.email ? { email: credential.email } : {}),
      ...(credential.fullName ? { fullName: credential.fullName } : {}),
    });

    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    const syncedSession = await syncPendingPremiumIfNeeded(
      response,
      get().pendingPremiumActivation,
    );

    await persistAndRouteAuthenticatedSession({
      set,
      session: syncedSession,
      authSource: 'apple',
      paywallScreenKey: 'auth',
    });
  },
  continueWithGoogle: async () => {
    const idToken = await getGoogleIdToken();

    if (!idToken) {
      return;
    }

    const response = await signInWithGoogle({
      idToken,
    });

    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    const syncedSession = await syncPendingPremiumIfNeeded(
      response,
      get().pendingPremiumActivation,
    );

    await persistAndRouteAuthenticatedSession({
      set,
      session: syncedSession,
      authSource: 'google',
      paywallScreenKey: 'auth',
    });
  },
  goToSignIn: () => {
    set({ stage: 'sign-in' });

    resetRoot('SignIn');
  },
  goToForgotPassword: () => {
    set({ stage: 'forgot-password' });

    navigateRoot('ForgotPassword');
  },
  goToResetPassword: token => {
    resetRoot('ResetPassword', token ? { token } : undefined);
  },
  goToCreateAccount: () => {
    set({ stage: 'create-account' });

    navigateRoot('CreateAccount');
  },
  createAccount: async payload => {
    const normalizedEmail = payload.email.trim();

    set({
      authSource: 'email',
      pendingEmail: normalizedEmail,
    });

    const response = await signUpWithEmail({
      email: normalizedEmail,
      password: payload.password,
    });

    set({
      pendingEmail: response.email,
    });
  },
  finishCreateAccount: () => {
    set({ stage: 'verify-email' });

    navigateRoot('VerifyEmail');
  },
  resendVerificationCode: async () => {
    const { pendingEmail } = get();

    if (!pendingEmail) {
      throw new Error('Please create an account first.');
    }

    await resendEmailVerification({
      email: pendingEmail,
    });
  },
  verifyPendingEmail: async code => {
    const { pendingEmail } = get();

    if (!pendingEmail) {
      throw new Error('Please create an account first.');
    }

    const response = await verifyEmail({
      email: pendingEmail,
      code,
    });

    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    const syncedSession = await syncPendingPremiumIfNeeded(
      response,
      get().pendingPremiumActivation,
    );

    set({
      session: syncedSession,
      sessionValidationState: 'verified',
      initialProfileName: syncedSession.user.name,
      pendingPremiumActivation: false,
    });
  },
  finishEmailVerification: async () => {
    const state = get();

    if (!state.session) {
      set({ stage: 'auth' });
      resetToAuthChoice();
      return;
    }

    await persistAndRouteAuthenticatedSession({
      set,
      session: state.session,
      authSource: state.authSource || 'email',
      pendingEmailFallback: state.pendingEmail,
      paywallScreenKey: 'verify-email',
    });
  },
  signIn: async payload => {
    let response: AuthSession;

    try {
      response = await signInWithEmail({
        ...payload,
      });
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'EMAIL_NOT_VERIFIED') {
        throw error;
      }

      const pendingEmail = payload.email.trim();

      set({
        authSource: 'email',
        pendingEmail,
        stage: 'verify-email',
      });

      navigateRoot('VerifyEmail');

      await resendEmailVerification({
        email: pendingEmail,
      }).catch(resendError => {
        if (__DEV__) {
          console.warn(
            `[Auth] Unable to resend verification code after sign-in ${JSON.stringify(
              {
                email: pendingEmail,
                message:
                  resendError instanceof Error
                    ? resendError.message
                    : 'Unknown resend failure',
              },
            )}`,
          );
        }
      });

      return;
    }

    await saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    const syncedSession = await syncPendingPremiumIfNeeded(
      response,
      get().pendingPremiumActivation,
    );

    await persistAndRouteAuthenticatedSession({
      set,
      session: syncedSession,
      authSource: 'email',
      pendingEmailFallback: payload.email,
      paywallScreenKey: 'auth',
    });
  },
  completeProfile: async payload => {
    const updatedProfile = await updateProfile({
      name: payload.name,
      avatarColor: payload.avatarColor,
      goals: getSelectedGoals(get()),
    });

    await saveOnboardingCompleted(true);

    enterHomeWithProfile(set, get, updatedProfile);
  },
  signOut: async () => {
    try {
      await logout();
    } catch {
      // Sign-out must still complete locally even if the backend session is already gone.
    }

    await cancelFreeTrialEndingReminder().catch(() => undefined);
    await clearTokens();
    await clearCachedAuthUser();
    await clearStoredOnboardingData();

    set({
      ...createInitialJournalSliceState(),
      stage: 'auth',
      activeTab: 'home',
      paywallReturnStage: null,
      activePaywallPlacementKey: null,
      activePaywallScreenKey: null,
      activePaywallTriggerMode: 'contextual',
      activeHostedPaywallTarget: null,
      postAuthPaywallStepOverride: null,
      preferredInsightsTab: null,
      isCompletingOnboarding: false,
      onboardingData: null,
      pendingEmail: '',
      authSource: null,
      session: null,
      sessionValidationState: 'none',
      initialProfileName: '',
      selectedJournalEntryId: null,
      pendingNewEntryPrompt: null,
      pendingPremiumActivation: false,
      isBiometricAppLocked: false,
      isBiometricAuthenticating: false,
      biometricLockFailureReason: null,
      biometricLockFailureMessage: null,
    });

    resetRoot('AuthChoice');
  },
  goBackToAuth: () => {
    set({ stage: 'auth' });

    goBackOrFallback(() => resetRoot('AuthChoice'));
  },
  goBackToCreateAccount: () => {
    set({ stage: 'create-account' });

    goBackOrFallback(() => resetRoot('CreateAccount'));
  },
  skipProfileSetup: async () => {
    const state = get();
    const fallbackName =
      state.initialProfileName || state.session?.user.name || 'Journal User';
    const avatarColor = state.session?.user.avatarColor || '#8E4636';

    const updatedProfile = await updateProfile({
      name: fallbackName,
      avatarColor,
      goals: getSelectedGoals(state),
    });

    await saveOnboardingCompleted(true);

    enterHomeWithProfile(set, get, updatedProfile);
  },
  restartFlow: () => {
    set({
      ...createInitialSnapshot(),
      stage: 'onboarding',
    });

    resetRoot('Onboarding');
  },
  markHomeEntranceSeen: () => {
    set({ hasSeenHomeEntrance: true });
  },
  setActiveTabState: nextTab => {
    set({
      activeTab: nextTab,
      preferredInsightsTab:
        nextTab === 'insights' ? get().preferredInsightsTab : null,
    });
  },
  setActiveTab: nextTab => {
    set({
      activeTab: nextTab,
      preferredInsightsTab:
        nextTab === 'insights' ? get().preferredInsightsTab : null,
    });

    replaceMainApp(getMainAppRouteForTab(nextTab));
  },
  openInsightsTab: (nextTab = 'overview') => {
    set({
      activeTab: 'insights',
      preferredInsightsTab: nextTab,
      stage: 'main-app',
    });

    replaceMainApp('Insights');
  },
  clearPreferredInsightsTab: () => {
    set({ preferredInsightsTab: null });
  },
  openNewEntry: options => {
    set({
      stage: 'new-entry',
      pendingNewEntryPrompt: normalizeNewEntryPrompt(options?.initialPrompt),
    });

    navigateMainApp('NewEntry', {
      initialPrompt: normalizeNewEntryPrompt(options?.initialPrompt),
    });
  },
  closeNewEntry: () => {
    set({ stage: 'main-app', pendingNewEntryPrompt: null });

    goBackOrFallback(() =>
      resetRoot('MainApp', {
        screen: getMainAppRouteForTab(get().activeTab),
      }),
    );
  },
  openJournalEntry: entryId => {
    set({
      selectedJournalEntryId: entryId,
      pendingNewEntryPrompt: null,
      stage: 'journal-detail',
    });

    navigateMainApp('EntryDetail', {
      entryId,
    });
  },
  openJournalEditor: entryId => {
    set({
      selectedJournalEntryId: entryId,
      pendingNewEntryPrompt: null,
      stage: 'journal-edit',
    });

    navigateMainApp('EditEntry', {
      entryId,
    });
  },
  closeJournalEntry: () => {
    const nextTab = get().activeTab;

    set({
      selectedJournalEntryId: null,
      pendingNewEntryPrompt: null,
      stage: 'main-app',
    });

    goBackOrFallback(() =>
      resetRoot('MainApp', {
        screen: getMainAppRouteForTab(nextTab),
      }),
    );
  },
  closeJournalEditor: () => {
    const hasEntry = Boolean(get().selectedJournalEntryId);

    set(state => ({
      pendingNewEntryPrompt: null,
      stage: state.selectedJournalEntryId ? 'journal-detail' : 'main-app',
    }));

    goBackOrFallback(() =>
      resetRoot('MainApp', {
        screen: hasEntry
          ? 'EntryDetail'
          : getMainAppRouteForTab(get().activeTab),
      }),
    );
  },
  returnHomeFromJournalFlow: () => {
    set({
      activeTab: 'home',
      preferredInsightsTab: null,
      selectedJournalEntryId: null,
      pendingNewEntryPrompt: null,
      stage: 'main-app',
    });

    resetRoot('MainApp', {
      screen: 'Home',
    });
  },
  setThemeModeOverride: nextMode => {
    set({ themeModeOverride: nextMode });
  },
  setHapticsEnabled: async nextValue => {
    await saveHapticsEnabled(nextValue);
    set({ hapticsEnabled: nextValue });
  },
  setHideJournalPreviews: async nextValue => {
    await saveHideJournalPreviews(nextValue);
    set({ hideJournalPreviews: nextValue });
  },
  refreshBiometricLockState: async () => {
    const snapshot = await readBiometricLockSnapshot();

    set(currentState => ({
      biometricLockEnabled: snapshot.biometricLockEnabled,
      biometricLockIsAvailable: snapshot.biometricLockIsAvailable,
      biometricLockIsSupported: snapshot.biometricLockIsSupported,
      biometricLockType: snapshot.biometricLockType,
      isBiometricAppLocked:
        snapshot.biometricLockEnabled && currentState.session
          ? currentState.isBiometricAppLocked
          : false,
    }));
  },
  setBiometricLockEnabled: async nextValue => {
    const result = nextValue
      ? await enableBiometricLockService()
      : await disableBiometricLockService();

    set({
      biometricLockEnabled: result.status === 'enabled',
      biometricLockIsAvailable: result.availability.isAvailable,
      biometricLockIsSupported: result.availability.isSupported,
      biometricLockType: result.availability.biometryType,
      isBiometricAppLocked: false,
      isBiometricAuthenticating: false,
      biometricLockFailureReason: null,
      biometricLockFailureMessage: null,
    });

    return result;
  },
  lockAppWithBiometrics: () => {
    const sessionUser = get().session?.user;

    if (!get().biometricLockEnabled || !sessionUser || !canAccessBiometricLock(sessionUser)) {
      return;
    }

    set({
      isBiometricAppLocked: true,
      isBiometricAuthenticating: false,
      biometricLockFailureReason: null,
      biometricLockFailureMessage: null,
    });
  },
  unlockAppWithBiometrics: async () => {
    if (!get().biometricLockEnabled) {
      set({
        isBiometricAppLocked: false,
        isBiometricAuthenticating: false,
        biometricLockFailureReason: null,
        biometricLockFailureMessage: null,
      });

      return {
        availability: await getBiometricLockAvailability(),
        status: 'success' as const,
      };
    }

    set({
      isBiometricAuthenticating: true,
      biometricLockFailureReason: null,
      biometricLockFailureMessage: null,
    });

    const result = await authenticateBiometricLock();

    set({
      biometricLockIsAvailable: result.availability.isAvailable,
      biometricLockIsSupported: result.availability.isSupported,
      biometricLockType: result.availability.biometryType,
      isBiometricAppLocked: result.status !== 'success',
      isBiometricAuthenticating: false,
      biometricLockFailureReason:
        result.status === 'success' ? null : result.status,
      biometricLockFailureMessage:
        result.status === 'success' ? null : result.message || null,
    });

    return result;
  },
  clearBiometricAppLockError: () => {
    set({
      biometricLockFailureReason: null,
      biometricLockFailureMessage: null,
    });
  },
  openLegalBrowser: ({ url, title = null }) => {
    set({
      legalBrowserUrl: url,
      legalBrowserTitle: title,
    });

    navigateRoot('LegalBrowserModal');
  },
  closeLegalBrowser: () => {
    set({
      legalBrowserUrl: null,
      legalBrowserTitle: null,
    });

    goBackOrFallback(() => undefined);
  },
  setSessionAiOptIn: nextValue => {
    const currentSession = get().session;

    if (!currentSession) {
      return;
    }

    const nextProfile = {
      ...currentSession.user,
      aiOptIn: nextValue,
    };

    saveCachedAuthUser(nextProfile).catch(() => undefined);

    set({
      session: {
        ...currentSession,
        user: nextProfile,
      },
    });
  },
  setSessionPremiumStatus: async nextValue => {
    const currentSession = get().session;

    if (!currentSession) {
      set({ pendingPremiumActivation: nextValue });
      return;
    }

    if (currentSession.user.isPremium === nextValue) {
      set({ pendingPremiumActivation: false });
      return;
    }

    const updatedProfile = await updatePremiumStatus({ isPremium: nextValue });

    if (!nextValue) {
      cancelFreeTrialEndingReminder().catch(() => undefined);
    }

    await saveCachedAuthUser(updatedProfile);

    set({
      pendingPremiumActivation: false,
      session: {
        ...currentSession,
        user: {
          ...updatedProfile,
        },
      },
      initialProfileName: updatedProfile.name,
      ...(canAccessBiometricLock(updatedProfile)
        ? {}
        : {
            isBiometricAppLocked: false,
            isBiometricAuthenticating: false,
            biometricLockFailureReason: null,
            biometricLockFailureMessage: null,
          }),
    });
  },
  setSessionUserProfile: nextProfile => {
    const currentSession = get().session;

    if (!currentSession) {
      return;
    }

    saveCachedAuthUser(nextProfile).catch(() => undefined);

    set({
      session: {
        ...currentSession,
        user: nextProfile,
      },
      initialProfileName: nextProfile.name,
      pendingPremiumActivation: false,
      ...(canAccessBiometricLock(nextProfile)
        ? {}
        : {
            isBiometricAppLocked: false,
            isBiometricAuthenticating: false,
            biometricLockFailureReason: null,
            biometricLockFailureMessage: null,
          }),
    });
  },
}));

export const resetAppStore = () => {
  useAppStore.setState(createInitialSnapshot());
};
