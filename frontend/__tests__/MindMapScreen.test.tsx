/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MindMapScreen from '../src/screens/insights/MindMapScreen';
import { getInsightsMindMap } from '../src/services/insightsService';
import { resetAppStore, useAppStore } from '../src/store/appStore';

jest.mock('../src/services/insightsService', () => ({
  getInsightsMindMap: jest.fn(),
}));

jest.mock('../src/features/brainMap3D/NativeMindMapView', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: (props: any) => ReactModule.createElement(View, props),
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
          aiOptIn: true,
        },
      },
      hideJournalPreviews: false,
    });
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
        },
      ],
      disclaimer: {
        title: 'Reflection signal, not a medical measure',
        body: 'Brightness and pulse reflect patterns in your writing.',
      },
    } as any)
    .mockResolvedValueOnce({
      status: 'building',
      period: {
        range: 'latest_week',
        label: 'Apr 12 - Apr 18',
        startDate: '2026-04-12',
        endDate: '2026-04-20',
        entryCount: 2,
        activeDays: 2,
        clearEntryCount: 1,
        totalWords: 44,
        minimumActiveDays: 4,
        generatedAt: null,
      },
      summary: {
        headline: 'Your Mind Map is still building',
        narrative:
          'Journal.IO needs more clear writing before it can rank regions.',
        note: 'Keep adding honest entries.',
      },
      progress: {
        activeDays: 2,
        minimumActiveDays: 4,
        clearEntryCount: 1,
        entriesNeeded: 2,
        daysRemaining: null,
      },
      disclaimer: {
        title: 'Reflection signal, not a medical measure',
        body: 'Brightness and pulse reflect patterns in your writing.',
      },
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

  expect(mockedGetInsightsMindMap).toHaveBeenCalledWith('all_time');
  expect(treeText).toContain('Mind Map');
  expect(treeText).toContain('Strongest signal');

  const expandButton = root.root.findByProps({
    accessibilityLabel: 'Expand Mind Map details',
  });

  await ReactTestRenderer.act(async () => {
    expandButton.props.onPress();
  });

  treeText = await flushRenderer(root);
  expect(treeText).toContain('Preview hidden by Privacy Mode.');

  const latestWeekButton = root.root.findByProps({
    accessibilityLabel: 'Latest week',
  });

  await ReactTestRenderer.act(async () => {
    latestWeekButton.props.onPress();
  });

  treeText = await flushRenderer(root);
  expect(mockedGetInsightsMindMap).toHaveBeenLastCalledWith('latest_week');
  expect(treeText).toContain('Your Mind Map is still building');

  await ReactTestRenderer.act(async () => {
    root.unmount();
  });
});

test('MindMapScreen keeps free users in educational mode without requesting personal data', async () => {
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

  let root!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <MindMapScreen showBackButton={false} />
      </SafeAreaProvider>,
    );
  });

  let treeText = await flushRenderer(root);

  expect(mockedGetInsightsMindMap).not.toHaveBeenCalled();
  expect(treeText).toContain('Learn the eight reflection regions');
  expect(treeText).toContain(
    'does not show personal scores, activity, or inferred results',
  );

  const expandButton = root.root.findByProps({
    accessibilityLabel: 'Expand Mind Map details',
  });

  await ReactTestRenderer.act(async () => {
    expandButton.props.onPress();
  });

  treeText = await flushRenderer(root);
  expect(treeText).toContain('Emotional Intensity');
  expect(treeText).toContain('Reflection signal, not a medical measure');

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
