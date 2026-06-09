import { useState } from "react";
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
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWindowDimensions } from "react-native";
import AuthHero from "../../components/AuthHero";
import PrimaryButton from "../../components/PrimaryButton";
import { useTheme } from "../../theme/provider";
import { getAuthLayoutMetrics } from "./authLayout";

type ResetPasswordScreenProps = {
  token: string;
  onSubmit: (payload: { token: string; password: string }) => Promise<void>;
  onBackToSignIn: () => void;
};

export default function ResetPasswordScreen({
  token,
  onSubmit,
  onBackToSignIn,
}: ResetPasswordScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
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

  const hasToken = Boolean(token.trim());

  const validateForm = () => {
    if (!hasToken) {
      setError("This reset link is missing a token. Please request a new one.");
      return false;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return false;
    }

    if (password !== confirmPassword) {
      setError("Passwords must match.");
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        token: token.trim(),
        password,
      });
      setIsComplete(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to reset your password right now."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPasswordInput = (
    value: string,
    onChangeText: (value: string) => void,
    placeholder: string,
    textContentType: "newPassword" | "password"
  ) => (
    <View style={styles.passwordRow}>
      <TextInput
        value={value}
        onChangeText={(nextValue: string) => {
          onChangeText(nextValue);
          if (error) {
            setError(null);
          }
        }}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.mutedForeground}
        secureTextEntry={!showPassword}
        textContentType={textContentType}
        autoComplete="password-new"
        editable={!isSubmitting && hasToken}
        style={[
          styles.input,
          styles.passwordInput,
          {
            borderColor: error ? theme.colors.destructive : theme.colors.border,
            backgroundColor: theme.colors.inputBackground,
            color: theme.colors.foreground,
          },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => setShowPassword(previous => !previous)}
        style={styles.visibilityButton}
      >
        {showPassword ? (
          <EyeOff color={theme.colors.mutedForeground} size={18} />
        ) : (
          <Eye color={theme.colors.mutedForeground} size={18} />
        )}
      </Pressable>
    </View>
  );

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
              title={isComplete ? "Password reset" : "Choose a new password"}
              subtitle={
                isComplete
                  ? "You can now sign in with your new password."
                  : "Use a password you do not use anywhere else."
              }
              imageSize={heroImageSize}
              shellSize={heroImageSize + (isVeryCompact ? 24 : 28)}
              subtitleMaxWidth={heroSubtitleMaxWidth}
              titleSize={heroTitleSize}
            />

            {isComplete ? (
              <View
                style={[
                  styles.successCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <CheckCircle2 color={theme.colors.primary} size={26} />
                <Text style={[styles.successTitle, { color: theme.colors.foreground }]}>
                  Your password is updated
                </Text>
                <Text style={[styles.successText, { color: theme.colors.mutedForeground }]}>
                  Sign in again to continue journaling.
                </Text>
                <PrimaryButton
                  label="Go to Sign In"
                  onPress={onBackToSignIn}
                  tone="accent"
                />
              </View>
            ) : (
              <View style={styles.form}>
                {!hasToken ? (
                  <View
                    style={[
                      styles.noticeCard,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.noticeText, { color: theme.colors.mutedForeground }]}>
                      This reset link is incomplete. Request a new link from the sign-in screen.
                    </Text>
                  </View>
                ) : null}

                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.colors.foreground }]}>
                    New password
                  </Text>
                  {renderPasswordInput(
                    password,
                    setPassword,
                    "Enter a new password",
                    "newPassword"
                  )}
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.colors.foreground }]}>
                    Confirm password
                  </Text>
                  {renderPasswordInput(
                    confirmPassword,
                    setConfirmPassword,
                    "Re-enter your password",
                    "password"
                  )}
                </View>

                {error ? (
                  <Text style={[styles.error, { color: theme.colors.destructive }]}>
                    {error}
                  </Text>
                ) : null}

                <PrimaryButton
                  label={isSubmitting ? "Resetting..." : "Reset Password"}
                  onPress={handleSubmit}
                  loading={isSubmitting}
                  disabled={isSubmitting || !hasToken}
                  icon={
                    isSubmitting ? (
                      <Loader2 color="#FFFFFF" size={16} />
                    ) : (
                      <KeyRound color="#FFFFFF" size={16} strokeWidth={2} />
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
    gap: 16,
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
  passwordRow: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 44,
  },
  visibilityButton: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  successCard: {
    marginTop: 28,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    alignItems: "center",
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  successText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 6,
  },
});
