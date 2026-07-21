/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ResetPasswordScreen from '../src/screens/auth/ResetPasswordScreen';
import { ApiError } from '../src/utils/apiClient';

jest.mock('../src/components/AuthInkBackdrop', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: () =>
      ReactModule.createElement(View, {
        testID: 'auth-ink-backdrop',
      }),
  };
});

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

const renderResetPassword = (
  onSubmit: (payload: { token: string; password: string }) => Promise<void>,
  onBackToSignIn = jest.fn(),
) =>
  ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <ResetPasswordScreen
        token="reset-token"
        onSubmit={onSubmit}
        onBackToSignIn={onBackToSignIn}
      />
    </SafeAreaProvider>,
  );

describe('ResetPasswordScreen', () => {
  let root: ReactTestRenderer.ReactTestRenderer | null = null;
  let reduceMotionSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    reduceMotionSpy = jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
  });

  afterEach(() => {
    ReactTestRenderer.act(() => {
      root?.unmount();
    });
    root = null;
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('keeps the back row fixed while centering the reset form', async () => {
    await ReactTestRenderer.act(async () => {
      root = renderResetPassword(jest.fn(async () => undefined));
      await Promise.resolve();
    });

    expect(
      root!.root.findByProps({ testID: 'auth-ink-backdrop' }),
    ).toBeTruthy();
    expect(
      root!.root.findByProps({ testID: 'reset-password-back-row' }),
    ).toBeTruthy();
    expect(
      StyleSheet.flatten(
        root!.root.findByProps({
          testID: 'reset-password-centered-scroll',
        }).props.contentContainerStyle,
      ).justifyContent,
    ).toBe('center');
    expect(
      root!.root.findByProps({ testID: 'reset-password-hero-entrance' }),
    ).toBeTruthy();
    expect(
      root!.root.findByProps({ testID: 'reset-password-form-entrance' }),
    ).toBeTruthy();
  });

  test('reveals success after the API resolves and automatically returns to sign in', async () => {
    const onSubmit = jest.fn(async () => undefined);
    const onBackToSignIn = jest.fn();

    await ReactTestRenderer.act(async () => {
      root = renderResetPassword(onSubmit, onBackToSignIn);
      await Promise.resolve();
    });

    const passwordInput = root!.root.findByProps({
      placeholder: 'Enter a new password',
    });
    const confirmPasswordInput = root!.root.findByProps({
      placeholder: 'Re-enter your password',
    });

    await ReactTestRenderer.act(async () => {
      passwordInput.props.onChangeText('new-password');
      confirmPasswordInput.props.onChangeText('new-password');
    });

    await ReactTestRenderer.act(async () => {
      await root!.root.findByProps({ label: 'Reset Password' }).props.onPress();
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledWith({
      token: 'reset-token',
      password: 'new-password',
    });
    expect(
      root!.root.findByProps({ testID: 'reset-password-success-card' }),
    ).toBeTruthy();
    expect(JSON.stringify(root!.toJSON())).toContain(
      'Taking you to sign in...',
    );
    expect(onBackToSignIn).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(1599);
      await Promise.resolve();
    });
    expect(onBackToSignIn).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(onBackToSignIn).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    expect(onBackToSignIn).toHaveBeenCalledTimes(1);
  });

  test('shows one prioritized validation notice for the reset fields', async () => {
    const onSubmit = jest.fn(async () => undefined);

    await ReactTestRenderer.act(async () => {
      root = renderResetPassword(onSubmit);
      await Promise.resolve();
    });

    await ReactTestRenderer.act(async () => {
      await root!.root.findByProps({ label: 'Reset Password' }).props.onPress();
      await Promise.resolve();
    });

    const tree = JSON.stringify(root!.toJSON());
    const passwordInput = root!.root.findByProps({
      placeholder: 'Enter a new password',
    });
    const confirmPasswordInput = root!.root.findByProps({
      placeholder: 'Re-enter your password',
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(tree).toContain('Password is required.');
    expect(tree).not.toContain('Confirm your password.');
    expect(StyleSheet.flatten(passwordInput.props.style).borderColor).toBe(
      '#D4183D',
    );
    expect(
      StyleSheet.flatten(confirmPasswordInput.props.style).borderColor,
    ).toBe('#D4183D');
  });

  test('keeps the user on the form when the reset API fails', async () => {
    const onSubmit = jest.fn(async () => {
      throw new ApiError('Raw reset-token copy', {
        code: 'PASSWORD_RESET_TOKEN_INVALID',
        status: 400,
      });
    });
    const onBackToSignIn = jest.fn();

    await ReactTestRenderer.act(async () => {
      root = renderResetPassword(onSubmit, onBackToSignIn);
      await Promise.resolve();
    });

    const passwordInput = root!.root.findByProps({
      placeholder: 'Enter a new password',
    });
    const confirmPasswordInput = root!.root.findByProps({
      placeholder: 'Re-enter your password',
    });

    await ReactTestRenderer.act(async () => {
      passwordInput.props.onChangeText('new-password');
      confirmPasswordInput.props.onChangeText('new-password');
    });

    await ReactTestRenderer.act(async () => {
      await root!.root.findByProps({ label: 'Reset Password' }).props.onPress();
      await Promise.resolve();
    });

    expect(JSON.stringify(root!.toJSON())).toContain(
      'That reset link is invalid or has expired. Request a new one.',
    );
    expect(JSON.stringify(root!.toJSON())).not.toContain(
      'Raw reset-token copy',
    );
    expect(
      root!.root.findAllByProps({ testID: 'reset-password-success-card' }),
    ).toHaveLength(0);

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    expect(onBackToSignIn).not.toHaveBeenCalled();
  });

  test('shows settled states without entrance animation under Reduce Motion', async () => {
    const staggerSpy = jest.spyOn(Animated, 'stagger');
    reduceMotionSpy.mockResolvedValue(true);
    const onBackToSignIn = jest.fn();

    await ReactTestRenderer.act(async () => {
      root = renderResetPassword(
        jest.fn(async () => undefined),
        onBackToSignIn,
      );
      await Promise.resolve();
    });

    expect(staggerSpy).not.toHaveBeenCalled();

    const passwordInput = root!.root.findByProps({
      placeholder: 'Enter a new password',
    });
    const confirmPasswordInput = root!.root.findByProps({
      placeholder: 'Re-enter your password',
    });

    await ReactTestRenderer.act(async () => {
      passwordInput.props.onChangeText('new-password');
      confirmPasswordInput.props.onChangeText('new-password');
    });

    await ReactTestRenderer.act(async () => {
      await root!.root.findByProps({ label: 'Reset Password' }).props.onPress();
      await Promise.resolve();
    });

    expect(staggerSpy).not.toHaveBeenCalled();
    expect(
      root!.root.findByProps({ testID: 'reset-password-success-card' }),
    ).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(1600);
      await Promise.resolve();
    });
    expect(onBackToSignIn).toHaveBeenCalledTimes(1);
  });
});
