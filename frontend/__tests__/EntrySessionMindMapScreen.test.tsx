/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import EntrySessionMindMapScreen from '../src/screens/insights/EntrySessionMindMapScreen';
import { getJournalSessionAnalysis } from '../src/services/journalService';
import type { GuidedReflectionSessionAnalysisResponse } from '../src/services/guidedReflectionService';
import { resetAppStore, useAppStore } from '../src/store/appStore';
import { ThemeProvider } from '../src/theme/provider';

jest.mock('../src/services/journalService', () => ({
  getJournalSessionAnalysis: jest.fn(),
}));

jest.mock('../src/screens/onboarding/OnboardingMindMapLoaderScreen', () => {
  const ReactModule = require('react');
  const { View: MockView } = require('react-native');

  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactModule.createElement(MockView, {
        ...props,
        testID: 'session-mind-map-loader',
      }),
  };
});

jest.mock('../src/screens/onboarding/OnboardingMindMapScreen', () => {
  const ReactModule = require('react');
  const { View: MockView } = require('react-native');

  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactModule.createElement(MockView, {
        ...props,
        testID: 'session-mind-map',
      }),
  };
});

jest.mock('../src/screens/insights/EntryMindMapScreen', () => {
  const ReactModule = require('react');
  const { View: MockView } = require('react-native');

  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactModule.createElement(MockView, {
        ...props,
        testID: 'entry-mind-map-gate',
      }),
  };
});

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

const analysis = {
  analysis: 'A focused session with one clear point of friction.',
  majorInsight: 'A smaller first task may reduce avoidance.',
  observedTrends: ['focus', 'avoidance'],
  detectedTopics: ['focus', 'avoidance'],
  detectedMood: 'okay',
  brainSessionMap: {
    dominantCenterId: 'planning_self_control',
    dominantCenter: {
      id: 'planning_self_control',
      productName: 'Planning & Self-Control',
      brainRegion: 'Prefrontal Cortex',
      score: 0.8,
      confidence: 0.72,
      rank: 1,
      intensity: 'high',
      evidence: ['start with one task'],
      shortInsight: 'Planning stood out in this session.',
      nuancedDetails: {},
    },
    secondaryCenterIds: [],
    secondaryCenters: [],
    centers: [],
    neuroscienceSummary: 'Planning was the clearest session signal.',
    mostNoticedText: 'Planning stood out.',
    mindMapSeedText: 'This session added one planning signal.',
  },
  hasEnoughSignal: true,
} as unknown as GuidedReflectionSessionAnalysisResponse;

function setSession(isPremium: boolean) {
  useAppStore.setState({
    session: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        userId: 'user-1',
        name: 'Journal User',
        phoneNumber: null,
        email: 'journal@example.com',
        isPremium,
        journalingGoals: [],
        avatarColor: null,
        profileSetupCompleted: true,
        onboardingCompleted: true,
        profilePic: null,
      },
    },
  });
}

async function renderScreen(
  initialSessionAnalysis?: GuidedReflectionSessionAnalysisResponse,
) {
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ThemeProvider modeOverride="light">
          <EntrySessionMindMapScreen
            initialSessionAnalysis={initialSessionAnalysis}
            journalId="journal-entry-1"
            onBack={jest.fn()}
            onContinue={jest.fn()}
            onUpgrade={jest.fn()}
          />
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    await Promise.resolve();
  });

  return root;
}

beforeEach(() => {
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
  (getJournalSessionAnalysis as jest.Mock).mockReset();
  (getJournalSessionAnalysis as jest.Mock).mockResolvedValue(analysis);
});

test('shows the shared loader then the onboarding-style session map', async () => {
  ReactTestRenderer.act(() => {
    setSession(true);
  });
  const root = await renderScreen(analysis);
  const loader = root.root.findByProps({
    testID: 'session-mind-map-loader',
  });

  expect(loader.props.variant).toBe('session');
  expect(getJournalSessionAnalysis).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => {
    loader.props.onComplete();
  });

  const map = root.root.findByProps({ testID: 'session-mind-map' });
  expect(map.props.variant).toBe('session');
  expect(map.props.sessionAnalysis).toBe(analysis);
});

test('restores missing session data by journal ID before revealing the map', async () => {
  ReactTestRenderer.act(() => {
    setSession(true);
  });
  const root = await renderScreen();

  expect(getJournalSessionAnalysis).toHaveBeenCalledWith('journal-entry-1');
  const loader = root.root.findByProps({
    testID: 'session-mind-map-loader',
  });

  ReactTestRenderer.act(() => {
    loader.props.onComplete();
  });

  expect(
    root.root.findByProps({ testID: 'session-mind-map' }).props.sessionAnalysis,
  ).toBe(analysis);
});

test('keeps the existing local gate for Free users without analysis requests', async () => {
  ReactTestRenderer.act(() => {
    setSession(false);
  });
  const root = await renderScreen();

  expect(getJournalSessionAnalysis).not.toHaveBeenCalled();
  expect(root.root.findByProps({ testID: 'entry-mind-map-gate' })).toBeTruthy();
  expect(root.root.findAllByType(View).length).toBeGreaterThan(0);
});
