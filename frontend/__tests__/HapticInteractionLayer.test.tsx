import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { View } from 'react-native';
import HapticInteractionLayer from '../src/components/HapticInteractionLayer';
import { triggerHaptic } from '../src/services/hapticsService';

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

const createTouchEvent = (pageX: number, pageY: number) =>
  ({ nativeEvent: { pageX, pageY } }) as never;

const renderLayer = () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <HapticInteractionLayer>
        <View />
      </HapticInteractionLayer>,
    );
  });

  return root!;
};

describe('HapticInteractionLayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('triggers a preference-aware haptic for a tap', () => {
    const root = renderLayer();
    const layer = root.root.findByProps({
      testID: 'haptic-interaction-layer',
    });

    ReactTestRenderer.act(() => {
      layer.props.onTouchStart(createTouchEvent(24, 32));
      layer.props.onTouchEnd(createTouchEvent(27, 35));
    });

    expect(triggerHaptic).toHaveBeenCalledWith('optionSelected');
  });

  it('does not trigger haptics for a drag gesture', () => {
    const root = renderLayer();
    const layer = root.root.findByProps({
      testID: 'haptic-interaction-layer',
    });

    ReactTestRenderer.act(() => {
      layer.props.onTouchStart(createTouchEvent(24, 32));
      layer.props.onTouchEnd(createTouchEvent(48, 64));
    });

    expect(triggerHaptic).not.toHaveBeenCalled();
  });
});
