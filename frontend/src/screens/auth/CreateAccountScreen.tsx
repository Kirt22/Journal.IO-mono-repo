import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from '../../infrastructure/reactNative';
import {
  ArrowLeft,
  CheckCircle2,
  CircleQuestionMark,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import PrimaryButton from '../../components/PrimaryButton';
import AuthActionIcon from '../../components/AuthActionIcon';
import {
  AuthErrorDialog,
  AuthErrorNotice,
} from '../../components/AuthErrorFeedback';
import AuthHero from '../../components/AuthHero';
import AuthInkBackdrop from '../../components/AuthInkBackdrop';
import { useTheme } from '../../theme/provider';
import { getAuthLayoutMetrics } from './authLayout';
import {
  AUTH_VALIDATION_MESSAGES,
  getAuthErrorPresentation,
  type AuthErrorPresentation,
} from './authErrorPresentation';

type CreateAccountScreenProps = {
  onSubmit: (payload: { email: string; password: string }) => Promise<void>;
  onSuccess: () => void;
  onBackToAuth: () => void;
  onGoToSignIn: () => void;
};

const validateEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function CreateAccountScreen({
  onSubmit,
  onSuccess,
  onBackToAuth,
  onGoToSignIn,
}: CreateAccountScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessBannerVisible, setIsSuccessBannerVisible] = useState(false);
  const [isPasswordRuleOpen, setIsPasswordRuleOpen] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    form?: string;
  }>({});
  const [dialogError, setDialogError] = useState<AuthErrorPresentation | null>(
    null,
  );
  const successBannerOpacity = useRef(new Animated.Value(0)).current;
  const successBannerOffset = useRef(new Animated.Value(-24)).current;
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    contentPaddingBottom,
    contentPaddingTop,
    heroSubtitleMaxWidth,
    heroTitleSize,
    horizontalPadding,
    sheetMaxWidth,
  } = getAuthLayoutMetrics(width);
  const successExitDelayMs = 1400;
  const isPasswordRuleMet = password.length >= 8;
  const validateForm = () => {
    const nextErrors: typeof errors = {};

    if (!email.trim()) {
      nextErrors.email = AUTH_VALIDATION_MESSAGES.emailRequired;
    } else if (!validateEmail(email)) {
      nextErrors.email = AUTH_VALIDATION_MESSAGES.emailInvalid;
    }

    if (!password) {
      nextErrors.password = AUTH_VALIDATION_MESSAGES.passwordRequired;
    } else if (!isPasswordRuleMet) {
      nextErrors.password = AUTH_VALIDATION_MESSAGES.passwordTooShort;
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword =
        AUTH_VALIDATION_MESSAGES.confirmPasswordRequired;
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = AUTH_VALIDATION_MESSAGES.passwordMismatch;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const showVerificationBanner = () => {
    setIsSuccessBannerVisible(true);
    Animated.parallel([
      Animated.timing(successBannerOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(successBannerOffset, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    successTimerRef.current = setTimeout(() => {
      onSuccess();
    }, successExitDelayMs);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setDialogError(null);

    try {
      await onSubmit({
        email: email.trim(),
        password,
      });
      showVerificationBanner();
    } catch (submissionError) {
      const presentation = getAuthErrorPresentation(
        submissionError,
        'create-account',
      );

      if (!presentation) {
        return;
      } else if (presentation.surface === 'dialog') {
        setDialogError(presentation);
      } else if (presentation.field === 'email') {
        setErrors({ email: presentation.message });
      } else if (presentation.field === 'password') {
        setErrors({ password: presentation.message });
      } else {
        setErrors({ form: presentation.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const isLockedAfterSuccess = isSubmitting || isSuccessBannerVisible;
  const passwordRuleState = !password
    ? 'idle'
    : isPasswordRuleMet
    ? 'met'
    : 'unmet';
  const passwordRuleIconColor =
    passwordRuleState === 'met'
      ? theme.colors.success
      : passwordRuleState === 'unmet'
      ? theme.colors.destructive
      : theme.colors.mutedForeground;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <AuthInkBackdrop />
      <View style={styles.screen}>
        {isSuccessBannerVisible ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.successBanner,
              {
                backgroundColor: theme.colors.accent,
                borderColor: theme.colors.border,
                opacity: successBannerOpacity,
                transform: [{ translateY: successBannerOffset }],
                left: horizontalPadding,
                right: horizontalPadding,
              },
              Platform.OS === 'ios'
                ? styles.successBannerIos
                : styles.successBannerAndroid,
            ]}
          >
            <CheckCircle2 color={theme.colors.primary} size={18} />
            <View style={styles.successBannerCopy}>
              <Text
                style={[
                  styles.successBannerTitle,
                  { color: theme.colors.foreground },
                ]}
              >
                Verification code has been sent.
              </Text>
              <Text
                style={[
                  styles.successBannerText,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                Check your inbox to continue.
              </Text>
            </View>
          </Animated.View>
        ) : null}

        <View
          testID="create-account-back-row"
          style={[styles.header, { paddingHorizontal: horizontalPadding }]}
        >
          <View style={[styles.headerInner, { maxWidth: sheetMaxWidth }]}>
            <Pressable
              accessibilityLabel="Back to authentication options"
              accessibilityRole="button"
              onPress={onBackToAuth}
              style={styles.backLink}
            >
              <ArrowLeft color={theme.colors.mutedForeground} size={18} />
              <Text
                style={[
                  styles.backText,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                Back
              </Text>
            </Pressable>
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            testID="create-account-centered-scroll"
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
              <AuthHero
                title="Create your account"
                subtitle="A gentle place to start your journaling journey."
                subtitleMaxWidth={heroSubtitleMaxWidth}
                titleSize={heroTitleSize}
              />

              <View style={styles.form}>
                <AuthErrorNotice
                  message={
                    errors.email ||
                    errors.password ||
                    errors.confirmPassword ||
                    errors.form
                  }
                  testID="create-account-error-notice"
                />
                <View style={styles.field}>
                  <Text
                    style={[styles.label, { color: theme.colors.foreground }]}
                  >
                    Email address
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={(value: string) => {
                      setEmail(value);
                      if (errors.email || errors.form) {
                        setErrors(previous => ({
                          ...previous,
                          email: undefined,
                          form: undefined,
                        }));
                      }
                    }}
                    placeholder="you@example.com"
                    placeholderTextColor={theme.colors.mutedForeground}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textContentType="emailAddress"
                    autoComplete="email"
                    editable={!isLockedAfterSuccess}
                    style={[
                      styles.input,
                      {
                        borderColor: errors.email
                          ? theme.colors.destructive
                          : theme.colors.border,
                        backgroundColor: theme.colors.inputBackground,
                        color: theme.colors.foreground,
                      },
                    ]}
                  />
                </View>

                <View style={styles.field}>
                  <View style={styles.passwordSection}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Password rule toggle"
                      testID="password-rule-toggle"
                      onPress={() =>
                        setIsPasswordRuleOpen(previous => !previous)
                      }
                      style={styles.passwordTitleRow}
                    >
                      <Text
                        style={[
                          styles.label,
                          { color: theme.colors.foreground },
                        ]}
                      >
                        Password
                      </Text>
                      <View style={styles.passwordRuleIcon}>
                        <CircleQuestionMark
                          color={passwordRuleIconColor}
                          size={16}
                        />
                      </View>
                    </Pressable>
                    {isPasswordRuleOpen ? (
                      <View
                        testID="password-rule-bubble"
                        style={[
                          styles.passwordBubble,
                          {
                            backgroundColor: theme.colors.card,
                            borderColor: theme.colors.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.passwordBubbleAccent,
                            {
                              backgroundColor:
                                passwordRuleState === 'met'
                                  ? theme.colors.success
                                  : passwordRuleState === 'unmet'
                                  ? theme.colors.destructive
                                  : theme.colors.mutedForeground,
                            },
                          ]}
                        />
                        <View style={styles.passwordBubbleHeader}>
                          <CircleQuestionMark
                            color={passwordRuleIconColor}
                            size={16}
                          />
                          <Text
                            style={[
                              styles.passwordBubbleTitle,
                              { color: theme.colors.foreground },
                            ]}
                          >
                            Password rule
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.passwordBubbleText,
                            { color: theme.colors.mutedForeground },
                          ]}
                        >
                          Use at least 8 characters.
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.passwordRow}>
                      <TextInput
                        value={password}
                        onChangeText={(value: string) => {
                          setPassword(value);
                          if (
                            errors.password ||
                            errors.confirmPassword ||
                            errors.form
                          ) {
                            setErrors(previous => ({
                              ...previous,
                              password: undefined,
                              form: undefined,
                              confirmPassword:
                                previous.confirmPassword &&
                                value !== confirmPassword
                                  ? previous.confirmPassword
                                  : undefined,
                            }));
                          }
                        }}
                        placeholder="Create a password"
                        placeholderTextColor={theme.colors.mutedForeground}
                        secureTextEntry={!showPassword}
                        textContentType="newPassword"
                        autoComplete="new-password"
                        editable={!isLockedAfterSuccess}
                        style={[
                          styles.input,
                          styles.passwordInput,
                          {
                            borderColor: errors.password
                              ? theme.colors.destructive
                              : theme.colors.border,
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
                          <EyeOff
                            color={theme.colors.mutedForeground}
                            size={18}
                          />
                        ) : (
                          <Eye color={theme.colors.mutedForeground} size={18} />
                        )}
                      </Pressable>
                    </View>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text
                    style={[styles.label, { color: theme.colors.foreground }]}
                  >
                    Confirm password
                  </Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={(value: string) => {
                        setConfirmPassword(value);
                        if (errors.confirmPassword || errors.form) {
                          setErrors(previous => ({
                            ...previous,
                            form: undefined,
                            confirmPassword:
                              value !== password
                                ? previous.confirmPassword
                                : undefined,
                          }));
                        }
                      }}
                      placeholder="Re-enter your password"
                      placeholderTextColor={theme.colors.mutedForeground}
                      secureTextEntry={!showConfirmPassword}
                      textContentType="newPassword"
                      autoComplete="new-password"
                      editable={!isLockedAfterSuccess}
                      style={[
                        styles.input,
                        styles.passwordInput,
                        {
                          borderColor: errors.confirmPassword
                            ? theme.colors.destructive
                            : theme.colors.border,
                          backgroundColor: theme.colors.inputBackground,
                          color: theme.colors.foreground,
                        },
                      ]}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        setShowConfirmPassword(previous => !previous)
                      }
                      style={styles.visibilityButton}
                    >
                      {showConfirmPassword ? (
                        <EyeOff
                          color={theme.colors.mutedForeground}
                          size={18}
                        />
                      ) : (
                        <Eye color={theme.colors.mutedForeground} size={18} />
                      )}
                    </Pressable>
                  </View>
                </View>

                <PrimaryButton
                  label="Create Account"
                  onPress={handleSubmit}
                  loading={isSubmitting}
                  disabled={isLockedAfterSuccess}
                  icon={<AuthActionIcon kind="create-account" />}
                  tone="accent"
                />
              </View>

              <View style={styles.footerRow}>
                <Text
                  style={[
                    styles.footerText,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  Already have an account?
                </Text>
                <Pressable onPress={onGoToSignIn} style={styles.linkButton}>
                  <Text
                    style={[styles.linkText, { color: theme.colors.primary }]}
                  >
                    Sign in
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
      <AuthErrorDialog
        message={dialogError?.message || ''}
        onDismiss={() => setDialogError(null)}
        title={dialogError?.title || 'Something went wrong'}
        visible={Boolean(dialogError)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
    position: 'relative',
  },
  header: {
    width: '100%',
    paddingTop: 4,
  },
  headerInner: {
    width: '100%',
    alignSelf: 'center',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 14,
    paddingBottom: 22,
    flexGrow: 1,
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    alignSelf: 'center',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  successBanner: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    zIndex: 20,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  successBannerIos: {
    top: 8,
  },
  successBannerAndroid: {
    top: 12,
  },
  successBannerCopy: {
    flex: 1,
    gap: 2,
  },
  successBannerTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  successBannerText: {
    fontSize: 12,
    lineHeight: 18,
  },
  form: {
    width: '100%',
    gap: 18,
    marginTop: 28,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  passwordSection: {
    position: 'relative',
    gap: 8,
    zIndex: 40,
  },
  passwordTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 30,
  },
  passwordRuleIcon: {
    minWidth: 24,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 48,
  },
  visibilityButton: {
    position: 'absolute',
    right: 14,
    height: 52,
    justifyContent: 'center',
  },
  passwordBubble: {
    position: 'absolute',
    top: 28,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingLeft: 16,
    gap: 4,
    zIndex: 40,
    elevation: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
  passwordBubbleAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  passwordBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  passwordBubbleTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  passwordBubbleText: {
    fontSize: 11,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 18,
  },
  footerText: {
    fontSize: 13,
  },
  linkButton: {
    paddingVertical: 2,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
