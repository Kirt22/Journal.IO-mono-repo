import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingV2Screen from '../src/screens/onboarding/OnboardingV2Screen';
import { ThemeProvider } from '../src/theme/provider';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../src/config/onboarding', () => ({
  ...jest.requireActual('../src/config/onboarding'),
  ENABLE_ONBOARDING_DEV_SHORTCUTS: true,
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
jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

const DEV_SKIP_LABEL = 'Dev: skip to the rating step';

function render() {
  return ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <ThemeProvider modeOverride="light">
        <OnboardingV2Screen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('the dev shortcut jumps straight to the rating step with a usable payload', () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    root = render();
  });

  act(() => {
    root.root.findByProps({ accessibilityLabel: DEV_SKIP_LABEL }).props.onPress();
  });

  expect(mockNavigate).toHaveBeenCalledTimes(1);

  const [routeName, payload] = mockNavigate.mock.calls[0];

  expect(routeName).toBe('FirstReflectionRating');
  // The rating step forwards these params to the streak step, which reads all
  // of them — a partial payload would render holes two screens later.
  expect(payload.sessionAnalysis.brainSessionMap.centers).toHaveLength(8);
  expect(payload.sessionAnalysis.brainSessionMap.dominantCenter).toEqual(
    payload.sessionAnalysis.brainSessionMap.centers[0],
  );
  expect(payload.goalSuggestions.length).toBeGreaterThan(0);
  expect(payload.answers.good_exciting).toEqual(expect.any(String));
  expect(payload.threadMessages).toHaveLength(1);
  expect(payload.draft).toBeDefined();

  act(() => {
    root.unmount();
  });
});
