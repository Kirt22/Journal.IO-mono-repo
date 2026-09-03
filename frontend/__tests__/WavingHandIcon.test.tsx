import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AccessibilityInfo, Animated } from 'react-native';
import WavingHandIcon from '../src/components/WavingHandIcon';

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

test('plays one waving-hand sequence and stops it on unmount', async () => {
  const animation = createAnimation();
  mockIsReduceMotionEnabled.mockResolvedValue(false);
  const sequenceSpy = jest
    .spyOn(Animated, 'sequence')
    .mockReturnValue(animation as unknown as Animated.CompositeAnimation);
  const timingSpy = jest.spyOn(Animated, 'timing');
  const loopSpy = jest.spyOn(Animated, 'loop');
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <WavingHandIcon size={22} testID="test-waving-hand" />,
    );
    await Promise.resolve();
  });

  expect(root!.root.findByProps({ testID: 'test-waving-hand' })).toBeTruthy();
  expect(JSON.stringify(root!.toJSON())).toContain('👋');
  expect(sequenceSpy).toHaveBeenCalledTimes(1);
  expect(animation.start).toHaveBeenCalledTimes(1);
  expect(loopSpy).not.toHaveBeenCalled();
  expect(timingSpy.mock.calls.map(([, config]) => config.duration)).toEqual([
    520, 420,
  ]);
  expect(
    timingSpy.mock.calls.every(([, config]) => config.useNativeDriver),
  ).toBe(true);

  ReactTestRenderer.act(() => root!.unmount());
  expect(animation.stop).toHaveBeenCalledTimes(1);

  loopSpy.mockRestore();
  timingSpy.mockRestore();
  sequenceSpy.mockRestore();
});

test('renders the hand without animating when reduced motion is enabled', async () => {
  mockIsReduceMotionEnabled.mockResolvedValue(true);
  const sequenceSpy = jest.spyOn(Animated, 'sequence');
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <WavingHandIcon testID="static-waving-hand" />,
    );
    await Promise.resolve();
  });

  expect(root!.root.findByProps({ testID: 'static-waving-hand' })).toBeTruthy();
  expect(JSON.stringify(root!.toJSON())).toContain('👋');
  expect(sequenceSpy).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => root!.unmount());
  sequenceSpy.mockRestore();
});

test('plays and settles the hand when Reduce Motion changes at runtime', async () => {
  const animation = createAnimation();
  let reduceMotionListener: ((enabled: boolean) => void) | undefined;
  const removeListener = jest.fn();
  const mockAddEventListener =
    AccessibilityInfo.addEventListener as unknown as jest.MockedFunction<ReduceMotionAddEventListener>;
  const previousAddEventListenerImplementation = (
    mockAddEventListener as jest.Mock
  ).getMockImplementation();

  mockIsReduceMotionEnabled.mockResolvedValue(true);
  mockAddEventListener.mockImplementation((eventName, listener) => {
    if (eventName === 'reduceMotionChanged') {
      reduceMotionListener = listener;
    }

    return { remove: removeListener };
  });
  const sequenceSpy = jest
    .spyOn(Animated, 'sequence')
    .mockReturnValue(animation as unknown as Animated.CompositeAnimation);
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <WavingHandIcon testID="runtime-waving-hand" />,
    );
    await Promise.resolve();
  });

  expect(sequenceSpy).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => reduceMotionListener?.(false));
  expect(sequenceSpy).toHaveBeenCalledTimes(1);
  expect(animation.start).toHaveBeenCalledTimes(1);

  ReactTestRenderer.act(() => reduceMotionListener?.(true));
  expect(animation.stop).toHaveBeenCalledTimes(1);

  ReactTestRenderer.act(() => root!.unmount());
  expect(removeListener).toHaveBeenCalledTimes(1);

  sequenceSpy.mockRestore();
  mockAddEventListener.mockImplementation(
    previousAddEventListenerImplementation ??
      (() => ({ remove: jest.fn() } as never)),
  );
});

test('grows while waving and settles back when emphasizeOnMount is set', async () => {
  const animation = createAnimation();
  mockIsReduceMotionEnabled.mockResolvedValue(false);
  const parallelSpy = jest
    .spyOn(Animated, 'parallel')
    .mockReturnValue(animation as unknown as Animated.CompositeAnimation);
  const timingSpy = jest.spyOn(Animated, 'timing');
  const loopSpy = jest.spyOn(Animated, 'loop');
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <WavingHandIcon emphasizeOnMount size={64} testID="hero-waving-hand" />,
    );
    await Promise.resolve();
  });

  expect(parallelSpy).toHaveBeenCalledTimes(1);
  expect(animation.start).toHaveBeenCalledTimes(1);
  expect(loopSpy).not.toHaveBeenCalled();
  // Wave out/back, then the scale swell that holds through the wave and eases
  // down once the wave is finished.
  expect(timingSpy.mock.calls.map(([, config]) => config.duration)).toEqual([
    520, 420, 520, 380,
  ]);
  expect(
    timingSpy.mock.calls.every(([, config]) => config.useNativeDriver),
  ).toBe(true);

  ReactTestRenderer.act(() => root!.unmount());
  expect(animation.stop).toHaveBeenCalledTimes(1);

  loopSpy.mockRestore();
  timingSpy.mockRestore();
  parallelSpy.mockRestore();
});

test('skips the growth animation when reduced motion is enabled', async () => {
  mockIsReduceMotionEnabled.mockResolvedValue(true);
  const parallelSpy = jest.spyOn(Animated, 'parallel');
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <WavingHandIcon emphasizeOnMount size={64} testID="static-hero-hand" />,
    );
    await Promise.resolve();
  });

  expect(parallelSpy).not.toHaveBeenCalled();
  expect(JSON.stringify(root!.toJSON())).toContain('👋');

  ReactTestRenderer.act(() => root!.unmount());
  parallelSpy.mockRestore();
});
