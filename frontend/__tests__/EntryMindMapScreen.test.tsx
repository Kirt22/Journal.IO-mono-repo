/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import EntryMindMapScreen from '../src/screens/insights/EntryMindMapScreen';
import { getEntryMindMap } from '../src/services/insightsService';
import { resetAppStore, useAppStore } from '../src/store/appStore';
import { ThemeProvider } from '../src/theme/provider';

jest.mock(
  '../src/features/brainMap3D/webRenderer/WebMindMapView',
  () => () => null,
);

jest.mock('../src/services/insightsService', () => ({
  getEntryMindMap: jest.fn(),
}));

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

const readyMap = {
  status: 'ready',
  journalId: 'journal-entry-1',
  refining: false,
  strongestRegionId: 'reflection',
  summary: {
    seedText: 'From this reflection',
    headline: 'A steady next step stood out',
    narrative:
      'Your writing may indicate that a smaller plan feels easier to carry.',
  },
  overallTier: {
    key: 'building',
    label: 'Building awareness',
    blurb: 'This entry adds one useful signal to your map.',
  },
  regions: [
    {
      id: 'reflection',
      productLabel: 'Reflection',
      brainRegionSubtitle: 'Meaning and perspective',
      signalScore: 0.72,
      confidence: 0.68,
      intensity: 0.64,
      rank: 1,
      tierLabel: 'Active',
      shortInsight: 'You paused to name what may help next.',
      evidenceSnippets: ['one small step'],
    },
  ],
  patterns: [],
};

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

async function renderScreen({
  onBack = jest.fn(),
  onContinue = jest.fn(),
  onUpgrade = jest.fn(),
}: {
  onBack?: jest.Mock;
  onContinue?: jest.Mock;
  onUpgrade?: jest.Mock;
} = {}) {
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ThemeProvider modeOverride="light">
          <EntryMindMapScreen
            journalId="journal-entry-1"
            onBack={onBack}
            onContinue={onContinue}
            onUpgrade={onUpgrade}
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
  (getEntryMindMap as jest.Mock).mockReset();
  (getEntryMindMap as jest.Mock).mockResolvedValue(readyMap);
});

test('shows a local obscured Pro preview for free users without requesting analysis', async () => {
  const onBack = jest.fn();
  const onUpgrade = jest.fn();

  ReactTestRenderer.act(() => {
    setSession(false);
  });
  const root = await renderScreen({ onBack, onUpgrade });

  expect(getEntryMindMap).not.toHaveBeenCalled();
  expect(
    root.root.findByProps({ accessibilityLabel: 'Blurred Mind Map preview' }),
  ).toBeTruthy();

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Unlock Mind Map with Pro' })
      .props.onPress();
    root.root.findByProps({ accessibilityLabel: 'Close' }).props.onPress();
  });

  expect(onUpgrade).toHaveBeenCalledTimes(1);
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(
    root.root.findAllByProps({ accessibilityLabel: 'Continue to goals' }),
  ).toHaveLength(0);
});

test('lets premium users continue from a ready Mind Map to goals', async () => {
  const onContinue = jest.fn();

  ReactTestRenderer.act(() => {
    setSession(true);
  });
  const root = await renderScreen({ onContinue });

  expect(getEntryMindMap).toHaveBeenCalledWith('journal-entry-1');

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Continue to goals' })
      .props.onPress();
  });

  expect(onContinue).toHaveBeenCalledTimes(1);
});
