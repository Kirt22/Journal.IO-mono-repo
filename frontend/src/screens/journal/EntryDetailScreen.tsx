import HapticPressable from '../../components/HapticPressable';
import {
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import {
  Animated,
  Alert,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Text,
} from '../../infrastructure/reactNative';
import {
  ArrowLeft,
  Brain,
  Edit2,
  Heart,
  Lock,
  Loader2,
  RefreshCw,
  Sparkles,
  Star,
  Tag,
  Trash2,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav, {
  BOTTOM_NAV_CONTENT_PADDING,
  type BottomNavKey,
} from '../../components/BottomNav';
import ButtonLoadingContent from '../../components/ButtonLoadingContent';
import JournalLoader from '../../components/JournalLoader';
import EmojiWithFallback from '../../components/EmojiWithFallback';
import EntrySessionInsights from '../../components/EntrySessionInsights';
import PremiumUpgradeCard from '../../components/PremiumUpgradeCard';
import {
  deleteJournalEntry,
  getJournalEntry,
  getJournalQuickAnalysis,
  getJournalSessionAnalysis,
  toggleJournalFavorite,
} from '../../services/journalService';
import { trackPaywallEvent } from '../../services/paywallService';
import { useAppStore } from '../../store/appStore';
import type {
  JournalEntry,
  JournalQuickAnalysis,
} from '../../models/journalModels';
import type { GuidedReflectionSessionAnalysisResponse } from '../../services/guidedReflectionService';
import { useTheme } from '../../theme/provider';
import {
  formatEntryTagLabel,
  getEntryDisplayTags,
} from '../../utils/journalEntryCard';

function formatEntryDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getToneColor(
  tone: JournalQuickAnalysis['patternTags'][number]['tone'],
) {
  switch (tone) {
    case 'coral':
      return '#E6816D';
    case 'sage':
      return '#8AB39A';
    case 'amber':
      return '#E9A15B';
    case 'slate':
      return '#8E939A';
    case 'blue':
    default:
      return '#7D9FD6';
  }
}

const MOOD_EMOJI: Record<
  GuidedReflectionSessionAnalysisResponse['detectedMood'],
  string
> = {
  amazing: '🤩',
  good: '😊',
  okay: '😌',
  bad: '😔',
  terrible: '😢',
};

function JournalTags({ tags }: { tags: string[] }) {
  const theme = useTheme();

  if (!tags.length) {
    return null;
  }

  return (
    <View style={styles.tagSection} testID="entry-detected-topic-tags">
      <View style={styles.tagHeader}>
        <Tag size={14} color={theme.colors.mutedForeground} />
        <Text
          style={[styles.tagSectionLabel, { color: theme.colors.foreground }]}
        >
          Tags
        </Text>
      </View>
      <View style={styles.tagRow}>
        {tags.map(tag => (
          <View
            key={tag}
            style={[
              styles.tagChip,
              {
                backgroundColor: theme.colors.secondary,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.tagChipText,
                { color: theme.colors.secondaryForeground },
              ]}
            >
              {formatEntryTagLabel(tag)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function QuickAnalysisSignalCard({
  title,
  signal,
}: {
  title: string;
  signal: JournalQuickAnalysis['signals'][keyof JournalQuickAnalysis['signals']];
}) {
  const theme = useTheme();
  const toneColor = getToneColor(signal.tone);

  return (
    <View
      style={[
        styles.quickAnalysisSignalCard,
        {
          backgroundColor: hexToRgba(toneColor, 0.08),
          borderColor: hexToRgba(toneColor, 0.22),
        },
      ]}
    >
      <Text
        style={[
          styles.quickAnalysisSignalLabel,
          { color: theme.colors.mutedForeground },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.quickAnalysisSignalTitle,
          { color: theme.colors.foreground },
        ]}
      >
        {signal.title}
      </Text>
      <Text
        style={[
          styles.quickAnalysisSignalBody,
          { color: theme.colors.mutedForeground },
        ]}
      >
        {signal.description}
      </Text>
      <View style={styles.quickAnalysisEvidenceRow}>
        {signal.evidence.map(item => (
          <View
            key={`${title}-${item}`}
            style={[
              styles.quickAnalysisEvidenceChip,
              { backgroundColor: hexToRgba(toneColor, 0.14) },
            ]}
          >
            <Text
              style={[styles.quickAnalysisEvidenceText, { color: toneColor }]}
            >
              {item}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function EntryDetailScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const activeTab = useAppStore(state => state.activeTab);
  const entryId = useAppStore(state => state.selectedJournalEntryId);
  const entries = useAppStore(state => state.recentJournalEntries);
  const isPremiumUser = useAppStore(state =>
    Boolean(state.session?.user.isPremium),
  );
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement,
  );
  const closeJournalEntry = useAppStore(state => state.closeJournalEntry);
  const setActiveTab = useAppStore(state => state.setActiveTab);
  const openNewEntry = useAppStore(state => state.openNewEntry);
  const openJournalEditor = useAppStore(state => state.openJournalEditor);
  const removeRecentJournalEntry = useAppStore(
    state => state.removeRecentJournalEntry,
  );
  const updateRecentJournalEntry = useAppStore(
    state => state.updateRecentJournalEntry,
  );
  const [hydratedEntry, setHydratedEntry] = useState<JournalEntry | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [quickAnalysis, setQuickAnalysis] =
    useState<JournalQuickAnalysis | null>(null);
  const [isQuickAnalysisLoading, setIsQuickAnalysisLoading] = useState(false);
  const [quickAnalysisError, setQuickAnalysisError] = useState<string | null>(
    null,
  );
  const [sessionAnalysis, setSessionAnalysis] =
    useState<GuidedReflectionSessionAnalysisResponse | null>(null);
  const [isSessionAnalysisLoading, setIsSessionAnalysisLoading] =
    useState(false);
  const [sessionAnalysisError, setSessionAnalysisError] = useState<
    string | null
  >(null);
  const quickAnalysisReveal = useRef(new Animated.Value(0)).current;
  const moodReveal = useRef(new Animated.Value(0)).current;

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 20;
  const layoutMaxWidth = isWide ? 430 : 390;

  const entry = useMemo(
    () =>
      hydratedEntry || entries.find(current => current._id === entryId) || null,
    [entryId, entries, hydratedEntry],
  );
  const sessionAnalysisEntryId = entry?._id;
  const sessionAnalysisEntryKind = entry?.entryKind;

  useEffect(() => {
    if (!entryId) {
      setHydratedEntry(null);
      setQuickAnalysis(null);
      setQuickAnalysisError(null);
      setIsQuickAnalysisLoading(false);
      return;
    }

    let isActive = true;

    setHydratedEntry(null);
    setIsRefreshing(true);

    getJournalEntry(entryId)
      .then(fetchedEntry => {
        if (!isActive) {
          return;
        }

        setHydratedEntry(fetchedEntry);
        updateRecentJournalEntry(fetchedEntry);
      })
      .catch(() => {
        // Keep locally cached data if the refresh fails.
      })
      .finally(() => {
        if (isActive) {
          setIsRefreshing(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [entryId, updateRecentJournalEntry]);

  useEffect(() => {
    setQuickAnalysis(null);
    setQuickAnalysisError(null);
    setIsQuickAnalysisLoading(false);
  }, [entryId]);

  useEffect(() => {
    setSessionAnalysis(null);
    setSessionAnalysisError(null);
    setIsSessionAnalysisLoading(false);
  }, [entryId]);

  useEffect(() => {
    if (
      Platform.OS !== 'ios' ||
      !entryId ||
      !sessionAnalysisEntryId ||
      sessionAnalysisEntryId !== entryId ||
      sessionAnalysisEntryKind === 'quick_thought' ||
      !isPremiumUser ||
      sessionAnalysis
    ) {
      return;
    }

    let isActive = true;
    setIsSessionAnalysisLoading(true);
    setSessionAnalysisError(null);

    getJournalSessionAnalysis(sessionAnalysisEntryId)
      .then(analysis => {
        if (!isActive) {
          return;
        }

        setSessionAnalysis(analysis);
        const latestEntry = useAppStore
          .getState()
          .recentJournalEntries.find(
            current => current._id === sessionAnalysisEntryId,
          );
        const analyzedEntry = latestEntry
          ? {
              ...latestEntry,
              detectedMood: analysis.detectedMood,
              detectedTopics: analysis.detectedTopics,
            }
          : null;

        setHydratedEntry(current =>
          analyzedEntry ||
          (current
            ? {
                ...current,
                detectedMood: analysis.detectedMood,
                detectedTopics: analysis.detectedTopics,
              }
            : current),
        );
        if (analyzedEntry) {
          updateRecentJournalEntry(analyzedEntry);
        }
      })
      .catch(() => {
        if (isActive) {
          setSessionAnalysisError(
            "We couldn't load the saved session insights right now. Your entry is still here.",
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsSessionAnalysisLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    entryId,
    isPremiumUser,
    sessionAnalysisEntryId,
    sessionAnalysisEntryKind,
    sessionAnalysis,
    updateRecentJournalEntry,
  ]);

  useEffect(() => {
    moodReveal.stopAnimation();
    if (!sessionAnalysis) {
      moodReveal.setValue(0);
      return;
    }

    moodReveal.setValue(0);
    Animated.timing(moodReveal, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [moodReveal, sessionAnalysis]);

  useEffect(() => {
    quickAnalysisReveal.stopAnimation();

    if (!quickAnalysis) {
      quickAnalysisReveal.setValue(0);
      return;
    }

    quickAnalysisReveal.setValue(0);
    Animated.timing(quickAnalysisReveal, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [quickAnalysis, quickAnalysisReveal]);

  const handleToggleFavorite = async () => {
    if (!entry || isTogglingFavorite) {
      return;
    }

    setIsTogglingFavorite(true);

    try {
      const updatedEntry = await toggleJournalFavorite({
        journalId: entry._id,
        isFavorite: !entry.isFavorite,
      });

      setHydratedEntry(updatedEntry);
      updateRecentJournalEntry(updatedEntry);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const handleDelete = () => {
    if (!entry || isDeleting) {
      return;
    }

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
            setIsDeleting(true);

            try {
              await deleteJournalEntry(entry._id);
              removeRecentJournalEntry(entry._id);
              closeJournalEntry();
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  const handleLoadQuickAnalysis = async ({
    force = false,
  }: { force?: boolean } = {}) => {
    if (!entry || isQuickAnalysisLoading) {
      return;
    }

    if (!isPremiumUser) {
      trackPaywallEvent({
        placementKey: 'entry_quick_analysis_locked',
        screenKey: 'journal-detail',
        eventType: 'locked_feature_tap',
        wasInterruptive: false,
      }).catch(() => undefined);
      openPaywallForPlacement({
        placementKey: 'entry_quick_analysis_locked',
        returnStage: 'journal-detail',
        screenKey: 'journal-detail',
      });
      return;
    }

    if (!force && quickAnalysis?.journalId === entry._id) {
      return;
    }

    setIsQuickAnalysisLoading(true);
    setQuickAnalysisError(null);

    try {
      const nextQuickAnalysis = await getJournalQuickAnalysis(entry._id);
      setQuickAnalysis(nextQuickAnalysis);
    } catch (error) {
      setQuickAnalysisError(
        error instanceof Error
          ? error.message
          : 'We could not load a quick analysis for this entry.',
      );
    } finally {
      setIsQuickAnalysisLoading(false);
    }
  };

  const handleBottomNavPress = (nextTab: BottomNavKey) => {
    if (nextTab === 'new') {
      closeJournalEntry();
      openNewEntry();
      return;
    }

    closeJournalEntry();
    setActiveTab(nextTab);
  };

  const renderBottomNav = (
    <BottomNav activeKey={activeTab} onPress={handleBottomNavPress} />
  );

  if (!entryId) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View
          style={[styles.emptyShell, { paddingHorizontal: horizontalPadding }]}
        >
          <View style={[styles.emptyState, { maxWidth: layoutMaxWidth }]}>
            <Text
              style={[styles.emptyTitle, { color: theme.colors.foreground }]}
            >
              Entry not found
            </Text>
            <Text
              style={[
                styles.emptyText,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Choose an entry from Home or Entries to view it here.
            </Text>
            <HapticPressable
              accessibilityRole="button"
              accessibilityLabel="Go back to home"
              onPress={closeJournalEntry}
              style={({ pressed }) => [
                styles.backButton,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.backButtonText,
                  { color: theme.colors.foreground },
                ]}
              >
                Go home
              </Text>
            </HapticPressable>
          </View>
        </View>
        {renderBottomNav}
      </SafeAreaView>
    );
  }

  if (!entry && isRefreshing) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View
          style={[styles.emptyShell, { paddingHorizontal: horizontalPadding }]}
        >
          <View style={[styles.emptyState, { maxWidth: layoutMaxWidth }]}>
            <Loader2 size={22} color={theme.colors.primary} />
            <Text
              style={[styles.emptyTitle, { color: theme.colors.foreground }]}
            >
              Loading entry
            </Text>
          </View>
        </View>
        {renderBottomNav}
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View
          style={[styles.emptyShell, { paddingHorizontal: horizontalPadding }]}
        >
          <View style={[styles.emptyState, { maxWidth: layoutMaxWidth }]}>
            <Text
              style={[styles.emptyTitle, { color: theme.colors.foreground }]}
            >
              Entry unavailable
            </Text>
            <Text
              style={[
                styles.emptyText,
                { color: theme.colors.mutedForeground },
              ]}
            >
              The journal item could not be loaded.
            </Text>
            <HapticPressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={closeJournalEntry}
              style={({ pressed }) => [
                styles.backButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.backButtonText,
                  { color: theme.colors.foreground },
                ]}
              >
                Go back
              </Text>
            </HapticPressable>
          </View>
        </View>
        {renderBottomNav}
      </SafeAreaView>
    );
  }

  const favoriteLabel = entry.isFavorite ? 'Remove favorite' : 'Add favorite';
  const visibleTags = getEntryDisplayTags(entry);
  const hasMoodTag = entry.tags.some(tag =>
    tag.toLowerCase().startsWith('mood:'),
  );
  const shouldShowQuickAnalysis = Platform.OS !== 'ios';
  const shouldShowSessionInsights =
    Platform.OS === 'ios' && entry.entryKind !== 'quick_thought';
  const quickAnalysisRevealTranslate = quickAnalysisReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const quickAnalysisRevealScale = quickAnalysisReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1],
  });

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View
        style={[styles.container, { paddingHorizontal: horizontalPadding }]}
      >
        <View style={[styles.shell, { maxWidth: layoutMaxWidth }]}>
          <View style={styles.header}>
            <HapticPressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={closeJournalEntry}
              hitSlop={8}
              style={({ pressed }) => [
                styles.headerIconButton,
                pressed && styles.pressed,
              ]}
            >
              <ArrowLeft size={18} color={theme.colors.foreground} />
            </HapticPressable>

            <View style={styles.headerActions}>
              <HapticPressable
                accessibilityRole="button"
                accessibilityLabel={favoriteLabel}
                accessibilityState={{
                  busy: isTogglingFavorite,
                  disabled: isTogglingFavorite,
                }}
                onPress={handleToggleFavorite}
                disabled={isTogglingFavorite}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.headerIconButton,
                  pressed && !isTogglingFavorite && styles.pressed,
                ]}
              >
                <ButtonLoadingContent
                  loaderColor={theme.colors.primary}
                  loading={isTogglingFavorite}
                >
                  <Star
                    size={16}
                    fill={
                      entry.isFavorite ? theme.colors.primary : 'transparent'
                    }
                    color={
                      entry.isFavorite
                        ? theme.colors.primary
                        : theme.colors.foreground
                    }
                  />
                </ButtonLoadingContent>
              </HapticPressable>

              <HapticPressable
                accessibilityRole="button"
                accessibilityLabel="Edit entry"
                onPress={() => openJournalEditor(entry._id)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.headerIconButton,
                  pressed && styles.pressed,
                ]}
              >
                <Edit2 size={16} color={theme.colors.foreground} />
              </HapticPressable>

              <HapticPressable
                accessibilityRole="button"
                accessibilityLabel="Delete entry"
                accessibilityState={{ busy: isDeleting, disabled: isDeleting }}
                onPress={handleDelete}
                disabled={isDeleting}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.headerIconButton,
                  pressed && !isDeleting && styles.pressed,
                ]}
              >
                <ButtonLoadingContent
                  loaderColor={theme.colors.destructive}
                  loading={isDeleting}
                >
                  <Trash2 size={16} color={theme.colors.destructive} />
                </ButtonLoadingContent>
              </HapticPressable>
            </View>
          </View>

          <View
            style={[
              styles.headerDivider,
              { borderTopColor: theme.colors.border },
            ]}
          />

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.body}>
              <View style={styles.metaRow}>
                {sessionAnalysis ? (
                  <Animated.View
                    accessibilityLabel={`Detected mood: ${sessionAnalysis.detectedMood}`}
                    style={{
                      opacity: moodReveal,
                      transform: [
                        {
                          scale: moodReveal.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.88, 1],
                          }),
                        },
                      ],
                    }}
                  >
                    <EmojiWithFallback
                      emoji={MOOD_EMOJI[sessionAnalysis.detectedMood]}
                      emojiStyle={styles.moodEmoji}
                      fallbackIcon={Heart}
                      fallbackIconColor={theme.colors.success}
                      fallbackIconSize={16}
                    />
                  </Animated.View>
                ) : (
                  <Heart
                    size={16}
                    color={
                      hasMoodTag
                        ? theme.colors.success
                        : theme.colors.mutedForeground
                    }
                  />
                )}
                <Text
                  style={[
                    styles.dateText,
                    { color: theme.colors.mutedForeground },
                  ]}
                >
                  {formatEntryDate(entry.createdAt)}
                </Text>
              </View>

              <Text style={[styles.title, { color: theme.colors.foreground }]}>
                {entry.title}
              </Text>

              <Text
                style={[styles.contentText, { color: theme.colors.foreground }]}
              >
                {entry.content}
              </Text>

              {visibleTags.length ? (
                <View
                  style={[
                    styles.sectionDivider,
                    { borderTopColor: theme.colors.border },
                  ]}
                >
                  <JournalTags tags={visibleTags} />
                </View>
              ) : null}

              {shouldShowSessionInsights ? (
                <View style={styles.sessionInsightsSection}>
                  {!isPremiumUser ? (
                    <PremiumUpgradeCard
                      accessibilityLabel="Unlock Session insights"
                      actionLabel="Unlock Session insights"
                      description="Keep the analysis and interactive Mind Map generated for each journal session."
                      onPress={() => {
                        trackPaywallEvent({
                          placementKey: 'entry_session_analysis_locked',
                          screenKey: 'journal-detail',
                          eventType: 'locked_feature_tap',
                          wasInterruptive: false,
                        }).catch(() => undefined);
                        openPaywallForPlacement({
                          placementKey: 'entry_session_analysis_locked',
                          returnStage: 'journal-detail',
                          screenKey: 'journal-detail',
                        });
                      }}
                      title="Session insights"
                    />
                  ) : isSessionAnalysisLoading && !sessionAnalysis ? (
                    <View
                      style={[
                        styles.sessionInsightsStatus,
                        {
                          backgroundColor: theme.colors.card,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <JournalLoader
                        color={theme.colors.primary}
                        size="small"
                      />
                      <View style={styles.sessionInsightsStatusCopy}>
                        <Text
                          style={[
                            styles.sessionInsightsStatusTitle,
                            { color: theme.colors.foreground },
                          ]}
                        >
                          Restoring this session
                        </Text>
                        <Text
                          style={[
                            styles.sessionInsightsStatusBody,
                            { color: theme.colors.mutedForeground },
                          ]}
                        >
                          Bringing back the analysis and Mind Map saved for this
                          entry.
                        </Text>
                      </View>
                    </View>
                  ) : sessionAnalysisError && !sessionAnalysis ? (
                    <View
                      style={[
                        styles.sessionInsightsError,
                        {
                          backgroundColor: theme.colors.card,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sessionInsightsStatusTitle,
                          { color: theme.colors.foreground },
                        ]}
                      >
                        Session insights unavailable
                      </Text>
                      <Text
                        style={[
                          styles.sessionInsightsStatusBody,
                          { color: theme.colors.mutedForeground },
                        ]}
                      >
                        {sessionAnalysisError}
                      </Text>
                      <HapticPressable
                        accessibilityLabel="Retry Session insights"
                        accessibilityRole="button"
                        onPress={() => {
                          setSessionAnalysisError(null);
                          setIsSessionAnalysisLoading(true);
                          getJournalSessionAnalysis(entry._id)
                            .then(analysis => {
                              setSessionAnalysis(analysis);
                              const latestEntry = useAppStore
                                .getState()
                                .recentJournalEntries.find(
                                  current => current._id === entry._id,
                                );
                              const analyzedEntry = latestEntry
                                ? {
                                    ...latestEntry,
                                    detectedMood: analysis.detectedMood,
                                    detectedTopics: analysis.detectedTopics,
                                  }
                                : null;

                              setHydratedEntry(current =>
                                analyzedEntry ||
                                (current
                                  ? {
                                      ...current,
                                      detectedMood: analysis.detectedMood,
                                      detectedTopics: analysis.detectedTopics,
                                    }
                                  : current),
                              );
                              if (analyzedEntry) {
                                updateRecentJournalEntry(analyzedEntry);
                              }
                            })
                            .catch(() =>
                              setSessionAnalysisError(
                                "We couldn't load the saved session insights right now. Your entry is still here.",
                              ),
                            )
                            .finally(() => setIsSessionAnalysisLoading(false));
                        }}
                        style={({ pressed }) => [
                          styles.sessionInsightsRetry,
                          { backgroundColor: theme.colors.primary },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.sessionInsightsRetryText,
                            { color: theme.colors.primaryForeground },
                          ]}
                        >
                          Try again
                        </Text>
                      </HapticPressable>
                    </View>
                  ) : sessionAnalysis ? (
                    <EntrySessionInsights analysis={sessionAnalysis} />
                  ) : null}
                </View>
              ) : null}

              {shouldShowQuickAnalysis ? (
                <View
                  style={[
                    styles.quickAnalysisCard,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={styles.quickAnalysisHeader}>
                    <View style={styles.quickAnalysisTitleRow}>
                      <Brain size={16} color={theme.colors.primary} />
                      <Text
                        style={[
                          styles.quickAnalysisLabel,
                          { color: theme.colors.foreground },
                        ]}
                      >
                        Quick Analysis
                      </Text>
                    </View>
                    {isPremiumUser ? (
                      <HapticPressable
                        accessibilityRole="button"
                        accessibilityLabel="Refresh quick analysis"
                        accessibilityState={{
                          busy: isQuickAnalysisLoading,
                          disabled: isQuickAnalysisLoading,
                        }}
                        onPress={() => {
                          handleLoadQuickAnalysis({ force: true }).catch(
                            () => undefined,
                          );
                        }}
                        disabled={isQuickAnalysisLoading}
                        style={({ pressed }) => [
                          styles.quickAnalysisRefresh,
                          pressed && !isQuickAnalysisLoading && styles.pressed,
                        ]}
                      >
                        <ButtonLoadingContent
                          loaderColor={theme.colors.primary}
                          loading={isQuickAnalysisLoading}
                        >
                          <RefreshCw size={14} color={theme.colors.primary} />
                        </ButtonLoadingContent>
                      </HapticPressable>
                    ) : null}
                  </View>

                  {!isPremiumUser ? (
                    <View style={styles.quickAnalysisStack}>
                      <Text
                        style={[
                          styles.quickAnalysisBody,
                          { color: theme.colors.mutedForeground },
                        ]}
                      >
                        Premium unlocks a short single-entry reflection so you
                        can read patterns without waiting for the full weekly
                        analysis.
                      </Text>
                      <HapticPressable
                        accessibilityRole="button"
                        accessibilityLabel="Unlock quick analysis"
                        onPress={() => {
                          handleLoadQuickAnalysis().catch(() => undefined);
                        }}
                        style={({ pressed }) => [
                          styles.quickAnalysisButton,
                          { backgroundColor: theme.colors.primary },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Lock
                          size={14}
                          color={theme.colors.primaryForeground}
                        />
                        <Text
                          style={[
                            styles.quickAnalysisButtonText,
                            { color: theme.colors.primaryForeground },
                          ]}
                        >
                          Unlock Quick Analysis
                        </Text>
                      </HapticPressable>
                    </View>
                  ) : isQuickAnalysisLoading && !quickAnalysis ? (
                    <View style={styles.quickAnalysisLoading}>
                      <JournalLoader
                        size="small"
                        color={theme.colors.primary}
                      />
                      <Text
                        style={[
                          styles.quickAnalysisBody,
                          { color: theme.colors.mutedForeground },
                        ]}
                      >
                        Building a short reflection from this entry.
                      </Text>
                    </View>
                  ) : quickAnalysisError && !quickAnalysis ? (
                    <View style={styles.quickAnalysisStack}>
                      <Text
                        style={[
                          styles.quickAnalysisBody,
                          { color: theme.colors.mutedForeground },
                        ]}
                      >
                        {quickAnalysisError}
                      </Text>
                      <HapticPressable
                        accessibilityRole="button"
                        accessibilityLabel="Retry quick analysis"
                        onPress={() => {
                          handleLoadQuickAnalysis({ force: true }).catch(
                            () => undefined,
                          );
                        }}
                        style={({ pressed }) => [
                          styles.quickAnalysisButton,
                          { backgroundColor: theme.colors.primary },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.quickAnalysisButtonText,
                            { color: theme.colors.primaryForeground },
                          ]}
                        >
                          Retry
                        </Text>
                      </HapticPressable>
                    </View>
                  ) : quickAnalysis ? (
                    <Animated.View
                      style={[
                        styles.quickAnalysisStack,
                        {
                          opacity: quickAnalysisReveal,
                          transform: [
                            { translateY: quickAnalysisRevealTranslate },
                            { scale: quickAnalysisRevealScale },
                          ],
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.quickAnalysisHero,
                          {
                            backgroundColor: hexToRgba(
                              getToneColor(quickAnalysis.scorecard.vibeTone),
                              0.08,
                            ),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.quickAnalysisHeroKicker,
                            { color: theme.colors.mutedForeground },
                          ]}
                        >
                          {quickAnalysis.scorecard.vibeLabel}
                        </Text>
                        <Text
                          style={[
                            styles.quickAnalysisHeadline,
                            { color: theme.colors.foreground },
                          ]}
                        >
                          {quickAnalysis.summary.headline}
                        </Text>
                        <Text
                          style={[
                            styles.quickAnalysisBody,
                            { color: theme.colors.mutedForeground },
                          ]}
                        >
                          {quickAnalysis.summary.narrative}
                        </Text>
                        <Text
                          style={[
                            styles.quickAnalysisHighlight,
                            { color: theme.colors.foreground },
                          ]}
                        >
                          {quickAnalysis.summary.highlight}
                        </Text>
                      </View>
                      {quickAnalysis.connection ? (
                        <View
                          style={[
                            styles.quickAnalysisConnection,
                            {
                              backgroundColor: hexToRgba(
                                theme.colors.primary,
                                0.08,
                              ),
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.quickAnalysisConnectionLabel,
                              { color: theme.colors.mutedForeground },
                            ]}
                          >
                            A thread from before
                          </Text>
                          <Text
                            style={[
                              styles.quickAnalysisConnectionText,
                              { color: theme.colors.foreground },
                            ]}
                          >
                            {quickAnalysis.connection}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.quickAnalysisScorecardRow}>
                        {quickAnalysis.scorecard.cards.map(card => {
                          const toneColor = getToneColor(card.tone);

                          return (
                            <View
                              key={card.key}
                              style={[
                                styles.quickAnalysisScorecard,
                                {
                                  backgroundColor: hexToRgba(toneColor, 0.09),
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.quickAnalysisScoreLabel,
                                  { color: theme.colors.mutedForeground },
                                ]}
                              >
                                {card.label}
                              </Text>
                              <Text
                                style={[
                                  styles.quickAnalysisScoreValue,
                                  { color: theme.colors.foreground },
                                ]}
                              >
                                {card.value}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                      <View style={styles.quickAnalysisTags}>
                        {quickAnalysis.patternTags.map(tag => {
                          const toneColor = getToneColor(tag.tone);

                          return (
                            <View
                              key={tag.label}
                              style={[
                                styles.quickAnalysisTag,
                                { backgroundColor: hexToRgba(toneColor, 0.12) },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.quickAnalysisTagText,
                                  { color: toneColor },
                                ]}
                              >
                                {tag.label}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                      <QuickAnalysisSignalCard
                        title="What Stood Out"
                        signal={quickAnalysis.signals.whatStoodOut}
                      />
                      <QuickAnalysisSignalCard
                        title="What Needs Care"
                        signal={quickAnalysis.signals.whatNeedsCare}
                      />
                      <QuickAnalysisSignalCard
                        title="What To Carry Forward"
                        signal={quickAnalysis.signals.whatToCarryForward}
                      />
                      <View
                        style={[
                          styles.quickAnalysisNote,
                          {
                            backgroundColor: hexToRgba(
                              theme.colors.primary,
                              0.08,
                            ),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.quickAnalysisNoteLabel,
                            { color: theme.colors.mutedForeground },
                          ]}
                        >
                          Gentle next step
                        </Text>
                        <Text
                          style={[
                            styles.quickAnalysisFocus,
                            { color: theme.colors.primary },
                          ]}
                        >
                          {quickAnalysis.nextStep.focus}
                        </Text>
                        <Text
                          style={[
                            styles.quickAnalysisNoteTitle,
                            { color: theme.colors.foreground },
                          ]}
                        >
                          {quickAnalysis.nextStep.title}
                        </Text>
                        <Text
                          style={[
                            styles.quickAnalysisNoteText,
                            { color: theme.colors.foreground },
                          ]}
                        >
                          {quickAnalysis.nextStep.description}
                        </Text>
                      </View>
                    </Animated.View>
                  ) : (
                    <View style={styles.quickAnalysisStack}>
                      <Text
                        style={[
                          styles.quickAnalysisBody,
                          { color: theme.colors.mutedForeground },
                        ]}
                      >
                        Need a faster read on this single entry? Generate a
                        short reflection while your weekly analysis is still
                        building.
                      </Text>
                      <HapticPressable
                        accessibilityRole="button"
                        accessibilityLabel="Generate quick analysis"
                        onPress={() => {
                          handleLoadQuickAnalysis().catch(() => undefined);
                        }}
                        style={({ pressed }) => [
                          styles.quickAnalysisButton,
                          { backgroundColor: theme.colors.primary },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Sparkles
                          size={14}
                          color={theme.colors.primaryForeground}
                        />
                        <Text
                          style={[
                            styles.quickAnalysisButtonText,
                            { color: theme.colors.primaryForeground },
                          ]}
                        >
                          Generate Quick Analysis
                        </Text>
                      </HapticPressable>
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
      {renderBottomNav}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  emptyShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    alignItems: 'center',
  },
  shell: {
    flex: 1,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 12,
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerDivider: {
    borderTopWidth: 1,
    marginBottom: 20,
  },
  headerIconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: BOTTOM_NAV_CONTENT_PADDING + 24,
  },
  body: {
    gap: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 13,
    lineHeight: 18,
  },
  moodEmoji: {
    fontSize: 17,
    lineHeight: 20,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 23,
  },
  sectionDivider: {
    borderTopWidth: 1,
    paddingTop: 18,
  },
  sessionInsightsSection: {
    marginTop: 4,
  },
  sessionInsightsStatus: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  sessionInsightsStatusCopy: {
    flex: 1,
  },
  sessionInsightsStatusTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  sessionInsightsStatusBody: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  sessionInsightsError: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  sessionInsightsRetry: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 40,
    paddingHorizontal: 16,
  },
  sessionInsightsRetryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  quickAnalysisCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  quickAnalysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickAnalysisTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickAnalysisLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  quickAnalysisRefresh: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAnalysisStack: {
    gap: 10,
  },
  quickAnalysisHero: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  quickAnalysisHeroKicker: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  quickAnalysisHeadline: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  quickAnalysisBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  quickAnalysisHighlight: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  quickAnalysisConnection: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 3,
  },
  quickAnalysisConnectionLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  quickAnalysisConnectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  quickAnalysisButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickAnalysisButtonText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  quickAnalysisLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickAnalysisScorecardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAnalysisScorecard: {
    minWidth: '47%',
    flexGrow: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 4,
  },
  quickAnalysisScoreLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  quickAnalysisScoreValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  quickAnalysisTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAnalysisTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickAnalysisTagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  quickAnalysisSignalCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 7,
  },
  quickAnalysisSignalLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  quickAnalysisSignalTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  quickAnalysisSignalBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  quickAnalysisEvidenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAnalysisEvidenceChip: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  quickAnalysisEvidenceText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  quickAnalysisNote: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  quickAnalysisNoteLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  quickAnalysisFocus: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  quickAnalysisNoteTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  quickAnalysisNoteText: {
    fontSize: 13,
    lineHeight: 18,
  },
  tagSection: {
    gap: 12,
  },
  tagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  backButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
});
