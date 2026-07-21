import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from '../../infrastructure/reactNative';
import { ArrowLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import ActionSuccessScreen from '../../components/ActionSuccessScreen';
import PrimaryButton from '../../components/PrimaryButton';
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

type VerifyEmailScreenProps = {
  email: string;
  isResending?: boolean;
  onVerifyEmail: (code: string) => Promise<void>;
  onVerificationSuccess: () => void | Promise<void>;
  onResendCode: () => Promise<void>;
  onBackToCreateAccount: () => void;
};

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export default function VerifyEmailScreen({
  email,
  isResending = false,
  onVerifyEmail,
  onVerificationSuccess,
  onResendCode,
  onBackToCreateAccount,
}: VerifyEmailScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [code, setCode] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<AuthErrorPresentation | null>(
    null,
  );
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const [isResendSubmitting, setIsResendSubmitting] = useState(false);
  const inputRefs = useRef<Array<any>>([]);
  const isSubmittingRef = useRef(false);
  const lastSubmittedCodeRef = useRef<string | null>(null);
  const {
    contentPaddingBottom,
    contentPaddingTop,
    heroSubtitleMaxWidth,
    heroTitleSize,
    horizontalPadding,
    otpGap,
    otpInputSize,
    sheetMaxWidth,
  } = getAuthLayoutMetrics(width);

  useEffect(() => {
    const timer =
      resendTimer > 0
        ? setTimeout(() => setResendTimer(previous => previous - 1), 1000)
        : null;

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [resendTimer]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const verificationCode = code.join('');

  const fillCode = (nextValue: string) => {
    const digits = nextValue.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
    const nextCode = new Array(OTP_LENGTH).fill('');

    digits.forEach((digit, index) => {
      nextCode[index] = digit;
    });

    setCode(nextCode);
    inputRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
  };

  const updateCode = (index: number, nextValue: string) => {
    if (!/^\d*$/.test(nextValue)) {
      return;
    }

    setError(null);
    setResendNotice(null);
    lastSubmittedCodeRef.current = null;
    setIsVerified(false);

    if (nextValue.length > 1) {
      fillCode(nextValue);
      return;
    }

    const nextCode = [...code];
    nextCode[index] = nextValue;
    setCode(nextCode);

    if (nextValue && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const nextCode = [...code];
      nextCode[index - 1] = '';
      setCode(nextCode);
    }
  };

  const handleVerify = useCallback(async () => {
    if (isVerifying || isVerified || isSubmittingRef.current) {
      return;
    }

    if (code.some(digit => digit === '')) {
      setError(AUTH_VALIDATION_MESSAGES.codeRequired);
      return;
    }

    if (verificationCode === lastSubmittedCodeRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    lastSubmittedCodeRef.current = verificationCode;
    setIsVerifying(true);
    setError(null);
    setDialogError(null);
    setResendNotice(null);

    try {
      await onVerifyEmail(verificationCode);
      setIsVerified(true);
    } catch (submissionError) {
      const presentation = getAuthErrorPresentation(
        submissionError,
        'verify-email',
      );

      if (!presentation) {
        return;
      } else if (presentation.surface === 'dialog') {
        setDialogError(presentation);
      } else {
        setError(presentation.message);
      }
      setIsVerified(false);
    } finally {
      isSubmittingRef.current = false;
      setIsVerifying(false);
    }
  }, [code, isVerifying, isVerified, onVerifyEmail, verificationCode]);

  useEffect(() => {
    if (
      code.every(digit => digit !== '') &&
      !isVerifying &&
      !isVerified &&
      !isSubmittingRef.current &&
      verificationCode !== lastSubmittedCodeRef.current
    ) {
      handleVerify();
    }
  }, [code, handleVerify, isVerified, isVerifying, verificationCode]);

  const handleResend = async () => {
    if (resendTimer > 0 || isResending || isResendSubmitting) {
      return;
    }

    setIsResendSubmitting(true);
    setError(null);
    setDialogError(null);
    setResendNotice(null);

    try {
      await onResendCode();
      setCode(new Array(OTP_LENGTH).fill(''));
      setResendTimer(RESEND_COOLDOWN);
      setIsVerified(false);
      setResendNotice(
        __DEV__
          ? 'A fresh code was requested. If local SMTP is off, use the latest code from the backend or Metro logs.'
          : 'A fresh code is on the way.',
      );
      lastSubmittedCodeRef.current = null;
      inputRefs.current[0]?.focus();
    } catch (submissionError) {
      const presentation = getAuthErrorPresentation(
        submissionError,
        'resend-verification',
      );

      if (!presentation) {
        return;
      } else if (presentation.surface === 'dialog') {
        setDialogError(presentation);
      } else {
        setError(presentation.message);
      }
    } finally {
      setIsResendSubmitting(false);
    }
  };

  if (isVerified) {
    return (
      <ActionSuccessScreen
        variant="otp"
        onPrimaryAction={onVerificationSuccess}
        autoAdvanceMs={5000}
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <AuthInkBackdrop />
      <View style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.content,
              {
                paddingBottom: contentPaddingBottom,
                paddingHorizontal: horizontalPadding,
                paddingTop: contentPaddingTop + 4,
              },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.sheet, { maxWidth: sheetMaxWidth }]}>
              <Pressable
                onPress={onBackToCreateAccount}
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

              <AuthHero
                title="Check your email"
                subtitle="We sent a 6-digit code to"
                badge={null}
                subtitleMaxWidth={heroSubtitleMaxWidth}
                titleSize={heroTitleSize}
              >
                <View
                  style={[
                    styles.emailPill,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="middle"
                    style={[
                      styles.emailPillText,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    {email}
                  </Text>
                </View>
              </AuthHero>

              <View style={styles.form}>
                <View
                  style={[
                    styles.instructionCard,
                    { backgroundColor: theme.colors.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.instructionTitle,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    Enter the verification code
                  </Text>
                  <Text
                    style={[
                      styles.instructionBody,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    Keep this screen open. The code will complete your account
                    setup once entered.
                  </Text>
                </View>

                {__DEV__ ? (
                  <View
                    style={[
                      styles.localTestingCard,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.localTestingTitle,
                        { color: theme.colors.foreground },
                      ]}
                    >
                      Local testing
                    </Text>
                    <Text
                      style={[
                        styles.localTestingBody,
                        { color: theme.colors.mutedForeground },
                      ]}
                    >
                      If SMTP is not configured, the latest verification code is
                      printed in the backend console and app dev logs.
                    </Text>
                  </View>
                ) : null}

                <AuthErrorNotice
                  message={error}
                  testID="verify-email-error-notice"
                />

                <View style={[styles.codeRow, { gap: otpGap }]}>
                  {code.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(el: any) => {
                        inputRefs.current[index] = el;
                      }}
                      value={digit}
                      onChangeText={(text: string) => updateCode(index, text)}
                      onKeyPress={({
                        nativeEvent,
                      }: {
                        nativeEvent: { key: string };
                      }) => handleKeyDown(index, nativeEvent.key)}
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      maxLength={1}
                      editable={!isVerifying && !isVerified}
                      style={[
                        styles.codeInput,
                        {
                          width: otpInputSize,
                          height: otpInputSize + 4,
                          borderColor: error
                            ? theme.colors.destructive
                            : digit
                            ? theme.colors.primary
                            : theme.colors.border,
                          backgroundColor: theme.colors.card,
                          color: theme.colors.foreground,
                        },
                      ]}
                    />
                  ))}
                </View>

                {resendNotice ? (
                  <Text
                    style={[
                      styles.resendNotice,
                      { color: theme.colors.success },
                    ]}
                  >
                    {resendNotice}
                  </Text>
                ) : null}

                <PrimaryButton
                  label={isVerified ? 'Verified' : 'Verify code'}
                  onPress={handleVerify}
                  loading={isVerifying}
                  disabled={
                    isVerifying ||
                    isVerified ||
                    code.some(digit => digit === '')
                  }
                  tone="accent"
                />

                <View style={styles.resendArea}>
                  {resendTimer > 0 ? (
                    <Text
                      style={[
                        styles.resendTimer,
                        { color: theme.colors.mutedForeground },
                      ]}
                    >
                      Resend code in{' '}
                      <Text
                        style={[
                          styles.resendTimerValue,
                          { color: theme.colors.foreground },
                        ]}
                      >
                        0:{resendTimer.toString().padStart(2, '0')}
                      </Text>
                    </Text>
                  ) : isResending || isResendSubmitting ? (
                    <View style={styles.resendLoading}>
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.primary}
                      />
                      <Text
                        style={[
                          styles.resendLoadingText,
                          { color: theme.colors.mutedForeground },
                        ]}
                      >
                        Sending a new code...
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleResend}
                      disabled={isResending || isResendSubmitting || isVerified}
                    >
                      <Text
                        style={[
                          styles.resendLink,
                          { color: theme.colors.primary },
                          isResending || isResendSubmitting || isVerified
                            ? styles.resendLinkDisabled
                            : null,
                        ]}
                      >
                        Didn't receive the code? Resend
                      </Text>
                    </Pressable>
                  )}
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
    position: 'relative',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingVertical: 20,
    flexGrow: 1,
    justifyContent: 'flex-start',
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
    marginBottom: 20,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    width: '100%',
    gap: 16,
    marginTop: 20,
  },
  emailPill: {
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 14,
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  emailPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  instructionCard: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  instructionBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  localTestingCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  localTestingTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  localTestingBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  codeInput: {
    borderRadius: 12,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
  },
  resendNotice: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  resendArea: {
    alignItems: 'center',
    marginTop: 4,
  },
  resendTimer: {
    fontSize: 14,
  },
  resendTimerValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  resendLinkDisabled: {
    opacity: 0.6,
  },
  resendLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resendLoadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
