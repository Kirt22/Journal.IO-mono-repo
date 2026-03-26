/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import PrimaryButton from "../src/components/PrimaryButton";
import CreateAccountScreen from "../src/screens/auth/CreateAccountScreen";

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

describe("CreateAccountScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("shows the password rule bubble on tap and blocks invalid signup submits", async () => {
    const onSubmit = jest.fn(async () => undefined);
    const onSuccess = jest.fn();

    let root: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      root = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={safeAreaMetrics}>
          <CreateAccountScreen
            onSubmit={onSubmit}
            onSuccess={onSuccess}
            onBackToAuth={jest.fn()}
            onGoToSignIn={jest.fn()}
          />
        </SafeAreaProvider>
      );
    });

    expect(root!.root.findAllByProps({ testID: "password-rule-bubble" })).toHaveLength(0);

    const passwordRuleButton = root!.root.findByProps({
      testID: "password-rule-toggle",
    });
    const submitButton = root!.root.findByType(PrimaryButton);

    await ReactTestRenderer.act(async () => {
      passwordRuleButton.props.onPress();
    });

    expect(root!.root.findByProps({ testID: "password-rule-bubble" })).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      await submitButton.props.onPress();
      await Promise.resolve();
    });

    const bannerTree = JSON.stringify(root!.toJSON());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(bannerTree).toContain("Email is required.");
    expect(bannerTree).toContain("Password is required.");
    expect(bannerTree).toContain("Confirm your password.");

    const emailInput = root!.root.findByProps({ placeholder: "you@example.com" });
    const passwordInput = root!.root.findByProps({ placeholder: "Create a password" });
    const confirmPasswordInput = root!.root.findByProps({
      placeholder: "Re-enter your password",
    });

    await ReactTestRenderer.act(async () => {
      emailInput.props.onChangeText("alex@example.com");
      passwordInput.props.onChangeText("password123");
      confirmPasswordInput.props.onChangeText("password123");
    });

    await ReactTestRenderer.act(async () => {
      await submitButton.props.onPress();
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledWith({
      email: "alex@example.com",
      password: "password123",
    });
    expect(JSON.stringify(root!.toJSON())).toContain("Verification code has been sent.");

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(1400);
    });
  });
});
