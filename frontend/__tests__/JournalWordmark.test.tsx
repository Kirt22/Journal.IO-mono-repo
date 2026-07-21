import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { ThemeProvider } from '../src/theme/provider';
import { getTheme } from '../src/theme/theme';
import JournalWordmark, {
  getInkCurrentHorizontalPath,
  getInkCurrentPresentationMetrics,
  getInkCurrentVerticalPath,
} from '../src/components/JournalWordmark';

test('renders the theme-aware journal.io wordmark as accessible text', () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="dark">
        <JournalWordmark />
      </ThemeProvider>,
    );
  });

  expect(
    root!.root.findByProps({ accessibilityLabel: 'Journal.IO' }),
  ).toBeTruthy();
  expect(JSON.stringify(root!.toJSON())).toContain('journal');
  expect(JSON.stringify(root!.toJSON())).toContain('.io');
});

test('keeps the final wordmark legible in dark mode', () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const theme = getTheme('dark');

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="dark">
        <JournalWordmark />
      </ThemeProvider>,
    );
  });

  const journal = root!.root.findByProps({ children: 'journal' });
  const ioColors = root!.root
    .findAllByProps({ children: '.io' })
    .map(node => StyleSheet.flatten(node.props.style).color);

  expect(StyleSheet.flatten(journal.props.style).color).toBe(
    theme.colors.foreground,
  );
  expect(ioColors).toContain(theme.colors.foreground);
  expect(ioColors).toContain(theme.colors.primary);
});

test('reserves room for the final io glyph instead of clipping its edge', () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalWordmark />
      </ThemeProvider>,
    );
  });

  const ioWrapStyle = StyleSheet.flatten(
    root!.root.findByProps({ testID: 'journal-wordmark-io-wrap' }).props.style,
  );
  const inkSweepClipStyle = StyleSheet.flatten(
    root!.root.findByProps({
      testID: 'journal-wordmark-ink-sweep-clip',
    }).props.style,
  );

  expect(ioWrapStyle.overflow).toBe('visible');
  expect(ioWrapStyle.paddingRight).toBeGreaterThanOrEqual(4);
  expect(inkSweepClipStyle.overflow).toBe('hidden');
});

test('builds a bounded editorial current that converges on the logo', () => {
  const compactPath = getInkCurrentHorizontalPath(320);
  const largePath = getInkCurrentHorizontalPath(520);
  const verticalPath = getInkCurrentVerticalPath(640);

  expect(compactPath[0]).toBe(0);
  expect(compactPath.at(-1)).toBe(0);
  expect(compactPath.slice(1, -1).map(Math.sign)).toEqual([1, -1, 1, -1, 1]);
  expect(Math.max(...compactPath.map(Math.abs))).toBeLessThan(
    Math.max(...largePath.map(Math.abs)),
  );
  expect(Math.max(...largePath.map(Math.abs))).toBe(62);
  expect(verticalPath[0]).toBe(640);
  expect(verticalPath.at(-1)).toBe(0);
  expect(
    verticalPath.every(
      (position, index) =>
        index === verticalPath.length - 1 ||
        position > verticalPath[index + 1],
    ),
  ).toBe(true);
});

test('uses large responsive current and final-logo typography', () => {
  expect(getInkCurrentPresentationMetrics(320)).toEqual({
    copyCount: 7,
    finalFontSize: 48,
    trailFontSize: 32,
    trailLineHeight: 35,
  });
  expect(getInkCurrentPresentationMetrics(390)).toEqual({
    copyCount: 8,
    finalFontSize: 56,
    trailFontSize: 36,
    trailLineHeight: 39,
  });
  expect(getInkCurrentPresentationMetrics(440)).toEqual({
    copyCount: 9,
    finalFontSize: 62,
    trailFontSize: 40,
    trailLineHeight: 43,
  });
});

test('reports the current start once when motion is enabled', async () => {
  jest.useFakeTimers();
  const reduceMotionSpy = jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  const onIntroStart = jest.fn();
  const onIntroComplete = jest.fn();
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalWordmark
          playInkCurrentIntro
          onIntroStart={onIntroStart}
          onIntroComplete={onIntroComplete}
        />
      </ThemeProvider>,
    );
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(250);
    await Promise.resolve();
  });

  expect(onIntroStart).toHaveBeenCalledTimes(1);
  expect(onIntroComplete).not.toHaveBeenCalled();
  const currentCopyIds = new Set(
    root!.root
      .findAll(
        node =>
          typeof node.props.testID === 'string' &&
          node.props.testID.startsWith('journal-ink-copy-'),
      )
      .map(node => node.props.testID),
  );
  expect([7, 8, 9]).toContain(currentCopyIds.size);

  ReactTestRenderer.act(() => root!.unmount());
  reduceMotionSpy.mockRestore();
  jest.useRealTimers();
});

test('reports merge and completion once when the intro falls back', async () => {
  jest.useFakeTimers();
  const reduceMotionSpy = jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(() => new Promise<boolean>(() => undefined));
  const onIntroMergeComplete = jest.fn();
  const onIntroComplete = jest.fn();
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalWordmark
          playInkCurrentIntro
          onIntroMergeComplete={onIntroMergeComplete}
          onIntroComplete={onIntroComplete}
        />
      </ThemeProvider>,
    );
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(3700);
    await Promise.resolve();
  });

  const fallbackResult = { animated: false, outcome: 'fallback' };
  expect(onIntroMergeComplete).toHaveBeenCalledTimes(1);
  expect(onIntroMergeComplete).toHaveBeenCalledWith(fallbackResult);
  expect(onIntroComplete).toHaveBeenCalledTimes(1);
  expect(onIntroComplete).toHaveBeenCalledWith(fallbackResult);

  ReactTestRenderer.act(() => root!.unmount());
  reduceMotionSpy.mockRestore();
  jest.useRealTimers();
});

test('settles once when reduced motion is enabled', async () => {
  jest.useFakeTimers();
  const reduceMotionSpy = jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  const onIntroStart = jest.fn();
  const onIntroMergeComplete = jest.fn();
  const onIntroComplete = jest.fn();
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <JournalWordmark
          playInkCurrentIntro
          onIntroStart={onIntroStart}
          onIntroMergeComplete={onIntroMergeComplete}
          onIntroComplete={onIntroComplete}
        />
      </ThemeProvider>,
    );
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(250);
    await Promise.resolve();
  });

  const reducedMotionResult = {
    animated: false,
    outcome: 'reduced-motion',
  };

  expect(onIntroStart).not.toHaveBeenCalled();
  expect(onIntroMergeComplete).toHaveBeenCalledTimes(1);
  expect(onIntroMergeComplete).toHaveBeenCalledWith(reducedMotionResult);
  expect(onIntroComplete).toHaveBeenCalledTimes(1);
  expect(onIntroComplete).toHaveBeenCalledWith(reducedMotionResult);

  ReactTestRenderer.act(() => root!.unmount());
  reduceMotionSpy.mockRestore();
  jest.useRealTimers();
});
