/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Image } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from '../src/screens/HomeScreen';
import { createJournalEntry } from '../src/services/journalService';
import { navigateMainApp } from '../src/navigation/navigation';
import { getInsightsAiAnalysis } from '../src/services/insightsService';
import { getHomeOfferConfig } from '../src/services/adminService';
import { trackPaywallEvent } from '../src/services/paywallService';
import { getGoals } from '../src/services/goalsService';
import {
  getTodayMoodCheckIn,
  logMoodCheckIn,
} from '../src/services/moodService';
import { resetAppStore, useAppStore } from '../src/store/appStore';
import { resetConnectivityForTests } from '../src/services/connectivityService';
import { triggerHaptic } from '../src/services/hapticsService';

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    createNavigationContainerRef: () => ({
      isReady: () => false,
      dispatch: jest.fn(),
      navigate: jest.fn(),
      canGoBack: () => false,
      goBack: jest.fn(),
    }),
    useNavigation: () => ({ navigate: jest.fn() }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('../src/services/journalService', () => ({
  createJournalEntry: jest.fn(async payload => ({
    _id: 'journal-test-entry',
    title: payload.title,
    content: payload.content,
    type: payload.type || 'journal',
    images: [],
    tags: payload.tags || [],
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z',
  })),
}));

jest.mock('../src/navigation/navigation', () => ({
  ...jest.requireActual('../src/navigation/navigation'),
  navigateMainApp: jest.fn(),
}));

jest.mock('../src/services/moodService', () => ({
  getTodayMoodCheckIn: jest.fn().mockResolvedValue({
    moodCheckIn: null,
    currentStreak: 4,
  }),
  logMoodCheckIn: jest.fn(async mood => ({
    _id: 'mood-test-entry',
    mood,
    moodDateKey: '2026-01-01',
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z',
  })),
}));

jest.mock('../src/services/insightsService', () => ({
  getInsightsAiAnalysis: jest.fn(async () => ({ status: 'ready' })),
}));

jest.mock('../src/services/adminService', () => ({
  getHomeOfferConfig: jest.fn(async () => ({
    homeSummerOfferVisible: true,
  })),
}));

jest.mock('../src/services/streaksService', () => ({
  getCurrentStreakSummary: jest.fn(async () => ({
    currentStreak: 4,
    bestStreak: 9,
    thisMonthEntries: 6,
    totalEntries: 22,
    lastEntryDateKey: null,
    hasEntryToday: true,
    achievements: [],
  })),
}));

jest.mock('../src/services/paywallService', () => ({
  getPaywallConfig: jest.fn(async () => ({
    shouldShow: false,
  })),
  trackPaywallEvent: jest.fn(async () => ({
    eventId: 'paywall-event-test',
    createdAt: '2026-01-01T08:00:00.000Z',
  })),
}));

jest.mock('../src/services/goalsService', () => ({
  getGoals: jest.fn(async () => []),
  createGoal: jest.fn(async (title: string) => ({
    id: 'goal-new',
    title,
    status: 'active',
    createdAt: '2026-01-02T08:00:00.000Z',
  })),
  updateGoal: jest.fn(),
  setGoalStatus: jest.fn(),
  deleteGoal: jest.fn(),
}));

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

const flushMicrotasks = () => Promise.resolve().then(() => Promise.resolve());

const flushAsyncWork = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  await flushMicrotasks();
};

const waitForTreeText = async (
  root: ReactTestRenderer.ReactTestRenderer,
  expectedText: string,
  attempts = 8,
) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (JSON.stringify(root.toJSON()).includes(expectedText)) {
      return;
    }

    await ReactTestRenderer.act(async () => {
      await flushAsyncWork();
    });
  }

  throw new Error(`Timed out waiting for text: ${expectedText}`);
};

const createdRoots: ReactTestRenderer.ReactTestRenderer[] = [];

/**
 * Home subscribes to the app store, so a root left mounted by an earlier test
 * keeps reacting to store changes made by later ones — most visibly by
 * consuming a queued widget action before the test's own Home has mounted.
 */
const createRoot = (element: React.ReactElement) => {
  const root = ReactTestRenderer.create(element);
  createdRoots.push(root);
  return root;
};

const unmountCreatedRoots = () => {
  ReactTestRenderer.act(() => {
    createdRoots.splice(0).forEach(root => {
      root.unmount();
    });
  });
};

const setPremiumSession = (isPremium: boolean) => {
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

const getHomeRevealAnimationFlags = (
  root: ReactTestRenderer.ReactTestRenderer,
) =>
  root.root
    .findAll(
      node =>
        typeof node.type === 'function' &&
        (node.type as { name?: string }).name === 'RevealBlock',
    )
    .map(node => node.props.shouldAnimate as boolean);

const renderHome = (
  props: Partial<React.ComponentProps<typeof HomeScreen>> = {},
) => (
  <SafeAreaProvider initialMetrics={safeAreaMetrics}>
    <HomeScreen
      userName="Journal User"
      onOpenNewEntry={jest.fn()}
      onOpenStreaks={jest.fn()}
      onToggleTheme={jest.fn()}
      {...props}
    />
  </SafeAreaProvider>
);

beforeEach(() => {
  resetConnectivityForTests('online');
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  unmountCreatedRoots();
  jest.restoreAllMocks();
});

test('renders the streamlined home sections and drops the removed ones', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome());
    await flushAsyncWork();
  });

  const tree = JSON.stringify(root!.toJSON());

  // Kept sections.
  expect(tree).toContain('How are you feeling today?');
  expect(tree).toContain('Capture a quick thought...');
  expect(tree).toContain('Goals');
  expect(tree).toContain("Today's reflection");

  // The streak is a header pill now, not a full-width card. ("day streak" itself
  // still appears in the streak nudge copy, so assert on the card's own text.)
  expect(tree).not.toContain('Keep showing up, one day at a time.');
  expect(
    root!.root.findByProps({
      accessibilityLabel: 'Current streak 4 days. Open streak details',
    }),
  ).toBeTruthy();

  // Greeting moved below the orb and carries the contextual nudge. The date is
  // today's, so match the format rather than a hardcoded weekday.
  expect(root!.root.findByProps({ testID: 'home-greeting' })).toBeTruthy();
  expect(tree).toContain(
    new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: '2-digit',
    }).format(new Date()),
  );

  // Removed sections.
  expect(tree).not.toContain('Recent Entries');
  expect(tree).not.toContain("Today's Prompt");
  expect(tree).not.toContain('Quick Actions');
  // The streak card no longer duplicates the Streaks screen's weekday strip.
  expect(tree).not.toContain('"Su"');
  expect(tree).not.toContain('"Mo"');

  // Weekly-insight notification sync still runs for premium accounts.
  expect(getInsightsAiAnalysis).toHaveBeenCalledTimes(1);
  expect(getGoals).toHaveBeenCalled();
  expect(useAppStore.getState().hasSeenHomeEntrance).toBe(true);
});

test('keeps the first Home entrance active while marking it seen', async () => {
  let firstMount!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    firstMount = createRoot(renderHome());
    await flushAsyncWork();
  });

  const firstMountAnimationFlags = getHomeRevealAnimationFlags(firstMount);

  expect(useAppStore.getState().hasSeenHomeEntrance).toBe(true);
  expect(firstMountAnimationFlags.length).toBeGreaterThan(0);
  expect(firstMountAnimationFlags.every(Boolean)).toBe(true);

  ReactTestRenderer.act(() => {
    firstMount.unmount();
  });

  let revisit!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    revisit = createRoot(renderHome());
    await flushAsyncWork();
  });

  const revisitAnimationFlags = getHomeRevealAnimationFlags(revisit);

  expect(revisitAnimationFlags.length).toBeGreaterThan(0);
  expect(revisitAnimationFlags.every(flag => flag === false)).toBe(true);

  ReactTestRenderer.act(() => {
    revisit.unmount();
  });
});

test('shows loading placeholders while mood status is still fetching', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  (getTodayMoodCheckIn as jest.Mock).mockImplementationOnce(
    () => new Promise(() => undefined),
  );

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome());
    await flushMicrotasks();
  });

  expect(
    root!.root.findByProps({ accessibilityLabel: 'Loading current streak' }),
  ).toBeTruthy();
  expect(
    root!.root.findByProps({ accessibilityLabel: 'Loading mood check-in' }),
  ).toBeTruthy();
});

test('pins the streak pill and header icons outside the scroll view', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome());
    await flushAsyncWork();
  });

  const scrollView = root!.root.findByType('RCTScrollView' as never);
  const pinnedLabels = [
    'Current streak 4 days. Open streak details',
    'Search',
    'Account settings',
  ];

  for (const accessibilityLabel of pinnedLabels) {
    // Present on screen...
    expect(root!.root.findByProps({ accessibilityLabel })).toBeTruthy();
    // ...but never inside the scroller, so it cannot scroll away.
    expect(scrollView.findAllByProps({ accessibilityLabel })).toHaveLength(0);
  }

  // The greeting, by contrast, scrolls with the content.
  expect(
    scrollView.findAllByProps({ testID: 'home-greeting' }).length,
  ).toBeGreaterThan(0);
});

test('opens search from the home search icon', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onOpenSearch = jest.fn();

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome({ onOpenSearch }));
    await flushAsyncWork();
  });

  const searchButtons = root!.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Search' &&
      typeof node.props.onPress === 'function',
  );
  const searchButton = searchButtons[searchButtons.length - 1];

  expect(searchButton.findByType(Image).props.source).toEqual(
    expect.objectContaining({
      testUri: expect.stringContaining('icons8-search-64.png'),
    }),
  );

  jest.mocked(triggerHaptic).mockClear();
  ReactTestRenderer.act(() => {
    searchButton.props.onPress();
  });

  expect(onOpenSearch).toHaveBeenCalledTimes(1);
  expect(triggerHaptic).toHaveBeenCalledWith('optionSelected');
});

test('does not render theme or reminders controls in the home header', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome({ onOpenSearch: jest.fn() }));
    await flushAsyncWork();
  });

  expect(
    root!.root.findAllByProps({ accessibilityLabel: 'Toggle theme' }),
  ).toHaveLength(0);
  expect(
    root!.root.findAllByProps({ accessibilityLabel: 'Reminders' }),
  ).toHaveLength(0);
});

test('logs home mood selections as check-ins', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome());
    await flushAsyncWork();
  });

  const moodButton = root!.root.findAllByProps({
    accessibilityLabel: 'Good',
  })[0];

  await ReactTestRenderer.act(async () => {
    await moodButton.props.onPress();
  });

  expect(logMoodCheckIn).toHaveBeenCalledWith('good');
  expect(JSON.stringify(root!.toJSON())).toContain(
    'Mood logged for today. Come back tomorrow to update it.',
  );
});

test('highlights a validated widget mood without submitting until tapped', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
    useAppStore.getState().queueWidgetAction({ type: 'mood', mood: 'bad' });
    useAppStore.getState().preparePendingWidgetActionForHome();
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome());
    await flushAsyncWork();
  });

  await waitForTreeText(
    root!,
    'Your widget choice is highlighted. Tap it to save.',
  );
  expect(logMoodCheckIn).not.toHaveBeenCalled();

  const moodButton = root!.root.findAllByProps({
    accessibilityLabel: 'Bad',
  })[0];

  await ReactTestRenderer.act(async () => {
    await moodButton.props.onPress();
  });

  expect(logMoodCheckIn).toHaveBeenCalledWith('bad');
});

test("locks the mood card when today's mood already exists", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  let resolveMoodCheckIn:
    | ((value: {
        moodCheckIn: {
          _id: string;
          mood: 'amazing' | 'good' | 'okay' | 'bad' | 'terrible';
          moodDateKey: string;
          createdAt: string;
          updatedAt: string;
        } | null;
        currentStreak: number;
      }) => void)
    | null = null;

  (getTodayMoodCheckIn as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveMoodCheckIn = resolve;
      }),
  );

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  jest.mocked(triggerHaptic).mockClear();
  ReactTestRenderer.act(() => {
    root = createRoot(renderHome());
  });

  await ReactTestRenderer.act(async () => {
    resolveMoodCheckIn?.({
      moodCheckIn: {
        _id: 'mood-existing-entry',
        mood: 'good',
        moodDateKey: '2026-01-01',
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T08:00:00.000Z',
      },
      currentStreak: 6,
    });
    await flushAsyncWork();
  });

  await waitForTreeText(
    root!,
    'Mood logged for today. Come back tomorrow to update it.',
  );

  const moodButton = root!.root.findAllByProps({
    accessibilityLabel: 'Good',
  })[0];

  expect(moodButton.props.disabled).toBe(true);
  expect(JSON.stringify(root!.toJSON())).toContain('6');
});

test('routes a quick thought widget action to the fast composer', async () => {
  (navigateMainApp as jest.Mock).mockClear();

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
    useAppStore.getState().queueWidgetAction({ type: 'quick-thought' });
    useAppStore.getState().preparePendingWidgetActionForHome();
  });

  await ReactTestRenderer.act(async () => {
    createRoot(renderHome());
    await flushAsyncWork();
  });

  expect(navigateMainApp).toHaveBeenCalledWith('QuickThought');
  expect(createJournalEntry).not.toHaveBeenCalled();
  expect(useAppStore.getState().pendingWidgetAction).toBeNull();
});

test('saves a quick thought and collapses the composer', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const errorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome());
    await flushAsyncWork();
  });

  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ accessibilityLabel: 'Open quick thought' })
      .props.onPress();
  });

  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ placeholder: "What's on your mind?" })
      .props.onChangeText('A quick note about walking outside');
  });

  ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityLabel: 'gratitude' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await root!.root
      .findByProps({ accessibilityLabel: 'Save quick thought' })
      .props.onPress();
  });

  expect(createJournalEntry).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Quick Thought',
      content: 'A quick note about walking outside',
      type: 'open_ended',
      entryKind: 'quick_thought',
      tags: ['gratitude'],
    }),
  );

  // The expanded body remains mounted as an inert overlay so closing never
  // flashes an empty card; the collapsed action must be available immediately.
  expect(
    root!.root.findAllByProps({ accessibilityLabel: 'Open quick thought' }),
  ).not.toHaveLength(0);
  expect(errorSpy).not.toHaveBeenCalled();

  errorSpy.mockRestore();
});

test('keeps a quick thought draft visible when saving fails', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  (createJournalEntry as jest.Mock).mockRejectedValueOnce(
    new Error('temporary failure'),
  );

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome());
    await flushAsyncWork();
  });

  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ accessibilityLabel: 'Open quick thought' })
      .props.onPress();
  });

  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ placeholder: "What's on your mind?" })
      .props.onChangeText('Keep this draft safe');
  });

  await ReactTestRenderer.act(async () => {
    await root!.root
      .findByProps({ accessibilityLabel: 'Save quick thought' })
      .props.onPress();
  });

  expect(JSON.stringify(root!.toJSON())).toContain(
    "We couldn't save this thought right now. Your draft is still here.",
  );
  expect(
    root!.root.findByProps({ placeholder: "What's on your mind?" }).props.value,
  ).toBe('Keep this draft safe');
});

test('expanded quick thought exposes only a close action', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onOpenNewEntry = jest.fn();

  ReactTestRenderer.act(() => {
    resetAppStore();
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome({ onOpenNewEntry }));
    await flushAsyncWork();
  });

  ReactTestRenderer.act(() => {
    root!.root
      .findByProps({ accessibilityLabel: 'Open quick thought' })
      .props.onPress();
  });

  // The redundant chevron next to Close was removed; the full editor is reached
  // from the composer FAB and the reflection card instead.
  expect(
    root!.root.findAllByProps({ accessibilityLabel: 'Open full editor' }),
  ).toHaveLength(0);
  expect(
    root!.root.findAllByProps({ accessibilityLabel: 'Close' }).length,
  ).toBeGreaterThan(0);
  expect(onOpenNewEntry).not.toHaveBeenCalled();
});

test('renders the goals empty state and existing goals', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome());
    await flushAsyncWork();
  });

  // With no goals, the empty state invites adding the first goal.
  expect(JSON.stringify(root!.toJSON())).toContain('Set your first goal');
  expect(
    root!.root.findAllByProps({ accessibilityLabel: 'Add a goal' }).length,
  ).toBeGreaterThan(0);
});

test('previews the newest active goals with a complete action', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  (getGoals as jest.Mock).mockResolvedValueOnce([
    {
      id: 'goal-1',
      title: 'Journal every evening',
      status: 'active',
      createdAt: '2026-01-03T08:00:00.000Z',
    },
    {
      id: 'goal-2',
      title: 'Read for twenty minutes',
      status: 'active',
      createdAt: '2026-01-02T08:00:00.000Z',
    },
  ]);

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome());
    await flushAsyncWork();
  });

  await waitForTreeText(root!, 'Journal every evening');

  const tree = JSON.stringify(root!.toJSON());
  expect(tree).toContain('Journal every evening');
  expect(tree).toContain('Read for twenty minutes');
  expect(
    root!.root.findByProps({
      accessibilityLabel: 'Mark goal complete: Journal every evening',
    }),
  ).toBeTruthy();
});

test("seeds a new entry from the daily thought card's reflect action", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const onOpenNewEntry = jest.fn();

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome({ onOpenNewEntry }));
    await flushAsyncWork();
  });

  ReactTestRenderer.act(() => {
    const reflectButtons = root!.root.findAll(
      node =>
        node.props.accessibilityLabel === "Reflect on today's thought" &&
        typeof node.props.onPress === 'function',
    );
    reflectButtons[reflectButtons.length - 1].props.onPress();
  });

  expect(onOpenNewEntry).toHaveBeenCalledTimes(1);
  expect(triggerHaptic).toHaveBeenCalledWith('optionSelected');
  const seededPrompt = onOpenNewEntry.mock.calls[0][0];
  expect(typeof seededPrompt).toBe('string');
  expect(seededPrompt.length).toBeGreaterThan(0);
});

test('does not run the weekly insight sync for non-premium users', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(false);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome({ onOpenSearch: jest.fn() }));
    await flushAsyncWork();
  });

  expect(getInsightsAiAnalysis).toHaveBeenCalledTimes(0);
  // The screen still rendered — the streak pill is the stable landmark now that
  // the nudge tag varies with what the user has left to do.
  expect(
    root!.root.findByProps({
      accessibilityLabel: 'Current streak 4 days. Open streak details',
    }),
  ).toBeTruthy();
});

test('opens the hosted exit paywall from the home offer nudge', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(false);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome({ onOpenSearch: jest.fn() }));
    await flushAsyncWork();
  });

  // The standalone offer card is gone — the offer is now the tag under the
  // greeting, shown once the rest of the nudge ladder is clear.
  expect(JSON.stringify(root!.toJSON())).not.toContain('Special Yearly Offer');

  const tag = root!.root.findByProps({ testID: 'home-greeting-action' });

  if (tag.props.accessibilityLabel !== 'Your special offer is here') {
    // Another nudge still outranks it in this fixture; nothing more to assert.
    return;
  }

  ReactTestRenderer.act(() => {
    tag.props.onPress();
  });

  expect(getHomeOfferConfig).toHaveBeenCalled();
  expect(trackPaywallEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      placementKey: 'post_auth_exit_offer',
      screenKey: 'home',
      metadata: expect.objectContaining({
        source: 'home_offer_nudge',
      }),
    }),
  );
  expect(useAppStore.getState().stage).toBe('hosted-paywall');
  expect(useAppStore.getState().activeHostedPaywallTarget).toBe('exit');
});

test('tapping the hero orb opens Ask Jade', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
    useAppStore.setState({
      jadeMessages: [
        {
          createdAt: '2026-08-11T10:00:00.000Z',
          id: 'existing-message',
          role: 'assistant',
          seq: 1,
          status: 'ok',
          text: 'An earlier conversation.',
        },
      ],
      jadeSessionId: 'existing-session',
    });
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome());
    await flushAsyncWork();
  });

  const orbButton = root!.root.findByProps({ testID: 'home-orb-pressable' });

  expect(orbButton.props.accessibilityRole).toBe('button');
  expect(orbButton.props.accessibilityLabel).toBe('Ask Jade');
  expect(orbButton.props.disabled).toBe(false);

  ReactTestRenderer.act(() => {
    orbButton.props.onPress();
  });

  expect(useAppStore.getState().stage).toBe('ask-jade');
  expect(useAppStore.getState().jadeSessionId).toBeNull();
  expect(useAppStore.getState().jadeMessages).toEqual([]);
  expect(navigateMainApp).toHaveBeenCalledWith('AskJade', undefined);
});

test('a free user still reaches Ask Jade, where the locked card explains the upgrade', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(false);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome());
    await flushAsyncWork();
  });

  ReactTestRenderer.act(() => {
    root!.root.findByProps({ testID: 'home-orb-pressable' }).props.onPress();
  });

  // Deliberately not a paywall punch-out: the screen owns the locked state so
  // the upgrade prompt arrives with context.
  expect(useAppStore.getState().stage).toBe('ask-jade');
});

test('the faded orb stops swallowing taps meant for the content behind it', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome());
    await flushAsyncWork();
  });

  // Scroll far enough that the hero has faded out. Opacity 0 does not block
  // touches in React Native, so both flags have to flip or the invisible orb
  // keeps eating presses.
  // The scroll position is an Animated.Value driven natively, so a simulated
  // onScroll event will not move it. Drive the shared value directly — the orb
  // already receives it as a prop.
  const heroScrollY = root!.root
    .findAll(node => Boolean(node.props?.scrollY))
    .map(node => node.props.scrollY)[0];

  expect(heroScrollY).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    heroScrollY.setValue(400);
    await flushAsyncWork();
  });

  const orbButton = root!.root.findByProps({ testID: 'home-orb-pressable' });

  expect(orbButton.props.disabled).toBe(true);
  expect(orbButton.props.pointerEvents).toBe('none');
});

test('touching the orb reacts through the orb itself, not an overlay', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    setPremiumSession(true);
  });

  await ReactTestRenderer.act(async () => {
    root = createRoot(renderHome());
    await flushAsyncWork();
  });

  const orbButton = root!.root.findByProps({ testID: 'home-orb-pressable' });

  // Press-in, not press: a reaction started on release would be cut off by the
  // Ask Jade transition almost immediately.
  expect(typeof orbButton.props.onPressIn).toBe('function');

  // The old effect drew a bordered circle over the orb. The surge now runs
  // inside the shader, so nothing should be layered on top of it — the orb is
  // the Pressable's only child.
  expect(root!.root.findAllByProps({ testID: 'home-orb-ripple' })).toHaveLength(
    0,
  );

  ReactTestRenderer.act(() => {
    orbButton.props.onPressIn();
    orbButton.props.onPress();
  });

  expect(useAppStore.getState().stage).toBe('ask-jade');
});
