import { useEffect, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  View,
} from 'react-native';
import AuthInkBackdrop from './AuthInkBackdrop';
import { useConnectivity } from '../hooks/useConnectivity';
import {
  getConnectivitySnapshot,
  probeBackendReadiness,
} from '../services/connectivityService';
import { useAppStore } from '../store/appStore';
import { useTheme } from '../theme/provider';
import { getBackendReadinessUrl } from '../utils/apiClient';
import type { FlowStage } from '../navigation/appFlow';

const OFFLINE_POLL_INTERVAL_MS = 3000;
const ONLINE_POLL_INTERVAL_MS = 15000;

const isAuthenticatedAppStage = (stage: FlowStage) =>
  stage === 'main-app' ||
  stage === 'new-entry' ||
  stage === 'journal-detail' ||
  stage === 'journal-edit';

function ConnectivityMonitor() {
  useEffect(() => {
    if (typeof jest !== 'undefined') {
      return;
    }

    let isActive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let probeInFlight: Promise<boolean> | null = null;

    const clearProbeTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const scheduleNextProbe = () => {
      if (!isActive) {
        return;
      }

      clearProbeTimer();
      const delay =
        getConnectivitySnapshot().status === 'online'
          ? ONLINE_POLL_INTERVAL_MS
          : OFFLINE_POLL_INTERVAL_MS;

      timer = setTimeout(() => {
        runProbe().catch(() => undefined);
      }, delay);
    };

    const runProbe = async () => {
      if (probeInFlight) {
        return probeInFlight;
      }

      clearProbeTimer();
      probeInFlight = probeBackendReadiness(getBackendReadinessUrl());

      try {
        return await probeInFlight;
      } finally {
        probeInFlight = null;
        scheduleNextProbe();
      }
    };

    runProbe().catch(() => undefined);
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextState => {
        if (nextState === 'active') {
          runProbe().catch(() => undefined);
        }
      },
    );

    return () => {
      isActive = false;
      clearProbeTimer();
      appStateSubscription.remove();
    };
  }, []);

  return null;
}

function ConnectivityGate({ overlay = false }: { overlay?: boolean }) {
  const theme = useTheme();

  return (
    <View
      accessibilityLabel="Waiting for connection"
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      testID={overlay ? 'connectivity-overlay' : 'connectivity-gate'}
      style={[
        styles.gate,
        overlay && styles.overlay,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <AuthInkBackdrop />
      <ActivityIndicator
        color={theme.colors.primary}
        size="large"
        testID="connectivity-loader"
      />
    </View>
  );
}

function ConnectivityBoundary({ children }: { children: ReactNode }) {
  const { status } = useConnectivity();
  const stage = useAppStore(state => state.stage);
  const hasBootstrappedAuthGate = useAppStore(
    state => state.hasBootstrappedAuthGate,
  );
  const hasAuthenticatedSession = useAppStore(
    state =>
      Boolean(state.session) && state.sessionValidationState !== 'none',
  );
  const hasMountedNavigatorRef = useRef(false);
  const isAuthenticatedSurface =
    hasAuthenticatedSession && isAuthenticatedAppStage(stage);
  const canMountNavigator =
    hasBootstrappedAuthGate &&
    (isAuthenticatedSurface || status === 'online');

  if (canMountNavigator) {
    hasMountedNavigatorRef.current = true;
  }

  if (!hasMountedNavigatorRef.current) {
    return <ConnectivityGate />;
  }

  const shouldCoverMountedFlow =
    (!hasBootstrappedAuthGate || !isAuthenticatedSurface) &&
    status !== 'online';

  return (
    <View style={styles.root}>
      {children}
      {shouldCoverMountedFlow ? <ConnectivityGate overlay /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gate: {
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
  root: {
    flex: 1,
  },
});

export { ConnectivityBoundary, ConnectivityMonitor };
