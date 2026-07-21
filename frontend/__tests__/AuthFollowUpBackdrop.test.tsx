/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ActionSuccessScreen from '../src/components/ActionSuccessScreen';
import ResetPasswordScreen from '../src/screens/auth/ResetPasswordScreen';
import SignInScreen from '../src/screens/auth/SignInScreen';

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

const renderWithSafeArea = (screen: React.ReactElement) =>
  ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      {screen}
    </SafeAreaProvider>,
  );

test('keeps the shared ink backdrop and centered body on sign-in and native reset screens', () => {
  let signInRoot: ReactTestRenderer.ReactTestRenderer;
  let resetRoot: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    signInRoot = renderWithSafeArea(
      <SignInScreen
        onSubmit={jest.fn(async () => undefined)}
        onBackToAuth={jest.fn()}
        onGoToCreateAccount={jest.fn()}
        onForgotPassword={jest.fn()}
      />,
    );
    resetRoot = renderWithSafeArea(
      <ResetPasswordScreen
        token="reset-token"
        onSubmit={jest.fn(async () => undefined)}
        onBackToSignIn={jest.fn()}
      />,
    );
  });

  expect(
    signInRoot!.root.findByProps({ testID: 'auth-ink-backdrop' }),
  ).toBeTruthy();
  expect(
    resetRoot!.root.findByProps({ testID: 'auth-ink-backdrop' }),
  ).toBeTruthy();
  expect(
    signInRoot!.root.findByProps({ testID: 'sign-in-back-row' }),
  ).toBeTruthy();
  expect(
    StyleSheet.flatten(
      signInRoot!.root.findByProps({
        testID: 'sign-in-centered-scroll',
      }).props.contentContainerStyle,
    ).justifyContent,
  ).toBe('center');
  expect(
    signInRoot!.root.findByProps({ testID: 'sign-in-waving-hand-icon' }),
  ).toBeTruthy();

  ReactTestRenderer.act(() => {
    signInRoot!.unmount();
    resetRoot!.unmount();
  });
});

test('uses the shared ink backdrop only for the OTP success variant', () => {
  let otpRoot: ReactTestRenderer.ReactTestRenderer;
  let genericRoot: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    otpRoot = renderWithSafeArea(
      <ActionSuccessScreen variant="otp" onPrimaryAction={jest.fn()} />,
    );
    genericRoot = renderWithSafeArea(
      <ActionSuccessScreen variant="generic" onPrimaryAction={jest.fn()} />,
    );
  });

  expect(
    otpRoot!.root.findByProps({ testID: 'auth-ink-backdrop' }),
  ).toBeTruthy();
  expect(
    genericRoot!.root.findAllByProps({ testID: 'auth-ink-backdrop' }),
  ).toHaveLength(0);

  ReactTestRenderer.act(() => {
    otpRoot!.unmount();
    genericRoot!.unmount();
  });
});
