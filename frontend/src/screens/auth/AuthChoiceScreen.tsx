import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "../../infrastructure/reactNative";
import { Loader2, Mail } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWindowDimensions } from "react-native";
import PrimaryButton from "../../components/PrimaryButton";
import AuthHero from "../../components/AuthHero";
import { useTheme } from "../../theme/provider";
import { Path, Svg } from "react-native-svg";

type AuthChoiceScreenProps = {
  onContinueWithEmail: () => Promise<void>;
  onContinueWithGoogle: () => Promise<void>;
  onGoToSignIn: () => void;
};

export default function AuthChoiceScreen({
  onContinueWithEmail,
  onContinueWithGoogle,
  onGoToSignIn,
}: AuthChoiceScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 24;
  const sheetMaxWidth = isWide ? 460 : 420;

  const handleEmailPress = async () => {
    setIsEmailLoading(true);
    setError(null);

    try {
      await onContinueWithEmail();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to continue with email right now."
      );
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleGooglePress = async () => {
    setIsGoogleLoading(true);
    setError(null);

    try {
      await onContinueWithGoogle();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to continue with Google right now."
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.sheet, { maxWidth: sheetMaxWidth }]}>
            <AuthHero
              title="Journal.IO"
              subtitle="Your personal journaling companion."
            />

            <View style={styles.form}>
              <PrimaryButton
                label={isEmailLoading ? "Loading..." : "Continue with Email"}
                onPress={handleEmailPress}
                loading={isEmailLoading}
                disabled={isEmailLoading || isGoogleLoading}
                icon={
                  isEmailLoading ? (
                    <Loader2 color="#FFFFFF" size={16} />
                  ) : (
                    <Mail color="#FFFFFF" size={16} strokeWidth={2} />
                  )
                }
                tone="accent"
              />

              <View style={styles.linkRow}>
                <Text style={[styles.linkText, { color: theme.colors.mutedForeground }]}>
                  Already have an account?
                </Text>
                <Pressable onPress={onGoToSignIn} style={styles.linkButton}>
                  <Text style={[styles.linkText, { color: theme.colors.primary }]}>
                    Sign in
                  </Text>
                </Pressable>
              </View>

              <View style={styles.divider}>
                <View style={[styles.rule, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.dividerText, { color: theme.colors.mutedForeground }]}>
                  or
                </Text>
                <View style={[styles.rule, { backgroundColor: theme.colors.border }]} />
              </View>

              <PrimaryButton
                label={isGoogleLoading ? "Connecting..." : "Continue with Google"}
                onPress={handleGooglePress}
                loading={isGoogleLoading}
                disabled={isEmailLoading || isGoogleLoading}
                variant="outline"
                icon={<GoogleMark />}
              />

              {error ? (
                <Text style={[styles.error, { color: theme.colors.destructive }]}>
                  {error}
                </Text>
              ) : null}

              <View style={[styles.infoCard, { backgroundColor: theme.colors.accent }]}>
                <Text style={[styles.infoText, { color: theme.colors.mutedForeground }]}>
                  Private, calm, and designed to stay out of your way.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function GoogleMark() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
        fill="#EA4335"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingVertical: 24,
    flexGrow: 1,
    justifyContent: "center",
  },
  sheet: {
    width: "100%",
    alignSelf: "center",
  },
  form: {
    width: "100%",
    marginTop: 20,
    gap: 16,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rule: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "600",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  linkButton: {
    paddingVertical: 2,
  },
  linkText: {
    fontSize: 14,
  },
  error: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  infoCard: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
