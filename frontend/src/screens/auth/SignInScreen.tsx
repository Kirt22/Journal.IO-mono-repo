import { useState } from 'react';
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
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import PrimaryButton from '../../components/PrimaryButton';
import {
  AuthErrorDialog,
  AuthErrorNotice,
} from '../../components/AuthErrorFeedback';
import AuthHero from '../../components/AuthHero';
import AuthInkBackdrop from '../../components/AuthInkBackdrop';
import WavingHandIcon from '../../components/WavingHandIcon';
import { useTheme } from '../../theme/provider';
import { getAuthLayoutMetrics } from './authLayout';
import {
  AUTH_VALIDATION_MESSAGES,
  getAuthErrorPresentation,
  type AuthErrorPresentation,
} from './authErrorPresentation';

type SignInScreenProps = {
  onSubmit: (payload: { email: string; password: string }) => Promise<void>;
  onBackToAuth: () => void;
  onGoToCreateAccount: () => void;
  onForgotPassword: () => void;
};

const validateEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function SignInScreen({
  onSubmit,
  onBackToAuth,
  onGoToCreateAccount,
  onForgotPassword,
}: SignInScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    form?: string;
    password?: string;
  }>({});
  const [dialogError, setDialogError] = useState<AuthErrorPresentation | null>(
    null,
  );
  const {
    contentPaddingBottom,
    contentPaddingTop,
    heroSubtitleMaxWidth,
    heroTitleSize,
    horizontalPadding,
    sheetMaxWidth,
  } = getAuthLayoutMetrics(width);

  const validateForm = () => {
    const nextErrors: typeof errors = {};

    if (!email.trim()) {
      nextErrors.email = AUTH_VALIDATION_MESSAGES.emailRequired;
    } else if (!validateEmail(email)) {
      nextErrors.email = AUTH_VALIDATION_MESSAGES.emailInvalid;
    }

    if (!password) {
      nextErrors.password = AUTH_VALIDATION_MESSAGES.passwordRequired;
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
        email: email.trim(),
        password,
      });
    } catch (submissionError) {
      const presentation = getAuthErrorPresentation(submissionError, 'sign-in');

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

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <AuthInkBackdrop />
      <View style={styles.screen}>
        <View
          testID="sign-in-back-row"
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
            testID="sign-in-centered-scroll"
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
                title="Welcome back"
                subtitle="Sign in to continue your journaling journey."
                subtitleMaxWidth={heroSubtitleMaxWidth}
                titleSize={heroTitleSize}
              />

              <View style={styles.form}>
                <AuthErrorNotice
                  message={errors.email || errors.password || errors.form}
                  testID="sign-in-error-notice"
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
                    editable={!isSubmitting}
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
                  <Text
                    style={[styles.label, { color: theme.colors.foreground }]}
                  >
                    Password
                  </Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      value={password}
                      onChangeText={(value: string) => {
                        setPassword(value);
                        if (errors.password || errors.form) {
                          setErrors(previous => ({
                            ...previous,
                            form: undefined,
                            password: undefined,
                          }));
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
                  <Pressable
                    onPress={onForgotPassword}
                    style={styles.forgotLinkRow}
                  >
                    <Text
                      style={[styles.linkText, { color: theme.colors.primary }]}
                    >
                      Forgot password?
                    </Text>
                  </Pressable>
                </View>

                <PrimaryButton
                  label="Sign In"
                  onPress={handleSubmit}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  icon={<WavingHandIcon size={22} testID="sign-in-waving-hand-icon" />}
                  tone="accent"
                />

                <View style={styles.footerRow}>
                  <Text
                    style={[
                      styles.footerText,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    Need an account?
                  </Text>
                  <Pressable
                    onPress={onGoToCreateAccount}
                    style={styles.linkButton}
                  >
                    <Text
                      style={[styles.linkText, { color: theme.colors.primary }]}
                    >
                      Create one
                    </Text>
                  </Pressable>
                </View>
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
    paddingTop: 16,
    paddingBottom: 24,
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
  forgotLinkRow: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingVertical: 2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
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
    fontWeight: '600',
  },
});
