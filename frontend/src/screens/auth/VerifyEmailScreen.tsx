import { useCallback, useEffect, useRef, useState } from "react";
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
import { ArrowLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWindowDimensions } from "react-native";
import ActionSuccessScreen from "../../components/ActionSuccessScreen";
import PrimaryButton from "../../components/PrimaryButton";
import AuthHero from "../../components/AuthHero";
import { useTheme } from "../../theme/provider";

type VerifyEmailScreenProps = {
  email: string;
  debugCode?: string | null;
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
  debugCode,
  isResending = false,
  onVerifyEmail,
  onVerificationSuccess,
  onResendCode,
  onBackToCreateAccount,
}: VerifyEmailScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [code, setCode] = useState<string[]>(new Array(OTP_LENGTH).fill(""));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const inputRefs = useRef<Array<any>>([]);
  const isSubmittingRef = useRef(false);
  const lastSubmittedCodeRef = useRef<string | null>(null);

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 24;
  const sheetMaxWidth = isWide ? 460 : 420;
  const inputSize = isCompact ? 40 : isWide ? 50 : 44;
  const gap = isCompact ? 8 : 12;

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

  const verificationCode = code.join("");

  const fillCode = (nextValue: string) => {
    const digits = nextValue.replace(/\D/g, "").slice(0, OTP_LENGTH).split("");
    const nextCode = new Array(OTP_LENGTH).fill("");

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
    if (key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const nextCode = [...code];
      nextCode[index - 1] = "";
      setCode(nextCode);
    }
  };

  const handleVerify = useCallback(async () => {
    if (isVerifying || isVerified || isSubmittingRef.current) {
      return;
    }

    if (code.some(digit => digit === "")) {
      setError("Please enter the full verification code.");
      return;
    }

    if (verificationCode === lastSubmittedCodeRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    lastSubmittedCodeRef.current = verificationCode;
    setIsVerifying(true);
    setError(null);

    try {
      await onVerifyEmail(verificationCode);
      setIsVerified(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to verify your email."
      );
      setIsVerified(false);
    } finally {
      isSubmittingRef.current = false;
      setIsVerifying(false);
    }
  }, [code, isVerifying, isVerified, onVerifyEmail, verificationCode]);

  useEffect(() => {
    if (
      code.every(digit => digit !== "") &&
      !isVerifying &&
      !isVerified &&
      !isSubmittingRef.current &&
      verificationCode !== lastSubmittedCodeRef.current
    ) {
      handleVerify();
    }
  }, [code, handleVerify, isVerified, isVerifying, verificationCode]);

  const handleResend = async () => {
    if (resendTimer > 0 || isResending) {
      return;
    }

    try {
      await onResendCode();
      setCode(new Array(OTP_LENGTH).fill(""));
      setResendTimer(RESEND_COOLDOWN);
      setError(null);
      setIsVerified(false);
      lastSubmittedCodeRef.current = null;
      inputRefs.current[0]?.focus();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to resend the verification code."
      );
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.screen}>
        <KeyboardAvoidingView
          style={[styles.container, { backgroundColor: theme.colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.sheet, { maxWidth: sheetMaxWidth }]}>
              <Pressable onPress={onBackToCreateAccount} style={styles.backLink}>
                <ArrowLeft color={theme.colors.mutedForeground} size={18} />
                <Text style={[styles.backText, { color: theme.colors.mutedForeground }]}>
                  Back
                </Text>
              </Pressable>

              <AuthHero
                title="Check your email"
                subtitle={`We sent a 6-digit code to ${email}.`}
                tone="default"
                badge={null}
              />

              <View style={styles.form}>
                <View style={[styles.instructionCard, { backgroundColor: theme.colors.accent }]}>
                  <Text style={[styles.instructionTitle, { color: theme.colors.foreground }]}>
                    Enter the verification code
                  </Text>
                  <Text style={[styles.instructionBody, { color: theme.colors.mutedForeground }]}>
                    Keep this screen open. The code will complete your account setup once entered.
                  </Text>
                </View>

                <View style={[styles.codeRow, { gap }]}>
                  {code.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(el: any) => {
                        inputRefs.current[index] = el;
                      }}
                      value={digit}
                      onChangeText={(text: string) => updateCode(index, text)}
                      onKeyPress={({ nativeEvent }: { nativeEvent: { key: string } }) =>
                        handleKeyDown(index, nativeEvent.key)
                      }
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      maxLength={1}
                      editable={!isVerifying && !isVerified}
                      style={[
                        styles.codeInput,
                        {
                          width: inputSize,
                          height: inputSize + 4,
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

                {error ? (
                  <Text style={[styles.error, { color: theme.colors.destructive }]}>
                    {error}
                  </Text>
                ) : null}

                <PrimaryButton
                  label={
                    isVerifying
                      ? "Verifying..."
                      : isVerified
                        ? "Verified"
                        : "Verify code"
                  }
                  onPress={handleVerify}
                  loading={isVerifying}
                  disabled={isVerifying || isVerified || code.some(digit => digit === "")}
                  tone="accent"
                />

                <View style={styles.resendArea}>
                  {resendTimer > 0 ? (
                    <Text style={[styles.resendTimer, { color: theme.colors.mutedForeground }]}>
                      Resend code in{" "}
                      <Text style={[styles.resendTimerValue, { color: theme.colors.foreground }]}>
                        0:{resendTimer.toString().padStart(2, "0")}
                      </Text>
                    </Text>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleResend}
                      disabled={isResending || isVerified}
                    >
                      <Text
                        style={[
                          styles.resendLink,
                          { color: theme.colors.primary },
                          (isResending || isVerified) ? styles.resendLinkDisabled : null,
                        ]}
                      >
                        {isResending ? "Sending..." : "Didn't receive the code? Resend"}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {debugCode ? (
                  <Text style={[styles.debugText, { color: theme.colors.mutedForeground }]}>
                    Test code: {debugCode}
                  </Text>
                ) : null}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
    position: "relative",
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
    marginTop: 20,
  },
  instructionCard: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  instructionBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  codeInput: {
    borderRadius: 12,
    borderWidth: 1.5,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "600",
  },
  error: {
    fontSize: 12,
    textAlign: "center",
  },
  resendArea: {
    alignItems: "center",
    marginTop: 4,
  },
  resendTimer: {
    fontSize: 14,
  },
  resendTimerValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  resendLink: {
    fontSize: 14,
    fontWeight: "600",
  },
  resendLinkDisabled: {
    opacity: 0.6,
  },
  debugText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
});
