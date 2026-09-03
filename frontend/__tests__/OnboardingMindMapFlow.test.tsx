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
    default: (props: Record<string, unknown>) =>
      ReactModule.createElement(View, props),
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

jest.mock('../src/components/MindMapShareCaptureModal', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'mind-map-share-capture-modal',
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

function extractSceneScript(html: string) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .filter(Boolean);
  const scene = scripts[scripts.length - 1];

  if (!scene) {
    throw new Error('Mind Map scene script was not generated.');
  }

  return scene;
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
    root.root.findByProps({
      accessibilityLabel: 'Continue to share your Mind Map',
    }),
  ).toBeTruthy();
  expect(
    root.root.findAllByProps({
      accessibilityLabel: 'Share selected Mind Map region',
    }),
  ).toHaveLength(0);

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
      .findByProps({
        accessibilityLabel: 'Continue to share your Mind Map',
      })
      .props.onPress();
  });
  expect(onContinue).toHaveBeenCalledWith('planning_self_control');
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
  expect(
    root.root.findByProps({
      accessibilityLabel: 'Share selected Mind Map region',
    }),
  ).toBeTruthy();
  const detailCard = root.root.findByProps({
    accessibilityLabel:
      'View details for Self-Reflection & Identity, score 88 out of 100, Very High',
  });
  expect(detailCard.props.onLongPress).toBeUndefined();

  act(() => {
    root.root
      .findByProps({
        accessibilityLabel: 'Share selected Mind Map region',
      })
      .props.onPress({ stopPropagation: jest.fn() });
  });

  expect(
    root.root.findByProps({ testID: 'mind-map-share-capture-modal' }).props
      .region,
  ).toEqual({
    brainRegion: 'Default Mode Network',
    label: 'Self-Reflection & Identity',
    regionId: 'self_reflection_identity',
    scorePercent: 88,
    shortInsight:
      'Your first reflection centered on what you want to carry forward.',
  });
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

test('builds a static share renderer that returns a native-safe brain snapshot', () => {
  const html = buildMindMapHtml(undefined, 'share');

  expect(html).toContain('window.__MIND_MAP_PRESENTATION__="share"');
  expect(html).toContain('preserveDrawingBuffer:shareMode');
  expect(html).toContain("controls.enabled = !shareMode");
  expect(html).toContain('window.__captureShare');
  expect(html).toContain(
    "post({ type:'shareSnapshot', snapshot:canvas.toDataURL('image/png'), pin:projectSelectedPin() });",
  );
});

// The scene is a concatenated array of quoted JS lines, so a dropped quote is a
// runtime crash in the WebView that no `toContain` assertion would catch.
test('emits a scene script that actually parses as JavaScript', () => {
  for (const mode of ['interactive', 'share'] as const) {
    const html = buildMindMapHtml(undefined, mode);
    const scene = extractSceneScript(html);

    expect(scene.length).toBeGreaterThan(1000);
    // Executing is intentionally avoided; construction only validates syntax.
    // eslint-disable-next-line no-new-func
    expect(() => new Function(scene)).not.toThrow();
  }
});

test('captures the share snapshot at an explicit square, never at layout size', () => {
  const html = buildMindMapHtml(undefined, 'share');

  // The old path snapshotted whatever the canvas happened to be, which on an
  // unsettled card was 1px wide. The capture now sizes the renderer itself.
  expect(html).toContain('renderer.setSize(w, h, false);');
  expect(html).toContain('camera.aspect=w/h; camera.updateProjectionMatrix();');
  expect(html).toContain('if(canvas.width<200 || canvas.height<200)');
  // …and restores whatever the live canvas was using afterwards.
  expect(html).toContain('renderer.setSize(prevW, prevH, false);');
  // contentReady no longer carries a snapshot.
  expect(html).not.toContain("msg.snapshot=canvas.toDataURL");
});

test('frames the whole brain and reports where the selected pin landed', () => {
  const html = buildMindMapHtml(undefined, 'share');
  const scene = extractSceneScript(html);

  // Distance is fitted per axis against the real vertices. A Box3 bounding sphere
  // circumscribes the axis-aligned box rather than the object (2.52 vs a true
  // 1.79 here), which parked the camera ~2x too far and left the brain filling
  // barely half the frame.
  expect(scene).not.toContain('getBoundingSphere');
  expect(html).toContain('function shareCameraDistance(direction, margin){');
  expect(html).toContain('_fitR.crossVectors(_fitF,_fitUp);');
  expect(html).toContain('var a=Math.abs(_fitW.dot(_fitR))/tanH + c;');
  expect(html).toContain('var b=Math.abs(_fitW.dot(_fitU))/tanV + c;');
  expect(html).toContain(
    'camera.position.copy(direction).multiplyScalar(dist).add(SHARE_TARGET);',
  );
  expect(html).toContain('camera.aspect=w/h; camera.updateProjectionMatrix();');
  // controls.update() would clamp back to maxDistance and re-crop the model.
  expect(html).toContain('camera.lookAt(SHARE_TARGET);');
  expect(html).not.toContain('camera.position.copy(direction.multiplyScalar(3.15));');
  // Pins are DOM overlays, so their position ships alongside the image.
  expect(html).toContain("post({ type:'shareSnapshot', snapshot:canvas.toDataURL('image/png'), pin:projectSelectedPin() });");
  // A still frame gets a static halo instead of the interactive pulse.
  expect(html).toContain('.share-mode .pin.strong::after');
  expect(html).toContain('animation:none;');
});
