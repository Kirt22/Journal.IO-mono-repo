import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppleButton } from '@invertase/react-native-apple-authentication';
import AuthHero from '../src/components/AuthHero';
import PrimaryButton from '../src/components/PrimaryButton';
import AuthChoiceScreen from '../src/screens/auth/AuthChoiceScreen';
import { triggerHaptic } from '../src/services/hapticsService';
import { ThemeProvider } from '../src/theme/provider';

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

jest.mock('../src/components/AuthInkBackdrop', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: () =>
      ReactModule.createElement(View, {
        accessibilityElementsHidden: true,
        accessible: false,
        importantForAccessibility: 'no-hide-descendants',
        pointerEvents: 'none',
        testID: 'auth-ink-backdrop',
      }),
  };
});

const mockTriggerHaptic = triggerHaptic as jest.MockedFunction<
  typeof triggerHaptic
>;

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const completedIntro = {
  animated: true,
  outcome: 'completed' as const,
};

const renderAuthChoice = (
  animateEntrance: boolean,
  mode: 'light' | 'dark' = 'light',
  overrides: {
    onContinueWithApple?: () => Promise<void>;
    onContinueWithEmail?: () => Promise<void>;
    onContinueWithGoogle?: () => Promise<void>;
  } = {},
) =>
  ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <ThemeProvider modeOverride={mode}>
        <AuthChoiceScreen
          onContinueWithEmail={
            overrides.onContinueWithEmail || jest.fn(async () => undefined)
          }
          onContinueWithApple={
            overrides.onContinueWithApple || jest.fn(async () => undefined)
          }
          onContinueWithGoogle={
            overrides.onContinueWithGoogle || jest.fn(async () => undefined)
          }
          onGoToSignIn={jest.fn()}
          animateEntrance={animateEntrance}
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  (
    AccessibilityInfo.isReduceMotionEnabled as jest.MockedFunction<
      typeof AccessibilityInfo.isReduceMotionEnabled
    >
  ).mockImplementation(async () => false);
});

test('keeps auth content visible when entrance motion is disabled', () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderAuthChoice(false, 'dark');
  });

  const actions = root!.root.findByProps({ testID: 'auth-actions' });
  const brand = root!.root.findByProps({ testID: 'auth-brand' });
  const backdrop = root!.root.findByProps({ testID: 'auth-ink-backdrop' });

  expect(StyleSheet.flatten(brand.props.style).transform).toEqual([
    { translateY: -28 },
  ]);
  expect(actions.props.pointerEvents).toBe('auto');
  expect(actions.props.accessibilityElementsHidden).toBe(false);
  expect(actions.props.importantForAccessibility).toBe('auto');
  expect(backdrop.props.pointerEvents).toBe('none');
  expect(backdrop.props.accessibilityElementsHidden).toBe(true);
  expect(backdrop.props.importantForAccessibility).toBe('no-hide-descendants');
  expect(root!.root.findByProps({ testID: 'auth-primary-layer' })).toBeTruthy();
  expect(
    root!.root.findByProps({ testID: 'auth-secondary-layer' }),
  ).toBeTruthy();
  expect(root!.root.findByProps({ testID: 'auth-email-action' })).toBeTruthy();
  expect(
    root!.root.findByProps({ testID: 'auth-email-action-icon' }),
  ).toBeTruthy();
  expect(
    root!.root.findByProps({ testID: 'auth-social-actions' }),
  ).toBeTruthy();
  expect(root!.root.findByProps({ testID: 'auth-privacy-note' })).toBeTruthy();
  expect(mockTriggerHaptic).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => root!.unmount());
});

test('shows provider dialogs with cancel and retry actions', async () => {
  const onContinueWithGoogle = jest
    .fn<Promise<void>, []>()
    .mockRejectedValueOnce(new Error('raw-google-sdk-failure'))
    .mockResolvedValueOnce(undefined);
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderAuthChoice(false, 'light', { onContinueWithGoogle });
    await Promise.resolve();
  });

  const googleButton = root!.root
    .findAllByType(PrimaryButton)
    .find(node => node.props.label === 'Continue with Google');

  await ReactTestRenderer.act(async () => {
    await googleButton!.props.onPress();
    await Promise.resolve();
  });

  const failedTree = JSON.stringify(root!.toJSON());
  expect(root!.root.findByProps({ testID: 'auth-error-dialog' })).toBeTruthy();
  expect(failedTree).toContain('Google sign-in failed');
  expect(failedTree).toContain('Not now');
  expect(failedTree).toContain('Try again');
  expect(failedTree).not.toContain('raw-google-sdk-failure');

  const retryButton = root!.root
    .findAllByType(PrimaryButton)
    .find(node => node.props.label === 'Try again');

  await ReactTestRenderer.act(async () => {
    retryButton!.props.onPress();
    await Promise.resolve();
  });

  expect(onContinueWithGoogle).toHaveBeenCalledTimes(2);
  ReactTestRenderer.act(() => root!.unmount());
});

test('uses the same dialog contract for Apple failures', async () => {
  const onContinueWithApple = jest.fn(async () => {
    throw new Error('raw-apple-sdk-failure');
  });
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderAuthChoice(false, 'light', { onContinueWithApple });
    await Promise.resolve();
  });

  const appleButton = root!.root.findByType(AppleButton);
  await ReactTestRenderer.act(async () => {
    await appleButton.props.onPress();
    await Promise.resolve();
  });

  const tree = JSON.stringify(root!.toJSON());
  expect(tree).toContain('Apple sign-in failed');
  expect(tree).not.toContain('raw-apple-sdk-failure');
  expect(root!.root.findByProps({ testID: 'auth-error-dialog' })).toBeTruthy();

  ReactTestRenderer.act(() => root!.unmount());
});

test('does not open an error dialog when a provider flow resolves without a session', async () => {
  const onContinueWithGoogle = jest.fn(async () => undefined);
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderAuthChoice(false, 'light', { onContinueWithGoogle });
    await Promise.resolve();
  });

  const googleButton = root!.root
    .findAllByType(PrimaryButton)
    .find(node => node.props.label === 'Continue with Google');
  await ReactTestRenderer.act(async () => {
    await googleButton!.props.onPress();
    await Promise.resolve();
  });

  expect(onContinueWithGoogle).toHaveBeenCalledTimes(1);
  expect(
    root!.root.findAllByProps({ testID: 'auth-error-dialog' }),
  ).toHaveLength(0);

  ReactTestRenderer.act(() => root!.unmount());
});

test('gates auth actions until the entrance sequence settles', async () => {
  jest.useFakeTimers();
  const reduceMotionSpy = jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderAuthChoice(true);
    await Promise.resolve();
  });

  let actions = root!.root.findByProps({ testID: 'auth-actions' });
  expect(actions.props.pointerEvents).toBe('none');
  expect(actions.props.accessibilityElementsHidden).toBe(true);
  expect(actions.props.importantForAccessibility).toBe('no-hide-descendants');

  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(3700);
    await Promise.resolve();
  });

  actions = root!.root.findByProps({ testID: 'auth-actions' });
  expect(actions.props.pointerEvents).toBe('auto');
  expect(actions.props.accessibilityElementsHidden).toBe(false);
  expect(actions.props.importantForAccessibility).toBe('auto');

  ReactTestRenderer.act(() => root!.unmount());
  reduceMotionSpy.mockRestore();
  jest.useRealTimers();
});

test('plays exactly three premium entrance haptics in phase order', async () => {
  jest.useFakeTimers();
  const reduceMotionSpy = jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(() => new Promise<boolean>(() => undefined));
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderAuthChoice(true);
    await Promise.resolve();
  });

  const hero = root!.root.findByType(AuthHero);

  ReactTestRenderer.act(() => {
    hero.props.onWordmarkIntroStart();
    jest.advanceTimersByTime(500);
    hero.props.onWordmarkMergeComplete(completedIntro);
    hero.props.onWordmarkIntroComplete(completedIntro);
  });

  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(600);
    await Promise.resolve();
  });

  expect(mockTriggerHaptic.mock.calls.map(([event]) => event)).toEqual([
    'authIntroProgress',
    'authIntroMerge',
    'authIntroReveal',
  ]);

  ReactTestRenderer.act(() => root!.unmount());
  reduceMotionSpy.mockRestore();
  jest.useRealTimers();
});

test('uses one welcome haptic when reduced motion skips the entrance', async () => {
  jest.useFakeTimers();
  const reduceMotionSpy = jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderAuthChoice(true, 'dark');
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(250);
    await Promise.resolve();
  });

  expect(mockTriggerHaptic).toHaveBeenCalledTimes(1);
  expect(mockTriggerHaptic).toHaveBeenCalledWith('authIntroWelcome');
  expect(
    root!.root.findByProps({ testID: 'auth-actions' }).props.pointerEvents,
  ).toBe('auto');

  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(3700);
    await Promise.resolve();
  });

  expect(mockTriggerHaptic).toHaveBeenCalledTimes(1);

  ReactTestRenderer.act(() => root!.unmount());
  reduceMotionSpy.mockRestore();
  jest.useRealTimers();
});

test('reveals safely without haptics when the wordmark falls back', async () => {
  jest.useFakeTimers();
  const reduceMotionSpy = jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(() => new Promise<boolean>(() => undefined));
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderAuthChoice(true);
    await Promise.resolve();
  });

  const hero = root!.root.findByType(AuthHero);
  const fallbackResult = {
    animated: false,
    outcome: 'fallback' as const,
  };

  ReactTestRenderer.act(() => {
    hero.props.onWordmarkMergeComplete(fallbackResult);
    hero.props.onWordmarkIntroComplete(fallbackResult);
  });

  expect(
    root!.root.findByProps({ testID: 'auth-actions' }).props.pointerEvents,
  ).toBe('auto');
  expect(mockTriggerHaptic).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => root!.unmount());
  reduceMotionSpy.mockRestore();
  jest.useRealTimers();
});

test('a reduced-motion result cancels an in-progress action reveal', async () => {
  jest.useFakeTimers();
  const reduceMotionListeners: Array<(enabled: boolean) => void> = [];
  type ReduceMotionAddEventListener = (
    eventName: 'reduceMotionChanged',
    listener: (enabled: boolean) => void,
  ) => { remove: () => void };
  let animationCompletion: ((result: Animated.EndResult) => void) | undefined;
  const actionAnimation = {
    reset: jest.fn(),
    start: jest.fn((completion?: (result: Animated.EndResult) => void) => {
      animationCompletion = completion;
    }),
    stop: jest.fn(() => {
      animationCompletion?.({ finished: false });
    }),
  } as unknown as Animated.CompositeAnimation;
  const parallelSpy = jest
    .spyOn(Animated, 'parallel')
    .mockReturnValue(actionAnimation);
  const addEventListenerMock =
    AccessibilityInfo.addEventListener as unknown as jest.MockedFunction<ReduceMotionAddEventListener>;
  const originalAddEventListenerImplementation =
    addEventListenerMock.getMockImplementation();
  addEventListenerMock.mockImplementation((eventName, listener) => {
    if (eventName === 'reduceMotionChanged') {
      reduceMotionListeners.push(listener);
    }

    return { remove: jest.fn() };
  });
  const reduceMotionSpy = jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(() => new Promise<boolean>(() => undefined));
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderAuthChoice(true);
    await Promise.resolve();
  });

  const hero = root!.root.findByType(AuthHero);

  ReactTestRenderer.act(() => {
    hero.props.onWordmarkIntroStart();
    jest.advanceTimersByTime(500);
    hero.props.onWordmarkMergeComplete(completedIntro);
    hero.props.onWordmarkIntroComplete(completedIntro);
    jest.advanceTimersByTime(100);
    reduceMotionListeners.forEach(listener => listener(true));
  });

  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
  });

  expect(
    root!.root.findByProps({ testID: 'auth-actions' }).props.pointerEvents,
  ).toBe('auto');
  expect(mockTriggerHaptic.mock.calls.map(([event]) => event)).toEqual([
    'authIntroProgress',
    'authIntroMerge',
  ]);

  ReactTestRenderer.act(() => root!.unmount());
  parallelSpy.mockRestore();
  if (originalAddEventListenerImplementation) {
    addEventListenerMock.mockImplementation(
      originalAddEventListenerImplementation,
    );
  } else {
    addEventListenerMock.mockReset();
  }
  reduceMotionSpy.mockRestore();
  jest.useRealTimers();
});

test('cancels the queued travel haptic when the auth screen unmounts', async () => {
  jest.useFakeTimers();
  const reduceMotionSpy = jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(() => new Promise<boolean>(() => undefined));
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderAuthChoice(true);
    await Promise.resolve();
  });

  const hero = root!.root.findByType(AuthHero);
  ReactTestRenderer.act(() => {
    hero.props.onWordmarkIntroStart();
    root!.unmount();
  });
  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(1000);
  });

  expect(mockTriggerHaptic).not.toHaveBeenCalled();

  reduceMotionSpy.mockRestore();
  jest.useRealTimers();
});
