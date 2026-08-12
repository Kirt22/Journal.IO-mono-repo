import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingMindMapLoaderScreen from '../src/screens/onboarding/OnboardingMindMapLoaderScreen';
import OnboardingMindMapScreen from '../src/screens/onboarding/OnboardingMindMapScreen';
import { buildMindMapHtml } from '../src/features/brainMap3D/webRenderer/buildMindMapHtml';
import type { GuidedReflectionSessionAnalysisResponse } from '../src/services/guidedReflectionService';
import { ThemeProvider } from '../src/theme/provider';

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

jest.mock('../src/features/brainMap3D/webRenderer/WebMindMapView', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: (props: unknown) => ReactModule.createElement(View, props),
  };
});

jest.mock('../src/components/MindMapRegionDetailSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: ({ visible, region }: { visible: boolean; region: unknown }) =>
      ReactModule.createElement(View, {
        testID: 'mind-map-region-detail-sheet',
        visible,
        region,
      }),
  };
});

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

const centers = [
  {
    id: 'self_reflection_identity',
    productName: 'Self-Reflection & Identity',
    brainRegion: 'Default Mode Network',
    score: 0.88,
    confidence: 0.7,
    rank: 1,
    intensity: 'high',
    evidence: [],
    shortInsight:
      'Your first reflection centered on what you want to carry forward.',
    nuancedDetails: {},
  },
  {
    id: 'planning_self_control',
    productName: 'Planning & Self-Control',
    brainRegion: 'Prefrontal Cortex',
    score: 0.62,
    confidence: 0.54,
    rank: 2,
    intensity: 'moderate',
    evidence: ['carry forward'],
    shortInsight: 'A small next step appears meaningful for tomorrow.',
    nuancedDetails: {},
  },
] as const;

const sessionAnalysis = {
  analysis: 'A calm first reflection.',
  majorInsight: 'One small action can be enough.',
  observedTrends: ['Focus'],
  hasEnoughSignal: true,
  brainSessionMap: {
    dominantCenterId: 'self_reflection_identity',
    dominantCenter: centers[0],
    secondaryCenterIds: ['planning_self_control'],
    secondaryCenters: [centers[1]],
    centers: [...centers],
    neuroscienceSummary: 'A first reflection signal.',
    mostNoticedText: 'Self-reflection stood out.',
    mindMapSeedText: 'Your first reflection added a signal.',
  },
} as unknown as GuidedReflectionSessionAnalysisResponse;

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

function render(node: React.ReactElement) {
  return ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <ThemeProvider modeOverride="light">{node}</ThemeProvider>
    </SafeAreaProvider>,
  );
}

test('loader advances to the Mind Map after its minimum wait', async () => {
  jest.useFakeTimers();
  const onComplete = jest.fn();
  let root!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    root = render(<OnboardingMindMapLoaderScreen onComplete={onComplete} />);
  });
  await act(async () => {
    await Promise.resolve();
  });

  act(() => {
    jest.advanceTimersByTime(3199);
  });
  expect(onComplete).not.toHaveBeenCalled();

  act(() => {
    jest.advanceTimersByTime(1);
  });
  expect(onComplete).toHaveBeenCalledTimes(1);
  act(() => {
    root.unmount();
  });
  jest.useRealTimers();
});

test('renders first-reflection regions in the interactive Mind Map and continues', async () => {
  const onContinue = jest.fn();
  let root!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    root = render(
      <OnboardingMindMapScreen
        onContinue={onContinue}
        sessionAnalysis={sessionAnalysis}
      />,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });

  const map = root.root.findByProps({
    selectedRegionId: 'self_reflection_identity',
  });
  expect(map.props.regions).toHaveLength(2);
  expect(
    root.root.findByProps({ accessibilityLabel: 'Continue to your streak' }),
  ).toBeTruthy();

  act(() => {
    map.props.onRegionPress({
      nativeEvent: { regionId: 'planning_self_control' },
    });
  });
  expect(extractText(root.toJSON())).toContain(
    'A small next step appears meaningful for tomorrow.',
  );
  expect(extractText(root.toJSON())).toContain('62 / 100');
  expect(extractText(root.toJSON())).toContain('High');
  expect(extractText(root.toJSON())).not.toContain('62%');

  act(() => {
    root.root
      .findByProps({
        accessibilityLabel:
          'View details for Planning & Self-Control, score 62 out of 100, High',
      })
      .props.onPress();
  });
  const detailSheet = root.root.findByProps({
    testID: 'mind-map-region-detail-sheet',
  });
  expect(detailSheet.props.visible).toBe(true);
  expect(detailSheet.props.region.evidence).toEqual(['carry forward']);

  act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Continue to your streak' })
      .props.onPress();
  });
  expect(onContinue).toHaveBeenCalledTimes(1);
  act(() => {
    root.unmount();
  });
});

test('reuses the onboarding Mind Map layout with session-specific copy', async () => {
  const onContinue = jest.fn();
  let root!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    root = render(
      <OnboardingMindMapScreen
        onContinue={onContinue}
        sessionAnalysis={sessionAnalysis}
        variant="session"
      />,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });

  const text = extractText(root.toJSON());
  expect(text).toContain('YOUR SESSION MIND MAP');
  expect(text).toContain('SESSION SIGNAL');
  expect(text).not.toContain('YOUR FIRST MIND MAP');
  expect(
    root.root.findByProps({ accessibilityLabel: 'Continue to Home' }),
  ).toBeTruthy();
  act(() => {
    root.unmount();
  });
});

test('builds a clean, bounded pin tooltip without lobe labels', () => {
  const html = buildMindMapHtml();

  expect(html).not.toContain('lobekey');
  expect(html).not.toContain('lobe legend');
  expect(html).toContain(
    "r.subtitle + '  \\u00b7  ' + Math.round(r.signalScore*100) + '%'",
  );
  expect(html).toContain('max-width:calc(100% - 24px)');
});
