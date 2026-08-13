/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Switch } from 'react-native';
import HapticPressable from '../src/components/HapticPressable';
import HapticSwitch from '../src/components/HapticSwitch';
import { triggerHaptic } from '../src/services/hapticsService';

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const findNativePressHandler = (root: ReactTestRenderer.ReactTestRenderer) => {
  const matches = root.root.findAll(
    node => typeof node.props.onPress === 'function',
  );
  return matches[matches.length - 1].props.onPress;
};

test('pressable emits its configured haptic before the action', () => {
  const onPress = jest.fn();
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <HapticPressable hapticEvent="back" onPress={onPress} />,
    );
  });
  ReactTestRenderer.act(() => {
    findNativePressHandler(root!)({});
  });

  expect(triggerHaptic).toHaveBeenCalledWith('back');
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('pressable supports explicit silent and disabled controls', () => {
  const onPress = jest.fn();
  let silentRoot: ReactTestRenderer.ReactTestRenderer;
  let disabledRoot: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    silentRoot = ReactTestRenderer.create(
      <HapticPressable hapticEvent={false} onPress={onPress} />,
    );
    disabledRoot = ReactTestRenderer.create(
      <HapticPressable disabled onPress={onPress} />,
    );
  });
  ReactTestRenderer.act(() => {
    findNativePressHandler(silentRoot!)({});
    findNativePressHandler(disabledRoot!)({});
  });

  expect(triggerHaptic).not.toHaveBeenCalled();
});

test('switch emits selection feedback and supports silent preference controls', () => {
  const onValueChange = jest.fn();
  let root: ReactTestRenderer.ReactTestRenderer;
  let silentRoot: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <HapticSwitch onValueChange={onValueChange} value={false} />,
    );
    silentRoot = ReactTestRenderer.create(
      <HapticSwitch
        hapticEvent={false}
        onValueChange={onValueChange}
        value={false}
      />,
    );
  });
  ReactTestRenderer.act(() => {
    root!.root.findByType(Switch).props.onValueChange(true);
    silentRoot!.root.findByType(Switch).props.onValueChange(true);
  });

  expect(triggerHaptic).toHaveBeenCalledTimes(1);
  expect(triggerHaptic).toHaveBeenCalledWith('optionSelected');
  expect(onValueChange).toHaveBeenCalledTimes(2);
});
