import React, { useState } from "react";
import { StyleSheet, Text, View } from "../infrastructure/reactNative";
import PrimaryButton from "../components/PrimaryButton";
import TextField from "../components/TextField";
import { AuthSession, signInWithGoogle } from "../services/authService";
import LoginScreen from "./LoginScreen";
import SignupScreen from "./SignupScreen";

const AuthScreen = () => {
  const [mode, setMode] = useState<"login" | "signup" | "google">("login");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [googleName, setGoogleName] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleUserId, setGoogleUserId] = useState("");
  const [googleIdToken, setGoogleIdToken] = useState("");
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const handleGoogleSubmit = async () => {
    if (!googleName || !googleEmail || !googleIdToken) {
      setGoogleError("Name, email, and Google ID token are required.");
      return;
    }

    setGoogleSubmitting(true);
    setGoogleError(null);

    try {
      const nextSession = await signInWithGoogle({
        name: googleName,
        email: googleEmail,
        googleIdToken,
        googleUserId: googleUserId || undefined,
      });
      setSession(nextSession);
    } catch (err) {
      setGoogleError(
        err instanceof Error ? err.message : "Google sign-in failed."
      );
    } finally {
      setGoogleSubmitting(false);
    }
  };

  if (session) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successTitle}>You're signed in.</Text>
        <Text style={styles.successSubtitle}>
          Welcome, {session.user.name}.
        </Text>
        <Text style={styles.successMeta}>
          Primary login: {session.user.phoneNumber || "Google account"}
        </Text>
      </View>
    );
  }

  if (mode === "signup") {
    return (
      <SignupScreen
        onSwitchToLogin={() => setMode("login")}
        onSwitchToGoogle={() => setMode("google")}
        onSignupSuccess={setSession}
      />
    );
  }

  if (mode === "google") {
    return (
      <View style={styles.googleContainer}>
        <Text style={styles.successTitle}>Continue with Google</Text>
        <Text style={styles.googleSubtitle}>
          This build exposes the backend Google OAuth entry point. Until the
          native Google SDK is wired in, enter the post-OAuth payload here.
        </Text>

        <View style={styles.googleCard}>
          <TextField
            label="Name"
            value={googleName}
            onChangeText={setGoogleName}
            placeholder="Google profile name"
            autoCapitalize="words"
            textContentType="name"
          />
          <TextField
            label="Email"
            value={googleEmail}
            onChangeText={setGoogleEmail}
            placeholder="you@gmail.com"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextField
            label="Google user ID"
            value={googleUserId}
            onChangeText={setGoogleUserId}
            placeholder="Optional stable Google user ID"
          />
          <TextField
            label="Google ID token"
            value={googleIdToken}
            onChangeText={setGoogleIdToken}
            placeholder="Paste Google ID token"
          />

          {googleError ? <Text style={styles.error}>{googleError}</Text> : null}

          <PrimaryButton
            label="Sign in with Google"
            onPress={handleGoogleSubmit}
            loading={googleSubmitting}
            disabled={!googleName || !googleEmail || !googleIdToken}
          />

          <View style={styles.googleActions}>
            <Text style={styles.footerLink} onPress={() => setMode("login")}>
              Back to phone login
            </Text>
            <Text style={styles.footerLink} onPress={() => setMode("signup")}>
              Create account with phone
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <LoginScreen
      onSwitchToSignup={() => setMode("signup")}
      onSwitchToGoogle={() => setMode("google")}
      onLoginSuccess={setSession}
    />
  );
};

const styles = StyleSheet.create({
  successContainer: {
    flex: 1,
    backgroundColor: "#F6F7F2",
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "600",
    color: "#1C221B",
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 15,
    color: "#556055",
  },
  successMeta: {
    fontSize: 14,
    color: "#556055",
    marginTop: 12,
  },
  googleContainer: {
    flex: 1,
    backgroundColor: "#F6F7F2",
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  googleSubtitle: {
    fontSize: 15,
    color: "#556055",
    marginBottom: 24,
    lineHeight: 22,
  },
  googleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },
  googleActions: {
    marginTop: 18,
    gap: 12,
  },
  footerLink: {
    color: "#2D6FA3",
    fontWeight: "600",
  },
  error: {
    color: "#C05A4A",
    marginBottom: 12,
  },
});

export default AuthScreen;
