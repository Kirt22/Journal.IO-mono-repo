import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "../../infrastructure/reactNative";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Animated, Easing, Linking, useWindowDimensions } from "react-native";
import AuthHero from "../../components/AuthHero";
import PrimaryButton from "../../components/PrimaryButton";
import { useTheme } from "../../theme/provider";
import { getAuthLayoutMetrics } from "./authLayout";
import type { PasswordResetChallenge } from "../../services/authService";

type ForgotPasswordScreenProps = {
  onSubmit: (payload: { email: string }) => Promise<PasswordResetChallenge>;
  onBackToSignIn: () => void;
};

const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function ForgotPasswordScreen({
  onSubmit,
  onBackToSignIn,
}: ForgotPasswordScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [localResetLink, setLocalResetLink] = useState<string | null>(null);
  const [localResetFailed, setLocalResetFailed] = useState(false);
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successOffset = useRef(new Animated.Value(20)).current;
  const {
    contentPaddingBottom,
    contentPaddingTop,
    heroImageSize,
    heroSubtitleMaxWidth,
    heroTitleSize,
    horizontalPadding,
    isVeryCompact,
    sheetMaxWidth,
  } = getAuthLayoutMetrics(width);

  useEffect(() => {
    if (!submittedEmail) {
      successOpacity.setValue(0);
      successOffset.setValue(20);
      return;
    }

    Animated.parallel([
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(successOffset, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [submittedEmail, successOffset, successOpacity]);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }

    if (!validateEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await onSubmit({ email: normalizedEmail });
      setSubmittedEmail(normalizedEmail);
      setLocalResetLink(__DEV__ ? response.resetLink || null : null);
      setLocalResetFailed(__DEV__ ? response.resetIssued === false : false);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to send a reset link right now."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenLocalResetLink = async () => {
    if (!localResetLink) {
      return;
    }

    try {
      await Linking.openURL(localResetLink);
    } catch {
      setError("Unable to open the local reset page right now.");
    }
  };

  const isLocalResetAvailable = Boolean(localResetLink);
  const submittedTitle = localResetFailed
    ? "Email not found"
    : isLocalResetAvailable
      ? "Reset link ready"
      : "Check your email";
  const submittedSubtitle = localResetFailed
    ? "We could not find a registered account for this address."
    : isLocalResetAvailable
      ? "Open the reset page to choose a new password."
      : "Open the reset link from your inbox to choose a new password.";
  const submittedCardTitle = localResetFailed
    ? "Request failed"
    : isLocalResetAvailable
      ? "Reset link ready"
      : "Reset email sent";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: contentPaddingBottom,
              paddingHorizontal: horizontalPadding,
              paddingTop: contentPaddingTop,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.sheet, { maxWidth: sheetMaxWidth }]}>
            <Pressable onPress={onBackToSignIn} style={styles.backLink}>
              <ArrowLeft color={theme.colors.mutedForeground} size={18} />
              <Text style={[styles.backText, { color: theme.colors.mutedForeground }]}>
                Back to sign in
              </Text>
            </Pressable>

            <AuthHero
              title={submittedEmail ? submittedTitle : "Reset password"}
              subtitle={
                submittedEmail
                  ? submittedSubtitle
                  : "Enter the email connected to your Journal.IO account."
              }
              imageSize={heroImageSize}
              shellSize={heroImageSize + (isVeryCompact ? 24 : 28)}
              subtitleMaxWidth={heroSubtitleMaxWidth}
              titleSize={heroTitleSize}
            />

            {submittedEmail ? (
              <Animated.View
                style={[
                  styles.successCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                    opacity: successOpacity,
                    transform: [{ translateY: successOffset }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.successIconWrap,
                    { backgroundColor: theme.colors.accent },
                  ]}
                >
                  <CheckCircle2 color={theme.colors.primary} size={24} />
                </View>

                <View style={styles.successCopy}>
                  <Text style={[styles.successTitle, { color: theme.colors.foreground }]}>
                    {submittedCardTitle}
                  </Text>
                  <Text style={[styles.successText, { color: theme.colors.mutedForeground }]}>
                    {localResetFailed
                      ? `${submittedEmail} is not registered in this local backend. Check the email or create an account first.`
                      : isLocalResetAvailable
                        ? `We prepared a reset link for ${submittedEmail}. Open it to continue.`
                        : `If ${submittedEmail} is registered, a password reset email is on the way.`}
                  </Text>
                </View>

                <View
                  style={[
                    styles.emailPill,
                    {
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="middle"
                    style={[styles.emailPillText, { color: theme.colors.foreground }]}
                  >
                    {submittedEmail}
                  </Text>
                </View>

                {__DEV__ ? (
                  <View
                    style={[
                      styles.devNote,
                      {
                        backgroundColor: theme.colors.accent,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.devNoteTitle, { color: theme.colors.foreground }]}>
                      Local testing
                    </Text>
                    <Text style={[styles.devNoteText, { color: theme.colors.mutedForeground }]}>
                      {localResetFailed
                        ? "This local-only message is based on the backend debug response. Production still keeps password reset requests generic."
                        : isLocalResetAvailable
                        ? "Use the local reset page below. Production keeps the generic confirmation state for privacy."
                        : "This request is using the standard email flow, so no in-app local shortcut was exposed here."}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.successActions}>
                  {isLocalResetAvailable ? (
                    <PrimaryButton
                      label="Open Reset Page"
                      onPress={handleOpenLocalResetLink}
                      tone="accent"
                    />
                  ) : (
                    <PrimaryButton
                      label="Try Another Email"
                      onPress={() => {
                        setSubmittedEmail(null);
                        setLocalResetLink(null);
                        setLocalResetFailed(false);
                      }}
                      tone="accent"
                    />
                  )}
                  <PrimaryButton
                    label="Back to Sign In"
                    onPress={onBackToSignIn}
                    variant="outline"
                    tone="accent"
                  />
                </View>
              </Animated.View>
            ) : (
              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.colors.foreground }]}>
                    Email address
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={(value: string) => {
                      setEmail(value);
                      if (error) {
                        setError(null);
                      }
                    }}
                    placeholder="you@example.com"
                    placeholderTextColor={theme.colors.mutedForeground}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textContentType="emailAddress"
                    autoComplete="email"
                    editable={!isSubmitting}
                    style={[
                      styles.input,
                      {
                        borderColor: error ? theme.colors.destructive : theme.colors.border,
                        backgroundColor: theme.colors.inputBackground,
                        color: theme.colors.foreground,
                      },
                    ]}
                  />
                  {error ? (
                    <Text style={[styles.error, { color: theme.colors.destructive }]}>
                      {error}
                    </Text>
                  ) : null}
                </View>

                <PrimaryButton
                  label={isSubmitting ? "Sending reset link..." : "Send Reset Link"}
                  onPress={handleSubmit}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  icon={
                    isSubmitting ? (
                      <Loader2 color="#FFFFFF" size={16} />
                    ) : (
                      <Mail color="#FFFFFF" size={16} strokeWidth={2} />
                    )
                  }
                  tone="accent"
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    flexGrow: 1,
    justifyContent: "flex-start",
  },
  sheet: {
    width: "100%",
    alignSelf: "center",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 20,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
  },
  form: {
    width: "100%",
    gap: 18,
    marginTop: 28,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
  },
  successCard: {
    marginTop: 28,
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    gap: 16,
  },
  successIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  successCopy: {
    gap: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
  },
  successText: {
    fontSize: 15,
    lineHeight: 22,
  },
  emailPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emailPillText: {
    fontSize: 14,
    fontWeight: "600",
  },
  devNote: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  devNoteTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  devNoteText: {
    fontSize: 13,
    lineHeight: 19,
  },
  successActions: {
    gap: 10,
  },
});
