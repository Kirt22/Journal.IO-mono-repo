import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingMindMapShareScreen from '../src/screens/onboarding/OnboardingMindMapShareScreen';
import type { GuidedReflectionSessionAnalysisResponse } from '../src/services/guidedReflectionService';
import { shareMindMapImage } from '../src/services/mindMapShareService';
import { ThemeProvider } from '../src/theme/provider';

let mockReduceMotion = true;

jest.mock('../src/hooks/useReduceMotion', () => ({
  useReduceMotion: () => mockReduceMotion,
}));

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

jest.mock('../src/services/mindMapShareService', () => ({
  shareMindMapImage: jest.fn(async () => 'shared'),
}));

jest.mock('../src/components/MindMapShareCard', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ReactModule.forwardRef(
      ({ onReadyChange, region, testID }: any, ref: any) => {
        ReactModule.useImperativeHandle(ref, () => ({
          capture: jest.fn(async () => '/tmp/share-card.png'),
        }));
        ReactModule.useEffect(() => {
          onReadyChange?.(true);
        }, [onReadyChange]);
        return ReactModule.createElement(View, { region, testID });
      },
    ),
  };
});

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

const center = {
  id: 'self_reflection_identity',
  productName: 'Self-Reflection & Identity',
  brainRegion: 'Default Mode Network',
  score: 0.88,
  confidence: 0.7,
  rank: 1,
  intensity: 'high',
  evidence: [],
  shortInsight: 'Your reflection centered on what you want to carry forward.',
  nuancedDetails: {},
} as const;

const sessionAnalysis = {
  brainSessionMap: {
    dominantCenter: center,
    dominantCenterId: center.id,
    centers: [center],
    secondaryCenterIds: [],
    secondaryCenters: [],
    mindMapSeedText: '',
    mostNoticedText: '',
    neuroscienceSummary: '',
  },
} as unknown as GuidedReflectionSessionAnalysisResponse;

beforeEach(() => {
  mockReduceMotion = true;
  jest.clearAllMocks();
});

function render(node: React.ReactElement) {
  return ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <ThemeProvider modeOverride="light">{node}</ThemeProvider>
    </SafeAreaProvider>,
  );
}

test('shares the visible card and advances once the share completes', async () => {
  const onMaybeLater = jest.fn();
  const onShared = jest.fn();
  let root!: ReactTestRenderer.ReactTestRenderer;

  await act(async () => {
    root = render(
      <OnboardingMindMapShareScreen
        onMaybeLater={onMaybeLater}
        onShared={onShared}
        selectedRegionId="self_reflection_identity"
        sessionAnalysis={sessionAnalysis}
      />,
    );
  });

  const cardRegion = root.root.findByProps({
    testID: 'onboarding-mind-map-share-card',
  }).props.region;
  expect(cardRegion.scorePercent).toBe(88);
  expect(cardRegion.brainRegion).toBe('Default Mode Network');

  // The subtitle was dropped in favour of the animated share icon.
  expect(
    root.root.findAllByProps({
      testID: 'onboarding-mind-map-share-icon',
    }).length,
  ).toBeGreaterThan(0);

  await act(async () => {
    await root.root.findByProps({ accessibilityLabel: 'Share now' }).props.onPress();
  });
  expect(shareMindMapImage).toHaveBeenCalledWith('/tmp/share-card.png');
  expect(onShared).toHaveBeenCalledTimes(1);
  expect(onMaybeLater).not.toHaveBeenCalled();

  act(() => {
    root.root.findByProps({ accessibilityLabel: 'Maybe later' }).props.onPress();
  });
  expect(onMaybeLater).toHaveBeenCalledTimes(1);

  act(() => root.unmount());
});

test('keeps the buttons inert until the entrance animation has finished', async () => {
  // The tap that navigates here lands where "Maybe later" is about to appear,
  // which used to skip the whole step.
  mockReduceMotion = false;
  const onMaybeLater = jest.fn();
  let root!: ReactTestRenderer.ReactTestRenderer;

  await act(async () => {
    root = render(
      <OnboardingMindMapShareScreen
        onMaybeLater={onMaybeLater}
        selectedRegionId="self_reflection_identity"
        sessionAnalysis={sessionAnalysis}
      />,
    );
  });

  const actions = root.root.findByProps({
    testID: 'onboarding-mind-map-share-actions',
  });
  expect(actions.props.pointerEvents).toBe('none');

  act(() => {
    root.root.findByProps({ accessibilityLabel: 'Maybe later' }).props.onPress();
  });
  expect(onMaybeLater).not.toHaveBeenCalled();

  act(() => root.unmount());
});

test('stays on the share step when the native sheet is dismissed', async () => {
  (shareMindMapImage as jest.Mock).mockResolvedValueOnce('dismissed');
  const onMaybeLater = jest.fn();
  const onShared = jest.fn();
  let root!: ReactTestRenderer.ReactTestRenderer;

  await act(async () => {
    root = render(
      <OnboardingMindMapShareScreen
        onMaybeLater={onMaybeLater}
        onShared={onShared}
        selectedRegionId="self_reflection_identity"
        sessionAnalysis={sessionAnalysis}
      />,
    );
  });

  await act(async () => {
    await root.root.findByProps({ accessibilityLabel: 'Share now' }).props.onPress();
  });

  expect(shareMindMapImage).toHaveBeenCalledWith('/tmp/share-card.png');
  expect(onShared).not.toHaveBeenCalled();
  expect(onMaybeLater).not.toHaveBeenCalled();

  act(() => root.unmount());
});
