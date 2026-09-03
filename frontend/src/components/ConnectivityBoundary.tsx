import { useEffect, useRef, type ReactNode } from 'react';
import {
  AppState,
  StyleSheet,
  View,
} from 'react-native';
import ConnectivitySplash from './ConnectivitySplash';
import { useConnectivity } from '../hooks/useConnectivity';
import {
  getConnectivitySnapshot,
  runConnectivityProbe,
} from '../services/connectivityService';
import { useAppStore } from '../store/appStore';
import { getBackendReadinessUrl } from '../utils/apiClient';
import type { FlowStage } from '../navigation/appFlow';

const OFFLINE_POLL_INTERVAL_MS = 3000;
const ONLINE_POLL_INTERVAL_MS = 15000;

const isAuthenticatedAppStage = (stage: FlowStage) =>
  stage === 'main-app' ||
  stage === 'new-entry' ||
  stage === 'journal-detail' ||
  stage === 'journal-edit' ||
  // Must match `isAuthenticatedAppStage` in appStore.ts and
  // `isWidgetReadyAppStage` in App.tsx. Omitting 'ask-jade' here put the
  // full-screen gate over a signed-in user who lost connection on Ask Jade,
  // which is the banner's job, and left the screen's own offline copy
  // unreachable in exactly the case it was written for.
  stage === 'ask-jade';

function ConnectivityMonitor() {
  useEffect(() => {
    if (typeof jest !== 'undefined') {
      return;
    }

    let isActive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

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

    // Scheduling stays here; the in-flight dedupe lives in the service so the
    // splash's retry button shares it instead of racing this loop.
    const runProbe = async () => {
      clearProbeTimer();

      try {
        return await runConnectivityProbe(getBackendReadinessUrl());
      } finally {
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
    return <ConnectivitySplash />;
  }

  const shouldCoverMountedFlow =
    (!hasBootstrappedAuthGate || !isAuthenticatedSurface) &&
    status !== 'online';

  return (
    <View style={styles.root}>
      {children}
      {shouldCoverMountedFlow ? <ConnectivitySplash overlay /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export { ConnectivityBoundary, ConnectivityMonitor };
