import { CloudOff } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';
import { Text } from '../infrastructure/reactNative';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectivity } from '../hooks/useConnectivity';
import { triggerHaptic } from '../services/hapticsService';
import { useTheme } from '../theme/provider';

// How far up the pill has to travel (or how fast it has to be flicked) before
// the release counts as a dismissal rather than a stray drag.
const DISMISS_DISTANCE = 26;
const DISMISS_VELOCITY = 0.6;
const EXIT_OFFSET = -140;
// The pill retires itself shortly after landing; the swipe is the escape hatch
// for anyone who wants it gone sooner.
const AUTO_DISMISS_MS = 2000;

export default function OfflineBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { status } = useConnectivity();
  const [dismissed, setDismissed] = useState(false);
  const dragY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOffline = status === 'offline';

  const cancelAutoDismiss = useCallback(() => {
    if (autoDismissTimer.current === null) {
      return;
    }

    clearTimeout(autoDismissTimer.current);
    autoDismissTimer.current = null;
  }, []);

  // Dismissal only silences the current offline stretch — coming back online
  // and dropping out again shows the banner afresh.
  useEffect(() => {
    if (isOffline) {
      return;
    }

    setDismissed(false);
    dragY.setValue(0);
    opacity.setValue(1);
  }, [dragY, isOffline, opacity]);

  const hide = useCallback(() => {
    cancelAutoDismiss();
    Animated.parallel([
      Animated.timing(dragY, {
        duration: 190,
        toValue: EXIT_OFFSET,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        duration: 160,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setDismissed(true);
      }
    });
  }, [cancelAutoDismiss, dragY, opacity]);

  // Only a deliberate dismissal earns a haptic — the timeout must stay silent.
  const dismiss = useCallback(() => {
    triggerHaptic('secondaryAction').catch(() => undefined);
    hide();
  }, [hide]);

  const scheduleAutoDismiss = useCallback(() => {
    cancelAutoDismiss();
    autoDismissTimer.current = setTimeout(hide, AUTO_DISMISS_MS);
  }, [cancelAutoDismiss, hide]);

  // Countdown runs from the moment the pill appears, and is suspended while a
  // finger is on it so it never vanishes mid-drag.
  useEffect(() => {
    if (!isOffline || dismissed) {
      cancelAutoDismiss();
      return;
    }

    scheduleAutoDismiss();

    return cancelAutoDismiss;
  }, [cancelAutoDismiss, dismissed, isOffline, scheduleAutoDismiss]);

  const settleBack = useCallback(() => {
    Animated.spring(dragY, {
      bounciness: 4,
      speed: 14,
      toValue: 0,
      useNativeDriver: true,
    }).start();
    scheduleAutoDismiss();
  }, [dragY, scheduleAutoDismiss]);

  const panResponder = useRef(
    PanResponder.create({
      // Claiming the touch on start (not just on move) is what lets a resting
      // finger hold the countdown open and restart it on release.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy < -3 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2,
      onPanResponderGrant: () => {
        cancelAutoDismiss();
      },
      onPanResponderMove: (_, gestureState) => {
        // Downward drag is ignored: the pill is already at rest against the top.
        dragY.setValue(Math.min(0, gestureState.dy));
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -DISMISS_DISTANCE || gestureState.vy < -DISMISS_VELOCITY) {
          dismiss();
          return;
        }

        settleBack();
      },
      onPanResponderTerminate: () => {
        settleBack();
      },
    }),
  ).current;

  if (!isOffline || dismissed) {
    return null;
  }

  return (
    <Animated.View
      accessibilityActions={[{ label: 'Dismiss', name: 'dismiss' }]}
      accessibilityHint="Swipe up to dismiss"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'dismiss') {
          dismiss();
        }
      }}
      testID="offline-banner"
      {...panResponder.panHandlers}
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          opacity,
          top: insets.top + 6,
          transform: [{ translateY: dragY }],
        },
      ]}
    >
      <CloudOff color={theme.colors.primary} size={15} strokeWidth={2.2} />
      <Text style={[styles.label, { color: theme.colors.foreground }]}>
        Offline - reconnect to save changes
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    elevation: 5,
    flexDirection: 'row',
    gap: 7,
    left: 20,
    maxWidth: 360,
    paddingHorizontal: 13,
    paddingVertical: 8,
    position: 'absolute',
    right: 20,
    shadowColor: '#000000',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    zIndex: 80,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
