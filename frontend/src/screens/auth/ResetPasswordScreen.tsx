import { useCallback, useEffect, useRef, useState } from 'react';
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
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react-native';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthHero from '../../components/AuthHero';
import {
  AuthErrorDialog,
  AuthErrorNotice,
} from '../../components/AuthErrorFeedback';
import AuthInkBackdrop from '../../components/AuthInkBackdrop';
import PrimaryButton from '../../components/PrimaryButton';
import { useTheme } from '../../theme/provider';
import { getAuthLayoutMetrics } from './authLayout';
import {
  AUTH_VALIDATION_MESSAGES,
  getAuthErrorPresentation,
  type AuthErrorPresentation,
} from './authErrorPresentation';

type ResetPasswordScreenProps = {
  token: string;
  onSubmit: (payload: { token: string; password: string }) => Promise<void>;
  onBackToSignIn: () => void;
};

type ResetPasswordErrors = {
  confirmPassword?: string;
  form?: string;
  password?: string;
};

const SUCCESS_HANDOFF_DELAY_MS = 1600;

const createVerticalRevealStyle = (
  progress: Animated.Value,
  distance: number,
) => ({
  opacity: progress,
  transform: [
    {
      translateY: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [distance, 0],
      }),
    },
  ],
});

export default function ResetPasswordScreen({
  token,
  onSubmit,
  onBackToSignIn,
}: ResetPasswordScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<ResetPasswordErrors>({});
  const [dialogError, setDialogError] = useState<AuthErrorPresentation | null>(
    null,
  );
  const [isComplete, setIsComplete] = useState(false);
  const heroEntrance = useRef(new Animated.Value(0)).current;
  const formEntrance = useRef(new Animated.Value(0)).current;
  const successCardEntrance = useRef(new Animated.Value(0)).current;
  const successIconEntrance = useRef(new Animated.Value(0)).current;
  const successCopyEntrance = useRef(new Animated.Value(0)).current;
  const initialEntranceAnimationRef =
    useRef<Animated.CompositeAnimation | null>(null);
  const successEntranceAnimationRef =
    useRef<Animated.CompositeAnimation | null>(null);
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReduceMotionRef = useRef(false);
  const hasNavigatedRef = useRef(false);
  const onBackToSignInRef = useRef(onBackToSignIn);
  const {
    contentPaddingBottom,
    contentPaddingTop,
    heroSubtitleMaxWidth,
    heroTitleSize,
    horizontalPadding,
    sheetMaxWidth,
  } = getAuthLayoutMetrics(width);

  const hasToken = Boolean(token.trim());

  useEffect(() => {
    onBackToSignInRef.current = onBackToSignIn;
  }, [onBackToSignIn]);

  const navigateToSignIn = useCallback(() => {
    if (hasNavigatedRef.current) {
      return;
    }

    hasNavigatedRef.current = true;
    if (handoffTimerRef.current) {
      clearTimeout(handoffTimerRef.current);
      handoffTimerRef.current = null;
    }
    onBackToSignInRef.current();
  }, []);

  useEffect(() => {
    let isActive = true;
    let runtimeReduceMotionPreference: boolean | null = null;

    const settleMotion = () => {
      initialEntranceAnimationRef.current?.stop();
      successEntranceAnimationRef.current?.stop();
      heroEntrance.setValue(1);
      formEntrance.setValue(1);
      successCardEntrance.setValue(1);
      successIconEntrance.setValue(1);
      successCopyEntrance.setValue(1);
    };

    const startEntrance = () => {
      if (!isActive || initialEntranceAnimationRef.current) {
        return;
      }

      initialEntranceAnimationRef.current = Animated.stagger(110, [
        Animated.timing(heroEntrance, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(formEntrance, {
          toValue: 1,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      initialEntranceAnimationRef.current.start();
    };

    const handleReduceMotionChange = (enabled: boolean) => {
      runtimeReduceMotionPreference = enabled;
      shouldReduceMotionRef.current = enabled;
      if (enabled) {
        settleMotion();
      }
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (!isActive) {
          return;
        }

        const shouldReduceMotion = runtimeReduceMotionPreference ?? enabled;
        shouldReduceMotionRef.current = shouldReduceMotion;
        if (shouldReduceMotion) {
          settleMotion();
        } else {
          startEntrance();
        }
      })
      .catch(startEntrance);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      handleReduceMotionChange,
    );

    return () => {
      isActive = false;
      subscription.remove();
      initialEntranceAnimationRef.current?.stop();
      initialEntranceAnimationRef.current = null;
    };
  }, [
    formEntrance,
    heroEntrance,
    successCardEntrance,
    successCopyEntrance,
    successIconEntrance,
  ]);

  useEffect(() => {
    if (!isComplete) {
      return;
    }

    if (shouldReduceMotionRef.current) {
      successCardEntrance.setValue(1);
      successIconEntrance.setValue(1);
      successCopyEntrance.setValue(1);
    } else {
      successCardEntrance.setValue(0);
      successIconEntrance.setValue(0);
      successCopyEntrance.setValue(0);
      successEntranceAnimationRef.current = Animated.stagger(90, [
        Animated.timing(successCardEntrance, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(successIconEntrance, {
          toValue: 1,
          damping: 15,
          stiffness: 190,
          mass: 0.82,
          useNativeDriver: true,
        }),
        Animated.timing(successCopyEntrance, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      successEntranceAnimationRef.current.start();
    }

    handoffTimerRef.current = setTimeout(
      navigateToSignIn,
      SUCCESS_HANDOFF_DELAY_MS,
    );

    return () => {
      successEntranceAnimationRef.current?.stop();
      successEntranceAnimationRef.current = null;
      if (handoffTimerRef.current) {
        clearTimeout(handoffTimerRef.current);
        handoffTimerRef.current = null;
      }
    };
  }, [
    isComplete,
    navigateToSignIn,
    successCardEntrance,
    successCopyEntrance,
    successIconEntrance,
  ]);

  const validateForm = () => {
    const nextErrors: ResetPasswordErrors = {};

    if (!hasToken) {
      nextErrors.form = AUTH_VALIDATION_MESSAGES.resetTokenMissing;
    }

    if (!password) {
      nextErrors.password = AUTH_VALIDATION_MESSAGES.passwordRequired;
    } else if (password.length < 8) {
      nextErrors.password = AUTH_VALIDATION_MESSAGES.passwordTooShort;
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword =
        AUTH_VALIDATION_MESSAGES.confirmPasswordRequired;
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = AUTH_VALIDATION_MESSAGES.passwordMismatch;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setDialogError(null);

    try {
      await onSubmit({
        token: token.trim(),
        password,
      });
      setIsComplete(true);
    } catch (submissionError) {
      const presentation = getAuthErrorPresentation(
        submissionError,
        'reset-password',
      );

      if (!presentation) {
        return;
      } else if (presentation.surface === 'dialog') {
        setDialogError(presentation);
      } else if (presentation.field === 'password') {
        setErrors({ password: presentation.message });
      } else if (presentation.field === 'confirmPassword') {
        setErrors({ confirmPassword: presentation.message });
      } else {
        setErrors({ form: presentation.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPasswordInput = (
    value: string,
    onChangeText: (value: string) => void,
    placeholder: string,
    textContentType: 'newPassword' | 'password',
    errorKey: 'confirmPassword' | 'password',
  ) => (
    <View style={styles.passwordRow}>
      <TextInput
        value={value}
        onChangeText={(nextValue: string) => {
          onChangeText(nextValue);
          if (errors[errorKey] || errors.form) {
            setErrors(previous => ({
              ...previous,
              [errorKey]: undefined,
              form: undefined,
            }));
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
            borderColor: errors[errorKey]
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
          <EyeOff color={theme.colors.mutedForeground} size={18} />
        ) : (
          <Eye color={theme.colors.mutedForeground} size={18} />
        )}
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <AuthInkBackdrop />
      <View style={styles.screen}>
        <View
          testID="reset-password-back-row"
          style={[styles.header, { paddingHorizontal: horizontalPadding }]}
        >
          <View style={[styles.headerInner, { maxWidth: sheetMaxWidth }]}>
            <Pressable
              accessibilityLabel="Back to sign in"
              accessibilityRole="button"
              onPress={navigateToSignIn}
              style={styles.backLink}
            >
              <ArrowLeft color={theme.colors.mutedForeground} size={18} />
              <Text
                style={[
                  styles.backText,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                Back to sign in
              </Text>
            </Pressable>
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            testID="reset-password-centered-scroll"
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
              <Animated.View
                testID="reset-password-hero-entrance"
                style={createVerticalRevealStyle(heroEntrance, 14)}
              >
                <AuthHero
                  title={
                    isComplete ? 'Password reset' : 'Choose a new password'
                  }
                  subtitle={
                    isComplete
                      ? 'Your new password is ready to use.'
                      : 'Use a password you do not use anywhere else.'
                  }
                  subtitleMaxWidth={heroSubtitleMaxWidth}
                  titleSize={heroTitleSize}
                />
              </Animated.View>

              {isComplete ? (
                <Animated.View
                  accessibilityLabel="Password reset. Your password is updated. Taking you to sign in."
                  accessibilityLiveRegion="polite"
                  accessibilityRole="alert"
                  accessible
                  testID="reset-password-success-card"
                  style={[
                    styles.successCard,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                    createVerticalRevealStyle(successCardEntrance, 18),
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.successIconWrap,
                      {
                        backgroundColor: theme.colors.accent,
                        opacity: successIconEntrance,
                        transform: [
                          {
                            scale: successIconEntrance.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.72, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <CheckCircle2 color={theme.colors.primary} size={30} />
                  </Animated.View>

                  <Animated.View
                    style={[
                      styles.successCopy,
                      createVerticalRevealStyle(successCopyEntrance, 10),
                    ]}
                  >
                    <Text
                      style={[
                        styles.successTitle,
                        { color: theme.colors.foreground },
                      ]}
                    >
                      Your password is updated
                    </Text>
                    <Text
                      style={[
                        styles.successText,
                        { color: theme.colors.mutedForeground },
                      ]}
                    >
                      Sign in again to continue journaling.
                    </Text>
                    <View style={styles.handoffRow}>
                      <View
                        style={[
                          styles.handoffDot,
                          { backgroundColor: theme.colors.primary },
                        ]}
                      />
                      <Text
                        style={[
                          styles.handoffText,
                          { color: theme.colors.primary },
                        ]}
                      >
                        Taking you to sign in...
                      </Text>
                    </View>
                  </Animated.View>
                </Animated.View>
              ) : (
                <Animated.View
                  testID="reset-password-form-entrance"
                  style={[
                    styles.form,
                    createVerticalRevealStyle(formEntrance, 18),
                  ]}
                >
                  <AuthErrorNotice
                    message={
                      !hasToken
                        ? AUTH_VALIDATION_MESSAGES.resetTokenMissing
                        : errors.form ||
                          errors.password ||
                          errors.confirmPassword
                    }
                    testID="reset-password-error-notice"
                  />

                  <View style={styles.field}>
                    <Text
                      style={[styles.label, { color: theme.colors.foreground }]}
                    >
                      New password
                    </Text>
                    {renderPasswordInput(
                      password,
                      setPassword,
                      'Enter a new password',
                      'newPassword',
                      'password',
                    )}
                  </View>

                  <View style={styles.field}>
                    <Text
                      style={[styles.label, { color: theme.colors.foreground }]}
                    >
                      Confirm password
                    </Text>
                    {renderPasswordInput(
                      confirmPassword,
                      setConfirmPassword,
                      'Re-enter your password',
                      'password',
                      'confirmPassword',
                    )}
                  </View>

                  <PrimaryButton
                    label="Reset Password"
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    disabled={isSubmitting || !hasToken}
                    icon={<KeyRound color="#FFFFFF" size={16} strokeWidth={2} />}
                    tone="accent"
                  />
                </Animated.View>
              )}
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
  form: {
    width: '100%',
    gap: 16,
    marginTop: 28,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 44,
  },
  visibilityButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  successCard: {
    marginTop: 28,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCopy: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  handoffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  handoffDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  handoffText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
