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

type SignupScreenProps = {
  onSwitchToLogin: () => void;
  onSwitchToGoogle: () => void;
  onSignupSuccess: (payload: AuthSession) => void;
};

const SignupScreen = ({
  onSwitchToLogin,
  onSwitchToGoogle,
  onSignupSuccess,
}: SignupScreenProps) => {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async () => {
    if (!name || !phoneNumber) {
      setError("Please enter your name and phone number.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data = await sendOtp({ phoneNumber });
      setCodeSent(true);
      setDebugOtp(data.debugOtp || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!name || !phoneNumber || !otp) {
      setError("Please complete the full sign-up flow.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data = await verifyOtp({ phoneNumber, otp, name });
      onSignupSuccess(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to verify your code."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Start with your phone number, then verify once to create your account.
        </Text>

        <View style={styles.card}>
          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
            textContentType="name"
          />
          <TextField
            label="Phone number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="+15551234567"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            helperText={debugOtp ? `Debug code: ${debugOtp}` : null}
          />

          {codeSent ? (
            <TextField
              label="Verification code"
              value={otp}
              onChangeText={setOtp}
              placeholder="6-digit code"
              textContentType="oneTimeCode"
            />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            label={codeSent ? "Create account" : "Send code"}
            onPress={codeSent ? handleVerifyOtp : handleSendOtp}
            loading={isSubmitting}
            disabled={!name || !phoneNumber || (codeSent && !otp)}
          />

          <View style={styles.divider}>
            <View style={styles.rule} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.rule} />
          </View>

          <PrimaryButton
            label="Continue with Google"
            onPress={onSwitchToGoogle}
            variant="outline"
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Text style={styles.footerLink} onPress={onSwitchToLogin}>
            Log in with phone
          </Text>
        </View>
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
    paddingTop: 40,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: "#1C221B",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#556055",
    marginBottom: 24,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  error: {
    color: "#C05A4A",
    marginBottom: 12,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E4DC",
  },
  dividerText: {
    marginHorizontal: 12,
    color: "#556055",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    color: "#556055",
    marginRight: 4,
  },
  footerLink: {
    color: "#2D6FA3",
    fontWeight: "600",
  },
});

export default SignupScreen;
