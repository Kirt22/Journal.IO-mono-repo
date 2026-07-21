/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PrimaryButton from '../src/components/PrimaryButton';
import CreateAccountScreen from '../src/screens/auth/CreateAccountScreen';
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

describe('CreateAccountScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('shows the password rule bubble on tap and blocks invalid signup submits', async () => {
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
        </SafeAreaProvider>,
      );
    });

    expect(
      root!.root.findByProps({ testID: 'auth-ink-backdrop' }),
    ).toBeTruthy();
    expect(
      root!.root.findByProps({ testID: 'auth-create-account-action-icon' }),
    ).toBeTruthy();
    expect(
      root!.root.findByProps({ testID: 'create-account-back-row' }),
    ).toBeTruthy();
    expect(
      StyleSheet.flatten(
        root!.root.findByProps({
          testID: 'create-account-centered-scroll',
        }).props.contentContainerStyle,
      ).justifyContent,
    ).toBe('center');
    expect(
      root!.root.findAllByProps({ testID: 'password-rule-bubble' }),
    ).toHaveLength(0);

    const passwordRuleButton = root!.root.findByProps({
      testID: 'password-rule-toggle',
    });
    const submitButton = root!.root.findByType(PrimaryButton);

    await ReactTestRenderer.act(async () => {
      passwordRuleButton.props.onPress();
    });

    expect(
      root!.root.findByProps({ testID: 'password-rule-bubble' }),
    ).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      await submitButton.props.onPress();
      await Promise.resolve();
    });

    const bannerTree = JSON.stringify(root!.toJSON());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(bannerTree).toContain('Email is required.');
    expect(bannerTree).not.toContain('Password is required.');
    expect(bannerTree).not.toContain('Confirm your password.');
    expect(bannerTree.match(/create-account-error-notice/g)).toHaveLength(1);

    const emailInput = root!.root.findByProps({
      placeholder: 'you@example.com',
    });
    const passwordInput = root!.root.findByProps({
      placeholder: 'Create a password',
    });
    const confirmPasswordInput = root!.root.findByProps({
      placeholder: 'Re-enter your password',
    });

    await ReactTestRenderer.act(async () => {
      emailInput.props.onChangeText('alex@example.com');
      passwordInput.props.onChangeText('password123');
      confirmPasswordInput.props.onChangeText('password123');
    });

    await ReactTestRenderer.act(async () => {
      await submitButton.props.onPress();
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'alex@example.com',
      password: 'password123',
    });
    expect(JSON.stringify(root!.toJSON())).toContain(
      'Verification code has been sent.',
    );

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(1400);
    });
  });

  test('does not advance when the backend signup call fails', async () => {
    const onSubmit = jest.fn(async () => {
      throw new ApiError('Raw backend registration copy', {
        code: 'EMAIL_ALREADY_REGISTERED',
        status: 409,
      });
    });
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
        </SafeAreaProvider>,
      );
    });

    const emailInput = root!.root.findByProps({
      placeholder: 'you@example.com',
    });
    const passwordInput = root!.root.findByProps({
      placeholder: 'Create a password',
    });
    const confirmPasswordInput = root!.root.findByProps({
      placeholder: 'Re-enter your password',
    });
    const submitButton = root!.root.findByType(PrimaryButton);

    await ReactTestRenderer.act(async () => {
      emailInput.props.onChangeText('alex@example.com');
      passwordInput.props.onChangeText('password123');
      confirmPasswordInput.props.onChangeText('password123');
    });

    await ReactTestRenderer.act(async () => {
      await submitButton.props.onPress();
      await Promise.resolve();
    });

    const tree = JSON.stringify(root!.toJSON());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(tree).toContain(
      'An account already exists for this email. Sign in instead.',
    );
    expect(tree).not.toContain('Raw backend registration copy');
    expect(tree).not.toContain('Verification code has been sent.');
  });
});
