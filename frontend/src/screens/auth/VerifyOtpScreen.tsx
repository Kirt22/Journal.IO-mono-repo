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
import { Animated, Easing } from "react-native";
import {
  ArrowLeft,
  BookHeart,
  CheckCircle2,
  Loader2,
} from "lucide-react-native";
import { useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PrimaryButton from "../../components/PrimaryButton";
import { useTheme } from "../../theme/provider";

type VerifyOtpScreenProps = {
  phoneNumber: string;
  debugOtp?: string | null;
  isResending?: boolean;
  onVerifyOtp: (otp: string) => Promise<void>;
  onVerificationSuccess: () => void;
  onResendCode: () => Promise<void>;
  onBackToAuth: () => void;
};

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;
const SUCCESS_ICON_ANIMATION_MS = 1200;

export default function VerifyOtpScreen({
  phoneNumber,
  debugOtp,
  isResending = false,
  onVerifyOtp,
  onVerificationSuccess,
  onResendCode,
  onBackToAuth,
}: VerifyOtpScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [otp, setOtp] = useState<string[]>(new Array(OTP_LENGTH).fill(""));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const inputRefs = useRef<Array<any>>([]);
  const successScale = useRef(new Animated.Value(0.76)).current;
  const isSubmittingRef = useRef(false);
  const lastSubmittedCodeRef = useRef<string | null>(null);
  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 24;
  const titleSize = isCompact ? 26 : isWide ? 32 : 30;
  const otpInputSize = isCompact ? 40 : isWide ? 50 : 44;
  const otpGap = isCompact ? 8 : isWide ? 14 : 12;
  const heroBottomMargin = isCompact ? 30 : 40;
  const sheetMaxWidth = isWide ? 460 : 420;
  const sheetOffset = isCompact ? -16 : -34;

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
      return;
    }

    Animated.timing(successScale, {
      toValue: 1,
      duration: SUCCESS_ICON_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isVerified, successScale]);

  const code = otp.join("");

  const updateOtp = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) {
      return;
    }

    setError(null);
    lastSubmittedCodeRef.current = null;
    setIsVerified(false);

    if (value.length > 1) {
      const nextOtp = new Array(OTP_LENGTH).fill("");
      value
        .replace(/\D/g, "")
        .slice(0, OTP_LENGTH)
        .split("")
        .forEach((digit, currentIndex) => {
          nextOtp[currentIndex] = digit;
        });
      setOtp(nextOtp);
      inputRefs.current[Math.min(value.length, OTP_LENGTH - 1)]?.focus();
      return;
    }

    const nextOtp = [...otp];
    nextOtp[index] = value;
    setOtp(nextOtp);

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, key: string) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const nextOtp = [...otp];
      nextOtp[index - 1] = "";
      setOtp(nextOtp);
    }
  };

  const handleVerify = useCallback(async () => {
    if (isVerifying || isVerified) {
      return;
    }

    if (isSubmittingRef.current) {
      return;
    }

    if (otp.some(digit => digit === "")) {
      setError("Please enter the full verification code.");
      return;
    }

    if (lastSubmittedCodeRef.current === code) {
      return;
    }

    isSubmittingRef.current = true;
    lastSubmittedCodeRef.current = code;
    setIsVerifying(true);
    setError(null);

    try {
      await onVerifyOtp(code);
      setIsVerified(true);
      setError(null);
      await new Promise(resolve => {
        setTimeout(resolve, SUCCESS_ICON_ANIMATION_MS);
      });
      onVerificationSuccess();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to verify the code."
      );
      setIsVerified(false);
    } finally {
      isSubmittingRef.current = false;
      setIsVerifying(false);
    }
  }, [code, isVerified, isVerifying, onVerificationSuccess, onVerifyOtp, otp]);

  useEffect(() => {
    if (
      otp.every(digit => digit !== "") &&
      !isVerifying &&
      !isVerified &&
      !isSubmittingRef.current &&
      code !== lastSubmittedCodeRef.current
    ) {
      handleVerify();
    }
  }, [code, handleVerify, isVerified, isVerifying, otp]);

  const handleResend = async () => {
    if (resendTimer > 0 || isResending) {
      return;
    }

    try {
      await onResendCode();
      setOtp(new Array(OTP_LENGTH).fill(""));
      setResendTimer(RESEND_COOLDOWN);
      setError(null);
      setIsVerified(false);
      lastSubmittedCodeRef.current = null;
      successScale.setValue(0.76);
      inputRefs.current[0]?.focus();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to resend the code."
      );
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: horizontalPadding },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.sheet, { maxWidth: sheetMaxWidth, marginTop: sheetOffset }]}>
            <Pressable onPress={onBackToAuth} style={styles.backLink}>
              <ArrowLeft color={theme.colors.mutedForeground} size={18} />
              <Text style={[styles.backText, { color: theme.colors.mutedForeground }]}>
                Change number
              </Text>
            </Pressable>

            <View style={[styles.hero, { marginBottom: heroBottomMargin }]}>
              <View style={[styles.heroIcon, { backgroundColor: theme.colors.accent }]}>
                {isVerified ? (
                  <Animated.View style={{ transform: [{ scale: successScale }] }}>
                    <CheckCircle2 color={theme.colors.success} size={30} />
                  </Animated.View>
                ) : isVerifying ? (
                  <Loader2 color={theme.colors.primary} size={28} />
                ) : (
                  <BookHeart color={theme.colors.primary} size={28} />
                )}
              </View>
              <Text style={[styles.title, { fontSize: titleSize, color: theme.colors.foreground }]}>
                {isVerified ? "Verified!" : "Enter verification code"}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.mutedForeground }]}>
                {isVerified
                  ? "Your phone number has been verified."
                  : `We sent a 6-digit code to ${phoneNumber}`}
              </Text>
            </View>

            <View style={[styles.otpRow, { gap: otpGap }]}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={el => {
                    inputRefs.current[index] = el;
                  }}
                  value={digit}
                  onChangeText={text => updateOtp(index, text)}
                  onKeyPress={({ nativeEvent }) =>
                    handleKeyDown(index, nativeEvent.key)
                  }
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={1}
                  editable={!isVerifying && !isVerified}
                  style={[
                    styles.otpInput,
                    { width: otpInputSize },
                    {
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
              <Text style={[styles.error, { color: theme.colors.destructive }]}>{error}</Text>
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
              disabled={isVerifying || isVerified || otp.some(digit => digit === "")}
              tone="accent"
            />

            <View style={styles.resendArea}>
              {resendTimer > 0 ? (
                <Text style={styles.resendTimer}>
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
                    {isResending ? "Sending..." : "Didn't receive a code? Resend"}
                  </Text>
                </Pressable>
              )}
            </View>

            {debugOtp ? (
              <Text style={[styles.devHint, { color: theme.colors.mutedForeground }]}>
                Test code: {debugOtp}
              </Text>
            ) : null}

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
    paddingVertical: 24,
    flexGrow: 1,
    justifyContent: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 32,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: "500",
  },
  hero: {
    alignItems: "center",
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 14,
  },
  otpInput: {
    height: 54,
    borderRadius: 12,
    borderWidth: 2,
    textAlign: "center",
    fontSize: 20,
  },
  error: {
    fontSize: 12,
    marginBottom: 14,
    textAlign: "center",
  },
  resendArea: {
    alignItems: "center",
    marginTop: 24,
  },
  resendTimer: {
    color: "#837D77",
    fontSize: 14,
  },
  resendTimerValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  resendLink: {
    fontSize: 14,
    fontWeight: "500",
  },
  resendLinkDisabled: {
    opacity: 0.6,
  },
  devHint: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
});
