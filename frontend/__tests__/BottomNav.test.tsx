/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BottomNav from '../src/components/BottomNav';
import { triggerHaptic } from '../src/services/hapticsService';

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

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

test('labels the journal history tab as Entries without changing its key', () => {
  const onPress = jest.fn();
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <BottomNav activeKey="calendar" onPress={onPress} />
      </SafeAreaProvider>,
    );
  });

  const entriesTabs = root!.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Entries' &&
      typeof node.props.onPress === 'function',
  );
  const entriesTab = entriesTabs[entriesTabs.length - 1];

  expect(JSON.stringify(root!.toJSON())).toContain('Entries');

  ReactTestRenderer.act(() => {
    entriesTab.props.onPress();
  });

  expect(onPress).toHaveBeenCalledWith('calendar');
  expect(triggerHaptic).toHaveBeenCalledWith('optionSelected');
});
