import HapticPressable from './HapticPressable';
import {
  useEffect,
  useRef,
  useState } from 'react';
import {
  AppState,
  Image,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import { Lock } from 'lucide-react-native';
import PrimaryButton from './PrimaryButton';
import JournalLoader from './JournalLoader';
import { useTheme } from '../theme/provider';
import { useAppStore } from '../store/appStore';
import {
  canAccessBiometricLock,
  getBiometricMethodName,
} from '../services/biometricLockService';

const isForegroundState = (value: string) => value === 'active';
const isBackgroundState = (value: string) =>
  value === 'inactive' || value === 'background';
export const BIOMETRIC_REAUTH_GRACE_MS = 60_000;

const faceIdIcon = require('../assets/png/settings/icons8-face-id-100.png');

export default function BiometricLockOverlay() {
  const theme = useTheme();
  const hasBootstrappedAuthGate = useAppStore(
    state => state.hasBootstrappedAuthGate,
  );
  const sessionUser = useAppStore(state => state.session?.user ?? null);
  const biometricLockEnabled = useAppStore(state => state.biometricLockEnabled);
  const biometricLockType = useAppStore(state => state.biometricLockType);
  const isBiometricAppLocked = useAppStore(state => state.isBiometricAppLocked);
  const isBiometricAuthenticating = useAppStore(
    state => state.isBiometricAuthenticating,
  );
  const biometricLockFailureReason = useAppStore(
    state => state.biometricLockFailureReason,
  );
  const biometricLockFailureMessage = useAppStore(
    state => state.biometricLockFailureMessage,
  );
  const clearBiometricAppLockError = useAppStore(
    state => state.clearBiometricAppLockError,
  );
  const lockAppWithBiometrics = useAppStore(state => state.lockAppWithBiometrics);
  const signOut = useAppStore(state => state.signOut);
  const unlockAppWithBiometrics = useAppStore(
    state => state.unlockAppWithBiometrics,
  );
  const currentAppStateRef = useRef(AppState.currentState ?? 'active');
  const hasPromptedDuringCurrentActiveStateRef = useRef(false);
  const backgroundedAtRef = useRef<number | null>(null);
  const wasLockedBeforeBackgroundRef = useRef(false);
  const isSystemPromptTransitionRef = useRef(false);
  const [isPrivacyCoverVisible, setIsPrivacyCoverVisible] = useState(false);
  const shouldEnforceLock =
    Platform.OS === 'ios' &&
    hasBootstrappedAuthGate &&
    biometricLockEnabled &&
    Boolean(sessionUser) &&
    canAccessBiometricLock(sessionUser);

  useEffect(() => {
    if (!shouldEnforceLock) {
      hasPromptedDuringCurrentActiveStateRef.current = false;
      backgroundedAtRef.current = null;
      wasLockedBeforeBackgroundRef.current = false;
      setIsPrivacyCoverVisible(false);
    }
  }, [shouldEnforceLock]);

  useEffect(() => {
    if (
      shouldEnforceLock &&
      isBiometricAppLocked &&
      isBiometricAuthenticating &&
      isForegroundState(currentAppStateRef.current)
    ) {
      hasPromptedDuringCurrentActiveStateRef.current = true;
      return;
    }

    if (
      !shouldEnforceLock ||
      !isBiometricAppLocked ||
      isBiometricAuthenticating ||
      !isForegroundState(currentAppStateRef.current) ||
      hasPromptedDuringCurrentActiveStateRef.current
    ) {
      return;
    }

    hasPromptedDuringCurrentActiveStateRef.current = true;
    unlockAppWithBiometrics().catch(() => undefined);
  }, [
    isBiometricAppLocked,
    isBiometricAuthenticating,
    shouldEnforceLock,
    unlockAppWithBiometrics,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const previousAppState = currentAppStateRef.current;
      currentAppStateRef.current = nextAppState;

      if (isForegroundState(previousAppState) && isBackgroundState(nextAppState)) {
        const storeState = useAppStore.getState();

        // The native biometric sheet can briefly move the app to inactive.
        // Treating that as a real absence would immediately prompt again.
        if (storeState.isBiometricAuthenticating) {
          isSystemPromptTransitionRef.current = true;
          return;
        }

        hasPromptedDuringCurrentActiveStateRef.current = false;

        if (
          storeState.biometricLockEnabled &&
          storeState.session?.user &&
          canAccessBiometricLock(storeState.session.user)
        ) {
          backgroundedAtRef.current = Date.now();
          wasLockedBeforeBackgroundRef.current =
            storeState.isBiometricAppLocked;
          setIsPrivacyCoverVisible(true);
        }

        return;
      }

      if (!isBackgroundState(previousAppState) || !isForegroundState(nextAppState)) {
        return;
      }

      if (isSystemPromptTransitionRef.current) {
        isSystemPromptTransitionRef.current = false;
        return;
      }

      const storeState = useAppStore.getState();

      if (
        !storeState.biometricLockEnabled ||
        !storeState.session?.user ||
        !canAccessBiometricLock(storeState.session.user) ||
        storeState.isBiometricAuthenticating
      ) {
        setIsPrivacyCoverVisible(false);
        backgroundedAtRef.current = null;
        wasLockedBeforeBackgroundRef.current = false;
        return;
      }

      const backgroundedAt = backgroundedAtRef.current;
      const absenceDuration = backgroundedAt
        ? Date.now() - backgroundedAt
        : BIOMETRIC_REAUTH_GRACE_MS;
      const shouldRequireAuthentication =
        wasLockedBeforeBackgroundRef.current ||
        storeState.isBiometricAppLocked ||
        absenceDuration >= BIOMETRIC_REAUTH_GRACE_MS;

      backgroundedAtRef.current = null;
      wasLockedBeforeBackgroundRef.current = false;

      if (!shouldRequireAuthentication) {
        setIsPrivacyCoverVisible(false);
        return;
      }

      if (!storeState.isBiometricAppLocked) {
        lockAppWithBiometrics();
      }

      hasPromptedDuringCurrentActiveStateRef.current = true;
      setIsPrivacyCoverVisible(true);
      useAppStore
        .getState()
        .unlockAppWithBiometrics()
        .finally(() => setIsPrivacyCoverVisible(false))
        .catch(() => undefined);
    });

    return () => {
      subscription.remove();
    };
  }, [lockAppWithBiometrics]);

  if (!shouldEnforceLock || (!isBiometricAppLocked && !isPrivacyCoverVisible)) {
    return null;
  }

  const biometricMethodName = getBiometricMethodName(biometricLockType);
  const showUnavailableState =
    biometricLockFailureReason === 'unavailable' ||
    biometricLockFailureReason === 'not_configured';
  const title = showUnavailableState
    ? `${biometricMethodName} is unavailable`
    : 'Journal.IO is locked';
  const description = showUnavailableState
    ? biometricLockFailureMessage ||
      `${biometricMethodName} is no longer available on this iPhone. Sign out to keep your entries covered until it is ready again.`
    : biometricLockFailureReason === 'cancelled'
    ? `Journal.IO will stay covered until you confirm it is you. Try ${biometricMethodName} again whenever you're ready.`
    : biometricLockFailureMessage ||
      `Unlock with ${biometricMethodName} to continue. Your iPhone may also offer your device passcode if needed.`;

  return (
    <View
      style={[
        styles.overlay,
        { backgroundColor: `${theme.colors.background}F2` },
      ]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            shadowColor: theme.colors.foreground,
          },
        ]}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: `${theme.colors.primary}18` },
          ]}
        >
          {biometricLockType === 'face_id' ? (
            <Image
              accessibilityIgnoresInvertColors
              accessibilityLabel="Face ID"
              resizeMode="contain"
              source={faceIdIcon}
              style={styles.faceIdIcon}
            />
          ) : (
            <Lock size={22} color={theme.colors.primary} />
          )}
        </View>

        <Text style={[styles.title, { color: theme.colors.foreground }]}>
          {title}
        </Text>
        <Text
          style={[styles.description, { color: theme.colors.mutedForeground }]}
        >
          {description}
        </Text>

        {isBiometricAuthenticating ? (
          <View style={styles.loadingRow}>
            <JournalLoader size="small" color={theme.colors.primary} />
            <Text
              style={[
                styles.loadingText,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Checking {biometricMethodName}...
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {showUnavailableState ? (
            <PrimaryButton
              label="Sign out"
              onPress={() => {
                signOut().catch(() => undefined);
              }}
              tone="accent"
            />
          ) : (
            <PrimaryButton
              label="Try again"
              loading={isBiometricAuthenticating}
              onPress={() => {
                clearBiometricAppLockError();
                hasPromptedDuringCurrentActiveStateRef.current = true;
                unlockAppWithBiometrics().catch(() => undefined);
              }}
              tone="accent"
            />
          )}
          {!showUnavailableState ? (
            <HapticPressable
              accessibilityRole="button"
              onPress={() => {
                clearBiometricAppLockError();
              }}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text
                style={[
                  styles.secondaryAction,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                Keep locked
              </Text>
            </HapticPressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 6,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  faceIdIcon: {
    height: 38,
    width: 38,
  },
  title: {
    fontSize: 22,
    letterSpacing: -0.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  loadingRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
  },
  actions: {
    width: '100%',
    marginTop: 24,
    gap: 12,
  },
  secondaryAction: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.78,
  },
});
