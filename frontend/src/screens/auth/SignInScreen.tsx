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
import { ArrowLeft, Eye, EyeOff, Loader2, Mail } from "lucide-react-native";
import { Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWindowDimensions } from "react-native";
import PrimaryButton from "../../components/PrimaryButton";
import AuthHero from "../../components/AuthHero";
import { useTheme } from "../../theme/provider";

type SignInScreenProps = {
  onSubmit: (payload: { email: string; password: string }) => Promise<void>;
  onBackToAuth: () => void;
  onGoToCreateAccount: () => void;
};

const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function SignInScreen({
  onSubmit,
  onBackToAuth,
  onGoToCreateAccount,
}: SignInScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 24;
  const sheetMaxWidth = isWide ? 460 : 420;

  const validateForm = () => {
    const nextErrors: typeof errors = {};

    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!validateEmail(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        email: email.trim(),
        password,
      });
    } catch (submissionError) {
      setErrors({
        password:
          submissionError instanceof Error
            ? submissionError.message
            : "Unable to sign in right now.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      "Forgot password",
      "Password recovery will be added in a later slice."
    );
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
            <Pressable onPress={onBackToAuth} style={styles.backLink}>
              <ArrowLeft color={theme.colors.mutedForeground} size={18} />
              <Text style={[styles.backText, { color: theme.colors.mutedForeground }]}>
                Back
              </Text>
            </Pressable>

            <AuthHero
              title="Welcome back"
              subtitle="Sign in to continue your journaling journey."
            />

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.colors.foreground }]}>
                  Email address
                </Text>
                <TextInput
                  value={email}
                  onChangeText={(value: string) => {
                    setEmail(value);
                    if (errors.email) {
                      setErrors(previous => ({ ...previous, email: undefined }));
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
                      borderColor: errors.email ? theme.colors.destructive : theme.colors.border,
                      backgroundColor: theme.colors.inputBackground,
                      color: theme.colors.foreground,
                    },
                  ]}
                />
                {errors.email ? (
                  <Text style={[styles.error, { color: theme.colors.destructive }]}>
                    {errors.email}
                  </Text>
                ) : null}
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.colors.foreground }]}>
                  Password
                </Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    value={password}
                    onChangeText={(value: string) => {
                      setPassword(value);
                      if (errors.password) {
                        setErrors(previous => ({ ...previous, password: undefined }));
                      }
                    }}
                    placeholder="Enter your password"
                    placeholderTextColor={theme.colors.mutedForeground}
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    autoComplete="password"
                    editable={!isSubmitting}
                    style={[
                      styles.input,
                      styles.passwordInput,
                      {
                        borderColor: errors.password ? theme.colors.destructive : theme.colors.border,
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
                {errors.password ? (
                  <Text style={[styles.error, { color: theme.colors.destructive }]}>
                    {errors.password}
                  </Text>
                ) : null}
                <Pressable onPress={handleForgotPassword} style={styles.forgotLinkRow}>
                  <Text style={[styles.linkText, { color: theme.colors.primary }]}>
                    Forgot password?
                  </Text>
                </Pressable>
              </View>

              <PrimaryButton
                label={isSubmitting ? "Signing in..." : "Sign In"}
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

              <View style={styles.footerRow}>
                <Text style={[styles.footerText, { color: theme.colors.mutedForeground }]}>
                  Need an account?
                </Text>
                <Pressable onPress={onGoToCreateAccount} style={styles.linkButton}>
                  <Text style={[styles.linkText, { color: theme.colors.primary }]}>
                    Create one
                  </Text>
                </Pressable>
              </View>
            </View>
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
    paddingTop: 16,
    paddingBottom: 24,
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
    fontSize: 16,
  },
  passwordRow: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 48,
  },
  visibilityButton: {
    position: "absolute",
    right: 14,
    height: 52,
    justifyContent: "center",
  },
  error: {
    fontSize: 12,
    lineHeight: 18,
  },
  forgotLinkRow: {
    alignSelf: "flex-end",
    marginTop: 6,
    paddingVertical: 2,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  footerText: {
    fontSize: 13,
  },
  linkButton: {
    paddingVertical: 2,
  },
  linkText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
