/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ForgotPasswordScreen from "../src/screens/auth/ForgotPasswordScreen";

const safeAreaMetrics = {
  frame: {
    x: 0,
    y: 0,
    width: 390,
    height: 844,
  },
  insets: {
    top: 47,
    bottom: 34,
    left: 0,
    right: 0,
  },
};

describe("ForgotPasswordScreen", () => {
  let root: ReactTestRenderer.ReactTestRenderer | null = null;

  afterEach(async () => {
    await ReactTestRenderer.act(async () => {
      root?.unmount();
    });
    root = null;
  });

  test("shows the local reset action when a dev reset link is returned", async () => {
    const onSubmit = jest.fn(async () => ({
      email: "alex@example.com",
      expiresInSeconds: 1800,
      resetLink: "http://localhost:3000/reset-password?token=abc",
    }));

    await ReactTestRenderer.act(() => {
      root = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={safeAreaMetrics}>
          <ForgotPasswordScreen
            onSubmit={onSubmit}
            onBackToSignIn={jest.fn()}
          />
        </SafeAreaProvider>
      );
    });

    const emailInput = root!.root.findByProps({ placeholder: "you@example.com" });

    await ReactTestRenderer.act(async () => {
      emailInput.props.onChangeText("alex@example.com");
    });

    const sendButton = root!.root.findByProps({ label: "Send Reset Link" });

    await ReactTestRenderer.act(async () => {
      sendButton.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    const screenText = JSON.stringify(root!.toJSON());

    expect(onSubmit).toHaveBeenCalledWith({ email: "alex@example.com" });
    expect(screenText).toContain("Reset link ready");
    expect(screenText).toContain("Open Reset Page");
    expect(screenText).toContain("Local testing");
  });

  test("shows the generic email confirmation when no local reset link is returned", async () => {
    const onSubmit = jest.fn(async () => ({
      email: "missing@example.com",
      expiresInSeconds: 1800,
    }));

    await ReactTestRenderer.act(() => {
      root = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={safeAreaMetrics}>
          <ForgotPasswordScreen
            onSubmit={onSubmit}
            onBackToSignIn={jest.fn()}
          />
        </SafeAreaProvider>
      );
    });

    const emailInput = root!.root.findByProps({ placeholder: "you@example.com" });

    await ReactTestRenderer.act(async () => {
      emailInput.props.onChangeText("missing@example.com");
    });

    const sendButton = root!.root.findByProps({ label: "Send Reset Link" });

    await ReactTestRenderer.act(async () => {
      sendButton.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    const screenText = JSON.stringify(root!.toJSON());

    expect(screenText).toContain("Check your email");
    expect(screenText).toContain("Reset email sent");
    expect(screenText).toContain("password reset email is on the way");
    expect(screenText).toContain("Try Another Email");
  });

  test("shows a local failure when the backend says no reset was issued", async () => {
    const onSubmit = jest.fn(async () => ({
      email: "missing@example.com",
      expiresInSeconds: 1800,
      resetIssued: false,
      resetSkippedReason: "user_not_found" as const,
    }));

    await ReactTestRenderer.act(() => {
      root = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={safeAreaMetrics}>
          <ForgotPasswordScreen
            onSubmit={onSubmit}
            onBackToSignIn={jest.fn()}
          />
        </SafeAreaProvider>
      );
    });

    const emailInput = root!.root.findByProps({ placeholder: "you@example.com" });

    await ReactTestRenderer.act(async () => {
      emailInput.props.onChangeText("missing@example.com");
    });

    const sendButton = root!.root.findByProps({ label: "Send Reset Link" });

    await ReactTestRenderer.act(async () => {
      sendButton.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    const screenText = JSON.stringify(root!.toJSON());

    expect(screenText).toContain("Email not found");
    expect(screenText).toContain("Request failed");
    expect(screenText).toContain("not registered in this local backend");
    expect(screenText).toContain("Try Another Email");
  });
});
