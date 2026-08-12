import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Keyboard } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingV2Screen from '../src/screens/onboarding/OnboardingV2Screen';
import { ThemeProvider } from '../src/theme/provider';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

// This test counts every button on screen to prove the CTA hides while the
// name field is focused, so the dev-only skip shortcut is switched off here.
jest.mock('../src/config/onboarding', () => ({
  ...jest.requireActual('../src/config/onboarding'),
  ENABLE_ONBOARDING_DEV_SHORTCUTS: false,
}));

jest.mock('../src/components/OnboardingBottomSheet', () => () => null);
jest.mock('../src/components/OnboardingHero', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return () => ReactModule.createElement(View);
});
jest.mock('../src/components/OnboardingProgressDots', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return () => ReactModule.createElement(View);
});
jest.mock('../src/components/OnboardingOptionCard', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return () => ReactModule.createElement(View);
});
jest.mock('../src/components/ThemePreviewCard', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return () => ReactModule.createElement(View);
});
jest.mock('../src/components/WavingHandIcon', () => () => null);
jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

function extractText(node: unknown): string {
  if (node == null) {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }
  if (typeof node === 'object' && 'children' in node) {
    return extractText((node as { children?: unknown }).children);
  }
  return '';
}

test('keeps welcome and name separate, dismisses Return, then personalizes the flow', () => {
  let root!: ReactTestRenderer.ReactTestRenderer;
  const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');

  act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ThemeProvider modeOverride="light">
          <OnboardingV2Screen />
        </ThemeProvider>
      </SafeAreaProvider>,
    );
  });

  expect(extractText(root.toJSON())).toContain('Ready to begin?');
  expect(extractText(root.toJSON())).not.toContain('Hey! What do we call you?');

  act(() => {
    root.root.findByProps({ testID: 'onboarding-primary-action' }).props.onPress();
  });

  expect(extractText(root.toJSON())).toContain('Hey! What do we call you?');

  const nameInput = root.root.findByProps({
    accessibilityLabel: 'What should Journal.IO call you?',
  });
  expect(nameInput.props.autoFocus).toBeUndefined();
  act(() => {
    nameInput.props.onFocus();
  });
  expect(root.root.findAllByProps({ testID: 'onboarding-primary-action' })).toHaveLength(0);
  act(() => {
    nameInput.props.onSubmitEditing();
  });
  expect(dismissKeyboard).toHaveBeenCalled();
  expect(extractText(root.toJSON())).toContain('Hey! What do we call you?');
  act(() => {
    nameInput.props.onBlur();
  });

  const continueButton = root.root.findByProps({
    testID: 'onboarding-primary-action',
  });
  act(() => {
    continueButton.props.onPress();
  });
  expect(extractText(root.toJSON())).toContain(
    'Please add the name you would like us to use.',
  );

  act(() => {
    nameInput.props.onChangeText('Avery James');
  });
  act(() => {
    root.root.findByProps({ testID: 'onboarding-primary-action' }).props.onPress();
  });

  expect(extractText(root.toJSON())).toContain(
    'Avery, how did you hear about us?',
  );
  act(() => {
    root.unmount();
  });
  dismissKeyboard.mockRestore();
});
