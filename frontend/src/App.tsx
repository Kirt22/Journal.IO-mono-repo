import { useEffect } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNavigator from "./navigation/AppNavigator";
import {
  addRevenueCatCustomerInfoUpdateListener,
  hasPremiumAccess,
  refreshRevenueCatEntitlementState,
  syncRevenueCatIdentity,
} from "./services/revenueCatService";
import { ThemeProvider } from "./theme/provider";
import { useAppStore } from "./store/appStore";

function AppBootstrapper() {
  const bootstrapAuthGate = useAppStore(state => state.bootstrapAuthGate);
  const session = useAppStore(state => state.session);
  const openLegalBrowser = useAppStore(state => state.openLegalBrowser);
  const setSessionPremiumStatus = useAppStore(
    state => state.setSessionPremiumStatus
  );

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
    const sessionPremiumStatus = Boolean(session?.user.isPremium);
    let isMounted = true;
    let removeCustomerInfoListener: (() => void) | null = null;

    const syncPremiumFromCustomerInfo = async (
      nextPremiumStatus: boolean | null
    ) => {
      if (!isMounted || !appUserId) {
        return;
      }

      if (nextPremiumStatus === null || nextPremiumStatus === sessionPremiumStatus) {
        return;
      }

      await setSessionPremiumStatus(nextPremiumStatus);
    };

    const setupRevenueCat = async () => {
      const configured = await syncRevenueCatIdentity(appUserId);

      if (!configured || !isMounted || !appUserId) {
        return;
      }

      const entitlementState = await refreshRevenueCatEntitlementState(appUserId);
      await syncPremiumFromCustomerInfo(entitlementState.hasPremiumAccess);

      removeCustomerInfoListener = addRevenueCatCustomerInfoUpdateListener(
        nextCustomerInfo => {
          syncPremiumFromCustomerInfo(hasPremiumAccess(nextCustomerInfo)).catch(
            () => undefined
          );
        }
      );
    };

    setupRevenueCat().catch(() => undefined);

    return () => {
      isMounted = false;
      removeCustomerInfoListener?.();
    };
  }, [session?.user.userId, session?.user.isPremium, setSessionPremiumStatus]);

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
  },
});
