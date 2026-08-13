/**
 * @format
 */

import React from 'react';
import { Alert } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import JournalEntryCard from '../src/components/JournalEntryCard';
import CalendarScreen from '../src/screens/calendar/CalendarScreen';
import {
  calendarSampleJournalEntries,
  toCalendarEntry,
} from '../src/models/calendarModels';
import {
  deleteJournalEntry,
  getJournalEntriesPage,
  toggleJournalFavorite,
} from '../src/services/journalService';
import { resetAppStore, useAppStore } from '../src/store/appStore';

jest.mock('../src/services/journalService', () => ({
  deleteJournalEntry: jest.fn(async () => ({})),
  getJournalEntriesPage: jest.fn(),
  toggleJournalFavorite: jest.fn(async ({ journalId, isFavorite }) => ({
    _id: journalId,
    title: 'Morning Reflections',
    content: 'Started the day with a calm walk.',
    type: 'open_ended',
    entryKind: 'journal',
    aiPrompt: null,
    images: [],
    tags: ['gratitude', 'morning'],
    isFavorite,
    createdAt: '2026-03-15T08:00:00.000Z',
    updatedAt: '2026-03-15T08:00:00.000Z',
  })),
}));

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

test('calendar entry mapping carries detected topics into shared cards', () => {
  const mappedEntry = toCalendarEntry({
    _id: 'entry-topics',
    title: 'A reflective afternoon',
    content: 'I noticed anxiety soften after reaching out.',
    type: 'guided',
    entryKind: 'journal',
    aiPrompt: null,
    images: [],
    tags: ['onboarding:first-reflection'],
    detectedTopics: ['anxiety', 'loneliness'],
    detectedMood: 'okay',
    isFavorite: false,
    createdAt: '2026-08-03T10:00:00.000Z',
    updatedAt: '2026-08-03T10:00:00.000Z',
  });

  expect(mappedEntry.detectedTopics).toEqual(['anxiety', 'loneliness']);
});

const formatCalendarDateLabel = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

const formatCalendarMonthLabel = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);

beforeEach(() => {
  jest.clearAllMocks();
  useAppStore.setState({
    hasBootstrappedAuthGate: true,
    session: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        userId: 'user-123',
        name: 'Alex',
        phoneNumber: null,
        email: 'alex@example.com',
        isPremium: false,
        journalingGoals: [],
        avatarColor: '#8E4636',
        profileSetupCompleted: true,
        onboardingCompleted: true,
        profilePic: null,
      },
    },
  });
  (getJournalEntriesPage as jest.Mock).mockImplementation(
    async ({ from, to }: { from?: string; to?: string } = {}) => {
      const sourceEntries = useAppStore.getState().recentJournalEntries;
      const entries = sourceEntries.filter(entry => {
        const createdAt = new Date(entry.createdAt).getTime();
        return (
          (!from || createdAt >= new Date(from).getTime()) &&
          (!to || createdAt < new Date(to).getTime())
        );
      });

      return {
        entries,
        pagination: {
          nextCursor: null,
          hasMore: false,
          matchingCount: entries.length,
        },
        summary: {
          totalEntries: sourceEntries.length,
          favoriteEntries: sourceEntries.filter(entry => entry.isFavorite)
            .length,
        },
      };
    },
  );
});

test('renders the calendar screen layout', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.setState({
      stage: 'main-app',
      hasBootstrappedAuthGate: true,
      session: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          userId: 'user-123',
          name: 'Alex',
          phoneNumber: null,
          email: 'alex@example.com',
          isPremium: false,
          journalingGoals: [],
          avatarColor: '#8E4636',
          profileSetupCompleted: true,
          onboardingCompleted: true,
          profilePic: null,
        },
      },
    });
    useAppStore
      .getState()
      .setRecentJournalEntries(calendarSampleJournalEntries);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <CalendarScreen />
      </SafeAreaProvider>,
    );
  });

  const tree = JSON.stringify(root!.toJSON());
  const title = root!.root.findByProps({ testID: 'entries-screen-title' });

  expect(title.props.children).toBe('All Entries');
  expect(tree).toContain('Total');
  expect(tree).toContain('This Month');
  expect(tree).toContain('Favorites');
  expect(tree).toContain('Morning Reflections');
  expect(tree).toContain('Challenging Day at Work');

  await ReactTestRenderer.act(() => {
    root!.root
      .findAllByProps({ accessibilityLabel: 'Switch to calendar view' })[0]
      .props.onPress();
  });

  const calendarTree = JSON.stringify(root!.toJSON());

  const currentMonth = new Date();
  const previousMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() - 1,
    1,
  );

  expect(
    root!.root.findByProps({ testID: 'entries-screen-title' }).props.children,
  ).toBe('Calendar');
  expect(calendarTree).toContain(formatCalendarMonthLabel(currentMonth));
  expect(calendarTree).toContain('S');
  expect(calendarTree).toContain('M');
  expect(calendarTree).toContain('T');
  expect(calendarTree).toContain('W');
  expect(calendarTree).toContain('F');

  await ReactTestRenderer.act(() => {
    root!.root
      .findAllByProps({ accessibilityLabel: 'Previous month' })[0]
      .props.onPress();
  });

  const previousMonthTree = JSON.stringify(root!.toJSON());

  expect(previousMonthTree).toContain(formatCalendarMonthLabel(previousMonth));

  const seededEntryDate = new Date(2026, 2, 15);
  const selectedMonthOffset =
    (seededEntryDate.getFullYear() - previousMonth.getFullYear()) * 12 +
    seededEntryDate.getMonth() -
    previousMonth.getMonth();
  const monthNavigationLabel =
    selectedMonthOffset > 0 ? 'Next month' : 'Previous month';

  for (let index = 0; index < Math.abs(selectedMonthOffset); index += 1) {
    await ReactTestRenderer.act(() => {
      root!.root
        .findAllByProps({ accessibilityLabel: monthNavigationLabel })[0]
        .props.onPress();
    });
  }

  await ReactTestRenderer.act(() => {
    root!.root
      .findAllByProps({ accessibilityLabel: 'Select Sun, Mar 15, 2026' })[0]
      .props.onPress();
  });

  const selectedTree = JSON.stringify(root!.toJSON());

  expect(selectedTree).toContain('Mar 15, 2026');
  expect(selectedTree).toContain('Morning Reflections');

  await ReactTestRenderer.act(() => {
    root!.root
      .findAllByProps({ accessibilityLabel: 'Switch to list view' })[0]
      .props.onPress();
  });

  expect(
    root!.root.findByProps({ testID: 'entries-screen-title' }).props.children,
  ).toBe('All Entries');
});

test('shows a create-entry placeholder when there are no calendar entries', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <CalendarScreen />
      </SafeAreaProvider>,
    );
  });

  const tree = JSON.stringify(root!.toJSON());

  expect(tree).toContain('No entries yet');
  expect(tree).toContain(
    'Start your journaling journey by creating your first entry',
  );
  expect(
    root!.root.findByProps({ accessibilityLabel: 'Create a new entry' }),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => {
    root!.root
      .findAllByProps({ accessibilityLabel: 'Switch to calendar view' })[0]
      .props.onPress();
  });

  const calendarTree = JSON.stringify(root!.toJSON());

  expect(calendarTree).toContain(formatCalendarDateLabel(new Date()));
  expect(calendarTree).toContain('No entries for this date');
});

test('appends the next cursor page near the end of All Entries', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const firstEntry = {
    ...calendarSampleJournalEntries[0],
    _id: 'first-page-entry',
    title: 'Newest page entry',
  };
  const olderEntry = {
    ...calendarSampleJournalEntries[1],
    _id: 'second-page-entry',
    title: 'Older page entry',
  };

  (getJournalEntriesPage as jest.Mock).mockImplementation(
    async ({ cursor, from }: { cursor?: string; from?: string } = {}) => {
      if (from) {
        return {
          entries: [],
          pagination: {
            nextCursor: null,
            hasMore: false,
            matchingCount: 0,
          },
          summary: { totalEntries: 2, favoriteEntries: 0 },
        };
      }

      return cursor
        ? {
            entries: [olderEntry],
            pagination: {
              nextCursor: null,
              hasMore: false,
              matchingCount: 2,
            },
            summary: { totalEntries: 2, favoriteEntries: 0 },
          }
        : {
            entries: [firstEntry],
            pagination: {
              nextCursor: 'page-two',
              hasMore: true,
              matchingCount: 2,
            },
            summary: { totalEntries: 2, favoriteEntries: 0 },
          };
    },
  );

  ReactTestRenderer.act(() => {
    resetAppStore();
  });

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <CalendarScreen />
      </SafeAreaProvider>,
    );
    await Promise.resolve();
  });

  const scrollView = root!.root.find(
    node => typeof node.props.onScroll === 'function',
  );

  await ReactTestRenderer.act(async () => {
    scrollView.props.onScroll({
      nativeEvent: {
        contentOffset: { y: 760 },
        contentSize: { height: 1200 },
        layoutMeasurement: { height: 500 },
      },
    });
    await Promise.resolve();
  });

  const tree = JSON.stringify(root!.toJSON());
  expect(tree).toContain('Newest page entry');
  expect(tree).toContain('Older page entry');
  expect(getJournalEntriesPage).toHaveBeenCalledWith({
    limit: 10,
    cursor: 'page-two',
  });
});

test("loads today's entries immediately when opening calendar view", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const today = new Date();
  const todayEntry = {
    _id: 'today-entry',
    title: 'Today entry',
    content: 'Today journal content',
    type: 'journal',
    aiPrompt: null,
    images: [],
    tags: ['today'],
    isFavorite: false,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  };

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.getState().setRecentJournalEntries([todayEntry]);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <CalendarScreen />
      </SafeAreaProvider>,
    );
  });

  await ReactTestRenderer.act(() => {
    root!.root
      .findAllByProps({ accessibilityLabel: 'Switch to calendar view' })[0]
      .props.onPress();
  });

  const tree = JSON.stringify(root!.toJSON());

  expect(tree).toContain(formatCalendarDateLabel(today));
  expect(tree).toContain('Today entry');
});

test('swipes between the list and calendar views', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore
      .getState()
      .setRecentJournalEntries(calendarSampleJournalEntries);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <CalendarScreen />
      </SafeAreaProvider>,
    );
  });

  const swipeZone = root!.root.findByProps({
    testID: 'calendar-view-swipe-zone',
  });

  ReactTestRenderer.act(() => {
    swipeZone.props.onTouchStart?.({
      nativeEvent: { locationX: 200, locationY: 40 },
    } as never);
    swipeZone.props.onTouchEnd?.({
      nativeEvent: { locationX: 100, locationY: 50 },
    } as never);
  });

  const calendarTree = JSON.stringify(root!.toJSON());

  expect(
    root!.root.findByProps({ testID: 'entries-screen-title' }).props.children,
  ).toBe('Calendar');
  expect(calendarTree).toContain(formatCalendarMonthLabel(new Date()));
  expect(calendarTree).toContain('S');

  ReactTestRenderer.act(() => {
    swipeZone.props.onTouchStart?.({
      nativeEvent: { locationX: 100, locationY: 50 },
    } as never);
    swipeZone.props.onTouchEnd?.({
      nativeEvent: { locationX: 220, locationY: 56 },
    } as never);
  });

  const listTree = JSON.stringify(root!.toJSON());

  expect(
    root!.root.findByProps({ testID: 'entries-screen-title' }).props.children,
  ).toBe('All Entries');
  expect(listTree).toContain('Morning Reflections');
  expect(listTree).toContain('Challenging Day at Work');
});

test('opens a journal detail from the calendar entry card', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  jest.useFakeTimers();

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore.setState({
      stage: 'main-app',
      hasBootstrappedAuthGate: true,
      session: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          userId: 'user-123',
          name: 'Alex',
          phoneNumber: null,
          email: 'alex@example.com',
          isPremium: false,
          journalingGoals: [],
          avatarColor: '#8E4636',
          profileSetupCompleted: true,
          onboardingCompleted: true,
          profilePic: null,
        },
      },
    });
    useAppStore
      .getState()
      .setRecentJournalEntries(calendarSampleJournalEntries);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <CalendarScreen />
      </SafeAreaProvider>,
    );
  });

  const firstEntryCard = root!.root.findAllByProps({
    accessibilityLabel: 'Open entry Morning Reflections',
  })[0];

  expect(firstEntryCard).toBeTruthy();

  ReactTestRenderer.act(() => {
    firstEntryCard.props.onPress();
  });

  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(300);
  });

  expect(useAppStore.getState().stage).toBe('journal-detail');
  expect(useAppStore.getState().selectedJournalEntryId).toBe('mar-15');
  jest.useRealTimers();
});

test('card swipe claims do not switch the whole Entries view', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore
      .getState()
      .setRecentJournalEntries(calendarSampleJournalEntries);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <CalendarScreen />
      </SafeAreaProvider>,
    );
  });

  root!.root.findAllByType(JournalEntryCard)[0].props.onHorizontalSwipeClaim();
  const swipeZone = root!.root.findByProps({
    testID: 'calendar-view-swipe-zone',
  });

  ReactTestRenderer.act(() => {
    swipeZone.props.onTouchStart({
      nativeEvent: { locationX: 220, locationY: 40 },
    });
    swipeZone.props.onTouchEnd({
      nativeEvent: { locationX: 80, locationY: 42 },
    });
  });

  expect(
    root!.root.findByProps({ testID: 'entries-screen-title' }).props.children,
  ).toBe('All Entries');
});

test('entry actions favorite and confirm deletion from the list', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

  ReactTestRenderer.act(() => {
    resetAppStore();
    useAppStore
      .getState()
      .setRecentJournalEntries(calendarSampleJournalEntries);
  });

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <CalendarScreen />
      </SafeAreaProvider>,
    );
  });

  const firstCard = root!.root.findAllByType(JournalEntryCard)[0];

  await ReactTestRenderer.act(async () => {
    await firstCard.props.onFavoritePress(false);
  });

  expect(toggleJournalFavorite).toHaveBeenCalledWith({
    journalId: 'mar-15',
    isFavorite: false,
  });

  ReactTestRenderer.act(() => {
    firstCard.props.onDeletePress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'Delete entry?',
    'This entry will be removed from your journal history.',
    expect.any(Array),
  );

  const confirmationButtons = alertSpy.mock.calls[0][2] as Array<{
    text: string;
    onPress?: () => Promise<void>;
  }>;

  await ReactTestRenderer.act(async () => {
    await confirmationButtons
      .find(button => button.text === 'Delete')
      ?.onPress?.();
  });

  expect(deleteJournalEntry).toHaveBeenCalledWith('mar-15');
  expect(
    useAppStore
      .getState()
      .recentJournalEntries.some(entry => entry._id === 'mar-15'),
  ).toBe(false);

  alertSpy.mockRestore();
});
