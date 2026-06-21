import { useEffect, useRef } from "react";
import { AppState, Linking, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNavigator from "./navigation/AppNavigator";
import {
  addRevenueCatCustomerInfoUpdateListener,
  refreshRevenueCatEntitlementState,
  syncRevenueCatIdentity,
} from "./services/revenueCatService";
import { syncPaywallEntitlement } from "./services/paywallService";
import { ThemeProvider } from "./theme/provider";
import { useAppStore } from "./store/appStore";

function AppBootstrapper() {
  const bootstrapAuthGate = useAppStore(state => state.bootstrapAuthGate);
  const session = useAppStore(state => state.session);
  const openLegalBrowser = useAppStore(state => state.openLegalBrowser);
  const setSessionUserProfile = useAppStore(state => state.setSessionUserProfile);
  const entitlementSyncInFlightRef = useRef(false);

  useEffect(() => {
    bootstrapAuthGate().catch(() => undefined);
  }, [bootstrapAuthGate]);

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
        <View style={appStyles.appRoot}>
          <AppBootstrapper />
          <AppNavigator />
        </View>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

export default App;

const appStyles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: "#FDFCFB",
  },
});
