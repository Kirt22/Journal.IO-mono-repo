import HapticPressable from '../../components/HapticPressable';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from '../../infrastructure/reactNative';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  List,
  } from 'lucide-react-native';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native';
import TabScreenLayout from '../../components/TabScreenLayout';
import {
  readViewSwipePoint,
  resolveViewSwipe,
  type ViewSwipePoint,
  type ViewSwipeTouchEvent,
} from '../../utils/viewSwipeGesture';
import JournalEntryCard from '../../components/JournalEntryCard';
import JournalLoader from '../../components/JournalLoader';
import { toCalendarEntries } from '../../models/calendarModels';
import {
  deleteJournalEntry,
  getJournalEntriesPage,
  toggleJournalFavorite,
} from '../../services/journalService';
import type { JournalEntry } from '../../models/journalModels';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../theme/provider';
import { useConnectivity } from '../../hooks/useConnectivity';
import { triggerHaptic } from '../../services/hapticsService';
import { fontFamilies } from '../../theme/typography';

type ViewMode = 'list' | 'calendar';

function useReduceMotionPreference() {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (mounted) {
          setReduceMotionEnabled(enabled);
        }
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotionEnabled;
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isSameMonth(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

function getMonthRange(date: Date) {
  return {
    from: new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
    to: new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString(),
  };
}

function mergeJournalEntries(
  current: JournalEntry[],
  incoming: JournalEntry[],
) {
  const entriesById = new Map(
    [...current, ...incoming].map(entry => [entry._id, entry]),
  );

  return Array.from(entriesById.values()).sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function buildMonthCells(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthDays = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  const offset = firstDay.getDay();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < offset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= monthDays; day += 1) {
    cells.push(new Date(date.getFullYear(), date.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function ModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (next: ViewMode) => void;
}) {
  const theme = useTheme();
  const translateX = useRef(
    new Animated.Value(value === 'list' ? 0 : 35),
  ).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: value === 'list' ? 0 : 35,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [translateX, value]);

  return (
    <View
      style={[
        styles.toggleShell,
        {
          backgroundColor: theme.colors.secondary,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toggleThumb,
          {
            backgroundColor: theme.colors.card,
            transform: [{ translateX }],
          },
        ]}
      />
      {[
        { key: 'list' as const, icon: List, label: 'List' },
        { key: 'calendar' as const, icon: Grid3x3, label: 'Calendar' },
      ].map(item => {
        const Icon = item.icon;
        const isActive = value === item.key;

        return (
          <HapticPressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${item.label.toLowerCase()} view`}
            onPress={() => onChange(item.key)}
            style={({ pressed }: { pressed: boolean }) => [
              styles.toggleButton,
              isActive && [styles.toggleButtonActive],
              pressed && styles.pressed,
            ]}
          >
            <Icon
              size={14}
              color={
                isActive
                  ? theme.colors.foreground
                  : theme.colors.mutedForeground
              }
            />
          </HapticPressable>
        );
      })}
    </View>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.foreground,
        },
      ]}
    >
      <Text style={[styles.statValue, { color: theme.colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

function EmptyState({
  title,
  description,
  onActionPress,
}: {
  title: string;
  description: string;
  onActionPress?: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyStateIconWrap,
          {
            backgroundColor: theme.colors.accent,
          },
        ]}
      >
        <BookOpen color={theme.colors.mutedForeground} size={28} />
      </View>
      <Text
        style={[styles.emptyStateTitle, { color: theme.colors.foreground }]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.emptyStateDescription,
          { color: theme.colors.mutedForeground },
        ]}
      >
        {description}
      </Text>
      {onActionPress ? (
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel="Create a new entry"
          onPress={onActionPress}
          style={({ pressed }: { pressed: boolean }) => [
            styles.emptyStateAction,
            {
              backgroundColor: theme.colors.primary,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.emptyStateActionText,
              { color: theme.colors.primaryForeground },
            ]}
          >
            Create Entry
          </Text>
        </HapticPressable>
      ) : null}
    </View>
  );
}

export default function CalendarScreen() {
  const theme = useTheme();
  const reduceMotionEnabled = useReduceMotionPreference();
  const { status: connectivityStatus } = useConnectivity();
  const isOnline = connectivityStatus === 'online';
  const { width } = useWindowDimensions();
  const today = useMemo(() => new Date(), []);
  const recentJournalEntries = useAppStore(state => state.recentJournalEntries);
  const hasHydratedRecentJournalEntries = useAppStore(
    state => state.hasHydratedRecentJournalEntries,
  );
  const openNewEntry = useAppStore(state => state.openNewEntry);
  const openJournalEntry = useAppStore(state => state.openJournalEntry);
  const updateRecentJournalEntry = useAppStore(
    state => state.updateRecentJournalEntry,
  );
  const removeRecentJournalEntry = useAppStore(
    state => state.removeRecentJournalEntry,
  );
  const mergeRecentJournalEntries = useAppStore(
    state => state.mergeRecentJournalEntries,
  );
  const [view, setView] = useState<ViewMode>('list');
  const [currentMonth, setCurrentMonth] = useState(today);
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const [favoriteUpdatingId, setFavoriteUpdatingId] = useState<string | null>(
    null,
  );
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [openActionsEntryId, setOpenActionsEntryId] = useState<string | null>(
    null,
  );
  const [listJournalEntries, setListJournalEntries] =
    useState<JournalEntry[]>(recentJournalEntries);
  const [monthJournalEntries, setMonthJournalEntries] = useState<
    JournalEntry[]
  >(
    recentJournalEntries.filter(entry =>
      isSameMonth(new Date(entry.createdAt), today),
    ),
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreEntries, setHasMoreEntries] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(
    isOnline && !hasHydratedRecentJournalEntries,
  );
  const [isLoadingMoreEntries, setIsLoadingMoreEntries] = useState(false);
  const isLoadingMoreEntriesRef = useRef(false);
  const [entriesPageError, setEntriesPageError] = useState<string | null>(null);
  const [entrySummary, setEntrySummary] = useState({
    totalEntries: recentJournalEntries.length,
    favoriteEntries: recentJournalEntries.filter(entry => entry.isFavorite)
      .length,
  });
  const viewTransition = useRef(new Animated.Value(1)).current;
  const titleTransition = useRef(new Animated.Value(1)).current;
  const swipeStartRef = useRef<ViewSwipePoint | null>(null);
  // Touch events fire on the swipe zone even while the list is scrolling, so a
  // scroll during the gesture disqualifies it outright.
  const didScrollRef = useRef(false);
  const suppressNextViewSwipeRef = useRef(false);
  const swipeSuppressionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 20;
  const layoutMaxWidth = isWide ? 460 : 420;
  const gridCellSize = isCompact ? 38 : isWide ? 48 : 44;
  const gridGap = isCompact ? 6 : 8;
  const listEntries = useMemo(
    () => toCalendarEntries(listJournalEntries),
    [listJournalEntries],
  );
  const calendarEntries = useMemo(
    () => toCalendarEntries(monthJournalEntries),
    [monthJournalEntries],
  );

  const monthCells = useMemo(
    () => buildMonthCells(currentMonth),
    [currentMonth],
  );
  const monthEntries = useMemo(
    () =>
      calendarEntries.filter(entry => isSameMonth(entry.date, currentMonth)),
    [calendarEntries, currentMonth],
  );
  const selectedEntries = useMemo(
    () =>
      selectedDate
        ? calendarEntries.filter(entry => isSameDay(entry.date, selectedDate))
        : [],
    [calendarEntries, selectedDate],
  );

  const totalCount = entrySummary.totalEntries;
  const monthCount = monthEntries.length;
  const favoriteCount = entrySummary.favoriteEntries;

  useEffect(() => {
    setListJournalEntries(current =>
      mergeJournalEntries(current, recentJournalEntries),
    );
    setMonthJournalEntries(current =>
      mergeJournalEntries(
        current,
        recentJournalEntries.filter(entry =>
          isSameMonth(new Date(entry.createdAt), currentMonth),
        ),
      ),
    );
  }, [currentMonth, recentJournalEntries]);

  useEffect(() => {
    if (!isOnline) {
      setIsLoadingEntries(false);
      return;
    }

    let isActive = true;
    setIsLoadingEntries(true);
    setEntriesPageError(null);

    getJournalEntriesPage({ limit: 10 })
      .then(page => {
        if (!isActive) {
          return;
        }

        setListJournalEntries(page.entries);
        setNextCursor(page.pagination.nextCursor);
        setHasMoreEntries(page.pagination.hasMore);
        setEntrySummary(page.summary);
        mergeRecentJournalEntries(page.entries);
      })
      .catch(() => {
        if (isActive) {
          setEntriesPageError("We couldn't load your entries right now.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingEntries(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [isOnline, mergeRecentJournalEntries]);

  useEffect(() => {
    if (!isOnline) {
      setMonthJournalEntries(
        recentJournalEntries.filter(entry =>
          isSameMonth(new Date(entry.createdAt), currentMonth),
        ),
      );
      return;
    }

    let isActive = true;
    const range = getMonthRange(currentMonth);

    const loadMonthEntries = async () => {
      const collected: JournalEntry[] = [];
      let cursor: string | undefined;

      do {
        const page = await getJournalEntriesPage({
          limit: 50,
          ...range,
          ...(cursor ? { cursor } : {}),
        });
        collected.push(...page.entries);
        cursor = page.pagination.nextCursor || undefined;
      } while (cursor && isActive);

      if (isActive) {
        setMonthJournalEntries(mergeJournalEntries([], collected));
      }
    };

    loadMonthEntries().catch(() => {
      // Keep cached month entries visible when the range request fails.
    });

    return () => {
      isActive = false;
    };
  }, [currentMonth, isOnline, recentJournalEntries]);

  const loadMoreEntries = useCallback(async () => {
    if (
      !isOnline ||
      !hasMoreEntries ||
      !nextCursor ||
      isLoadingEntries ||
      isLoadingMoreEntriesRef.current
    ) {
      return;
    }

    isLoadingMoreEntriesRef.current = true;
    setIsLoadingMoreEntries(true);
    setEntriesPageError(null);

    try {
      const page = await getJournalEntriesPage({
        limit: 10,
        cursor: nextCursor,
      });
      setListJournalEntries(current =>
        mergeJournalEntries(current, page.entries),
      );
      setNextCursor(page.pagination.nextCursor);
      setHasMoreEntries(page.pagination.hasMore);
      setEntrySummary(page.summary);
    } catch {
      setEntriesPageError(
        "We couldn't load older entries. Try again when you're ready.",
      );
    } finally {
      isLoadingMoreEntriesRef.current = false;
      setIsLoadingMoreEntries(false);
    }
  }, [hasMoreEntries, isLoadingEntries, isOnline, nextCursor]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (swipeStartRef.current) {
        didScrollRef.current = true;
      }
      setOpenActionsEntryId(null);

      if (view !== 'list') {
        return;
      }

      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;

      if (distanceFromBottom < 280) {
        loadMoreEntries().catch(() => undefined);
      }
    },
    [loadMoreEntries, view],
  );

  const retryEntriesPage = useCallback(async () => {
    if (nextCursor) {
      await loadMoreEntries();
      return;
    }

    if (!isOnline || isLoadingEntries) {
      return;
    }

    setIsLoadingEntries(true);
    setEntriesPageError(null);
    try {
      const page = await getJournalEntriesPage({ limit: 10 });
      setListJournalEntries(page.entries);
      setNextCursor(page.pagination.nextCursor);
      setHasMoreEntries(page.pagination.hasMore);
      setEntrySummary(page.summary);
      mergeRecentJournalEntries(page.entries);
    } catch {
      setEntriesPageError("We couldn't load your entries right now.");
    } finally {
      setIsLoadingEntries(false);
    }
  }, [
    isLoadingEntries,
    isOnline,
    loadMoreEntries,
    mergeRecentJournalEntries,
    nextCursor,
  ]);

  const handleMonthShift = (offset: number) => {
    setCurrentMonth(
      previous =>
        new Date(previous.getFullYear(), previous.getMonth() + offset, 1),
    );
    setSelectedDate(null);
  };

  const handleFavoriteToggle = async (
    entryId: string,
    nextFavorite: boolean,
  ) => {
    if (!isOnline || favoriteUpdatingId === entryId) {
      return;
    }

    const currentEntry = [...listEntries, ...calendarEntries].find(
      entry => entry.id === entryId,
    );

    if (!currentEntry) {
      return;
    }

    setFavoriteUpdatingId(entryId);

    try {
      const updatedEntry = await toggleJournalFavorite({
        journalId: entryId,
        isFavorite: nextFavorite,
      });

      updateRecentJournalEntry(updatedEntry);
      setListJournalEntries(current =>
        current.map(entry => (entry._id === entryId ? updatedEntry : entry)),
      );
      setMonthJournalEntries(current =>
        current.map(entry => (entry._id === entryId ? updatedEntry : entry)),
      );
      setEntrySummary(current => ({
        ...current,
        favoriteEntries: Math.max(
          0,
          current.favoriteEntries + (nextFavorite ? 1 : -1),
        ),
      }));
    } catch (error) {
      Alert.alert(
        "Couldn't update favorite",
        "Your entry wasn't changed. Please try again.",
      );
      throw error;
    } finally {
      setFavoriteUpdatingId(null);
    }
  };

  const handleDeletePress = (entryId: string) => {
    if (!isOnline || deletingEntryId) {
      return;
    }

    const deletingEntry = [...listJournalEntries, ...monthJournalEntries].find(
      entry => entry._id === entryId,
    );

    Alert.alert(
      'Delete entry?',
      'This entry will be removed from your journal history.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingEntryId(entryId);

            try {
              await deleteJournalEntry(entryId);
              removeRecentJournalEntry(entryId);
              setListJournalEntries(current =>
                current.filter(entry => entry._id !== entryId),
              );
              setMonthJournalEntries(current =>
                current.filter(entry => entry._id !== entryId),
              );
              setEntrySummary(current => ({
                totalEntries: Math.max(0, current.totalEntries - 1),
                favoriteEntries: Math.max(
                  0,
                  current.favoriteEntries - (deletingEntry?.isFavorite ? 1 : 0),
                ),
              }));
              setOpenActionsEntryId(null);
            } catch {
              Alert.alert(
                "Couldn't delete entry",
                'Your entry is still here. Please try again.',
              );
            } finally {
              setDeletingEntryId(null);
            }
          },
        },
      ],
    );
  };

  const handleViewModeChange = useCallback(
    (nextView: ViewMode) => {
      if (view === nextView) {
        return;
      }

      if (!reduceMotionEnabled) {
        titleTransition.stopAnimation();
        titleTransition.setValue(0);
      }

      setView(nextView);
      setOpenActionsEntryId(null);
    },
    [reduceMotionEnabled, titleTransition, view],
  );

  const handleSwipeStart = useCallback((event: ViewSwipeTouchEvent) => {
    didScrollRef.current = false;
    swipeStartRef.current = readViewSwipePoint(event, Date.now());
  }, []);

  const handleEntryCardSwipeClaim = useCallback(() => {
    suppressNextViewSwipeRef.current = true;

    if (swipeSuppressionTimerRef.current) {
      clearTimeout(swipeSuppressionTimerRef.current);
    }

    swipeSuppressionTimerRef.current = setTimeout(() => {
      suppressNextViewSwipeRef.current = false;
      swipeSuppressionTimerRef.current = null;
    }, 700);
  }, []);

  const handleSwipeEnd = useCallback(
    (event: ViewSwipeTouchEvent) => {
      const start = swipeStartRef.current;
      const scrolled = didScrollRef.current;
      swipeStartRef.current = null;
      didScrollRef.current = false;

      if (suppressNextViewSwipeRef.current) {
        suppressNextViewSwipeRef.current = false;
        if (swipeSuppressionTimerRef.current) {
          clearTimeout(swipeSuppressionTimerRef.current);
          swipeSuppressionTimerRef.current = null;
        }
        return;
      }

      const direction = resolveViewSwipe({
        start,
        end: readViewSwipePoint(event, Date.now()),
        scrolled,
      });

      if (!direction) {
        return;
      }

      if (direction === 'left' && view === 'list') {
        triggerHaptic('optionSelected').catch(() => undefined);
        handleViewModeChange('calendar');
        return;
      }

      if (direction === 'right' && view === 'calendar') {
        triggerHaptic('optionSelected').catch(() => undefined);
        handleViewModeChange('list');
      }
    },
    [handleViewModeChange, view],
  );

  useEffect(() => {
    return () => {
      if (swipeSuppressionTimerRef.current) {
        clearTimeout(swipeSuppressionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    viewTransition.stopAnimation();
    viewTransition.setValue(0);

    Animated.timing(viewTransition, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [view, viewTransition]);

  useEffect(() => {
    if (reduceMotionEnabled) {
      titleTransition.stopAnimation();
      titleTransition.setValue(1);
      return;
    }

    const animation = Animated.timing(titleTransition, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [reduceMotionEnabled, titleTransition, view]);

  return (
    <TabScreenLayout
      backgroundColor={theme.colors.background}
      horizontalPadding={horizontalPadding}
      layoutMaxWidth={layoutMaxWidth}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      scrollContentStyle={styles.content}
      shellStyle={styles.shell}
    >
      <View style={styles.header}>
        <Animated.Text
          accessibilityRole="header"
          testID="entries-screen-title"
          style={[
            styles.screenTitle,
            {
              color: theme.colors.foreground,
              opacity: titleTransition,
              transform: [
                {
                  translateY: titleTransition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [6, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {view === 'list' ? 'All Entries' : 'Calendar'}
        </Animated.Text>
        <ModeToggle value={view} onChange={handleViewModeChange} />
      </View>

      <View style={styles.statsRow}>
        <StatCard value={totalCount} label="Total" />
        <StatCard value={monthCount} label="This Month" />
        <StatCard value={favoriteCount} label="Favorites" />
      </View>

      <View
        testID="calendar-view-swipe-zone"
        style={styles.swipeZone}
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
      >
        {view === 'list' ? (
          isLoadingEntries && listEntries.length === 0 ? (
            <View style={styles.entriesLoadingState}>
              <JournalLoader color={theme.colors.primary} size="small" />
              <Text
                style={[
                  styles.entriesLoadingText,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                Loading your entries...
              </Text>
            </View>
          ) : entriesPageError && listEntries.length === 0 ? (
            <View style={styles.entriesLoadingState}>
              <Text
                style={[
                  styles.emptyStateTitle,
                  { color: theme.colors.foreground },
                ]}
              >
                Entries unavailable
              </Text>
              <Text
                style={[
                  styles.emptyStateDescription,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                {entriesPageError}
              </Text>
              <HapticPressable
                accessibilityLabel="Retry loading entries"
                accessibilityRole="button"
                onPress={() => retryEntriesPage().catch(() => undefined)}
                style={[
                  styles.emptyStateAction,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.emptyStateActionText,
                    { color: theme.colors.primaryForeground },
                  ]}
                >
                  Try again
                </Text>
              </HapticPressable>
            </View>
          ) : totalCount === 0 ? (
            <EmptyState
              title={
                !isOnline && !hasHydratedRecentJournalEntries
                  ? 'Entries unavailable offline'
                  : 'No entries yet'
              }
              description={
                !isOnline && !hasHydratedRecentJournalEntries
                  ? 'Reconnect to load your journal entries.'
                  : 'Start your journaling journey by creating your first entry'
              }
              onActionPress={
                isOnline || hasHydratedRecentJournalEntries
                  ? openNewEntry
                  : undefined
              }
            />
          ) : (
            <Animated.View
              key="list"
              style={[
                styles.viewTransition,
                {
                  opacity: viewTransition,
                  transform: [
                    {
                      translateY: viewTransition.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.listStack}>
                {listEntries.map(entry => (
                  <JournalEntryCard
                    key={entry.id}
                    entry={entry}
                    onPress={() => openJournalEntry(entry.id)}
                    onFavoritePress={nextFavorite =>
                      handleFavoriteToggle(entry.id, nextFavorite)
                    }
                    onDeletePress={() => handleDeletePress(entry.id)}
                    isFavoriteUpdating={favoriteUpdatingId === entry.id}
                    isDeleting={deletingEntryId === entry.id}
                    actionsDisabled={!isOnline}
                    actionsOpen={openActionsEntryId === entry.id}
                    onActionsOpenChange={open =>
                      setOpenActionsEntryId(open ? entry.id : null)
                    }
                    onHorizontalSwipeClaim={handleEntryCardSwipeClaim}
                    enableEntryActions
                    previewLines={3}
                  />
                ))}
                {isLoadingMoreEntries ? (
                  <View style={styles.paginationFooter}>
                    <JournalLoader
                      color={theme.colors.primary}
                      size="small"
                    />
                    <Text
                      style={[
                        styles.paginationText,
                        { color: theme.colors.mutedForeground },
                      ]}
                    >
                      Loading older entries...
                    </Text>
                  </View>
                ) : !isOnline && hasMoreEntries ? (
                  <View style={styles.paginationFooter}>
                    <Text
                      style={[
                        styles.paginationText,
                        { color: theme.colors.mutedForeground },
                      ]}
                    >
                      Reconnect to load older entries
                    </Text>
                  </View>
                ) : entriesPageError && listEntries.length > 0 ? (
                  <HapticPressable
                    accessibilityLabel="Retry loading older entries"
                    accessibilityRole="button"
                    onPress={() => retryEntriesPage().catch(() => undefined)}
                    style={styles.paginationRetry}
                  >
                    <Text
                      style={[
                        styles.paginationText,
                        { color: theme.colors.primary },
                      ]}
                    >
                      {isOnline
                        ? 'Try loading older entries again'
                        : 'Reconnect to load older entries'}
                    </Text>
                  </HapticPressable>
                ) : null}
              </View>
            </Animated.View>
          )
        ) : (
          <Animated.View
            key="calendar"
            style={[
              styles.viewTransition,
              {
                opacity: viewTransition,
                transform: [
                  {
                    translateY: viewTransition.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.calendarStack}>
              <View style={styles.monthHeader}>
                <HapticPressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  onPress={() => handleMonthShift(-1)}
                  style={({ pressed }: { pressed: boolean }) => [
                    styles.monthNavButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ChevronLeft size={20} color={theme.colors.foreground} />
                </HapticPressable>

                <Text
                  style={[
                    styles.monthLabel,
                    { color: theme.colors.foreground },
                  ]}
                >
                  {formatMonthLabel(currentMonth)}
                </Text>

                <HapticPressable
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  onPress={() => handleMonthShift(1)}
                  style={({ pressed }: { pressed: boolean }) => [
                    styles.monthNavButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ChevronRight size={20} color={theme.colors.foreground} />
                </HapticPressable>
              </View>

              <View style={[styles.weekdayRow, { gap: gridGap }]}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <Text
                    key={`${day}-${index}`}
                    style={[
                      styles.weekdayLabel,
                      {
                        color: theme.colors.mutedForeground,
                        width: gridCellSize,
                      },
                    ]}
                  >
                    {day}
                  </Text>
                ))}
              </View>

              <View style={[styles.grid, { gap: gridGap }]}>
                {monthCells.map((cell, index) => {
                  if (!cell) {
                    return (
                      <View
                        key={`empty-${index}`}
                        style={[
                          styles.dayCell,
                          styles.gridPlaceholder,
                          {
                            width: gridCellSize,
                            height: gridCellSize,
                          },
                        ]}
                      />
                    );
                  }

                  const isToday = isSameDay(cell, today);
                  const isSelected = selectedDate
                    ? isSameDay(cell, selectedDate)
                    : false;
                  const hasEntry = calendarEntries.some(entry =>
                    isSameDay(entry.date, cell),
                  );

                  return (
                    <HapticPressable
                      key={cell.toISOString()}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${formatDateLabel(cell)}`}
                      onPress={() =>
                        setSelectedDate(previous =>
                          previous && isSameDay(previous, cell) ? null : cell,
                        )
                      }
                      style={({ pressed }: { pressed: boolean }) => [
                        styles.dayCell,
                        {
                          width: gridCellSize,
                          height: gridCellSize,
                          borderColor: isSelected
                            ? theme.colors.primary
                            : isToday
                            ? theme.colors.primary
                            : 'transparent',
                          backgroundColor: isSelected
                            ? theme.colors.primary
                            : 'transparent',
                        },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          {
                            color: isSelected
                              ? theme.colors.primaryForeground
                              : theme.colors.foreground,
                          },
                        ]}
                      >
                        {cell.getDate()}
                      </Text>
                      {hasEntry ? (
                        <View
                          style={[
                            styles.dayDot,
                            {
                              backgroundColor: isSelected
                                ? theme.colors.primaryForeground
                                : theme.colors.primary,
                            },
                          ]}
                        />
                      ) : null}
                    </HapticPressable>
                  );
                })}
              </View>

              {selectedDate ? (
                <View style={styles.selectedSection}>
                  <Text
                    style={[
                      styles.selectedLabel,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    {formatDateLabel(selectedDate)}
                  </Text>

                  {selectedEntries.length > 0 ? (
                    <View style={styles.listStack}>
                      {selectedEntries.map(entry => (
                        <JournalEntryCard
                          key={entry.id}
                          entry={entry}
                          onPress={() => openJournalEntry(entry.id)}
                          onFavoritePress={nextFavorite =>
                            handleFavoriteToggle(entry.id, nextFavorite)
                          }
                          onDeletePress={() => handleDeletePress(entry.id)}
                          isFavoriteUpdating={favoriteUpdatingId === entry.id}
                          isDeleting={deletingEntryId === entry.id}
                          actionsDisabled={!isOnline}
                          actionsOpen={openActionsEntryId === entry.id}
                          onActionsOpenChange={open =>
                            setOpenActionsEntryId(open ? entry.id : null)
                          }
                          onHorizontalSwipeClaim={handleEntryCardSwipeClaim}
                          enableEntryActions
                          previewLines={3}
                        />
                      ))}
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.emptyCalendarState,
                        {
                          backgroundColor: theme.colors.card,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.emptyCalendarTitle,
                          { color: theme.colors.foreground },
                        ]}
                      >
                        No entries for this date
                      </Text>
                      <Text
                        style={[
                          styles.emptyCalendarText,
                          { color: theme.colors.mutedForeground },
                        ]}
                      >
                        This is a calm placeholder until entry creation is
                        connected.
                      </Text>
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          </Animated.View>
        )}
      </View>
    </TabScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 14,
  },
  shell: {
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  screenTitle: {
    fontFamily: fontFamilies.display.semibold,
    flex: 1,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  toggleShell: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    padding: 3,
    gap: 3,
    overflow: 'hidden',
  },
  toggleThumb: {
    position: 'absolute',
    left: 3,
    top: 3,
    bottom: 3,
    width: 32,
    borderRadius: 999,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 1,
  },
  toggleButton: {
    width: 32,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {},
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 1,
  },
  statValue: {
    fontSize: 30,
    letterSpacing: -0.7,
    fontWeight: '600',
    lineHeight: 34,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  listStack: {
    gap: 12,
  },
  entriesLoadingState: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 48,
  },
  entriesLoadingText: {
    fontSize: 13,
    lineHeight: 19,
  },
  paginationFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    minHeight: 48,
  },
  paginationRetry: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  paginationText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyStateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyStateDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 260,
    marginBottom: 20,
  },
  emptyStateAction: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  emptyStateActionText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  viewTransition: {
    width: '100%',
  },
  swipeZone: {
    width: '100%',
  },
  entryCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 1,
  },
  entryCardPressable: {
    opacity: 0.98,
  },
  entryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  entryTitleWrap: {
    flex: 1,
    gap: 4,
  },
  entryDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entryDateText: {
    fontSize: 12,
    lineHeight: 16,
  },
  entryTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  favoriteWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  entryContent: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    lineHeight: 14,
  },
  calendarStack: {
    gap: 18,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthNavButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
    paddingHorizontal: 0,
  },
  weekdayLabel: {
    width: 44,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  dayCell: {
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
  },
  selectedSection: {
    gap: 12,
    marginTop: 4,
  },
  selectedLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyCalendarState: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyCalendarTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyCalendarText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 260,
  },
  gridPlaceholder: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
