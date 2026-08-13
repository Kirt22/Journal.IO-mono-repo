import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, View } from 'react-native';
import { Circle } from 'react-native-svg';
import JournalLoader from '../src/components/JournalLoader';

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({
    remove: jest.fn(),
  } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders the reference arc with the requested color and standard size', () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    renderer = ReactTestRenderer.create(
      <JournalLoader color="#D86A5B" size="large" testID="journal-loader" />,
    );
  });

  const root = renderer.root.find(
    node => node.type === View && node.props.testID === 'journal-loader',
  );
  const circle = renderer.root.findByType(Circle);

  expect(root.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ height: 36, width: 36 })]),
  );
  expect(circle.props.stroke).toBe('#D86A5B');
  expect(circle.props.strokeLinecap).toBe('round');
  expect(circle.props.strokeDasharray).toEqual(expect.any(String));
});

test('supports numeric sizing and forwards accessibility props', () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    renderer = ReactTestRenderer.create(
      <JournalLoader
        accessibilityLabel="Loading journal"
        accessibilityRole="progressbar"
        color="#111111"
        size={28}
      />,
    );
  });

  const container = renderer.root.findAllByType(View)[0];
  expect(container.props.accessibilityLabel).toBe('Loading journal');
  expect(container.props.accessibilityRole).toBe('progressbar');
  expect(container.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ height: 28, width: 28 })]),
  );
});

test('keeps its bounds but hides the arc when stopped', () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    renderer = ReactTestRenderer.create(
      <JournalLoader animating={false} color="#111111" testID="stopped-loader" />,
    );
  });

  expect(renderer.root.findByProps({ testID: 'stopped-loader' })).toBeTruthy();
  expect(renderer.root.findAllByType(Circle)).toHaveLength(0);
});

test('uses a static arc when Reduce Motion is enabled', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValueOnce(true);
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await act(async () => {
    renderer = ReactTestRenderer.create(
      <JournalLoader color="#111111" testID="reduced-loader" />,
    );
    await Promise.resolve();
  });

  expect(renderer.root.findByType(Circle).props.strokeDasharray).toEqual(
    expect.any(String),
  );
});
