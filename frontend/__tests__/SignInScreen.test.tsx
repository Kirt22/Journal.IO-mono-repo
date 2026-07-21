import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PrimaryButton from '../src/components/PrimaryButton';
import SignInScreen from '../src/screens/auth/SignInScreen';
import { ApiError } from '../src/utils/apiClient';

jest.mock('../src/components/AuthInkBackdrop', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: () =>
      ReactModule.createElement(View, { testID: 'auth-ink-backdrop' }),
  };
});

jest.mock('../src/components/WavingHandIcon', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: ({ testID }: { testID?: string }) =>
      ReactModule.createElement(View, { testID }),
  };
});

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

const renderSignIn = (
  onSubmit: (payload: { email: string; password: string }) => Promise<void>,
) =>
  ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <SignInScreen
        onSubmit={onSubmit}
        onBackToAuth={jest.fn()}
        onGoToCreateAccount={jest.fn()}
        onForgotPassword={jest.fn()}
      />
    </SafeAreaProvider>,
  );

describe('SignInScreen auth errors', () => {
  let root: ReactTestRenderer.ReactTestRenderer | null = null;

  afterEach(() => {
    ReactTestRenderer.act(() => root?.unmount());
    root = null;
  });

  test('shows one prioritized notice while highlighting every invalid field', async () => {
    const onSubmit = jest.fn(async () => undefined);

    await ReactTestRenderer.act(async () => {
      root = renderSignIn(onSubmit);
      await Promise.resolve();
    });

    const submitButton = root!.root.findByType(PrimaryButton);
    await ReactTestRenderer.act(async () => {
      await submitButton.props.onPress();
      await Promise.resolve();
    });

    const initialTree = JSON.stringify(root!.toJSON());
    const emailInput = root!.root.findByProps({
      placeholder: 'you@example.com',
    });
    const passwordInput = root!.root.findByProps({
      placeholder: 'Enter your password',
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(initialTree).toContain('Email is required.');
    expect(initialTree).not.toContain('Password is required.');
    expect(StyleSheet.flatten(emailInput.props.style).borderColor).toBe(
      '#D4183D',
    );
    expect(StyleSheet.flatten(passwordInput.props.style).borderColor).toBe(
      '#D4183D',
    );

    await ReactTestRenderer.act(async () => {
      emailInput.props.onChangeText('alex@example.com');
      await Promise.resolve();
    });

    expect(JSON.stringify(root!.toJSON())).toContain('Password is required.');
    expect(
      JSON.stringify(root!.toJSON()).match(/sign-in-error-notice/g),
    ).toHaveLength(1);
  });

  test('standardizes invalid credentials inside the shared notice', async () => {
    const onSubmit = jest.fn(async () => {
      throw new ApiError('Backend credential text', {
        code: 'INVALID_CREDENTIALS',
        status: 401,
      });
    });

    await ReactTestRenderer.act(async () => {
      root = renderSignIn(onSubmit);
      await Promise.resolve();
    });

    const emailInput = root!.root.findByProps({
      placeholder: 'you@example.com',
    });
    const passwordInput = root!.root.findByProps({
      placeholder: 'Enter your password',
    });

    await ReactTestRenderer.act(async () => {
      emailInput.props.onChangeText('alex@example.com');
      passwordInput.props.onChangeText('wrong-password');
      await Promise.resolve();
    });

    await ReactTestRenderer.act(async () => {
      await root!.root.findByType(PrimaryButton).props.onPress();
      await Promise.resolve();
    });

    const tree = JSON.stringify(root!.toJSON());
    expect(tree).toContain("That email or password doesn't look right.");
    expect(tree).not.toContain('Backend credential text');
    expect(
      root!.root.findAllByProps({ testID: 'auth-error-dialog' }),
    ).toHaveLength(0);
  });

  test('defers network failures to the global connectivity gate', async () => {
    const onSubmit = jest.fn(async () => {
      throw new ApiError('Network request failed', { isNetworkError: true });
    });

    await ReactTestRenderer.act(async () => {
      root = renderSignIn(onSubmit);
      await Promise.resolve();
    });

    const emailInput = root!.root.findByProps({
      placeholder: 'you@example.com',
    });
    const passwordInput = root!.root.findByProps({
      placeholder: 'Enter your password',
    });

    await ReactTestRenderer.act(async () => {
      emailInput.props.onChangeText('alex@example.com');
      passwordInput.props.onChangeText('password123');
      await Promise.resolve();
    });

    await ReactTestRenderer.act(async () => {
      await root!.root.findByType(PrimaryButton).props.onPress();
      await Promise.resolve();
    });

    expect(
      root!.root.findAllByProps({ testID: 'auth-error-dialog' }),
    ).toHaveLength(0);
    expect(JSON.stringify(root!.toJSON())).not.toContain('Network request failed');
  });
});
