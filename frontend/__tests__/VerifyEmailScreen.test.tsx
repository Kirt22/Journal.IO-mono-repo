/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import VerifyEmailScreen from "../src/screens/auth/VerifyEmailScreen";

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

describe("VerifyEmailScreen", () => {
  let root: ReactTestRenderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await ReactTestRenderer.act(async () => {
      root?.unmount();
      jest.runOnlyPendingTimers();
    });
    root = null;
    jest.useRealTimers();
  });

  test("shows the verification success state and advances automatically", async () => {
    const onVerifyEmail = jest.fn(async () => undefined);
    const onVerificationSuccess = jest.fn();

    await ReactTestRenderer.act(() => {
      root = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={safeAreaMetrics}>
          <VerifyEmailScreen
            email="alex@example.com"
            onVerifyEmail={onVerifyEmail}
            onVerificationSuccess={onVerificationSuccess}
            onResendCode={jest.fn(async () => undefined)}
            onBackToCreateAccount={jest.fn()}
          />
        </SafeAreaProvider>
      );
    });

    const codeInputs = root!.root.findAllByProps({ maxLength: 1 });
    await ReactTestRenderer.act(async () => {
      codeInputs[0].props.onChangeText("123456");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onVerifyEmail).toHaveBeenCalledWith("123456");
    expect(onVerificationSuccess).not.toHaveBeenCalled();
    expect(JSON.stringify(root!.toJSON())).toContain("Email Verified");
    expect(JSON.stringify(root!.toJSON())).toContain("Continue Setup");

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(onVerificationSuccess).toHaveBeenCalledTimes(1);
  });
});
