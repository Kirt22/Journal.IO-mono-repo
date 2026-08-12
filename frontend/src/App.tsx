import { useEffect, useRef } from "react";
import { AppState, Linking, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNavigator from "./navigation/AppNavigator";
import BiometricLockOverlay from "./components/BiometricLockOverlay";
import OrbHandoffOverlay from "./components/OrbHandoffOverlay";
import {
  ConnectivityBoundary,
  ConnectivityMonitor,
} from "./components/ConnectivityBoundary";
import {
  addRevenueCatCustomerInfoUpdateListener,
  refreshRevenueCatEntitlementState,
  syncRevenueCatIdentity,
} from "./services/revenueCatService";
import { syncPaywallEntitlement } from "./services/paywallService";
import { ThemeProvider, useTheme } from "./theme/provider";
import { useAppStore } from "./store/appStore";
import { useConnectivity } from "./hooks/useConnectivity";
import {
  reconcileStreakWidget,
  syncWidgetAccessState,
} from "./services/widgetService";

const isWidgetReadyAppStage = (stage: string) =>
  stage === 'main-app' ||
  stage === 'new-entry' ||
  stage === 'journal-detail' ||
  stage === 'journal-edit' ||
  stage === 'ask-jade';

function AppBootstrapper() {
  const bootstrapAuthGate = useAppStore(state => state.bootstrapAuthGate);
  const revalidateCachedSession = useAppStore(
    state => state.revalidateCachedSession,
  );
  const hasBootstrappedAuthGate = useAppStore(
    state => state.hasBootstrappedAuthGate,
  );
  const session = useAppStore(state => state.session);
  const sessionValidationState = useAppStore(
    state => state.sessionValidationState,
  );
  const hasPremiumAccess = Boolean(session?.user.isPremium);
  const stage = useAppStore(state => state.stage);
  const isPaywallOverlay = useAppStore(state => state.isPaywallOverlay);
  const isBiometricAppLocked = useAppStore(
    state => state.isBiometricAppLocked,
  );
  const pendingWidgetAction = useAppStore(
    state => state.pendingWidgetAction,
  );
  const preparePendingWidgetActionForHome = useAppStore(
    state => state.preparePendingWidgetActionForHome,
  );
  const openLegalBrowser = useAppStore(state => state.openLegalBrowser);
  const setSessionUserProfile = useAppStore(state => state.setSessionUserProfile);
  const entitlementSyncInFlightRef = useRef(false);
  const bootstrapInFlightRef = useRef<Promise<void> | null>(null);
  const revalidationInFlightRef = useRef<Promise<void> | null>(null);
  const { reconnectVersion, status: connectivityStatus } = useConnectivity();

  useEffect(() => {
    let isActive = true;

    const runBootstrap = () => {
      if (!bootstrapInFlightRef.current) {
        bootstrapInFlightRef.current = bootstrapAuthGate().finally(() => {
          bootstrapInFlightRef.current = null;
        });
      }

      return bootstrapInFlightRef.current;
    };

    const reconcileAuth = async () => {
      await runBootstrap();

      if (!isActive || connectivityStatus !== 'online') {
        return;
      }

      if (!useAppStore.getState().hasBootstrappedAuthGate) {
        await runBootstrap();
      }

      if (
        isActive &&
        useAppStore.getState().sessionValidationState === 'cached'
      ) {
        if (!revalidationInFlightRef.current) {
          revalidationInFlightRef.current = revalidateCachedSession().finally(
            () => {
              revalidationInFlightRef.current = null;
            },
          );
        }

        await revalidationInFlightRef.current;
      }
    };

    reconcileAuth().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [
    bootstrapAuthGate,
    connectivityStatus,
    reconnectVersion,
    revalidateCachedSession,
  ]);

  useEffect(() => {
    const originalOpenURL = Linking.openURL.bind(Linking);

    Linking.openURL = async (url: string) => {
      if (/^https?:\/\//i.test(url)) {
        openLegalBrowser({ url, title: null });
        return;
      }

      await originalOpenURL(url);
    };

    return () => {
      Linking.openURL = originalOpenURL;
    };
  }, [openLegalBrowser]);

  useEffect(() => {
    if (hasBootstrappedAuthGate && !session?.user.userId) {
      syncRevenueCatIdentity(null).catch(() => undefined);
    }
  }, [hasBootstrappedAuthGate, session?.user.userId]);

  useEffect(() => {
    const appUserId = session?.user.userId ?? null;
    let isMounted = true;
    let removeCustomerInfoListener: (() => void) | null = null;
    let appStateSubscription: { remove: () => void } | null = null;

    const reconcilePremiumState = async (reason: string) => {
      if (!isMounted || !appUserId || entitlementSyncInFlightRef.current) {
        return;
      }

      entitlementSyncInFlightRef.current = true;

      try {
        const configured = await syncRevenueCatIdentity(appUserId);

        if (configured) {
          await refreshRevenueCatEntitlementState(appUserId);
        }

        const updatedProfile = await syncPaywallEntitlement({ reason });

        if (isMounted) {
          setSessionUserProfile(updatedProfile);
        }
      } catch {
        // Keep the cached premium state until verification succeeds again.
      } finally {
        entitlementSyncInFlightRef.current = false;
      }
    };

    const setupRevenueCat = async () => {
      await reconcilePremiumState("launch");

      if (!appUserId) {
        return;
      }

      removeCustomerInfoListener = addRevenueCatCustomerInfoUpdateListener(() => {
        reconcilePremiumState("listener").catch(() => undefined);
      });

      appStateSubscription = AppState.addEventListener("change", nextState => {
        if (nextState === "active") {
          reconcilePremiumState("foreground").catch(() => undefined);
        }
      });
    };

    setupRevenueCat().catch(() => undefined);

    return () => {
      isMounted = false;
      removeCustomerInfoListener?.();
      appStateSubscription?.remove();
    };
  }, [session?.user.userId, setSessionUserProfile]);

  useEffect(() => {
    const userId = session?.user.userId;

    if (
      !userId ||
      sessionValidationState !== 'verified' ||
      connectivityStatus !== 'online' ||
      !isWidgetReadyAppStage(stage)
    ) {
      return;
    }

    const reconcileWidgetSession = async () => {
      await syncWidgetAccessState({
        userId,
        hasPremiumAccess,
      });
      await reconcileStreakWidget();
    };

    reconcileWidgetSession().catch(() => undefined);

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        reconcileWidgetSession().catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [
    connectivityStatus,
    hasPremiumAccess,
    session?.user.userId,
    sessionValidationState,
    stage,
  ]);

  useEffect(() => {
    if (
      !pendingWidgetAction ||
      pendingWidgetAction.isReadyForHome ||
      !session?.user.userId ||
      !isWidgetReadyAppStage(stage) ||
      // A contextual paywall is stacked over the caller and leaves `stage` on
      // it, so this gate no longer excludes the paywall on its own. Handing off
      // now would reset the root and tear the paywall down mid-purchase; the
      // action stays queued until it closes.
      isPaywallOverlay ||
      isBiometricAppLocked
    ) {
      return;
    }

    if (
      (pendingWidgetAction.action.type === 'mood' ||
        pendingWidgetAction.action.type === 'open-mood') &&
      hasPremiumAccess &&
      connectivityStatus === 'online' &&
      sessionValidationState === 'verified'
    ) {
      syncWidgetAccessState({
        userId: session.user.userId,
        hasPremiumAccess,
      }).catch(() => undefined);
    }

    preparePendingWidgetActionForHome();
  }, [
    connectivityStatus,
    hasPremiumAccess,
    isBiometricAppLocked,
    isPaywallOverlay,
    pendingWidgetAction,
    preparePendingWidgetActionForHome,
    session?.user.userId,
    sessionValidationState,
    stage,
  ]);

  return null;
}

function App() {
  const themeModeOverride = useAppStore(state => state.themeModeOverride);

  return (
    <ThemeProvider modeOverride={themeModeOverride}>
      <SafeAreaProvider>
        <AppShell />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

export default App;

function AppShell() {
  const theme = useTheme();

  return (
    <View
      style={[
        appStyles.appRoot,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <AppBootstrapper />
      <ConnectivityMonitor />
      <ConnectivityBoundary>
        <AppNavigator />
        {/* Above the navigator so the orb survives the paywall's root reset,
            below the lock overlay so it can never sit over a locked app. */}
        <OrbHandoffOverlay />
        <BiometricLockOverlay />
      </ConnectivityBoundary>
    </View>
  );
}

const appStyles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
});
