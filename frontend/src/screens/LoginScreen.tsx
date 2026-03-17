import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "../infrastructure/reactNative";
import PrimaryButton from "../components/PrimaryButton";
import TextField from "../components/TextField";
import { AuthSession, sendOtp, verifyOtp } from "../services/authService";

type LoginScreenProps = {
  onSwitchToSignup: () => void;
  onSwitchToGoogle: () => void;
  onLoginSuccess: (payload: AuthSession) => void;
};

const LoginScreen = ({
  onSwitchToSignup,
  onSwitchToGoogle,
  onLoginSuccess,
}: LoginScreenProps) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [step, setStep] = useState<"welcome" | "phone" | "otp">("welcome");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async () => {
    if (!phoneNumber) {
      setError("Please enter your phone number.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data = await sendOtp({ phoneNumber });
      setStep("otp");
      setOtp("");
      setDebugOtp(data.debugOtp || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!phoneNumber || !otp) {
      setError("Please enter your phone number and code.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data = await verifyOtp({ phoneNumber, otp });
      onLoginSuccess(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to verify your code."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPhone = () => {
    setError(null);
    setStep("phone");
    setOtp("");
  };

  const handleBackToWelcome = () => {
    setError(null);
    setStep("welcome");
    setOtp("");
  };

  const renderWelcome = () => (
    <View style={styles.heroShell}>
      <View style={styles.heroTop}>
        <View style={styles.topBar}>
          <Text style={styles.topBarLogo}>journal.io</Text>
          <View style={styles.topBarLinks}>
            <Text style={styles.topBarLink}>Politics</Text>
            <Text style={styles.topBarLink}>Tech</Text>
            <Text style={styles.topBarLink}>Science</Text>
            <Text style={styles.topBarLink}>Culture</Text>
          </View>
        </View>

        <View style={styles.wordmarkWrap}>
          <Text style={styles.wordmark}>
            j<Text style={styles.wordmarkRest}>ournal.</Text>
            <Text style={styles.wordmarkAccent}>IO</Text>
          </Text>
          <View style={styles.wordmarkUnderline} />
        </View>

        <Text style={styles.welcomeHeadline}>
          Welcome to your personal journal.
        </Text>
      </View>

      <View style={styles.heroActions}>
        <PrimaryButton
          label="Continue with Google"
          onPress={onSwitchToGoogle}
          variant="outline"
        />
        <PrimaryButton
          label="Continue with Phone Number"
          onPress={() => setStep("phone")}
        />

        <View style={styles.separator}>
          <View style={styles.separatorRule} />
          <Text style={styles.separatorText}>or</Text>
          <View style={styles.separatorRule} />
        </View>

        <PrimaryButton
          label="Create account with phone"
          onPress={onSwitchToSignup}
          variant="ghost"
        />

        <Text style={styles.termsText}>
          By continuing, you agree to journal.io&apos;s{" "}
          <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
          <Text style={styles.termsLink}>Privacy Policy</Text>.
        </Text>
      </View>
    </View>
  );

  const renderPhoneStep = () => (
    <View style={styles.stepShell}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepEyebrow}>Phone sign in</Text>
        <Text style={styles.title}>Enter your number</Text>
        <Text style={styles.subtitle}>
          We&apos;ll text you a one-time code. This keeps sign in simple without
          asking for a password.
        </Text>
      </View>

      <View style={styles.card}>
        <TextField
          label="Phone number"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="+1 555 123 4567"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoFocus
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label="Send code"
          onPress={handleSendOtp}
          loading={isSubmitting}
          disabled={!phoneNumber}
        />
        <PrimaryButton
          label="Back"
          onPress={handleBackToWelcome}
          variant="ghost"
        />
      </View>
    </View>
  );

  const renderOtpStep = () => (
    <View style={styles.stepShell}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepEyebrow}>Verification</Text>
        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to {phoneNumber}. Enter it below to continue.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.phoneBadge}>
          <Text style={styles.phoneBadgeLabel}>Sending code to</Text>
          <Text style={styles.phoneBadgeValue}>{phoneNumber}</Text>
        </View>

        <TextField
          label="Verification code"
          value={otp}
          onChangeText={setOtp}
          placeholder="6-digit code"
          textContentType="oneTimeCode"
          keyboardType="phone-pad"
          helperText={debugOtp ? `Debug code: ${debugOtp}` : null}
          autoFocus
          maxLength={6}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label="Verify code"
          onPress={handleVerifyOtp}
          loading={isSubmitting}
          disabled={!otp || otp.length < 4}
        />

        <View style={styles.inlineActions}>
          <Text style={styles.inlineLink} onPress={handleEditPhone}>
            Edit number
          </Text>
          <Text style={styles.inlineLink} onPress={handleSendOtp}>
            Resend code
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {step === "welcome" ? renderWelcome() : null}
        {step === "phone" ? renderPhoneStep() : null}
        {step === "otp" ? renderOtpStep() : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F7F2",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    flexGrow: 1,
  },
  heroShell: {
    flex: 1,
    justifyContent: "space-between",
    gap: 28,
    paddingTop: 12,
  },
  heroTop: {
    gap: 20,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  topBarLogo: {
    color: "#1F2937",
    fontSize: 20,
    fontWeight: "700",
  },
  topBarLinks: {
    flexDirection: "row",
    gap: 12,
    display: "none",
  },
  topBarLink: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "500",
  },
  wordmarkWrap: {
    alignItems: "center",
    marginBottom: 8,
  },
  wordmark: {
    color: "#0F172A",
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "800",
    letterSpacing: -2,
  },
  wordmarkRest: {
    color: "#0F172A",
  },
  wordmarkAccent: {
    color: "#13DAEC",
  },
  wordmarkUnderline: {
    width: 104,
    height: 6,
    backgroundColor: "#13DAEC",
    borderRadius: 999,
    marginTop: 6,
  },
  welcomeHeadline: {
    color: "#4B5563",
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 320,
    alignSelf: "center",
  },
  heroActions: {
    gap: 12,
    width: "100%",
  },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  separatorRule: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  separatorText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
    marginHorizontal: 16,
  },
  termsText: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 12,
  },
  termsLink: {
    color: "#374151",
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  stepShell: {
    gap: 24,
    paddingTop: 48,
  },
  stepHeader: {
    gap: 8,
  },
  stepEyebrow: {
    color: "#556055",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1C221B",
  },
  subtitle: {
    fontSize: 15,
    color: "#556055",
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E0E4DC",
  },
  error: {
    color: "#C05A4A",
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  footerText: {
    color: "#556055",
    marginRight: 4,
  },
  footerLink: {
    color: "#2D6FA3",
    fontWeight: "600",
  },
  phoneBadge: {
    backgroundColor: "#F1F4EE",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
  },
  phoneBadgeLabel: {
    color: "#556055",
    fontSize: 12,
    marginBottom: 4,
  },
  phoneBadgeValue: {
    color: "#1C221B",
    fontSize: 16,
    fontWeight: "600",
  },
  inlineActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  inlineLink: {
    color: "#2D6FA3",
    fontWeight: "600",
  },
});

export default LoginScreen;
