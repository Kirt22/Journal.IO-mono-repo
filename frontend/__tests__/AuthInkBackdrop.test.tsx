import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AccessibilityInfo, Animated } from 'react-native';
import AuthInkBackdrop from '../src/components/AuthInkBackdrop';
import { ThemeProvider } from '../src/theme/provider';

const renderBackdrop = () =>
  ReactTestRenderer.create(
    <ThemeProvider modeOverride="light">
      <AuthInkBackdrop animateWaves />
    </ThemeProvider>,
  );

const createAnimation = () => ({
  reset: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
});

const mockIsReduceMotionEnabled =
  AccessibilityInfo.isReduceMotionEnabled as jest.MockedFunction<
    typeof AccessibilityInfo.isReduceMotionEnabled
  >;
type ReduceMotionAddEventListener = (
  eventName: 'reduceMotionChanged',
  listener: (enabled: boolean) => void,
) => { remove: () => void };

afterEach(() => {
  mockIsReduceMotionEnabled.mockImplementation(async () => false);
});

test('loops all three ink contours and stops them on unmount', async () => {
  const animations = [createAnimation(), createAnimation(), createAnimation()];
  mockIsReduceMotionEnabled.mockResolvedValue(false);
  const loopSpy = jest
    .spyOn(Animated, 'loop')
    .mockImplementation(
      () => animations.shift() as unknown as Animated.CompositeAnimation,
    );
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderBackdrop();
    await Promise.resolve();
  });

  const createdAnimations = loopSpy.mock.results.map(
    result => result.value as unknown as ReturnType<typeof createAnimation>,
  );

  expect(loopSpy).toHaveBeenCalledTimes(3);
  expect(createdAnimations).toHaveLength(3);
  createdAnimations.forEach(animation => {
    expect(animation.start).toHaveBeenCalledTimes(1);
    expect(animation.stop).not.toHaveBeenCalled();
  });
  expect(
    root!.root.findByProps({ testID: 'auth-ink-upper-wave' }),
  ).toBeTruthy();
  expect(
    root!.root.findByProps({ testID: 'auth-ink-middle-wave' }),
  ).toBeTruthy();
  expect(
    root!.root.findByProps({ testID: 'auth-ink-lower-wave' }),
  ).toBeTruthy();

  ReactTestRenderer.act(() => root!.unmount());

  createdAnimations.forEach(animation => {
    expect(animation.stop).toHaveBeenCalledTimes(1);
  });

  loopSpy.mockRestore();
});

test('keeps the ink contours static when reduced motion is enabled', async () => {
  mockIsReduceMotionEnabled.mockResolvedValue(true);
  const loopSpy = jest.spyOn(Animated, 'loop');
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderBackdrop();
    await Promise.resolve();
  });

  expect(loopSpy).not.toHaveBeenCalled();
  expect(
    root!.root.findByProps({ testID: 'auth-ink-upper-wave' }),
  ).toBeTruthy();
  expect(
    root!.root.findByProps({ testID: 'auth-ink-middle-wave' }),
  ).toBeTruthy();
  expect(
    root!.root.findByProps({ testID: 'auth-ink-lower-wave' }),
  ).toBeTruthy();

  ReactTestRenderer.act(() => root!.unmount());
  loopSpy.mockRestore();
});

test('stops and restarts the contour loops when Reduce Motion changes', async () => {
  const createdAnimations: ReturnType<typeof createAnimation>[] = [];
  let reduceMotionListener: ((enabled: boolean) => void) | undefined;
  const removeListener = jest.fn();
  const mockAddEventListener =
    AccessibilityInfo.addEventListener as unknown as jest.MockedFunction<ReduceMotionAddEventListener>;
  const previousAddEventListenerImplementation = (
    mockAddEventListener as jest.Mock
  ).getMockImplementation();

  mockIsReduceMotionEnabled.mockResolvedValue(false);
  mockAddEventListener.mockImplementation((eventName, listener) => {
    if (eventName === 'reduceMotionChanged') {
      reduceMotionListener = listener;
    }

    return { remove: removeListener };
  });
  const loopSpy = jest.spyOn(Animated, 'loop').mockImplementation(() => {
    const animation = createAnimation();
    createdAnimations.push(animation);
    return animation as unknown as Animated.CompositeAnimation;
  });
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderBackdrop();
    await Promise.resolve();
  });

  expect(createdAnimations).toHaveLength(3);

  ReactTestRenderer.act(() => reduceMotionListener?.(true));
  createdAnimations.slice(0, 3).forEach(animation => {
    expect(animation.stop).toHaveBeenCalledTimes(1);
  });

  ReactTestRenderer.act(() => reduceMotionListener?.(false));
  expect(createdAnimations).toHaveLength(6);
  createdAnimations.slice(3).forEach(animation => {
    expect(animation.start).toHaveBeenCalledTimes(1);
  });

  ReactTestRenderer.act(() => root!.unmount());
  createdAnimations.slice(3).forEach(animation => {
    expect(animation.stop).toHaveBeenCalledTimes(1);
  });
  expect(removeListener).toHaveBeenCalledTimes(1);

  loopSpy.mockRestore();
  mockAddEventListener.mockImplementation(
    previousAddEventListenerImplementation ??
      (() => ({ remove: jest.fn() } as never)),
  );
});
