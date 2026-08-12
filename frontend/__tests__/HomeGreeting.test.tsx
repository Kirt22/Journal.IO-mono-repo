import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Animated } from 'react-native';
import HomeGreeting from '../src/components/HomeGreeting';
import { ThemeProvider } from '../src/theme/provider';
import { selectHomeNudge, type HomeNudgeInput } from '../src/utils/homeNudge';

const ALL_CLEAR: HomeNudgeInput = {
  currentStreak: 5,
  hasCheckedInToday: true,
  hasWrittenToday: true,
  hadStreakBefore: false,
  pendingGoalCount: 0,
  hasSeenTodaysReflection: true,
  isPremium: true,
  isOfferAvailable: false,
  isHeroVisible: true,
};

const greetingFor = (
  overrides: Partial<HomeNudgeInput> = {},
  props: Partial<React.ComponentProps<typeof HomeGreeting>> = {},
) => (
  <ThemeProvider modeOverride="light">
    <HomeGreeting
      date="Thursday, August 06"
      firstName="Kirtan"
      greeting="Good evening"
      nudge={selectHomeNudge({ ...ALL_CLEAR, ...overrides })}
      onPress={jest.fn()}
      shouldAnimate={false}
      {...props}
    />
  </ThemeProvider>
);

const treeText = (root: ReactTestRenderer.ReactTestRenderer) =>
  JSON.stringify(root.toJSON());

test('always shows the greeting and the waving hand', () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(greetingFor());
  });

  const text = treeText(root!);
  expect(text).toContain('Good evening, Kirtan');
  expect(text).toContain('👋');
  expect(text).toContain('Thursday, August 06');

  ReactTestRenderer.act(() => root!.unmount());
});

test('keeps the greeting even when a nudge is pending — only the tag changes', () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      greetingFor({ currentStreak: 5, hasWrittenToday: false }),
    );
  });

  let text = treeText(root!);
  expect(text).toContain('Good evening, Kirtan');
  expect(text).toContain('👋');
  expect(text).toContain('Keep your 5-day streak');

  ReactTestRenderer.act(() => {
    root!.update(greetingFor({ pendingGoalCount: 2 }));
  });

  text = treeText(root!);
  // Headline held still; tag swapped.
  expect(text).toContain('Good evening, Kirtan');
  expect(text).not.toContain('Keep your 5-day streak');
  expect(text).toContain("2 left on today's goals");

  ReactTestRenderer.act(() => root!.unmount());
});

test('greets without a trailing comma when there is no name', () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(greetingFor({}, { firstName: '' }));
  });

  expect(treeText(root!)).toContain('Good evening');
  expect(treeText(root!)).not.toContain('Good evening,');

  ReactTestRenderer.act(() => root!.unmount());
});

test('the tag is a labelled button that reports the nudge', () => {
  const onPress = jest.fn();
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(greetingFor({ pendingGoalCount: 2 }, { onPress }));
  });

  const tag = root!.root.findByProps({ testID: 'home-greeting-action' });
  expect(tag.props.accessibilityRole).toBe('button');
  expect(tag.props.accessibilityLabel).toBe("2 left on today's goals");

  ReactTestRenderer.act(() => tag.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);

  ReactTestRenderer.act(() => root!.unmount());
});

test('renders settled without animating when shouldAnimate is false', () => {
  const springSpy = jest.spyOn(Animated, 'spring');
  const sequenceSpy = jest.spyOn(Animated, 'sequence');
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(greetingFor());
  });

  expect(springSpy).not.toHaveBeenCalled();
  expect(sequenceSpy).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => root!.unmount());
  springSpy.mockRestore();
  sequenceSpy.mockRestore();
});

test('animates the tag alone when the nudge kind changes', () => {
  const start = jest.fn();
  const springSpy = jest
    .spyOn(Animated, 'spring')
    .mockImplementation(
      () =>
        ({ start, stop: jest.fn(), reset: jest.fn() } as unknown as Animated.CompositeAnimation),
    );
  const sequenceSpy = jest
    .spyOn(Animated, 'sequence')
    .mockImplementation(
      () =>
        ({
          start: jest.fn(),
          stop: jest.fn(),
          reset: jest.fn(),
        } as unknown as Animated.CompositeAnimation),
    );

  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      greetingFor({ pendingGoalCount: 3 }, { shouldAnimate: true }),
    );
  });

  const afterMount = start.mock.calls.length;
  expect(afterMount).toBeGreaterThan(0);

  // Same kind, different count — the tag copy updates without re-animating.
  ReactTestRenderer.act(() => {
    root!.update(greetingFor({ pendingGoalCount: 2 }, { shouldAnimate: true }));
  });
  expect(start.mock.calls.length).toBe(afterMount);

  // Different kind — the tag settles in.
  ReactTestRenderer.act(() => {
    root!.update(greetingFor({}, { shouldAnimate: true }));
  });
  expect(start.mock.calls.length).toBeGreaterThan(afterMount);

  ReactTestRenderer.act(() => root!.unmount());
  springSpy.mockRestore();
  sequenceSpy.mockRestore();
});

test('the offer nudge falls back to the crown when there is no icons8 asset', () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      greetingFor({ isPremium: false, isOfferAvailable: true }),
    );
  });

  const text = treeText(root!);
  expect(text).toContain('Your special offer is here');
  // No Image source means it rendered the lucide crown instead.
  expect(text).not.toContain('icons8-pen-40.png');

  ReactTestRenderer.act(() => root!.unmount());
});

test('confetti only renders while the celebration is running', () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      greetingFor(
        { isPremium: false, isOfferAvailable: true },
        { celebrate: true, shouldAnimate: true },
      ),
    );
  });

  const celebrating = root!.root.findAllByProps({ pointerEvents: 'none' });
  expect(celebrating.length).toBeGreaterThan(0);

  ReactTestRenderer.act(() => {
    root!.update(
      greetingFor(
        { isPremium: false, isOfferAvailable: true },
        { celebrate: false, shouldAnimate: true },
      ),
    );
  });

  expect(treeText(root!)).toContain('Your special offer is here');

  ReactTestRenderer.act(() => root!.unmount());
});
