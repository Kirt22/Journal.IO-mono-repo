/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import EntrySessionAnalysisScreen from '../src/screens/journal/EntrySessionAnalysisScreen';
import { getJournalSessionAnalysis } from '../src/services/journalService';
import { getGoalSuggestions } from '../src/services/goalsService';
import type {
  BrainCenterScore,
  BrainReflectionCenterId,
  GuidedReflectionSessionAnalysisResponse,
} from '../src/services/guidedReflectionService';
import { resetAppStore, useAppStore } from '../src/store/appStore';
import { ThemeProvider } from '../src/theme/provider';

jest.mock('../src/services/journalService', () => ({
  getJournalSessionAnalysis: jest.fn(),
}));

jest.mock('../src/services/goalsService', () => ({
  getGoalSuggestions: jest.fn(),
}));

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

const centerIds: BrainReflectionCenterId[] = [
  'planning_self_control',
  'emotional_intensity',
  'memory_meaning',
  'body_inner_signals',
  'conflict_attention',
  'motivation_reward',
  'relationships_perspective',
  'self_reflection_identity',
];

const centers: BrainCenterScore[] = centerIds.map((id, index) => ({
  id,
  productName: `Center ${index + 1}`,
  brainRegion: `Region ${index + 1}`,
  score: 0.9 - index * 0.08,
  confidence: 0.84 - index * 0.05,
  rank: index + 1,
  intensity: index === 0 ? 'high' : 'moderate',
  evidence: index === 0 ? ['protected one focused hour'] : [],
  shortInsight: `Center ${index + 1} appeared as a grounded signal.`,
  nuancedDetails: {},
}));

const analysis: GuidedReflectionSessionAnalysisResponse = {
  analysis:
    'This entry suggests that protecting a focused hour helped create steadiness while work pressure remained present. Keeping the next task small may help preserve that calmer direction.',
  majorInsight:
    'Major insight: bounded progress appears more useful than added urgency.',
  observedTrends: ['Focus', 'Pressure', 'Calm progress'],
  topicsObserved: ['focus', 'stress', 'calm'],
  detectedTopics: ['focus', 'stress', 'calm'],
  detectedMood: 'good',
  brainSessionMap: {
    dominantCenterId: centers[0].id,
    dominantCenter: centers[0],
    secondaryCenterIds: [centers[1].id, centers[2].id],
    secondaryCenters: [centers[1], centers[2]],
    centers,
    neuroscienceSummary: 'A short private summary of the strongest signals.',
    mostNoticedText: 'Planning and self-control appeared most clearly.',
    mindMapSeedText: 'This entry adds a practical planning signal.',
  },
  hasEnoughSignal: true,
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

const setSession = (isPremium: boolean) => {
  useAppStore.setState({
    session: {
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
      user: {
        userId: 'user-test',
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
};

type RenderOptions = {
  onContinue?: jest.Mock;
  onGoalsReady?: jest.Mock;
  initialAnalysis?: GuidedReflectionSessionAnalysisResponse;
};

const renderScreen = async ({
  onContinue = jest.fn(),
  onGoalsReady = jest.fn(),
  initialAnalysis,
}: RenderOptions = {}) => {
  let root!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ThemeProvider modeOverride="light">
          <EntrySessionAnalysisScreen
            initialAnalysis={initialAnalysis}
            journalId="journal-1"
            onContinue={onContinue}
            onExit={jest.fn()}
            onGoalsReady={onGoalsReady}
            onUpgrade={jest.fn()}
          />
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  return root;
};

// The analysis is revealed card by card behind typewriter + stagger timers, so
// the assertions below run against the settled screen.
const flushTimers = () => {
  for (let index = 0; index < 120; index += 1) {
    ReactTestRenderer.act(() => {
      jest.runOnlyPendingTimers();
    });
  }
};

beforeEach(() => {
  jest.useFakeTimers();
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
  (getJournalSessionAnalysis as jest.Mock).mockReset();
  (getJournalSessionAnalysis as jest.Mock).mockResolvedValue(analysis);
  (getGoalSuggestions as jest.Mock).mockReset();
  (getGoalSuggestions as jest.Mock).mockResolvedValue({
    suggestions: [
      {
        title: 'Protect one focused hour',
        description: 'Block a single hour before the day fills up.',
        frequency: 'daily',
        icon: 'target',
      },
    ],
  });
});

afterEach(() => {
  ReactTestRenderer.act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

test('shows a locked Free preview without requesting private analysis', async () => {
  ReactTestRenderer.act(() => {
    setSession(false);
  });

  const root = await renderScreen();

  expect(getJournalSessionAnalysis).not.toHaveBeenCalled();
  expect(
    root.root.findByProps({ accessibilityLabel: 'Unlock my analysis' }),
  ).toBeTruthy();
  const lockedText = extractText(root.toJSON());
  expect(lockedText).toContain('Your patterns are ready to unfold');
  // The explanatory paragraph was cut so the lock and the actions carry the
  // screen on their own.
  expect(lockedText).not.toContain('Premium reveals a private, practical read');
  expect(root.root.findByProps({ accessibilityLabel: 'Not now' })).toBeTruthy();
  ReactTestRenderer.act(() => root.unmount());
});

test('loads Premium analysis in the shared guided card layout with detected topics', async () => {
  ReactTestRenderer.act(() => {
    setSession(true);
  });

  const root = await renderScreen();
  flushTimers();
  const screenText = extractText(root.toJSON());

  expect(getJournalSessionAnalysis).toHaveBeenCalledWith('journal-1');
  expect(screenText).toContain('SESSION ANALYSIS');
  expect(screenText).toContain('A quick read on today');
  expect(screenText).toContain('MOST NOTICED CENTER');
  expect(screenText).toContain('CENTER BREAKDOWN');
  expect(screenText).toContain('TOPICS DETECTED');
  expect(screenText).toContain('Focus');
  expect(screenText).toContain('Stress');
  expect(screenText).toContain('Your Mind Map is slowly building.');
  ReactTestRenderer.act(() => root.unmount());
});

test('renders a seeded analysis immediately instead of showing a loading screen', async () => {
  ReactTestRenderer.act(() => {
    setSession(true);
  });

  const root = await renderScreen({ initialAnalysis: analysis });

  // The save step already fetched it — refetching here is what used to put a
  // full-screen spinner between the save and the reveal.
  expect(getJournalSessionAnalysis).not.toHaveBeenCalled();
  expect(extractText(root.toJSON())).not.toContain(
    'Noticing the clearest patterns...',
  );

  flushTimers();
  expect(extractText(root.toJSON())).toContain('A quick read on today');
  ReactTestRenderer.act(() => root.unmount());
});

test('continues to goals inline using the journal-id goal suggestions', async () => {
  const onGoalsReady = jest.fn();
  ReactTestRenderer.act(() => {
    setSession(true);
  });

  const root = await renderScreen({
    initialAnalysis: analysis,
    onGoalsReady,
  });
  flushTimers();

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: 'Continue to goals' })
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  // Open-ended entries have no guided prompt answers, so the goal suggestions
  // must come from the journal-id endpoint rather than the guided one.
  expect(getGoalSuggestions).toHaveBeenCalledWith('journal-1');
  expect(onGoalsReady).toHaveBeenCalledTimes(1);
  expect(onGoalsReady.mock.calls[0][0].sessionAnalysis).toEqual(analysis);
  expect(onGoalsReady.mock.calls[0][0].goalSuggestions[0].title).toBe(
    'Protect one focused hour',
  );
  ReactTestRenderer.act(() => root.unmount());
});

test('says so plainly when the model reported too little to work with', async () => {
  ReactTestRenderer.act(() => {
    setSession(true);
  });
  (getJournalSessionAnalysis as jest.Mock).mockResolvedValue({
    ...analysis,
    hasEnoughSignal: false,
    detectedTopics: [],
    topicsObserved: [],
  });

  const root = await renderScreen();
  flushTimers();
  const screenText = extractText(root.toJSON());

  expect(screenText).toContain('NOT ENOUGH DETAIL YET');
  expect(screenText).toContain('Not enough to read from yet');
  expect(screenText).not.toContain('A quick read on today');
  // The chosen presentation keeps the rest of the cards rather than collapsing
  // the screen, so the Topics card needs copy of its own when it has no chips.
  expect(screenText).toContain('TOPICS DETECTED');
  expect(screenText).toContain('No clear topics stood out in this entry yet.');
  expect(screenText).toContain('MOST NOTICED CENTER');
  ReactTestRenderer.act(() => root.unmount());
});
