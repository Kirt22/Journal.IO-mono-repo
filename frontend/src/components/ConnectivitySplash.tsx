import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { StyleSheet, Text, View } from '../infrastructure/reactNative';
import AuthInkBackdrop from './AuthInkBackdrop';
import JournalWordmark from './JournalWordmark';
import PrimaryButton from './PrimaryButton';
import { useConnectivity } from '../hooks/useConnectivity';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { runConnectivityProbe } from '../services/connectivityService';
import { useTheme } from '../theme/provider';
import { getBackendReadinessUrl } from '../utils/apiClient';

// The mark alone is the whole screen for the first few seconds: a cold start on
// a slow-but-working connection resolves well inside this window, and flashing
// "Waiting for connection" at someone who is about to get in reads as a failure
// that never happened. Past this point the silence stops being calm and starts
// looking frozen, so the copy and the escape hatch earn their place.
const WAITING_COPY_DELAY_MS = 5000;
const WAITING_COPY_FADE_MS = 260;

type ConnectivitySplashProps = {
  overlay?: boolean;
};

/**
 * The pre-auth connectivity surface: the brand mark on the shared auth backdrop,
 * with the waiting copy held back until the wait is genuinely long.
 *
 * The wordmark renders static on purpose. `playInkCurrentIntro` is
 * `AuthChoiceScreen`'s entrance and it only lands once — playing it here would
 * spend it on a loading screen and then replay it a beat later when the auth
 * flow mounts behind us.
 *
 * Deliberately silent: no haptic on appearance. Only the retry press speaks,
 * and that goes through `PrimaryButton` -> `HapticPressable`.
 */
export default function ConnectivitySplash({
  overlay = false,
}: ConnectivitySplashProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const { status } = useConnectivity();
  const [showsWaitingCopy, setShowsWaitingCopy] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const waitingCopyEntrance = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // A brief reconnect must retract the copy, otherwise a flapping connection
  // leaves "Waiting for connection" on screen while we are demonstrably online.
  useEffect(() => {
    if (status === 'online') {
      setShowsWaitingCopy(false);
      waitingCopyEntrance.setValue(0);
      return;
    }

    const timer = setTimeout(
      () => setShowsWaitingCopy(true),
      WAITING_COPY_DELAY_MS,
    );

    return () => clearTimeout(timer);
  }, [status, waitingCopyEntrance]);

  useEffect(() => {
    if (!showsWaitingCopy) {
      return;
    }

    if (reduceMotion) {
      waitingCopyEntrance.setValue(1);
      return;
    }

    const entrance = Animated.timing(waitingCopyEntrance, {
      duration: WAITING_COPY_FADE_MS,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    });

    entrance.start();

    return () => entrance.stop();
  }, [reduceMotion, showsWaitingCopy, waitingCopyEntrance]);

  const handleRetry = useCallback(() => {
    setIsProbing(true);

    runConnectivityProbe(getBackendReadinessUrl())
      .catch(() => undefined)
      .finally(() => {
        if (isMountedRef.current) {
          setIsProbing(false);
        }
      });
  }, []);

  const waitingCopyStyle = {
    opacity: waitingCopyEntrance,
    transform: [
      {
        translateY: waitingCopyEntrance.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
        }),
      },
    ],
  } as const;

  return (
    <View
      testID={overlay ? 'connectivity-overlay' : 'connectivity-gate'}
      style={[
        styles.splash,
        overlay && styles.overlay,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <AuthInkBackdrop />
      {/* Compact matches the 160x44 wordmark in the iOS launch storyboard, so the
          native launch image hands off to this screen without the mark jumping. */}
      <JournalWordmark accessibilityLabel="Journal.IO" size="compact" />
      {showsWaitingCopy ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          testID="connectivity-waiting-copy"
          style={[styles.waiting, waitingCopyStyle]}
        >
          <Text style={[styles.waitingLabel, { color: theme.colors.mutedForeground }]}>
            Waiting for connection
          </Text>
          <PrimaryButton
            hapticEvent="secondaryAction"
            label="Retry"
            loading={isProbing}
            onPress={handleRetry}
            size="sm"
            variant="ghost"
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    elevation: 100,
    zIndex: 100,
  },
  waiting: {
    alignItems: 'center',
    gap: 4,
    marginTop: 20,
    zIndex: 2,
  },
  waitingLabel: {
    fontSize: 14,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
