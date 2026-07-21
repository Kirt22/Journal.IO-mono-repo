import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AccessibilityInfo, Animated } from 'react-native';
import PrimaryButton from '../src/components/PrimaryButton';
import {
  AuthErrorDialog,
  AuthErrorNotice,
} from '../src/components/AuthErrorFeedback';

describe('AuthErrorFeedback', () => {
  let root: ReactTestRenderer.ReactTestRenderer | null = null;

  afterEach(() => {
    ReactTestRenderer.act(() => root?.unmount());
    root = null;
    jest.restoreAllMocks();
  });

  test('announces the single inline error as an accessible alert', async () => {
    const announceSpy = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);

    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <AuthErrorNotice message={null} testID="test-auth-error-notice" />,
      );
      await Promise.resolve();
    });

    await ReactTestRenderer.act(async () => {
      root!.update(
        <AuthErrorNotice
          message="Email is required."
          testID="test-auth-error-notice"
        />,
      );
      await Promise.resolve();
    });

    const notice = root!.toJSON() as ReactTestRenderer.ReactTestRendererJSON;
    expect(notice.props.accessibilityRole).toBe('alert');
    expect(notice.props.accessibilityLiveRegion).toBe('assertive');
    expect(announceSpy).toHaveBeenCalledWith('Email is required.');
  });

  test('settles the dialog immediately under Reduce Motion', async () => {
    jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    const springSpy = jest.spyOn(Animated, 'spring');
    const onDismiss = jest.fn();
    const onRetry = jest.fn();

    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <AuthErrorDialog
          message="Google sign-in could not be completed."
          onDismiss={onDismiss}
          onRetry={onRetry}
          title="Google sign-in failed"
          visible={false}
        />,
      );
      await Promise.resolve();
    });

    springSpy.mockClear();
    await ReactTestRenderer.act(async () => {
      root!.update(
        <AuthErrorDialog
          message="Google sign-in could not be completed."
          onDismiss={onDismiss}
          onRetry={onRetry}
          title="Google sign-in failed"
          visible
        />,
      );
      await Promise.resolve();
    });

    expect(springSpy).not.toHaveBeenCalled();
    expect(
      root!.root.findByProps({ testID: 'auth-error-dialog' }).props
        .accessibilityViewIsModal,
    ).toBe(true);

    const actions = root!.root.findAllByType(PrimaryButton);
    expect(actions.map(action => action.props.label)).toEqual([
      'Not now',
      'Try again',
    ]);

    ReactTestRenderer.act(() => actions[1].props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
