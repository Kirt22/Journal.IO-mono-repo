/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MindMapScreen from '../src/screens/insights/MindMapScreen';
import {
  getInsightsMindMap,
  getInsightsMindMapRegionSeries,
} from '../src/services/insightsService';
import { getCurrentStreakSummary } from '../src/services/streaksService';
import { resetAppStore, useAppStore } from '../src/store/appStore';

jest.mock('../src/services/insightsService', () => ({
  getInsightsMindMap: jest.fn(),
  getInsightsMindMapRegionSeries: jest.fn(),
}));

jest.mock('../src/services/streaksService', () => ({
  getCurrentStreakSummary: jest.fn(),
}));

jest.mock('../src/services/paywallService', () => ({
  trackPaywallEvent: jest.fn().mockResolvedValue(undefined),
}));

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

jest.mock('../src/features/brainMap3D/webRenderer/WebMindMapView', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  function MockWebMindMapView({ onReady, ...props }: any) {
    // Mirror the real renderer signalling that the 3D model has loaded, which
    // is what releases the screen's data-load gate.
    ReactModule.useEffect(() => {
      onReady?.();
    }, [onReady]);
    return ReactModule.createElement(View, props);
  }

  return {
    __esModule: true,
    default: MockWebMindMapView,
  };
});

jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({
    isReady: () => false,
    dispatch: jest.fn(),
    navigate: jest.fn(),
    canGoBack: () => false,
    goBack: jest.fn(),
  }),
  useNavigation: () => ({
    goBack: jest.fn(),
    navigate: jest.fn(),
  }),
}));

const mockedGetInsightsMindMap = getInsightsMindMap as jest.MockedFunction<
  typeof getInsightsMindMap
>;
const mockedGetRegionSeries =
  getInsightsMindMapRegionSeries as jest.MockedFunction<
    typeof getInsightsMindMapRegionSeries
  >;
const mockedGetStreakSummary =
  getCurrentStreakSummary as jest.MockedFunction<typeof getCurrentStreakSummary>;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function makeReadyMindMap() {
  return {
    status: 'ready',
    period: {
      range: 'all_time',
      label: 'All reflections',
      startDate: '2026-04-12',
      endDate: '2026-04-18',
      entryCount: 4,
      activeDays: 4,
      clearEntryCount: 4,
      totalWords: 240,
      minimumActiveDays: 4,
      generatedAt: '2026-04-20T10:00:00.000Z',
    },
    summary: {
      headline:
        'Planning & Self-Control carried the strongest reflection signal',
      narrative: 'Weekly narrative',
      note: 'Brightness reflects writing patterns.',
    },
    strongestRegionId: 'planning_self_control',
    regions: [
      {
        id: 'planning_self_control',
        productLabel: 'Planning & Self-Control',
        brainRegionSubtitle: 'Prefrontal Cortex',
        signalScore: 0.84,
        confidence: 0.82,
        rank: 1,
        intensity: 'high',
        shortInsight: 'Planning stood out most clearly.',
        actionStep: 'Write down the first step for tomorrow.',
        evidenceSnippets: ['planned tomorrow carefully'],
        trend: 'steady',
        trendLabel: 'Planning & Self-Control has stayed steady.',
        tier: 'very_high',
        tierLabel: 'Very High',
      },
      {
        id: 'emotional_intensity',
        productLabel: 'Emotional Intensity',
        brainRegionSubtitle: 'Amygdala',
        signalScore: 0.7,
        confidence: 0.72,
        rank: 2,
        intensity: 'high',
        shortInsight: 'Stress stayed present.',
        actionStep: 'Notice what helps you reset.',
        evidenceSnippets: ['work stress felt heavy'],
        trend: 'steady',
        trendLabel: 'Emotional Intensity has stayed steady.',
        tier: 'high',
        tierLabel: 'High',
      },
    ],
    overallTier: {
      tier: 'deeply_reflective',
      label: 'Deeply Reflective',
      blurb: 'You go deeper than most journalers in a few areas.',
    },
    disclaimer: {
      title: 'Reflection signal, not a medical measure',
      body: 'Brightness and pulse reflect patterns in your writing.',
    },
  } as any;
}

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

function extractText(node: unknown): string {
  if (node == null) {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(child => extractText(child)).join('');
  }

  if (typeof node === 'object' && 'children' in node) {
    return extractText((node as { children?: unknown }).children);
  }

  return '';
}

async function flushRenderer(root: ReactTestRenderer.ReactTestRenderer) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await ReactTestRenderer.act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }

  return extractText(root.toJSON());
}

beforeEach(() => {
  jest.clearAllMocks();
  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.setState({
      session: {
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        user: {
          userId: 'user-test',
          name: 'Journal User',
          phoneNumber: null,
          email: 'journal@example.com',
          isPremium: true,
          journalingGoals: [],
          avatarColor: null,
          profileSetupCompleted: true,
          onboardingCompleted: true,
          profilePic: null,
        },
      },
      hideJournalPreviews: false,
    });
  });
});

test('MindMapScreen shows two shimmer cards before revealing loaded details', async () => {
  const pendingMap = createDeferred<any>();
  mockedGetInsightsMindMap.mockReturnValueOnce(pendingMap.promise);

  let root!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <MindMapScreen />
      </SafeAreaProvider>,
    );
  });

  await flushRenderer(root);

  expect(
    root.root.findAllByProps({ testID: 'mind-map-loading-primary-card' }),
  ).not.toHaveLength(0);
  expect(
    root.root.findAllByProps({ testID: 'mind-map-loading-region-card' }),
  ).not.toHaveLength(0);

  await ReactTestRenderer.act(async () => {
    pendingMap.resolve(makeReadyMindMap());
    await Promise.resolve();
  });

  const treeText = await flushRenderer(root);
  expect(
    root.root.findAllByProps({ testID: 'mind-map-loading-skeleton' }),
  ).toHaveLength(0);
  expect(treeText).toContain('Planning & Self-Control');
  expect(treeText).toContain('All regions');

  await ReactTestRenderer.act(async () => {
    root.unmount();
  });
});

test('MindMapScreen returns from a card error to shimmer before retrying', async () => {
  const retryMap = createDeferred<any>();
  mockedGetInsightsMindMap
    .mockRejectedValueOnce(new Error('Your connection is unavailable.'))
    .mockReturnValueOnce(retryMap.promise);

  let root!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <MindMapScreen />
      </SafeAreaProvider>,
    );
  });

  let treeText = await flushRenderer(root);
  expect(
    root.root.findAllByProps({ testID: 'mind-map-error-card' }),
  ).not.toHaveLength(0);
  expect(treeText).toContain('We could not load your Mind Map');
  expect(treeText).toContain('Your connection is unavailable.');

  const retryButton = root.root.findByProps({
    accessibilityLabel: 'Retry Mind Map',
  });
  await ReactTestRenderer.act(async () => {
    retryButton.props.onPress();
    await Promise.resolve();
  });

  expect(mockedGetInsightsMindMap).toHaveBeenCalledTimes(2);
  expect(
    root.root.findAllByProps({ testID: 'mind-map-loading-skeleton' }),
  ).not.toHaveLength(0);

  await ReactTestRenderer.act(async () => {
    retryMap.resolve(makeReadyMindMap());
    await Promise.resolve();
  });

  treeText = await flushRenderer(root);
  expect(
    root.root.findAllByProps({ testID: 'mind-map-error-card' }),
  ).toHaveLength(0);
  expect(treeText).toContain('Planning & Self-Control');

  await ReactTestRenderer.act(async () => {
    root.unmount();
  });
});

test('MindMapScreen switches ranges and masks evidence when previews are hidden', async () => {
  mockedGetInsightsMindMap
    .mockResolvedValueOnce({
      status: 'ready',
      period: {
        range: 'all_time',
        label: 'All reflections',
        startDate: '2026-04-12',
        endDate: '2026-04-18',
        entryCount: 4,
        activeDays: 4,
        clearEntryCount: 4,
        totalWords: 240,
        minimumActiveDays: 4,
        generatedAt: '2026-04-20T10:00:00.000Z',
      },
      summary: {
        headline:
          'Planning & Self-Control carried the strongest reflection signal',
        narrative: 'Weekly narrative',
        note: 'Brightness reflects writing patterns.',
      },
      strongestRegionId: 'planning_self_control',
      regions: [
        {
          id: 'planning_self_control',
          productLabel: 'Planning & Self-Control',
          brainRegionSubtitle: 'Prefrontal Cortex',
          signalScore: 1,
          confidence: 0.82,
          rank: 1,
          intensity: 'high',
          shortInsight: 'Planning stood out most clearly.',
          evidenceSnippets: ['planned tomorrow carefully'],
          trend: 'steady',
          trendLabel: 'Planning & Self-Control has stayed steady.',
          tier: 'very_high',
          tierLabel: 'Very High',
        },
        {
          id: 'emotional_intensity',
          productLabel: 'Emotional Intensity',
          brainRegionSubtitle: 'Amygdala',
          signalScore: 0.7,
          confidence: 0.72,
          rank: 2,
          intensity: 'high',
          shortInsight: 'Stress stayed present.',
          evidenceSnippets: ['work stress felt heavy'],
          trend: 'steady',
          trendLabel: 'Emotional Intensity has stayed steady.',
          tier: 'high',
          tierLabel: 'High',
        },
      ],
      overallTier: {
        tier: 'deeply_reflective',
        label: 'Deeply Reflective',
        blurb: 'You go deeper than most journalers in a few areas.',
      },
      disclaimer: {
        title: 'Reflection signal, not a medical measure',
        body: 'Brightness and pulse reflect patterns in your writing.',
      },
    } as any);

  mockedGetRegionSeries.mockResolvedValue({
    regionId: 'planning_self_control',
    productLabel: 'Planning & Self-Control',
    brainRegionSubtitle: 'Prefrontal Cortex',
    range: 'all_time',
    bucket: 'day',
    startDate: '2026-03-22',
    endDate: '2026-04-20',
    points: [
      { dateKey: '2026-04-01', label: 'Apr 1', value: 0.4 },
      { dateKey: '2026-04-08', label: 'Apr 8', value: 0.7 },
    ],
  } as any);

  useAppStore.setState({ hideJournalPreviews: true });

  let root!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <MindMapScreen />
      </SafeAreaProvider>,
    );
  });

  let treeText = await flushRenderer(root);

  // The Mind Map shows all-time reflection analytics.
  expect(mockedGetInsightsMindMap).toHaveBeenCalledWith('all_time');
  expect(treeText).toContain('Mind Map');
  expect(treeText).toContain('All-time reflection analytics');
  // The selected-region card (defaults to the strongest region) shows its
  // tier band; the compact list shows every region.
  expect(treeText).toContain('Very High');
  expect(treeText).toContain('Emotional Intensity');
  // Evidence lives in the region sheet, not the panel.
  expect(treeText).not.toContain('Preview hidden by your entry privacy setting.');

  // Tapping the selected card fetches its development series and opens the
  // sheet, where masked evidence reflects the entry privacy setting.
  const selectedCard = root.root.findByProps({
    accessibilityLabel: 'Planning & Self-Control. View analytics.',
  });
  expect(selectedCard.props.onLongPress).toBeUndefined();
  const shareButton = root.root.findByProps({
    accessibilityLabel: 'Share selected Mind Map region',
  });

  ReactTestRenderer.act(() => {
    shareButton.props.onPress({ stopPropagation: jest.fn() });
  });

  expect(
    root.root.findByProps({ testID: 'mind-map-share-capture-modal' }).props
      .region,
  ).toEqual({
    brainRegion: 'Prefrontal Cortex',
    label: 'Planning & Self-Control',
    regionId: 'planning_self_control',
    scorePercent: 100,
    shortInsight: 'Planning stood out most clearly.',
  });

  await ReactTestRenderer.act(async () => {
    selectedCard.props.onPress();
  });

  treeText = await flushRenderer(root);
  expect(mockedGetRegionSeries).toHaveBeenCalledWith(
    'planning_self_control',
    'all_time',
  );
  expect(treeText).toContain('Preview hidden by your entry privacy setting.');

  await ReactTestRenderer.act(async () => {
    root.unmount();
  });
});

function makeFreeUser() {
  ReactTestRenderer.act(() => {
    useAppStore.setState(state => ({
      session: state.session
        ? {
            ...state.session,
            user: {
              ...state.session.user,
              isPremium: false,
            },
          }
        : null,
    }));
  });
}

test('MindMapScreen never shows unlock progress to free users', async () => {
  makeFreeUser();

  let root!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <MindMapScreen showBackButton={false} />
      </SafeAreaProvider>,
    );
  });

  const treeText = await flushRenderer(root);

  // The free screen is static: no premium endpoint, and no entry count either
  // — the unlock meter is a premium-only concern.
  expect(mockedGetInsightsMindMap).not.toHaveBeenCalled();
  expect(mockedGetStreakSummary).not.toHaveBeenCalled();
  expect(treeText).not.toContain('Your Mind Map is still building');
  // Just the standard screen: educational regions with the signal gated.
  expect(treeText).toContain('All regions');
  expect(treeText).toContain('Emotional Intensity');
  expect(treeText).toContain('Upgrade to see full insights');

  await ReactTestRenderer.act(async () => {
    root.unmount();
  });
});

test('MindMapScreen shows a blurred upgrade card for free users', async () => {
  makeFreeUser();

  const openPaywallForPlacement = jest.fn();
  ReactTestRenderer.act(() => {
    useAppStore.setState({ openPaywallForPlacement });
  });

  let root!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <MindMapScreen showBackButton={false} />
      </SafeAreaProvider>,
    );
  });

  const treeText = await flushRenderer(root);

  expect(mockedGetInsightsMindMap).not.toHaveBeenCalled();
  // The selected card (scoring blurred behind an upgrade prompt) + the region
  // list, whatever the entry count.
  expect(treeText).not.toContain('Your Mind Map is still building');
  expect(treeText).toContain('Emotional Intensity');
  expect(treeText).toContain('Upgrade to see full insights');

  // Tapping the blurred scoring's upgrade prompt opens the paywall.
  const upgradeCard = root.root.findByProps({
    accessibilityLabel: 'Upgrade to see full insights',
  });
  await ReactTestRenderer.act(async () => {
    upgradeCard.props.onPress();
    // The region sheet closes first, so the paywall is raised a tick later —
    // otherwise the pushed route renders behind a modal that never dismissed.
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
  });
  expect(openPaywallForPlacement).toHaveBeenCalledWith(
    expect.objectContaining({ placementKey: 'insights_ai_tab_locked' }),
  );

  await ReactTestRenderer.act(async () => {
    root.unmount();
  });
});

test('MindMapScreen tells premium users under the threshold that signals are pending', async () => {
  mockedGetInsightsMindMap.mockResolvedValue({
    status: 'building',
    period: {
      range: 'all_time',
      label: 'All reflections',
      startDate: '2026-04-12',
      endDate: '2026-04-18',
      entryCount: 2,
      activeDays: 2,
      clearEntryCount: 2,
      totalWords: 90,
      minimumActiveDays: 4,
      generatedAt: '2026-04-20T10:00:00.000Z',
    },
    summary: {
      headline: 'Your Mind Map is still building',
      narrative: 'A few more clear entries unlock the ranked regions.',
      note: 'Keep adding honest entries in your own words.',
    },
    progress: {
      activeDays: 2,
      minimumActiveDays: 4,
      clearEntryCount: 2,
      entriesNeeded: 3,
      daysRemaining: null,
    },
  } as any);

  let root!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <MindMapScreen showBackButton={false} />
      </SafeAreaProvider>,
    );
  });

  let treeText = await flushRenderer(root);

  // Premium keeps the unlock meter.
  expect(treeText).toContain('Your Mind Map is still building');
  expect(treeText).toContain('2/5');

  // Opening a region must not paywall someone who already pays — no personal
  // signal exists yet, and the sheet says exactly that.
  const selectedCard = root.root.findByProps({
    accessibilityLabel: 'Emotional Intensity. Learn more.',
  });
  await ReactTestRenderer.act(async () => {
    selectedCard.props.onPress();
  });

  treeText = await flushRenderer(root);
  expect(treeText).toContain("Your personalised signals aren't ready yet");
  expect(treeText).not.toContain('Upgrade to see full insights');
  // Nothing personal to fetch while the map is still building.
  expect(mockedGetRegionSeries).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    root.unmount();
  });
});

test('MindMapScreen renders support-first copy', async () => {
  mockedGetInsightsMindMap.mockResolvedValue({
    status: 'support_first',
    period: {
      range: 'latest_week',
      label: 'Apr 12 - Apr 18',
      startDate: '2026-04-12',
      endDate: '2026-04-18',
      entryCount: 4,
      activeDays: 4,
      clearEntryCount: 0,
      totalWords: 0,
      minimumActiveDays: 4,
      generatedAt: '2026-04-20T10:00:00.000Z',
    },
    summary: {
      headline: 'This week needs a support-first read',
      narrative: 'Journal.IO noticed elevated-risk language in the week.',
      note: 'Support-first handling takes priority over region ranking.',
    },
    support: {
      headline: 'A calmer next step matters more than a ranked map right now.',
      body: 'Please reach out to local emergency or crisis support now.',
      note: 'Journal.IO hides normal scoring for safety-sensitive writing.',
    },
    disclaimer: {
      title: 'Reflection signal, not a medical measure',
      body: 'Brightness and pulse reflect patterns in your writing.',
    },
  } as any);

  let root!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <MindMapScreen />
      </SafeAreaProvider>,
    );
  });

  const treeText = await flushRenderer(root);

  expect(treeText).toContain('This week needs a support-first read');
  expect(treeText).toContain(
    'Please reach out to local emergency or crisis support now.',
  );

  await ReactTestRenderer.act(async () => {
    root.unmount();
  });
});
