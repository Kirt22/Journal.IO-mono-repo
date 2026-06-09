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
    expect(screenText).toContain("Reset link sent");
    expect(screenText).toContain("Open Reset Page");
    expect(screenText).toContain("Local testing");
  });

  test("shows a local not-issued message when no reset link is returned", async () => {
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

    expect(screenText).toContain("No reset link was issued");
    expect(screenText).toContain("No registered and verified account was eligible");
    expect(screenText).toContain("Try Another Email");
  });
});
