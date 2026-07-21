import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import PrimaryButton from '../src/components/PrimaryButton';
import { ThemeProvider } from '../src/theme/provider';

function renderButton(loading: boolean) {
  return (
    <ThemeProvider modeOverride="light">
      <PrimaryButton label="Save entry" loading={loading} onPress={jest.fn()} />
    </ThemeProvider>
  );
}

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({
    remove: jest.fn(),
  } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('keeps the resting label mounted while the button is busy', () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(renderButton(false));
  });

  ReactTestRenderer.act(() => {
    renderer.update(renderButton(true));
  });

  const button = renderer.root.findByProps({ accessibilityRole: 'button' });

  expect(button.props.accessibilityState).toEqual({ busy: true, disabled: true });
  expect(
    renderer.root.findAll(node => node.children.includes('Save entry')).length,
  ).toBeGreaterThan(0);
});
