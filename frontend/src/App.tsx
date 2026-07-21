import { useEffect, useRef } from "react";
import { AppState, Linking, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNavigator from "./navigation/AppNavigator";
import BiometricLockOverlay from "./components/BiometricLockOverlay";
import {
  ConnectivityBoundary,
  ConnectivityMonitor,
} from "./components/ConnectivityBoundary";
import HapticInteractionLayer from "./components/HapticInteractionLayer";
import {
  addRevenueCatCustomerInfoUpdateListener,
  refreshRevenueCatEntitlementState,
  syncRevenueCatIdentity,
} from "./services/revenueCatService";
import { syncPaywallEntitlement } from "./services/paywallService";
import { ThemeProvider, useTheme } from "./theme/provider";
import { useAppStore } from "./store/appStore";
import { useConnectivity } from "./hooks/useConnectivity";

function AppBootstrapper() {
  const bootstrapAuthGate = useAppStore(state => state.bootstrapAuthGate);
  const revalidateCachedSession = useAppStore(
    state => state.revalidateCachedSession,
  );
  const session = useAppStore(state => state.session);
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
      <HapticInteractionLayer>
        <ConnectivityBoundary>
          <AppNavigator />
          <BiometricLockOverlay />
        </ConnectivityBoundary>
      </HapticInteractionLayer>
    </View>
  );
}

const appStyles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
});
