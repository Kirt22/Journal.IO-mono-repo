import HapticPressable from '../components/HapticPressable';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  AppState,
  Easing,
  Image,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  Text,
  TextInput,
} from '../infrastructure/reactNative';
import {
  Hash,
  Heart,
  Send,
  X,
  Frown,
  Meh,
  Smile,
  SmilePlus,
} from 'lucide-react-native';
import TabScreenLayout from '../components/TabScreenLayout';
import Orb, { type OrbHandle } from '../components/orb';
import AnimatedTagChip from '../components/AnimatedTagChip';
import ButtonLoadingContent from '../components/ButtonLoadingContent';
import EmojiWithFallback from '../components/EmojiWithFallback';
import HomeStreakPill from '../components/HomeStreakPill';
import HomeGreeting from '../components/HomeGreeting';
import GoalsHomeCard from '../components/GoalsHomeCard';
import DailyThoughtCard from '../components/DailyThoughtCard';
import { triggerHaptic } from '../services/hapticsService';
import { createJournalEntry } from '../services/journalService';
import { getInsightsAiAnalysis } from '../services/insightsService';
import {
  getTodayMoodCheckIn,
  logMoodCheckIn,
  type MoodValue,
} from '../services/moodService';
import { getHomeOfferConfig } from '../services/adminService';
import {
  getPaywallConfig,
  trackPaywallEvent,
} from '../services/paywallService';
import {
  cancelWeeklyInsightNotifications,
  syncWeeklyInsightNotifications,
} from '../services/reminderNotificationsService';
import {
  MOOD_SELECTED_TINT_ALPHA,
  MOOD_TINT_ALPHA,
  getMoodColor,
} from '../constants/moodPalette';
import { getOrbAccents } from '../constants/orbPalette';
import { selectHomeNudge } from '../utils/homeNudge';
import { createHeroFadeStyle, getHeroFadeDistance } from '../utils/heroScroll';
import { selectTodoGoals } from '../store/slices/goalsSlice';
import {
  getLastKnownStreak,
  getReflectionSeenDateKey,
  saveLastKnownStreak,
  saveReflectionSeenDateKey,
} from '../utils/appStorage';
import { getLocalDateKey } from '../utils/goalPeriod';
import { useAppStore } from '../store/appStore';
import { useTheme } from '../theme/provider';
import type { ThemePreference } from '../theme/theme';
import { ApiError } from '../utils/apiClient';
import { navigateMainApp, navigateRoot } from '../navigation/navigation';
import { useConnectivity } from '../hooks/useConnectivity';
import {
  ensureMoodWidgetSession,
  reconcileStreakWidget,
  syncMoodWidgetAfterMoodSave,
  syncMoodWidgetTodayStatus,
} from '../services/widgetService';
import { getCurrentStreakSummary } from '../services/streaksService';

type HomeScreenProps = {
  userName?: string;
  userEmail?: string | null;
  fallbackEmail?: string | null;
  userGoals?: string[];
  onboardingGoals?: string[];
  userAvatarColor?: string | null;
  userProfilePic?: string | null;
  isPremium?: boolean;
  onOpenNewEntry: (initialPrompt?: string) => void;
  onOpenStreaks: () => void;
  onOpenSearch?: () => void;
  onOpenReminders?: () => void;
  onOpenSettings?: () => void;
  onOpenGoals?: () => void;
  onToggleTheme: (nextMode: ThemePreference | null) => void;
};

type MoodType = MoodValue;

const quickTags = ['thought', 'idea', 'reminder', 'gratitude', 'dream'];
const MOOD_CONFIRMATION_DELAY_MS = 120;
const HOME_ENTRANCE_STAGGER_MS = 52;
const HOME_ENTRANCE_DURATION_MS = 360;
const QUICK_NOTE_ICON = require('../assets/png/home/quill-pen.png');
const SEARCH_ICON = require('../assets/png/home/icons8-search-64.png');
const SETTINGS_ICON = require('../assets/png/home/icons8-settings-100.png');
const QUICK_NOTE_CROSSFADE_MS = 180;

// Mirrors RemindersScreen's config so an expanding card and the cards below it
// move together instead of the body snapping between two heights.
const QUICK_NOTE_LAYOUT_ANIMATION = {
  duration: 230,
  create: {
    type: LayoutAnimation.Types.easeOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};
const moods: {
  value: MoodType;
  icon: typeof Smile;
  label: string;
  emoji: string;
}[] = [
  {
    value: 'amazing',
    icon: Heart,
    label: 'Amazing',
    emoji: '🤩',
  },
  {
    value: 'good',
    icon: SmilePlus,
    label: 'Good',
    emoji: '😊',
  },
  {
    value: 'okay',
    icon: Smile,
    label: 'Okay',
    emoji: '😌',
  },
  {
    value: 'bad',
    icon: Meh,
    label: 'Bad',
    emoji: '😔',
  },
  {
    value: 'terrible',
    icon: Frown,
    label: 'Terrible',
    emoji: '😢',
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 17) {
    return 'Good afternoon';
  }

  return 'Good evening';
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

function delay(ms: number) {
  return new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });
}

function buildQuickThoughtTitle() {
  return 'Quick Thought';
}

function HeaderIconButton({
  source,
  onPress,
  label,
  borderColor,
  backgroundColor,
}: {
  source: ImageSourcePropType;
  onPress: (event: GestureResponderEvent) => void;
  label: string;
  borderColor: string;
  backgroundColor: string;
}) {
  return (
    <HapticPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerIconButton,
        {
          borderColor,
          backgroundColor,
        },
        pressed && styles.pressed,
      ]}
    >
      {/* Full-colour icons8 artwork, matching the Settings row set — it carries
          its own palette, so no theme tint is applied. */}
      <Image source={source} style={styles.headerIcon} />
    </HapticPressable>
  );
}

function RevealBlock({
  children,
  style,
  index,
  onLayout,
  shouldAnimate,
  isReady = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  index: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  shouldAnimate: boolean;
  /**
   * Holds the block off-stage until the screen is ready to reveal it — used
   * while the paywall's orb is still travelling into the hero, so the cascade
   * runs once the orb has landed rather than under it.
   */
  isReady?: boolean;
}) {
  const progress = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;

  useEffect(() => {
    if (!shouldAnimate || typeof jest !== 'undefined') {
      progress.setValue(1);
      return;
    }

    progress.setValue(0);

    if (!isReady) {
      return;
    }

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: HOME_ENTRANCE_DURATION_MS,
      delay: index * HOME_ENTRANCE_STAGGER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [index, isReady, progress, shouldAnimate]);

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [28, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function ShimmerBlock({
  theme,
  width = '100%',
  height = 12,
  borderRadius = 999,
  style,
}: {
  theme: ReturnType<typeof useTheme>;
  width?: number | `${number}%` | '100%';
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const shimmerTranslate = useRef(new Animated.Value(-160)).current;
  const shouldAnimateShimmer = typeof jest === 'undefined';

  useEffect(() => {
    if (!shouldAnimateShimmer) {
      shimmerTranslate.setValue(0);
      return;
    }

    shimmerTranslate.setValue(-160);

    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerTranslate, {
        toValue: 160,
        duration: 1180,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );

    shimmerLoop.start();

    return () => {
      shimmerLoop.stop();
      shimmerTranslate.stopAnimation();
    };
  }, [shimmerTranslate, shouldAnimateShimmer]);

  return (
    <View
      style={[
        styles.shimmerBlock,
        {
          width,
          height,
          borderRadius,
          backgroundColor: hexToRgba(theme.colors.primary, 0.08),
        },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmerHighlight,
          {
            backgroundColor: hexToRgba(theme.colors.primary, 0.16),
            transform: [{ translateX: shimmerTranslate }],
          },
        ]}
      />
    </View>
  );
}

export default function HomeScreen({
  userName,
  onOpenNewEntry,
  onOpenStreaks,
  onOpenSearch,
  onOpenSettings,
  onOpenGoals,
}: HomeScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { reconnectVersion, status: connectivityStatus } = useConnectivity();
  const isOnline = connectivityStatus === 'online';
  const stage = useAppStore(state => state.stage);
  const hasSeenHomeEntrance = useAppStore(state => state.hasSeenHomeEntrance);
  const shouldAnimateEntrance = useRef(!hasSeenHomeEntrance).current;
  const markHomeEntranceSeen = useAppStore(state => state.markHomeEntranceSeen);
  const orbHandoff = useAppStore(state => state.orbHandoff);
  const reportOrbHandoffTarget = useAppStore(
    state => state.reportOrbHandoffTarget,
  );
  // Only a Home that mounted *into* a hand-off owes the overlay a target. Once
  // the overlay clears the store entry the orb is ours again, and the rest of
  // the screen is free to cascade in behind it.
  const arrivedFromOrbHandoff = useRef(Boolean(orbHandoff)).current;
  const isOrbHandoffPending = arrivedFromOrbHandoff && Boolean(orbHandoff);
  const openPaywallForPlacement = useAppStore(
    state => state.openPaywallForPlacement,
  );
  const openHostedPaywall = useAppStore(state => state.openHostedPaywall);
  const openNewEntryChoice = useAppStore(state => state.openNewEntryChoice);
  const openAskJade = useAppStore(state => state.openAskJade);
  const startNewJadeChat = useAppStore(state => state.startNewJadeChat);
  const isPremiumUser = useAppStore(state =>
    Boolean(state.session?.user.isPremium),
  );
  const sessionUserId = useAppStore(
    state => state.session?.user.userId ?? null,
  );
  const shouldAnimateMood = typeof jest === 'undefined';
  const addRecentJournalEntry = useAppStore(
    state => state.addRecentJournalEntry,
  );
  const recentJournalEntries = useAppStore(state => state.recentJournalEntries);
  const goals = useAppStore(state => state.goals);
  const pendingWidgetAction = useAppStore(state => state.pendingWidgetAction);
  const consumePendingWidgetAction = useAppStore(
    state => state.consumePendingWidgetAction,
  );
  const scrollViewRef = useRef<ScrollView>(null);
  const moodSectionYRef = useRef(0);
  const reflectionSectionYRef = useRef(0);
  const quickThoughtSectionYRef = useRef(0);
  const noteInputRef = useRef<TextInput>(null);
  const moodSelectionProgress = useRef(new Animated.Value(0)).current;
  const moodRevealProgress = useRef(new Animated.Value(0)).current;
  const moodEmojiSpinProgress = useRef(new Animated.Value(0)).current;
  const moodStageProgress = useRef(new Animated.Value(0)).current;
  const quickNoteReveal = useRef(new Animated.Value(0)).current;
  const quickNoteClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const saveHighlight = useRef(new Animated.Value(0)).current;
  const heroScrollY = useRef(new Animated.Value(0)).current;
  const heroOrbRef = useRef<View>(null);
  // Held at 0 while the paywall's orb is still travelling here — the overlay is
  // drawing an identical orb on top, so this flips rather than fades.
  const heroOrbOpacity = useRef(new Animated.Value(orbHandoff ? 0 : 1)).current;
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [widgetSuggestedMood, setWidgetSuggestedMood] =
    useState<MoodType | null>(null);
  const [savedMood, setSavedMood] = useState<MoodType | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showMoodResult, setShowMoodResult] = useState(false);
  const [isLoggingMood, setIsLoggingMood] = useState(false);
  const [isLoadingMoodStatus, setIsLoadingMoodStatus] = useState(true);
  const [note, setNote] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const [noteInputHeight, setNoteInputHeight] = useState(92);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const [isSavingQuickThought, setIsSavingQuickThought] = useState(false);
  const [quickThoughtError, setQuickThoughtError] = useState<string | null>(
    null,
  );
  const [moodRefreshVersion, setMoodRefreshVersion] = useState(0);
  const [isHomeSummerOfferVisible, setIsHomeSummerOfferVisible] =
    useState(false);
  const [hadStreakBefore, setHadStreakBefore] = useState(false);
  const [hasSeenTodaysReflection, setHasSeenTodaysReflection] = useState(true);
  // Defaults true so the at-risk nudge never flashes before the streak summary
  // lands and tells us whether today already has an entry.
  const [hasWrittenToday, setHasWrittenToday] = useState(true);
  const [isHeroAtTop, setIsHeroAtTop] = useState(true);
  const isHeroAtTopRef = useRef(true);

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 20;
  const layoutMaxWidth = isWide ? 460 : 420;
  // The component's own default is width * 0.72; Home runs slightly larger so
  // the canvas frame lands in the 290-310pt band and the ring reads at ~250-265pt.
  const heroOrbSize = Math.min(Math.max(Math.round(width * 0.78), 260), 310);
  const orbAccents = useMemo(() => getOrbAccents(theme.mode), [theme.mode]);
  const handleHeroScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: heroScrollY } } }], {
        useNativeDriver: true,
      }),
    [heroScrollY],
  );
  const shouldAnimateQuickNote =
    typeof jest === 'undefined' && !isReduceMotionEnabled;
  const canSaveQuickThought =
    isOnline && note.trim().length > 0 && !isSavingQuickThought;

  const clearQuickNoteDraft = () => {
    setNote('');
    setSelectedTags([]);
    setQuickThoughtError(null);
  };

  const toggleNoteExpanded = (
    expanded: boolean,
    clearAfterCollapse = false,
  ) => {
    if (quickNoteClearTimerRef.current) {
      clearTimeout(quickNoteClearTimerRef.current);
      quickNoteClearTimerRef.current = null;
    }

    quickNoteReveal.stopAnimation();

    if (shouldAnimateQuickNote) {
      LayoutAnimation.configureNext(QUICK_NOTE_LAYOUT_ANIMATION);
    }

    setIsNoteExpanded(expanded);

    if (!expanded && clearAfterCollapse) {
      if (!shouldAnimateQuickNote) {
        clearQuickNoteDraft();
        return;
      }

      quickNoteClearTimerRef.current = setTimeout(() => {
        clearQuickNoteDraft();
        quickNoteClearTimerRef.current = null;
      }, QUICK_NOTE_LAYOUT_ANIMATION.duration + 30);
    }
  };

  useEffect(
    () => () => {
      if (quickNoteClearTimerRef.current) {
        clearTimeout(quickNoteClearTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (shouldAnimateEntrance) {
      markHomeEntranceSeen();
    }
  }, [markHomeEntranceSeen, shouldAnimateEntrance]);

  // Tell the travelling orb where to land. `onLayout` covers the normal case;
  // this second pass covers a first layout that measures before the view is
  // attached to the window and reports zeroes.
  const publishOrbHandoffTarget = useCallback(() => {
    if (!isOrbHandoffPending) {
      return;
    }

    heroOrbRef.current?.measureInWindow((x, y, frameWidth) => {
      if (!frameWidth) {
        return;
      }
      reportOrbHandoffTarget({ x, y, size: frameWidth });
    });
  }, [isOrbHandoffPending, reportOrbHandoffTarget]);

  useEffect(() => {
    if (!isOrbHandoffPending) {
      return;
    }

    const frame = requestAnimationFrame(publishOrbHandoffTarget);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [isOrbHandoffPending, publishOrbHandoffTarget]);

  // The overlay clears the hand-off the instant its orb lands on ours.
  useEffect(() => {
    if (!isOrbHandoffPending) {
      heroOrbOpacity.setValue(1);
    }
  }, [heroOrbOpacity, isOrbHandoffPending]);

  // The greeting's wave now lives in HomeGreeting; the one welcome cue on first
  // Home entrance stays here.
  useEffect(() => {
    if (!shouldAnimateEntrance || typeof jest !== 'undefined') {
      return;
    }

    triggerHaptic('welcome').catch(() => undefined);
  }, [shouldAnimateEntrance]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        // Native-driver animations pause with the app. If Quick Note was
        // backgrounded mid-crossfade, settle it to the state React currently
        // owns instead of resuming with the wrong layer visible.
        quickNoteReveal.stopAnimation();
        quickNoteReveal.setValue(isNoteExpanded ? 1 : 0);
        setMoodRefreshVersion(previous => previous + 1);
      }
    });

    return () => subscription.remove();
  }, [isNoteExpanded, quickNoteReveal]);

  useEffect(() => {
    if (!pendingWidgetAction?.isReadyForHome) {
      return;
    }

    const { action, requestId } = pendingWidgetAction;

    if (action.type === 'home') {
      consumePendingWidgetAction(requestId);
      return;
    }

    if (action.type === 'streaks') {
      consumePendingWidgetAction(requestId);
      onOpenStreaks();
      return;
    }

    if (action.type === 'widget-settings') {
      consumePendingWidgetAction(requestId);
      navigateRoot('ProfileModal', { screen: 'Widgets' });
      return;
    }

    if (action.type === 'quick-thought') {
      consumePendingWidgetAction(requestId);
      if (!isPremiumUser) {
        openPaywallForPlacement({
          placementKey: 'settings_widgets_locked',
          returnStage: 'main-app',
          screenKey: 'widgets',
        });
        return;
      }
      navigateMainApp('QuickThought');
      return;
    }

    if (!isPremiumUser) {
      consumePendingWidgetAction(requestId);
      openPaywallForPlacement({
        placementKey: 'settings_widgets_locked',
        returnStage: 'main-app',
        screenKey: 'widgets',
      });
      return;
    }

    setWidgetSuggestedMood(action.type === 'mood' ? action.mood : null);

    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        animated: true,
        y: Math.max(0, moodSectionYRef.current - 16),
      });

      consumePendingWidgetAction(requestId);
    }, 120);

    return () => clearTimeout(timer);
  }, [
    consumePendingWidgetAction,
    isPremiumUser,
    onOpenStreaks,
    openPaywallForPlacement,
    pendingWidgetAction,
  ]);

  const firstName = useMemo(() => {
    const trimmedName = userName?.trim();

    if (!trimmedName) {
      return 'there';
    }

    return trimmedName.split(/\s+/)[0];
  }, [userName]);

  const greeting = getGreeting();
  const displayedMood = selectedMood || widgetSuggestedMood || savedMood;
  const isAiInsightEnabled = isPremiumUser;
  const todayDate = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: '2-digit',
      }).format(new Date()),
    [],
  );

  // Only one nudge shows at a time; `selectHomeNudge` owns the priority ladder.
  const pendingGoalCount = useMemo(
    () => selectTodoGoals(goals).length,
    [goals],
  );
  const hasCheckedInToday = Boolean(savedMood);
  const homeNudge = useMemo(
    () =>
      selectHomeNudge({
        currentStreak,
        hasCheckedInToday,
        hasWrittenToday,
        hadStreakBefore,
        pendingGoalCount,
        hasSeenTodaysReflection,
        isPremium: isPremiumUser,
        isOfferAvailable: isHomeSummerOfferVisible,
        isHeroVisible: isHeroAtTop,
      }),
    [
      currentStreak,
      hadStreakBefore,
      hasCheckedInToday,
      hasSeenTodaysReflection,
      hasWrittenToday,
      isHeroAtTop,
      isHomeSummerOfferVisible,
      isPremiumUser,
      pendingGoalCount,
    ],
  );

  // The offer swap gets one celebration per visit — replaying it on every
  // return to the top would turn a moment into wallpaper.
  const hasCelebratedOfferRef = useRef(false);
  const [isCelebratingOffer, setIsCelebratingOffer] = useState(false);

  useEffect(() => {
    if (homeNudge.kind !== 'offer' || hasCelebratedOfferRef.current) {
      return undefined;
    }

    hasCelebratedOfferRef.current = true;
    setIsCelebratingOffer(true);
    triggerHaptic('personalizationComplete').catch(() => undefined);

    const timer = setTimeout(() => setIsCelebratingOffer(false), 1200);
    return () => clearTimeout(timer);
  }, [homeNudge.kind]);
  const shouldAnimateGreeting =
    typeof jest === 'undefined' && !isReduceMotionEnabled;

  // Same curve the orb uses, so the greeting dissolves with it as one hero
  // rather than lingering after the orb has gone.
  const heroFadeStyle = useMemo(
    () =>
      createHeroFadeStyle(heroScrollY, getHeroFadeDistance(heroOrbSize), {
        withScale: false,
      }),
    [heroOrbSize, heroScrollY],
  );

  // The mood API only reports the streak as it stands, so a reset is inferred by
  // comparing against the last value we stored. A fresh install has nothing to
  // compare with and simply stays quiet.
  useEffect(() => {
    if (isLoadingMoodStatus) {
      return;
    }

    let isActive = true;

    getLastKnownStreak()
      .then(lastKnown => {
        if (!isActive) {
          return;
        }

        setHadStreakBefore(
          lastKnown !== null && lastKnown > 0 && currentStreak === 0,
        );

        return saveLastKnownStreak(currentStreak);
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [currentStreak, isLoadingMoodStatus]);

  useEffect(() => {
    let isActive = true;

    getReflectionSeenDateKey()
      .then(seenDateKey => {
        if (isActive) {
          setHasSeenTodaysReflection(seenDateKey === getLocalDateKey());
        }
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [moodRefreshVersion]);

  // The streak nudge is about writing, so it reads the journal streak summary
  // rather than the mood check-in endpoint the pill uses.
  useEffect(() => {
    if (!isOnline) {
      return undefined;
    }

    let isActive = true;

    getCurrentStreakSummary()
      .then(summary => {
        if (isActive) {
          setHasWrittenToday(Boolean(summary.hasEntryToday));
        }
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [isOnline, moodRefreshVersion, reconnectVersion]);

  // The offer nudge waits for the hero to be back on screen so its celebration
  // is actually seen. Hysteresis keeps the flag from chattering at the edge —
  // same approach the orb uses for its own visibility gate.
  useEffect(() => {
    const listenerId = heroScrollY.addListener(({ value }) => {
      const nextAtTop = isHeroAtTopRef.current ? value < 48 : value < 8;

      if (nextAtTop === isHeroAtTopRef.current) {
        return;
      }

      isHeroAtTopRef.current = nextAtTop;
      setIsHeroAtTop(nextAtTop);
    });

    return () => {
      heroScrollY.removeListener(listenerId);
    };
  }, [heroScrollY]);

  // The orb is only a tap target while it is actually on screen; once it has
  // faded out on scroll it must let touches through to the content behind it.
  const isOrbInteractive = isHeroAtTop && !isOrbHandoffPending;

  // Touching the orb surges the shader's own `intensity` uniform, so the ring
  // liquifies and settles in its own material rather than taking an overlay.
  // It fires on press-in, not press: a reaction started on release would be cut
  // off almost immediately by the Ask Jade transition. Reduce Motion and the
  // shader-compile fallback are handled inside the orb.
  const orbRef = useRef<OrbHandle>(null);

  const handleOrbPressIn = useCallback(() => {
    orbRef.current?.pulse();
  }, []);

  const handleOrbPress = useCallback(() => {
    triggerHaptic('primaryAction').catch(() => undefined);
    // Free users still reach the screen — it renders the locked card, which
    // gives the paywall real context instead of a bare punch-out.
    startNewJadeChat();
    openAskJade();
  }, [openAskJade, startNewJadeChat]);

  const handleReflectionSeen = useCallback(() => {
    setHasSeenTodaysReflection(true);
    saveReflectionSeenDateKey(getLocalDateKey()).catch(() => undefined);
  }, []);

  const scrollToSection = useCallback((sectionY: number) => {
    scrollViewRef.current?.scrollTo({
      animated: true,
      y: Math.max(0, sectionY - 16),
    });
  }, []);

  const handleNudgePress = useCallback(() => {
    triggerHaptic('secondaryAction').catch(() => undefined);

    switch (homeNudge.target) {
      case 'goals':
        onOpenGoals?.();
        return;
      case 'reflection':
        scrollToSection(reflectionSectionYRef.current);
        return;
      case 'new-entry':
        // The streak is carried by writing, so this opens the entry chooser
        // rather than pointing at the mood row.
        openNewEntryChoice();
        return;
      case 'offer':
        trackPaywallEvent({
          placementKey: 'post_auth_exit_offer',
          screenKey: 'home',
          eventType: 'upgrade_tap',
          wasInterruptive: false,
          metadata: {
            source: 'home_offer_nudge',
            offerLabel: 'special_yearly_offer',
          },
        }).catch(() => undefined);
        openHostedPaywall('exit');
        return;
      case 'quick-thought':
        scrollToSection(quickThoughtSectionYRef.current);
        setIsNoteExpanded(true);
        return;
      case 'mood':
      default:
        scrollToSection(moodSectionYRef.current);
    }
  }, [
    homeNudge.target,
    onOpenGoals,
    openHostedPaywall,
    openNewEntryChoice,
    scrollToSection,
  ]);

  // The insight card was removed from home, but weekly-insight notification
  // scheduling still keys off the latest analysis, so keep that sync running.
  useEffect(() => {
    if (!isAiInsightEnabled) {
      cancelWeeklyInsightNotifications().catch(() => undefined);
      return;
    }

    if (!isOnline) {
      return;
    }

    let isActive = true;

    const syncWeeklyInsight = async () => {
      try {
        const analysis = await getInsightsAiAnalysis();

        if (!isActive) {
          return;
        }

        await syncWeeklyInsightNotifications(
          analysis.status === 'collecting' ? analysis : null,
        );
      } catch {
        cancelWeeklyInsightNotifications().catch(() => undefined);
      }
    };

    syncWeeklyInsight().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [isAiInsightEnabled, isOnline, reconnectVersion]);

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    let isActive = true;

    const loadHomeOfferConfig = async () => {
      try {
        const config = await getHomeOfferConfig();

        if (isActive) {
          setIsHomeSummerOfferVisible(config.homeSummerOfferVisible);
        }
      } catch {
        if (isActive) {
          setIsHomeSummerOfferVisible(false);
        }
      }
    };

    loadHomeOfferConfig().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [isOnline, reconnectVersion]);

  useEffect(() => {
    if (isNoteExpanded) {
      noteInputRef.current?.focus();
    }
  }, [isNoteExpanded]);

  useEffect(() => {
    if (!isNoteExpanded) {
      setNoteInputHeight(92);
    }
  }, [isNoteExpanded]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (isActive) {
          setIsReduceMotionEnabled(enabled);
        }
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      enabled => {
        setIsReduceMotionEnabled(enabled);
      },
    );

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  // Cross-fade the collapsed and expanded quick-note bodies so the swap reads as
  // one motion alongside the layout animation, rather than a hard cut.
  useEffect(() => {
    const target = isNoteExpanded ? 1 : 0;

    if (!shouldAnimateQuickNote) {
      quickNoteReveal.setValue(target);
      return;
    }

    quickNoteReveal.stopAnimation();
    const animation = Animated.timing(quickNoteReveal, {
      toValue: target,
      duration: QUICK_NOTE_CROSSFADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [isNoteExpanded, quickNoteReveal, shouldAnimateQuickNote]);

  // The save button only becomes a real primary action once there is something
  // to save — reveal it with the sanctioned conditional-action spring.
  useEffect(() => {
    const target = canSaveQuickThought ? 1 : 0;

    if (!shouldAnimateQuickNote) {
      saveHighlight.setValue(target);
      return;
    }

    Animated.spring(saveHighlight, {
      toValue: target,
      damping: 16,
      stiffness: 220,
      mass: 0.85,
      useNativeDriver: false,
    }).start();
  }, [canSaveQuickThought, saveHighlight, shouldAnimateQuickNote]);

  useEffect(() => {
    if (!isOnline) {
      setIsLoadingMoodStatus(false);
      return;
    }

    let isActive = true;

    const loadMoodStatus = async () => {
      try {
        const moodStatus = await getTodayMoodCheckIn();

        if (!isActive) {
          return;
        }

        if (sessionUserId) {
          ensureMoodWidgetSession({
            userId: sessionUserId,
            hasPremiumAccess: isPremiumUser,
            todayStatus: moodStatus,
          })
            .then(() => syncMoodWidgetTodayStatus(moodStatus, sessionUserId))
            .catch(() => undefined);
        }

        setCurrentStreak(moodStatus.currentStreak);

        const moodCheckIn = moodStatus.moodCheckIn;

        if (moodCheckIn) {
          setWidgetSuggestedMood(null);
          setSavedMood(moodCheckIn.mood);
          setShowMoodResult(true);
          setSelectedMood(null);
          moodSelectionProgress.setValue(0);
          moodRevealProgress.setValue(1);
          moodEmojiSpinProgress.setValue(1);
          moodStageProgress.setValue(1);
        } else {
          setSavedMood(null);
          setShowMoodResult(false);
          moodSelectionProgress.setValue(0);
          moodRevealProgress.setValue(0);
          moodEmojiSpinProgress.setValue(0);
          moodStageProgress.setValue(0);
        }
      } catch {
        // Leave the card interactive if the mood status cannot be loaded.
      } finally {
        if (isActive) {
          setIsLoadingMoodStatus(false);
        }
      }
    };

    loadMoodStatus().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [
    moodEmojiSpinProgress,
    moodRevealProgress,
    moodSelectionProgress,
    moodStageProgress,
    isOnline,
    isPremiumUser,
    moodRefreshVersion,
    reconnectVersion,
    sessionUserId,
  ]);

  const resetMoodAnimations = () => {
    moodSelectionProgress.stopAnimation();
    moodRevealProgress.stopAnimation();
    moodEmojiSpinProgress.stopAnimation();
    moodStageProgress.stopAnimation();
    moodSelectionProgress.setValue(0);
    moodRevealProgress.setValue(0);
    moodEmojiSpinProgress.setValue(0);
    moodStageProgress.setValue(0);
  };

  const handleSelectMood = async (mood: MoodType) => {
    if (!isOnline || isLoggingMood || isLoadingMoodStatus || showMoodResult) {
      return;
    }

    resetMoodAnimations();
    setWidgetSuggestedMood(null);
    setShowMoodResult(false);
    setIsLoggingMood(true);
    setSelectedMood(mood);
    if (shouldAnimateMood) {
      Animated.spring(moodSelectionProgress, {
        toValue: 1,
        friction: 7,
        tension: 130,
        useNativeDriver: false,
      }).start();
    } else {
      moodSelectionProgress.setValue(1);
    }

    try {
      const moodCheckIn = await logMoodCheckIn(mood);

      if (sessionUserId) {
        syncMoodWidgetAfterMoodSave(moodCheckIn, sessionUserId).catch(
          () => undefined,
        );
      }

      if (shouldAnimateMood) {
        await delay(MOOD_CONFIRMATION_DELAY_MS);
        setSavedMood(moodCheckIn.mood);
        setShowMoodResult(true);
        setSelectedMood(null);

        moodSelectionProgress.setValue(0);
        moodRevealProgress.setValue(0);
        moodEmojiSpinProgress.setValue(0);
        moodStageProgress.setValue(0);

        Animated.parallel([
          Animated.timing(moodRevealProgress, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.timing(moodEmojiSpinProgress, {
            toValue: 1,
            duration: 620,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.timing(moodStageProgress, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
        ]).start();
      } else {
        setSavedMood(moodCheckIn.mood);
        setShowMoodResult(true);
        setSelectedMood(null);
        moodSelectionProgress.setValue(0);
        moodRevealProgress.setValue(1);
        moodEmojiSpinProgress.setValue(1);
        moodStageProgress.setValue(1);
      }
    } catch (error) {
      if (!(error instanceof ApiError && error.isNetworkError)) {
        Alert.alert(
          'Mood check-in',
          error instanceof Error
            ? error.message
            : 'Unable to save your mood check-in right now.',
        );
      }
      resetMoodAnimations();
      setSelectedMood(null);
      setShowMoodResult(false);
    } finally {
      setIsLoggingMood(false);
    }
  };

  const handleSaveNote = async () => {
    const trimmedNote = note.trim();

    if (!isOnline || !trimmedNote || isSavingQuickThought) {
      return;
    }

    setQuickThoughtError(null);
    setIsSavingQuickThought(true);

    const hadEntryTodayBeforeSave = recentJournalEntries.some(entry => {
      return (
        entry.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)
      );
    });

    const optimisticEntry = {
      _id: `quick-thought-${Date.now()}`,
      title: buildQuickThoughtTitle(),
      content: trimmedNote,
      type: 'open_ended' as const,
      entryKind: 'quick_thought' as const,
      images: [],
      tags: [...selectedTags],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const savedEntry = await createJournalEntry({
        title: optimisticEntry.title,
        content: optimisticEntry.content,
        type: optimisticEntry.type,
        entryKind: optimisticEntry.entryKind,
        tags: optimisticEntry.tags,
      });

      addRecentJournalEntry(savedEntry);

      if (!hadEntryTodayBeforeSave) {
        setCurrentStreak(previous => previous + 1);
      }

      reconcileStreakWidget().catch(() => undefined);

      toggleNoteExpanded(false, true);
    } catch {
      setQuickThoughtError(
        "We couldn't save this thought right now. Your draft is still here.",
      );
    } finally {
      setIsSavingQuickThought(false);
    }
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags(previous =>
      previous.includes(tag)
        ? previous.filter(currentTag => currentTag !== tag)
        : [...previous, tag],
    );
  };

  const savedMoodData = savedMood
    ? moods.find(mood => mood.value === savedMood)
    : null;
  const SavedMoodIcon = savedMoodData?.icon || Smile;

  const currentMoodTone = displayedMood
    ? (() => {
        const color = getMoodColor(displayedMood, theme.mode);

        return {
          color,
          backgroundColor: hexToRgba(color, MOOD_SELECTED_TINT_ALPHA),
        };
      })()
    : null;

  const noteBorderColor = isNoteExpanded
    ? theme.colors.primary
    : theme.colors.border;
  const moodCardAnimatedStyle = {
    transform: [
      {
        scale: moodSelectionProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.02],
        }),
      },
      {
        translateY: moodSelectionProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -3],
        }),
      },
    ],
  } as const;
  const moodQuestionOpacity = moodRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const moodQuestionTranslateY = moodRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });
  const moodSavedOpacity = moodRevealProgress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.5, 1],
  });
  const moodSavedTranslateY = moodRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });
  const moodEmojiRotate = moodEmojiSpinProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const moodStageHeight = moodStageProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [160, 56],
  });
  const quickNoteCollapsedOpacity = quickNoteReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const quickNoteExpandedOpacity = quickNoteReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const saveButtonBackgroundColor = saveHighlight.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.muted, theme.colors.primary],
  });
  const saveButtonOpacity = saveHighlight.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });
  const saveButtonScale = saveHighlight.interpolate({
    inputRange: [0, 0.75, 1],
    outputRange: [1, 1.035, 1],
  });
  const saveButtonForeground = canSaveQuickThought
    ? theme.colors.primaryForeground
    : theme.colors.mutedForeground;

  useEffect(() => {
    if (isPremiumUser || stage !== 'main-app') {
      return;
    }

    let cancelled = false;

    getPaywallConfig({
      placementKey: 'home_interruptive',
      screenKey: 'home',
      currentStage: stage,
      triggerMode: 'interruptive',
    })
      .then(result => {
        if (cancelled || !result.shouldShow) {
          return;
        }

        openPaywallForPlacement({
          placementKey: result.placementKey,
          returnStage: 'main-app',
          screenKey: result.screenKey || 'home',
          triggerMode: 'interruptive',
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isPremiumUser, openPaywallForPlacement, stage]);

  return (
    <TabScreenLayout
      backgroundColor={theme.colors.background}
      horizontalPadding={horizontalPadding}
      layoutMaxWidth={layoutMaxWidth}
      header={
        <View
          style={[styles.headerBar, { paddingHorizontal: horizontalPadding }]}
        >
          <View style={[styles.headerBarShell, { maxWidth: layoutMaxWidth }]}>
            <RevealBlock
              index={0}
              isReady={!isOrbHandoffPending}
              shouldAnimate={shouldAnimateEntrance}
              style={styles.header}
            >
              <HomeStreakPill
                currentStreak={currentStreak}
                isLoading={isLoadingMoodStatus}
                onPress={onOpenStreaks}
              />

              <View style={styles.headerActions}>
                <HeaderIconButton
                  source={SEARCH_ICON}
                  onPress={() => {
                    onOpenSearch?.();
                  }}
                  label="Search"
                  borderColor={theme.colors.border}
                  backgroundColor={theme.colors.card}
                />
                <HeaderIconButton
                  source={SETTINGS_ICON}
                  onPress={() => {
                    onOpenSettings?.();
                  }}
                  label="Account settings"
                  borderColor={theme.colors.border}
                  backgroundColor={theme.colors.card}
                />
              </View>
            </RevealBlock>
          </View>
        </View>
      }
      onScroll={handleHeroScroll}
      scrollEventThrottle={16}
      scrollViewRef={scrollViewRef}
      shellStyle={styles.content}
      useAnimatedScroll
    >
      {/* Arriving from the paywall, the orb is already on screen and travelling
          here — replaying the entrance reveal would fight it, so the block is
          placed at rest and the orb below fades in when the hand-off lands. */}
      <RevealBlock
        index={1}
        shouldAnimate={shouldAnimateEntrance && !arrivedFromOrbHandoff}
        style={styles.heroSection}
      >
        <Animated.View
          collapsable={false}
          onLayout={publishOrbHandoffTarget}
          ref={heroOrbRef}
          style={{ opacity: heroOrbOpacity }}
        >
          {/* The orb fades to opacity 0 as the page scrolls, and opacity alone
              does not stop touches — without disabling both the press handler
              and pointer events, this would swallow taps meant for the cards
              that have scrolled up underneath it. */}
          <HapticPressable
            accessibilityHint="Opens a chat about your patterns"
            accessibilityLabel="Ask Jade"
            accessibilityRole="button"
            disabled={!isOrbInteractive}
            onPress={handleOrbPress}
            onPressIn={handleOrbPressIn}
            pointerEvents={isOrbInteractive ? 'auto' : 'none'}
            testID="home-orb-pressable"
          >
            <Orb
              deepColor={orbAccents.deep}
              paused={isOrbHandoffPending}
              primaryColor={theme.colors.primary}
              ref={orbRef}
              scrollY={heroScrollY}
              secondaryColor={orbAccents.secondary}
              size={heroOrbSize}
            />
          </HapticPressable>
        </Animated.View>
      </RevealBlock>

      <RevealBlock
        index={2}
        isReady={!isOrbHandoffPending}
        shouldAnimate={shouldAnimateEntrance}
        style={styles.greetingSection}
      >
        <Animated.View style={heroFadeStyle}>
          <HomeGreeting
            celebrate={isCelebratingOffer}
            date={todayDate}
            firstName={firstName}
            greeting={greeting}
            isCompact={isCompact}
            isWide={isWide}
            nudge={homeNudge}
            onPress={handleNudgePress}
            shouldAnimate={shouldAnimateGreeting}
          />
        </Animated.View>
      </RevealBlock>

      <RevealBlock
        index={4}
        onLayout={event => {
          reflectionSectionYRef.current = event.nativeEvent.layout.y;
        }}
        isReady={!isOrbHandoffPending}
        shouldAnimate={shouldAnimateEntrance}
        style={styles.sectionSpacing}
      >
        <DailyThoughtCard
          onReflect={text => {
            handleReflectionSeen();
            onOpenNewEntry(text);
          }}
          isCompact={isCompact}
        />
      </RevealBlock>

      <RevealBlock
        index={5}
        onLayout={event => {
          moodSectionYRef.current = event.nativeEvent.layout.y;
        }}
        isReady={!isOrbHandoffPending}
        shouldAnimate={shouldAnimateEntrance}
        style={styles.sectionSpacing}
      >
        <Animated.View
          style={[
            styles.card,
            styles.moodCard,
            {
              backgroundColor: theme.colors.card,
              borderColor:
                showMoodResult && currentMoodTone
                  ? currentMoodTone.color
                  : theme.colors.border,
            },
            moodCardAnimatedStyle,
          ]}
        >
          {isLoadingMoodStatus ? (
            <View
              accessibilityLabel="Loading mood check-in"
              style={styles.moodLoadingCard}
            >
              <Text
                style={[styles.cardPrompt, { color: theme.colors.foreground }]}
              >
                How are you feeling today?
              </Text>
              <View style={styles.moodRow}>
                {moods.map(mood => (
                  <View key={mood.value} style={styles.moodOptionShell}>
                    <View
                      style={[
                        styles.moodOption,
                        styles.moodLoadingOption,
                        {
                          backgroundColor: hexToRgba(
                            theme.colors.primary,
                            0.05,
                          ),
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <ShimmerBlock
                        theme={theme}
                        width={36}
                        height={36}
                        borderRadius={18}
                      />
                      <ShimmerBlock
                        theme={theme}
                        width="62%"
                        height={10}
                        borderRadius={999}
                        style={styles.moodLoadingLabel}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Animated.View
              style={[
                styles.moodStage,
                {
                  height: moodStageHeight,
                },
              ]}
            >
              <Animated.View
                pointerEvents={showMoodResult ? 'none' : 'auto'}
                style={[
                  styles.moodLayer,
                  {
                    opacity: moodQuestionOpacity,
                    transform: [{ translateY: moodQuestionTranslateY }],
                  },
                ]}
              >
                <Text
                  style={[
                    styles.cardPrompt,
                    { color: theme.colors.foreground },
                  ]}
                >
                  {widgetSuggestedMood
                    ? 'Your widget choice is highlighted. Tap it to save.'
                    : 'How are you feeling today?'}
                </Text>

                <View style={styles.moodRow}>
                  {moods.map(mood => {
                    const Icon = mood.icon;
                    const isSelected =
                      selectedMood === mood.value ||
                      widgetSuggestedMood === mood.value;

                    const moodColor = getMoodColor(mood.value, theme.mode);
                    const tone = {
                      color: moodColor,
                      backgroundColor: hexToRgba(moodColor, MOOD_TINT_ALPHA),
                      selectedBackgroundColor: hexToRgba(
                        moodColor,
                        MOOD_SELECTED_TINT_ALPHA,
                      ),
                    };

                    const selectedButtonStyle = isSelected
                      ? {
                          transform: [
                            {
                              scale: moodSelectionProgress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 1.08],
                              }),
                            },
                            {
                              translateY: moodSelectionProgress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -2],
                              }),
                            },
                          ],
                        }
                      : null;

                    return (
                      <HapticPressable
                        key={mood.value}
                        accessibilityRole="button"
                        accessibilityLabel={mood.label}
                        disabled={
                          !isOnline ||
                          isLoggingMood ||
                          isLoadingMoodStatus ||
                          showMoodResult
                        }
                        onPress={() => {
                          handleSelectMood(mood.value).catch(() => {});
                        }}
                        style={({ pressed }) => [
                          styles.moodOptionShell,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Animated.View
                          style={[
                            styles.moodOption,
                            isSelected && styles.moodOptionSelected,
                            {
                              backgroundColor: isSelected
                                ? tone.selectedBackgroundColor
                                : tone.backgroundColor,
                              borderColor: isSelected
                                ? tone.color
                                : theme.colors.border,
                            },
                            selectedButtonStyle,
                          ]}
                        >
                          <View
                            style={[
                              styles.moodIconCircle,
                              {
                                backgroundColor: isSelected
                                  ? tone.selectedBackgroundColor
                                  : theme.colors.secondary,
                              },
                            ]}
                          >
                            <Icon
                              size={18}
                              color={
                                isSelected
                                  ? tone.color
                                  : theme.colors.mutedForeground
                              }
                            />
                          </View>
                          <Text
                            style={[
                              styles.moodLabel,
                              {
                                color: isSelected
                                  ? tone.color
                                  : theme.colors.mutedForeground,
                              },
                            ]}
                          >
                            {mood.label}
                          </Text>
                        </Animated.View>
                      </HapticPressable>
                    );
                  })}
                </View>
              </Animated.View>

              <Animated.View
                pointerEvents={showMoodResult ? 'auto' : 'none'}
                style={[
                  styles.moodLayer,
                  styles.moodSavedLayer,
                  {
                    opacity: moodSavedOpacity,
                    transform: [{ translateY: moodSavedTranslateY }],
                  },
                ]}
              >
                {savedMoodData && currentMoodTone ? (
                  <View style={styles.moodSavedRow}>
                    <View
                      style={[
                        styles.moodSavedIcon,
                        { backgroundColor: currentMoodTone.backgroundColor },
                      ]}
                    >
                      <Animated.View
                        style={{
                          transform: [{ rotate: moodEmojiRotate }],
                        }}
                      >
                        <EmojiWithFallback
                          emoji={savedMoodData.emoji}
                          emojiStyle={styles.moodEmoji}
                          fallbackIcon={SavedMoodIcon}
                          fallbackIconColor={currentMoodTone.color}
                          fallbackIconSize={20}
                        />
                      </Animated.View>
                    </View>
                    <View style={styles.moodSavedCopy}>
                      <View style={styles.moodSavedTitleRow}>
                        <Text
                          style={[
                            styles.moodSavedTitle,
                            { color: theme.colors.foreground },
                          ]}
                        >
                          Feeling{' '}
                          <Text style={{ color: currentMoodTone.color }}>
                            {savedMoodData.label.toLowerCase()}
                          </Text>{' '}
                          today
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.moodSavedSubtitle,
                          { color: theme.colors.mutedForeground },
                        ]}
                      >
                        Mood logged for today. Come back tomorrow to update it.
                      </Text>
                    </View>
                  </View>
                ) : null}
              </Animated.View>
            </Animated.View>
          )}
        </Animated.View>
      </RevealBlock>

      <RevealBlock
        index={6}
        onLayout={event => {
          quickThoughtSectionYRef.current = event.nativeEvent.layout.y;
        }}
        isReady={!isOrbHandoffPending}
        shouldAnimate={shouldAnimateEntrance}
        style={styles.sectionSpacing}
      >
        <View
          style={[
            styles.card,
            styles.quickNoteCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: noteBorderColor,
            },
          ]}
        >
          <Animated.View
            accessibilityElementsHidden={isNoteExpanded}
            importantForAccessibility={
              isNoteExpanded ? 'no-hide-descendants' : 'auto'
            }
            pointerEvents={isNoteExpanded ? 'none' : 'auto'}
            style={[
              isNoteExpanded && styles.quickNoteLayerAbsolute,
              { opacity: quickNoteCollapsedOpacity },
            ]}
          >
            <HapticPressable
              accessibilityRole="button"
              accessibilityLabel="Open quick thought"
              onPress={() => toggleNoteExpanded(true)}
              style={({ pressed }) => [
                styles.quickNoteCollapsed,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.quickNoteIcon,
                  {
                    backgroundColor: hexToRgba(theme.colors.primary, 0.1),
                  },
                ]}
              >
                <Image
                  source={QUICK_NOTE_ICON}
                  style={styles.quickNoteIconImage}
                />
              </View>
              <Text
                style={[
                  styles.quickNotePlaceholder,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                Capture a quick thought...
              </Text>
            </HapticPressable>
          </Animated.View>
          <Animated.View
            accessibilityElementsHidden={!isNoteExpanded}
            importantForAccessibility={
              isNoteExpanded ? 'auto' : 'no-hide-descendants'
            }
            pointerEvents={isNoteExpanded ? 'auto' : 'none'}
            style={[
              styles.quickNoteExpanded,
              !isNoteExpanded && styles.quickNoteLayerAbsolute,
              { opacity: quickNoteExpandedOpacity },
            ]}
          >
            <View style={styles.quickNoteHeader}>
              <View style={styles.quickNoteTitleRow}>
                <Image
                  source={QUICK_NOTE_ICON}
                  style={styles.quickNoteTitleIcon}
                />
                <Text
                  style={[
                    styles.quickNoteTitle,
                    { color: theme.colors.foreground },
                  ]}
                >
                  Quick Note
                </Text>
              </View>
              <View style={styles.quickNoteActions}>
                <HapticPressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => toggleNoteExpanded(false, true)}
                  style={({ pressed }) => [
                    styles.smallIconButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <X size={14} color={theme.colors.mutedForeground} />
                </HapticPressable>
              </View>
            </View>

            <TextInput
              ref={noteInputRef}
              value={note}
              onChangeText={value => {
                setNote(value);
                setQuickThoughtError(null);
              }}
              onContentSizeChange={event => {
                const nextHeight = Math.min(
                  120,
                  Math.max(72, event.nativeEvent.contentSize.height),
                );

                setNoteInputHeight(nextHeight);
              }}
              placeholder="What's on your mind?"
              placeholderTextColor={theme.colors.mutedForeground}
              multiline
              scrollEnabled={false}
              maxLength={500}
              style={[
                styles.quickNoteInput,
                {
                  color: theme.colors.foreground,
                  height: noteInputHeight,
                },
              ]}
            />

            <View style={styles.quickTagsRow}>
              <Hash size={12} color={theme.colors.mutedForeground} />
              {quickTags.map(tag => (
                <AnimatedTagChip
                  key={tag}
                  label={tag}
                  onPress={() => handleToggleTag(tag)}
                  selected={selectedTags.includes(tag)}
                  shouldAnimate={shouldAnimateQuickNote}
                  style={styles.tagChip}
                  textStyle={styles.tagText}
                />
              ))}
            </View>

            {quickThoughtError ? (
              <Text
                accessibilityRole="alert"
                style={[
                  styles.quickThoughtError,
                  { color: theme.colors.destructive },
                ]}
              >
                {quickThoughtError}
              </Text>
            ) : null}

            <View style={styles.quickNoteFooter}>
              <Text
                style={[
                  styles.quickNoteCount,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                {note.length}/500
              </Text>
              <HapticPressable
                accessibilityRole="button"
                accessibilityLabel="Save quick thought"
                accessibilityState={{
                  busy: isSavingQuickThought,
                  disabled: !canSaveQuickThought,
                }}
                onPress={handleSaveNote}
                disabled={!canSaveQuickThought}
                style={({ pressed }) => [
                  pressed && canSaveQuickThought && styles.pressed,
                ]}
              >
                <Animated.View
                  style={[
                    styles.saveButton,
                    {
                      backgroundColor: saveButtonBackgroundColor,
                      opacity: saveButtonOpacity,
                      transform: [{ scale: saveButtonScale }],
                    },
                  ]}
                >
                  <ButtonLoadingContent
                    contentStyle={styles.saveButtonContent}
                    loaderColor={theme.colors.primaryForeground}
                    loading={isSavingQuickThought}
                  >
                    <Send size={12} color={saveButtonForeground} />
                    <Text
                      style={[
                        styles.saveButtonText,
                        { color: saveButtonForeground },
                      ]}
                    >
                      Save
                    </Text>
                  </ButtonLoadingContent>
                </Animated.View>
              </HapticPressable>
            </View>
          </Animated.View>
        </View>
      </RevealBlock>

      <RevealBlock
        index={7}
        isReady={!isOrbHandoffPending}
        shouldAnimate={shouldAnimateEntrance}
        style={styles.sectionSpacingBottom}
      >
        <GoalsHomeCard onOpenGoals={() => onOpenGoals?.()} />
      </RevealBlock>
    </TabScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 0,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 4,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 0,
  },
  greetingSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerBar: {
    width: '100%',
  },
  headerBarShell: {
    alignSelf: 'center',
    paddingBottom: 8,
    paddingTop: 12,
    width: '100%',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalsCard: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  goalsCardIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  goalsCardCopy: {
    flex: 1,
    gap: 3,
  },
  goalsCardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  goalsCardBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  headerIcon: {
    height: 20,
    resizeMode: 'contain',
    width: 20,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCardRow: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  topCardRowSingle: {
    gap: 0,
  },
  streakCard: {
    flex: 1,
    minHeight: 104,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    overflow: 'hidden',
  },
  streakCardCompact: {
    minHeight: 118,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 22,
    paddingHorizontal: 18,
  },
  streakCopy: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  streakValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  streakLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 34,
  },
  streakValue: {
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  streakSuffix: {
    fontSize: 14,
  },
  streakFireEmoji: {
    fontSize: 15,
    lineHeight: 18,
  },
  ghostButton: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ghostButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionSpacing: {
    marginTop: 16,
  },
  sectionSpacingBottom: {
    marginTop: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    overflow: 'hidden',
  },
  moodCard: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  moodStage: {
    position: 'relative',
  },
  moodLayer: {
    width: '100%',
  },
  moodSavedLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  moodLoadingCard: {
    justifyContent: 'center',
    minHeight: 144,
  },
  quickNoteCard: {
    padding: 0,
    position: 'relative',
  },
  quickNoteLayerAbsolute: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  cardPrompt: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 18,
    marginTop: 4,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  moodOptionShell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  moodOption: {
    width: '96%',
    minHeight: 94,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 8,
    borderWidth: 1,
  },
  moodLoadingOption: {
    justifyContent: 'center',
  },
  moodOptionSelected: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 3,
  },
  moodIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  moodLoadingLabel: {
    alignSelf: 'center',
  },
  moodSavedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  moodSavedIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodEmoji: {
    fontSize: 20,
  },
  moodSavedCopy: {
    flex: 1,
  },
  moodSavedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moodSavedTitle: {
    fontSize: 13,
    flex: 1,
  },
  moodSavedSubtitle: {
    marginTop: 4,
    fontSize: 11,
  },
  smallIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickNoteCollapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  quickNoteIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  quickNoteIconImage: {
    height: 20,
    width: 20,
  },
  quickNoteTitleIcon: {
    height: 17,
    width: 17,
  },
  quickNotePlaceholder: {
    flex: 1,
    fontSize: 14,
  },
  quickNoteExpanded: {
    padding: 16,
  },
  quickNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  quickNoteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickNoteTitle: {
    fontSize: 14,
  },
  quickNoteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  quickNoteInput: {
    fontSize: 14,
    textAlignVertical: 'top',
    paddingVertical: 0,
    marginBottom: 12,
  },
  quickTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tagChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 11,
  },
  quickNoteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickThoughtError: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  quickNoteCount: {
    fontSize: 12,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  insightCard: {
    padding: 20,
    position: 'relative',
  },
  insightGlow: {
    position: 'absolute',
    top: -48,
    right: -48,
    width: 128,
    height: 128,
    borderRadius: 64,
    opacity: 1,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    zIndex: 1,
  },
  insightTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionKicker: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  insightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  insightDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  insightDot: {
    height: 6,
    width: 6,
    borderRadius: 999,
  },
  insightDotActive: {
    width: 16,
  },
  insightDotLocked: {
    opacity: 0.6,
  },
  insightBody: {
    zIndex: 1,
  },
  insightBodyDisabled: {
    opacity: 0.96,
  },
  insightAnimatedContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  insightLoadingLine: {
    marginTop: 8,
  },
  insightIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  insightCopy: {
    flex: 1,
  },
  insightMetaPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  insightMetaText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400',
  },
  insightTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  insightText: {
    fontSize: 12,
    lineHeight: 18,
  },
  insightCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  insightCtaText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  smallIconButtonDisabled: {
    opacity: 0.45,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  promptIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  promptCopy: {
    flex: 1,
  },
  promptText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  promptCardDisabled: {
    opacity: 0.98,
  },
  promptLoadingStack: {
    marginTop: 8,
    gap: 8,
  },
  promptLoadingLine: {
    marginTop: 0,
  },
  promptDialogBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 28, 26, 0.42)',
    paddingHorizontal: 24,
  },
  promptDialogDismissLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  promptDialogCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '78%',
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    position: 'relative',
    shadowColor: '#1E1C1A',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.26,
    shadowRadius: 34,
    elevation: 16,
  },
  promptDialogHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 14,
  },
  promptDialogTitleWrap: {
    flex: 1,
  },
  promptDialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  promptDialogSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  promptDialogCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  promptDialogStatus: {
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 12,
  },
  promptDialogScroll: {
    maxHeight: 420,
  },
  promptDialogList: {
    gap: 10,
    paddingBottom: 4,
  },
  promptDialogOption: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  promptDialogTopic: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  promptDialogPrompt: {
    fontSize: 13,
    lineHeight: 19,
  },
  shimmerBlock: {
    overflow: 'hidden',
    position: 'relative',
  },
  shimmerHighlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '42%',
    borderRadius: 999,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionLabel: {
    fontSize: 11,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  recentEntryList: {
    gap: 10,
  },
  recentEntryCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  recentEntryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  recentEntryTitleWrap: {
    flex: 1,
    gap: 2,
  },
  recentEntryTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  recentEntryType: {
    fontSize: 11,
  },
  recentEntryDate: {
    fontSize: 11,
    flexShrink: 0,
  },
  recentEntryPreview: {
    fontSize: 12,
    lineHeight: 18,
  },
  recentEntryTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  recentEntryTag: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recentEntryTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  recentEntriesFooterHint: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  recentEntriesFooterText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  sectionTitle: {
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyStateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyStateTitle: {
    fontSize: 16,
    marginBottom: 6,
  },
  emptyStateDescription: {
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 260,
    textAlign: 'center',
    marginBottom: 18,
  },
  emptyStateAction: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyStateActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
});
