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
import { Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWindowDimensions } from "react-native";
import PrimaryButton from "../../components/PrimaryButton";
import AuthHero from "../../components/AuthHero";
import { useTheme } from "../../theme/provider";

type VerifyEmailScreenProps = {
  email: string;
  debugCode?: string | null;
  isResending?: boolean;
  onVerifyEmail: (code: string) => Promise<void>;
  onVerificationSuccess: () => void;
  onResendCode: () => Promise<void>;
  onBackToCreateAccount: () => void;
};

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

const CONFETTI_PIECES = [
  { left: 20, top: 18, size: 8, driftX: -18, driftY: -48, delay: 0 },
  { left: 48, top: 8, size: 6, driftX: 14, driftY: -56, delay: 40 },
  { left: 82, top: 22, size: 10, driftX: 26, driftY: -40, delay: 80 },
  { left: 118, top: 12, size: 7, driftX: -12, driftY: -62, delay: 120 },
  { left: 150, top: 28, size: 8, driftX: 20, driftY: -46, delay: 60 },
  { left: 188, top: 16, size: 6, driftX: -24, driftY: -52, delay: 100 },
  { left: 224, top: 24, size: 9, driftX: 16, driftY: -44, delay: 140 },
  { left: 262, top: 10, size: 7, driftX: -10, driftY: -58, delay: 180 },
] as const;

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
  const successPulse = useRef(new Animated.Value(0)).current;
  const confettiValues = useRef(
    CONFETTI_PIECES.map(() => new Animated.Value(0))
  ).current;
  const successAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (!isVerified) {
      if (successAdvanceTimerRef.current) {
        clearTimeout(successAdvanceTimerRef.current);
        successAdvanceTimerRef.current = null;
      }
      successPulse.setValue(0);
      confettiValues.forEach(value => value.setValue(0));
      return;
    }

    Animated.parallel([
      Animated.timing(successPulse, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      ...confettiValues.map((value, index) =>
        Animated.sequence([
          Animated.delay(CONFETTI_PIECES[index].delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 820,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();

    successAdvanceTimerRef.current = setTimeout(() => {
      onVerificationSuccess();
    }, 1200);
  }, [confettiValues, isVerified, onVerificationSuccess, successPulse]);

  useEffect(() => {
    return () => {
      if (successAdvanceTimerRef.current) {
        clearTimeout(successAdvanceTimerRef.current);
      }
    };
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
    successPulse.setValue(0);
    confettiValues.forEach(value => value.setValue(0));

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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.screen}>
        {isVerified ? (
          <View pointerEvents="none" style={styles.confettiLayer}>
            {CONFETTI_PIECES.map((piece, index) => {
              const animatedValue = confettiValues[index];
              const scale = animatedValue.interpolate({
                inputRange: [0, 0.18, 1],
                outputRange: [0.2, 1.08, 0.85],
              });
              const opacity = animatedValue.interpolate({
                inputRange: [0, 0.1, 0.8, 1],
                outputRange: [0, 1, 1, 0],
              });
              const translateY = animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [piece.top, piece.top + piece.driftY],
              });
              const translateX = animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [piece.left, piece.left + piece.driftX],
              });
              const rotate = animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", `${180 + index * 28}deg`],
              });

              return (
                <Animated.View
                  key={`${piece.left}-${piece.top}`}
                  style={[
                    styles.confettiPiece,
                    {
                      left: piece.left,
                      top: piece.top,
                      width: piece.size,
                      height: piece.size * 1.8,
                      opacity,
                      transform: [{ translateX }, { translateY }, { scale }, { rotate }],
                      backgroundColor:
                        index % 4 === 0
                          ? theme.colors.primary
                          : index % 4 === 1
                            ? theme.colors.success
                            : index % 4 === 2
                              ? theme.colors.accent
                              : theme.colors.destructive,
                    },
                  ]}
                />
              );
            })}
          </View>
        ) : null}

        <KeyboardAvoidingView
          style={[styles.container, { backgroundColor: theme.colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.sheet, { maxWidth: sheetMaxWidth }]}>
              {!isVerified ? (
                <Pressable onPress={onBackToCreateAccount} style={styles.backLink}>
                  <ArrowLeft color={theme.colors.mutedForeground} size={18} />
                  <Text style={[styles.backText, { color: theme.colors.mutedForeground }]}>
                    Back
                  </Text>
                </Pressable>
              ) : null}

              <AuthHero
                title={isVerified ? "Email verified" : "Check your email"}
                subtitle={
                  isVerified
                    ? "You can finish setting up your profile now."
                    : `We sent a 6-digit code to ${email}.`
                }
                tone={isVerified ? "success" : "default"}
                badge={null}
              />

              {!isVerified ? (
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
              ) : (
                <View style={styles.successStack}>
                  <View style={styles.successCard}>
                    <Text style={[styles.successText, { color: theme.colors.foreground }]}>
                      Your email is confirmed. We&apos;ll use the details below to finish setup.
                    </Text>
                  </View>
                </View>
              )}
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
  successCard: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(47, 122, 93, 0.08)",
  },
  successStack: {
    gap: 12,
    marginTop: 16,
  },
  successText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  confettiLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 140,
    height: 220,
    zIndex: 20,
    elevation: 20,
  },
  confettiPiece: {
    position: "absolute",
    borderRadius: 999,
  },
});
