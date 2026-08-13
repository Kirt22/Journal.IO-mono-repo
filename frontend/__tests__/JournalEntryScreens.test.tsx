/**
 * @format
 */

import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import EntryDetailScreen from '../src/screens/journal/EntryDetailScreen';
import EditEntryScreen from '../src/screens/journal/EditEntryScreen';
import { resetAppStore, useAppStore } from '../src/store/appStore';
import {
  getJournalSessionAnalysis,
  updateJournalEntry,
} from '../src/services/journalService';
import type {
  BrainCenterScore,
  BrainReflectionCenterId,
  GuidedReflectionSessionAnalysisResponse,
} from '../src/services/guidedReflectionService';
import {
  reportBackendReachable,
  reportBackendUnavailable,
  resetConnectivityForTests,
} from '../src/services/connectivityService';

jest.mock('../src/features/brainMap3D/webRenderer/WebMindMapView', () => {
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => (
      <View accessibilityLabel="Session Mind Map" {...props} />
    ),
  };
});

jest.mock('../src/services/journalService', () => ({
  deleteJournalEntry: jest.fn().mockResolvedValue({}),
  getJournalEntries: jest.fn().mockResolvedValue([]),
  getJournalEntry: jest.fn().mockResolvedValue({
    _id: 'mar-15',
    title: 'Morning Reflections',
    content: 'Started the day with a beautiful sunrise walk.',
    type: 'journal',
    aiPrompt: 'What are you grateful for today?',
    images: [],
    tags: ['onboarding:first-reflection', 'legacy-user-tag'],
    detectedTopics: [
      'anxiety',
      'loneliness',
      'stress',
      'self-care',
      'confidence',
    ],
    isFavorite: true,
    createdAt: '2026-03-15T08:00:00.000Z',
    updatedAt: '2026-03-15T08:00:00.000Z',
  }),
  getJournalQuickAnalysis: jest.fn().mockResolvedValue({
    journalId: 'mar-15',
    summary: {
      headline: 'Morning carried this steady moment',
      narrative:
        'This entry reads like a grounded check-in. The language suggests the morning routine was doing real emotional work here.',
      highlight:
        'Morning looks like the clearest thread to keep tracking if you want to understand what steadies you.',
    },
    scorecard: {
      vibeLabel: 'Steadier moment',
      vibeTone: 'sage',
      cards: [
        { key: 'words', label: 'Words', value: '7', tone: 'blue' },
        { key: 'mood', label: 'Mood', value: 'Good', tone: 'sage' },
        { key: 'focus', label: 'Focus', value: 'Morning', tone: 'amber' },
        { key: 'depth', label: 'Depth', value: 'Quick note', tone: 'amber' },
      ],
    },
    patternTags: [
      { label: 'Morning', tone: 'amber' },
      { label: 'Gratitude', tone: 'sage' },
    ],
    signals: {
      whatStoodOut: {
        title: 'Morning was the clearest signal',
        description:
          'The entry makes it pretty clear that the start of the day shaped the emotional tone more than anything else.',
        evidence: ['Morning', 'Good'],
        tone: 'amber',
      },
      whatNeedsCare: {
        title: 'Nothing sharp looked overwhelming',
        description:
          'There is no major friction point here, which makes this a useful entry for noticing what is already working.',
        evidence: ['Good', 'Quick note'],
        tone: 'blue',
      },
      whatToCarryForward: {
        title: 'This is worth carrying forward',
        description:
          'The steadier tone itself is useful data. It helps show what a more regulated moment sounds like on the page.',
        evidence: ['Quick note', 'Morning'],
        tone: 'sage',
      },
    },
    nextStep: {
      title: 'Name what made the morning work',
      description:
        'Next time, add one line about what made this feel steady so you can spot the pattern faster.',
      focus: 'Support',
    },
    generatedAt: '2026-03-15T08:10:00.000Z',
  }),
  getJournalSessionAnalysis: jest.fn(),
  updateJournalEntry: jest.fn(async payload => ({
    _id: payload.journalId,
    title: payload.title,
    content: payload.content,
    type: payload.type || 'journal',
    aiPrompt: payload.aiPrompt ?? 'What are you grateful for today?',
    images: payload.images || [],
    tags: payload.tags || [],
    isFavorite: payload.isFavorite ?? false,
    createdAt: '2026-03-15T08:00:00.000Z',
    updatedAt: '2026-03-30T08:00:00.000Z',
  })),
}));

jest.mock('../src/services/paywallService', () => ({
  trackPaywallEvent: jest.fn(async () => undefined),
}));

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

const sessionAnalysis: GuidedReflectionSessionAnalysisResponse = {
  analysis:
    'This entry suggests that the morning walk helped create a steadier start.',
  majorInsight:
    'Major insight: a small morning routine appeared associated with more calm.',
  observedTrends: ['Morning', 'Calm'],
  detectedTopics: [
    'anxiety',
    'loneliness',
    'stress',
    'self-care',
    'confidence',
  ],
  detectedMood: 'good',
  brainSessionMap: {
    dominantCenterId: centers[0].id,
    dominantCenter: centers[0],
    secondaryCenterIds: [centers[1].id, centers[2].id],
    secondaryCenters: [centers[1], centers[2]],
    centers,
    neuroscienceSummary: "A summary of this reflection's strongest signals.",
    mostNoticedText: 'Planning appeared most clearly in this session.',
    mindMapSeedText: 'This reflection added a planning signal.',
  },
  hasEnoughSignal: true,
};

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

beforeEach(() => {
  resetConnectivityForTests('online');
  (getJournalSessionAnalysis as jest.Mock).mockReset();
  (getJournalSessionAnalysis as jest.Mock).mockResolvedValue(sessionAnalysis);
});

test('entry detail opens the journal editor', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.getState().openJournalEntry('mar-15');
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <EntryDetailScreen />
      </SafeAreaProvider>,
    );
    await Promise.resolve();
  });

  const editButton = root!.root.findByProps({
    accessibilityLabel: 'Edit entry',
  });

  ReactTestRenderer.act(() => {
    editButton.props.onPress();
  });

  expect(useAppStore.getState().stage).toBe('journal-edit');
});

test('entry detail keeps the selected entry under the Session insights paywall', async () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

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
          isPremium: false,
          journalingGoals: [],
          avatarColor: null,
          profileSetupCompleted: true,
          onboardingCompleted: true,
          profilePic: null,
        },
      },
    });
    useAppStore.getState().openJournalEntry('mar-15');
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <EntryDetailScreen />
      </SafeAreaProvider>,
    );
    await Promise.resolve();
  });

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Unlock Session insights' })
      .props.onPress();
  });

  expect(useAppStore.getState().activePaywallPlacementKey).toBe(
    'entry_session_analysis_locked',
  );
  expect(useAppStore.getState().activePaywallScreenKey).toBe('journal-detail');
  expect(useAppStore.getState().isPaywallOverlay).toBe(true);
  expect(useAppStore.getState().selectedJournalEntryId).toBe('mar-15');

  ReactTestRenderer.act(() => root.unmount());
});

test('entry detail restores Session insights and the exact session Mind Map', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

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
    });
    useAppStore.getState().openJournalEntry('mar-15');
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <EntryDetailScreen />
      </SafeAreaProvider>,
    );
    await Promise.resolve();
  });

  const tree = JSON.stringify(root!.toJSON());

  expect(getJournalSessionAnalysis).toHaveBeenCalledWith('mar-15');
  expect(tree).toContain('Session insights');
  expect(tree).toContain('A quick read on this session');
  expect(tree).toContain('a small morning routine appeared associated');
  const tagTree = JSON.stringify(
    root!.root
      .findByProps({ testID: 'entry-detected-topic-tags' })
      .findAllByType(Text)
      .map(node => node.props.children),
  );
  expect(tagTree).toContain('Anxiety');
  expect(tagTree).toContain('Loneliness');
  expect(tagTree).toContain('Stress');
  expect(tagTree).toContain('Self Care');
  expect(tagTree).toContain('Confidence');
  expect(tagTree).not.toContain('legacy-user-tag');
  expect(tagTree).not.toContain('onboarding:first-reflection');
  expect(tree).not.toContain('What are you grateful for today?');

  ReactTestRenderer.act(() => {
    root!.root
      .findAllByProps({ accessibilityRole: 'tab' })
      .find(tab => tab.props.accessibilityState?.selected === false)
      ?.props.onPress();
  });

  const mindMapTree = JSON.stringify(root!.toJSON());
  expect(mindMapTree).toContain('YOUR SESSION MIND MAP');
  expect(mindMapTree).toContain('Explore what stood out');
  expect(mindMapTree).toContain('Center 1');

  await ReactTestRenderer.act(async () => {
    root!.root
      .findByProps({ accessibilityLabel: 'Session Mind Map' })
      .props.onRegionPress({
        nativeEvent: { regionId: centers[1].id },
      });
    await new Promise<void>(resolve => setTimeout(resolve, 320));
  });

  const changedSignalTree = JSON.stringify(root!.toJSON());
  expect(changedSignalTree).toContain('Center 2');
  expect(changedSignalTree).toContain('Region 2');
  expect(changedSignalTree).toContain(
    'Center 2 appeared as a grounded signal.',
  );
});

test('edit entry saves changes and returns home', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.getState().openJournalEditor('mar-15');
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <EditEntryScreen />
      </SafeAreaProvider>,
    );
    await Promise.resolve();
  });

  const editTagTree = JSON.stringify(
    root!.root
      .findByProps({ testID: 'edit-entry-detected-topic-tags' })
      .findAllByType(Text)
      .map(node => node.props.children),
  );
  expect(editTagTree).toContain('Anxiety');
  expect(editTagTree).toContain('Loneliness');
  expect(editTagTree).toContain('Stress');
  expect(editTagTree).toContain('Self Care');
  expect(editTagTree).toContain('Confidence');
  expect(editTagTree).not.toContain('legacy-user-tag');
  expect(JSON.stringify(root!.toJSON())).not.toContain(
    'What are you grateful for today?',
  );

  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ accessibilityLabel: 'Entry title' })
      .props.onChangeText('Updated reflections');
    root!.root
      .findByProps({ accessibilityLabel: 'Entry content' })
      .props.onChangeText('Updated content for the day.');
  });

  await ReactTestRenderer.act(async () => {
    await root!.root
      .findByProps({ accessibilityLabel: 'Save entry' })
      .props.onPress();
  });

  expect(useAppStore.getState().stage).toBe('main-app');
  expect(useAppStore.getState().activeTab).toBe('home');
  expect(useAppStore.getState().selectedJournalEntryId).toBeNull();
  expect(useAppStore.getState().recentJournalEntries[0].title).toBe(
    'Updated reflections',
  );
});

test('edit entry keeps unsaved text through an offline interruption', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.getState().openJournalEditor('mar-15');
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <EditEntryScreen />
      </SafeAreaProvider>,
    );
    await Promise.resolve();
  });

  await ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ accessibilityLabel: 'Entry content' })
      .props.onChangeText('A draft that should survive reconnecting.');
    reportBackendUnavailable();
  });

  expect(
    root!.root.findByProps({ accessibilityLabel: 'Entry content' }).props.value,
  ).toBe('A draft that should survive reconnecting.');
  expect(
    root!.root.findByProps({ accessibilityLabel: 'Save entry' }).props.disabled,
  ).toBe(true);

  await ReactTestRenderer.act(() => {
    reportBackendReachable();
  });

  expect(
    root!.root.findByProps({ accessibilityLabel: 'Entry content' }).props.value,
  ).toBe('A draft that should survive reconnecting.');
  expect(
    root!.root.findByProps({ accessibilityLabel: 'Save entry' }).props.disabled,
  ).toBe(false);
});

test('edit entry shows a spinning save loader while update is in flight', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  let resolveSave: ((value: any) => void) | null = null;

  (updateJournalEntry as jest.Mock).mockImplementationOnce(
    _payload =>
      new Promise(resolve => {
        resolveSave = resolve;
      }),
  );

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.getState().openJournalEditor('mar-15');
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <EditEntryScreen />
      </SafeAreaProvider>,
    );
    await Promise.resolve();
  });

  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ accessibilityLabel: 'Entry content' })
      .props.onChangeText('Updated content for the day.');
  });

  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ accessibilityLabel: 'Save entry' })
      .props.onPress();
  });

  expect(
    root!.root.findByProps({ accessibilityLabel: 'Save entry' }).props
      .accessibilityState,
  ).toEqual({ busy: true, disabled: true });
  expect(JSON.stringify(root!.toJSON())).toContain('Save');

  await ReactTestRenderer.act(async () => {
    resolveSave?.({
      _id: 'mar-15',
      title: 'Morning Reflections',
      content: 'Updated content for the day.',
      type: 'journal',
      aiPrompt: 'What are you grateful for today?',
      images: [],
      tags: ['gratitude', 'morning', 'nature'],
      isFavorite: true,
      createdAt: '2026-03-15T08:00:00.000Z',
      updatedAt: '2026-03-30T08:00:00.000Z',
    });
    await Promise.resolve();
  });
});
