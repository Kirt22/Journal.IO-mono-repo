import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { useAppStore } from "../store/appStore";
import { useTheme } from "../theme/provider";

export default function InAppBrowserModal() {
  const theme = useTheme();
  const legalBrowserUrl = useAppStore(state => state.legalBrowserUrl);
  const legalBrowserTitle = useAppStore(state => state.legalBrowserTitle);
  const closeLegalBrowser = useAppStore(state => state.closeLegalBrowser);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!legalBrowserUrl) {
      setIsLoading(false);
      setErrorMessage(null);
      setReloadKey(0);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
  }, [legalBrowserUrl]);

  if (!legalBrowserUrl) {
    return null;
  }

  const handleClose = () => {
    closeLegalBrowser();
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setIsLoading(true);
    setReloadKey(previous => previous + 1);
  };

  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      style={[styles.root, { backgroundColor: theme.colors.background }]}
    >
      <View
        style={[
          styles.header,
          {
            borderBottomColor: theme.colors.border,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <Pressable
          accessibilityLabel="Close browser"
          accessibilityRole="button"
          onPress={handleClose}
          style={({ pressed }) => [
            styles.closeButton,
            {
              backgroundColor: theme.colors.secondary,
              borderColor: theme.colors.border,
            },
            pressed && styles.pressed,
          ]}
        >
          <X size={18} color={theme.colors.foreground} />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text
            numberOfLines={1}
            style={[styles.headerTitle, { color: theme.colors.foreground }]}
          >
            {legalBrowserTitle || "Journal.IO"}
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.browserShell}>
        <WebView
          key={`${legalBrowserUrl}-${reloadKey}`}
          originWhitelist={["http://*", "https://*"]}
          source={{ uri: legalBrowserUrl }}
          onError={event => {
            setIsLoading(false);
            setErrorMessage(
              event.nativeEvent.description || "Unable to load this page."
            );
          }}
          onLoadEnd={() => {
            setIsLoading(false);
          }}
          onLoadStart={() => {
            setErrorMessage(null);
            setIsLoading(true);
          }}
          onShouldStartLoadWithRequest={request => {
            if (
              request.url === "about:blank" ||
              /^https?:\/\//i.test(request.url)
            ) {
              return true;
            }

            Linking.openURL(request.url).catch(() => undefined);
            return false;
          }}
          style={styles.webView}
        />

        {isLoading ? (
          <View
            style={[
              styles.loadingOverlay,
              { backgroundColor: theme.colors.background },
            ]}
          >
            <ActivityIndicator color={theme.colors.primary} />
            <Text
              style={[
                styles.loadingText,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Loading secure page
            </Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View
            style={[
              styles.errorOverlay,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.errorTitle, { color: theme.colors.foreground }]}>
              Unable to open this page
            </Text>
            <Text
              style={[
                styles.errorText,
                { color: theme.colors.mutedForeground },
              ]}
            >
              {errorMessage}
            </Text>
            <View style={styles.errorActions}>
              <Pressable
                accessibilityRole="button"
                onPress={handleRetry}
                style={({ pressed }) => [
                  styles.retryButton,
                  {
                    backgroundColor: theme.colors.primary,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.retryButtonText,
                    { color: theme.colors.primaryForeground },
                  ]}
                >
                  Retry
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleClose}
                style={({ pressed }) => [
                  styles.dismissButton,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.secondary,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.dismissButtonText,
                    { color: theme.colors.foreground },
                  ]}
                >
                  Close
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 15,
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 36,
  },
  browserShell: {
    flex: 1,
    position: "relative",
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
    borderTopWidth: 1,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  errorActions: {
    flexDirection: "row",
    gap: 10,
  },
  retryButton: {
    minWidth: 96,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  dismissButton: {
    minWidth: 96,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
});
