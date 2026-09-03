import HapticPressable from './HapticPressable';
import {
  useEffect,
  useRef,
  useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import {
  Archive,
  ArchiveRestore,
  Check,
  Pencil,
  Target,
} from 'lucide-react-native';
import EmojiWithFallback from './EmojiWithFallback';
import { triggerHaptic } from '../services/hapticsService';
import { useTheme } from '../theme/provider';
import { getGoalIconEmoji } from '../constants/goalIcons';
import { formatReminderTime } from '../constants/reminderTimes';
import { GOAL_FREQUENCY_LABELS } from '../utils/goalPeriod';
import { getGoalPresentationColors } from '../utils/goalPresentation';
import { shouldClaimRowSwipe } from '../utils/rowSwipeGesture';
import type { SavedGoal } from '../services/goalsService';

export type GoalRowPresentation = 'home' | 'manage';

type GoalRowProps = {
  goal: SavedGoal;
  onToggleComplete: (
    goal: SavedGoal,
    completed: boolean,
  ) => Promise<void> | void;
  onEdit: (goal: SavedGoal) => void;
  onArchive: (goal: SavedGoal) => void;
  onUnarchive?: (goal: SavedGoal) => void;
  presentation?: GoalRowPresentation;
  accentIndex?: number;
  /**
   * Bumped by the parent whenever the list scrolls. An open action tray left
   * behind while the user scrolls away is stale UI, so it closes itself.
   */
  closeSignal?: number;
};

const TRAY_WIDTH = 132;
const OPEN_THRESHOLD = TRAY_WIDTH * 0.4;

export default function GoalRow({
  goal,
  onToggleComplete,
  onEdit,
  onArchive,
  onUnarchive,
  presentation = 'home',
  accentIndex,
  closeSignal,
}: GoalRowProps) {
  const theme = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const contentExit = useRef(new Animated.Value(0)).current;
  const tickTravel = useRef(new Animated.Value(0)).current;
  const tickFill = useRef(
    new Animated.Value(goal.isCompletedForPeriod ? 1 : 0),
  ).current;
  const tickPulse = useRef(new Animated.Value(1)).current;
  const rowExit = useRef(new Animated.Value(0)).current;
  const startXRef = useRef(0);
  const isOpenRef = useRef(false);
  const isMountedRef = useRef(true);
  const isTransitioningRef = useRef(false);
  const [rowWidth, setRowWidth] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const [showCompletedVisual, setShowCompletedVisual] = useState(
    goal.isCompletedForPeriod,
  );
  const goalColors = getGoalPresentationColors(theme, goal.id, accentIndex);

  useEffect(() => {
    isMountedRef.current = true;

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
      setIsReduceMotionEnabled,
    );

    return () => {
      isActive = false;
      isMountedRef.current = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isTransitioningRef.current) {
      return;
    }

    setShowCompletedVisual(goal.isCompletedForPeriod);
    tickFill.stopAnimation();

    if (isReduceMotionEnabled || typeof jest !== 'undefined') {
      tickFill.setValue(goal.isCompletedForPeriod ? 1 : 0);
      return;
    }

    Animated.timing(tickFill, {
      toValue: goal.isCompletedForPeriod ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [goal.isCompletedForPeriod, isReduceMotionEnabled, tickFill]);

  const snapRef = useRef<(open: boolean) => void>(() => undefined);

  const snap = (open: boolean) => {
    isOpenRef.current = open;
    Animated.spring(translateX, {
      toValue: open ? -TRAY_WIDTH : 0,
      damping: 22,
      stiffness: 200,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  };

  snapRef.current = snap;

  useEffect(() => {
    if (closeSignal === undefined || !isOpenRef.current) {
      return;
    }

    snapRef.current(false);
  }, [closeSignal]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => shouldClaimRowSwipe(gesture),
      onPanResponderGrant: () => {
        translateX.stopAnimation(value => {
          startXRef.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(
          Math.min(0, Math.max(-TRAY_WIDTH, startXRef.current + gesture.dx)),
        );
      },
      onPanResponderRelease: (_, gesture) => {
        const next = startXRef.current + gesture.dx;
        const shouldOpen =
          gesture.dx < -OPEN_THRESHOLD ||
          (isOpenRef.current && next < -OPEN_THRESHOLD);

        if (shouldOpen !== isOpenRef.current) {
          triggerHaptic('optionSelected').catch(() => undefined);
        }
        snap(shouldOpen);
      },
      onPanResponderTerminate: () => snap(isOpenRef.current),
    }),
  ).current;

  const runTiming = (
    value: Animated.Value,
    toValue: number,
    duration: number,
    useNativeDriver: boolean,
  ) =>
    new Promise<void>(resolve => {
      Animated.timing(value, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver,
      }).start(() => resolve());
    });

  const settleFailedHomeTransition = () => {
    if (!isMountedRef.current) {
      return;
    }

    setShowCompletedVisual(false);
    tickPulse.stopAnimation();
    tickPulse.setValue(1);
    Animated.parallel([
      Animated.timing(rowExit, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(contentExit, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(tickTravel, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(tickFill, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start(() => {
      isTransitioningRef.current = false;
      setIsTransitioning(false);
    });
  };

  const runHomeCompletion = async () => {
    await runTiming(contentExit, 1, 140, true);
    await runTiming(tickTravel, 1, 220, true);
    setShowCompletedVisual(true);

    tickPulse.setValue(0.82);
    await Promise.all([
      runTiming(tickFill, 1, 160, false),
      new Promise<void>(resolve => {
        Animated.sequence([
          Animated.spring(tickPulse, {
            toValue: 1.08,
            damping: 15,
            stiffness: 240,
            mass: 0.8,
            useNativeDriver: true,
          }),
          Animated.spring(tickPulse, {
            toValue: 1,
            damping: 18,
            stiffness: 260,
            mass: 0.75,
            useNativeDriver: true,
          }),
        ]).start(() => resolve());
      }),
    ]);
    await runTiming(rowExit, 1, 180, true);
    await onToggleComplete(goal, true);

    requestAnimationFrame(() => {
      // A successful Home mutation unmounts this row. Remaining mounted means
      // the optimistic request rolled back, so reveal the goal calmly.
      if (isMountedRef.current) {
        settleFailedHomeTransition();
      }
    });
  };

  const runManageCompletion = async (nextCompleted: boolean) => {
    if (nextCompleted) {
      setShowCompletedVisual(true);
      tickPulse.setValue(0.88);
      await Promise.all([
        runTiming(tickFill, 1, 180, false),
        new Promise<void>(resolve => {
          Animated.spring(tickPulse, {
            toValue: 1,
            damping: 16,
            stiffness: 220,
            mass: 0.85,
            useNativeDriver: true,
          }).start(() => resolve());
        }),
      ]);
    } else {
      await runTiming(tickFill, 0, 180, false);
      setShowCompletedVisual(false);
    }

    await onToggleComplete(goal, nextCompleted);
    isTransitioningRef.current = false;
    if (isMountedRef.current) {
      setIsTransitioning(false);
    }
  };

  const handleToggle = () => {
    if (isTransitioningRef.current) {
      return;
    }

    snap(false);
    const nextCompleted = !goal.isCompletedForPeriod;
    triggerHaptic(nextCompleted ? 'primaryAction' : 'secondaryAction').catch(
      () => undefined,
    );

    if (isReduceMotionEnabled || typeof jest !== 'undefined') {
      onToggleComplete(goal, nextCompleted);
      return;
    }

    isTransitioningRef.current = true;
    setIsTransitioning(true);

    if (presentation === 'home' && nextCompleted) {
      runHomeCompletion().catch(settleFailedHomeTransition);
      return;
    }

    runManageCompletion(nextCompleted).catch(() => {
      isTransitioningRef.current = false;
      setIsTransitioning(false);
    });
  };

  const handleEdit = () => {
    triggerHaptic('optionSelected').catch(() => undefined);
    snap(false);
    onEdit(goal);
  };

  const handleLifecycleAction = () => {
    triggerHaptic('secondaryAction').catch(() => undefined);
    snap(false);

    if (goal.status === 'archived') {
      onUnarchive?.(goal);
      return;
    }

    Alert.alert(
      'Archive goal?',
      `Are you sure you want to archive '${goal.title}'?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => onArchive(goal),
        },
      ],
    );
  };

  const tickDistance = rowWidth > 0 ? -(rowWidth / 2 - 28) : 0;
  const tickTranslateX = tickTravel.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tickDistance],
  });
  const contentOpacity = contentExit.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const contentTranslateX = contentExit.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });
  const rowOpacity = rowExit.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const rowScale = rowExit.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.97],
  });
  const rowTranslateY = rowExit.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });
  const tickBackgroundColor = tickFill.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', theme.colors.success],
  });
  const tickBorderColor = tickFill.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.mutedForeground, theme.colors.success],
  });

  const reminderLabel =
    goal.reminderEnabled && goal.reminderTime
      ? formatReminderTime(goal.reminderTime)
      : null;
  const metaLabel = [
    goal.frequency === 'as_needed'
      ? null
      : GOAL_FREQUENCY_LABELS[goal.frequency],
    reminderLabel,
  ]
    .filter(Boolean)
    .join(' · ');
  const isArchived = goal.status === 'archived';
  const LifecycleIcon = isArchived ? ArchiveRestore : Archive;
  const lifecycleLabel = isArchived ? 'Unarchive' : 'Archive';
  const contentAnimationStyle = {
    opacity: presentation === 'home' ? contentOpacity : 1,
    transform: [
      {
        translateX: presentation === 'home' ? contentTranslateX : 0,
      },
    ],
  };

  return (
    <Animated.View
      testID="goal-row-shell"
      style={[
        styles.clip,
        {
          opacity: rowOpacity,
          transform: [{ translateY: rowTranslateY }, { scale: rowScale }],
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.traySeam, { backgroundColor: theme.colors.info }]}
      />
      <View style={styles.tray}>
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel={`Edit goal ${goal.title}`}
          onPress={handleEdit}
          style={({ pressed }) => [
            styles.trayButton,
            { backgroundColor: theme.colors.info },
            pressed && styles.pressed,
          ]}
        >
          <Pencil size={16} color={theme.colors.infoForeground} />
          <Text
            style={[styles.trayLabel, { color: theme.colors.infoForeground }]}
          >
            Edit
          </Text>
        </HapticPressable>
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel={`${lifecycleLabel} goal ${goal.title}`}
          onPress={handleLifecycleAction}
          style={({ pressed }) => [
            styles.trayButton,
            {
              backgroundColor: isArchived
                ? theme.colors.success
                : theme.colors.warning,
            },
            pressed && styles.pressed,
          ]}
        >
          <LifecycleIcon
            size={16}
            color={
              isArchived
                ? theme.colors.successForeground
                : theme.colors.warningForeground
            }
          />
          <Text
            style={[
              styles.trayLabel,
              {
                color: isArchived
                  ? theme.colors.successForeground
                  : theme.colors.warningForeground,
              },
            ]}
          >
            {lifecycleLabel}
          </Text>
        </HapticPressable>
      </View>

      <Animated.View
        testID="goal-row-foreground"
        {...panResponder.panHandlers}
        onLayout={event => setRowWidth(event.nativeEvent.layout.width)}
        style={[
          styles.row,
          {
            backgroundColor: theme.colors.card,
            borderColor: goalColors.borderColor,
            transform: [{ translateX }],
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: goalColors.tintColor },
          ]}
        />
        <Animated.View style={[styles.content, contentAnimationStyle]}>
          <View
            style={[
              styles.iconChip,
              { backgroundColor: goalColors.iconBackgroundColor },
            ]}
          >
            <EmojiWithFallback
              emoji={getGoalIconEmoji(goal.icon)}
              emojiStyle={styles.iconEmoji}
              fallbackIcon={Target}
              fallbackIconColor={goalColors.accentColor}
              fallbackIconSize={15}
            />
          </View>
          <View style={styles.copy}>
            <Text
              ellipsizeMode="tail"
              numberOfLines={1}
              style={[styles.title, { color: theme.colors.foreground }]}
            >
              {goal.title}
            </Text>
            {metaLabel ? (
              <Text
                numberOfLines={1}
                style={[styles.meta, { color: theme.colors.mutedForeground }]}
              >
                {metaLabel}
              </Text>
            ) : null}
          </View>
        </Animated.View>

        <HapticPressable
          accessibilityRole="checkbox"
          accessibilityLabel={
            goal.isCompletedForPeriod
              ? `Mark goal not done: ${goal.title}`
              : `Mark goal complete: ${goal.title}`
          }
          accessibilityState={{
            checked: goal.isCompletedForPeriod,
            disabled: isTransitioning,
          }}
          disabled={isTransitioning}
          hitSlop={8}
          onPress={handleToggle}
          style={styles.tickHitbox}
        >
          <Animated.View
            testID="goal-tick-motion"
            style={{
              transform: [
                {
                  translateX: presentation === 'home' ? tickTranslateX : 0,
                },
                { scale: tickPulse },
              ],
            }}
          >
            <Animated.View
              testID="goal-tick-fill"
              style={[
                styles.tickChip,
                {
                  backgroundColor: tickBackgroundColor,
                  borderColor: tickBorderColor,
                },
              ]}
            >
              <Check
                size={15}
                color={
                  showCompletedVisual
                    ? theme.colors.successForeground
                    : theme.colors.mutedForeground
                }
                strokeWidth={2.4}
              />
            </Animated.View>
          </Animated.View>
        </HapticPressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  traySeam: {
    bottom: 0,
    position: 'absolute',
    right: TRAY_WIDTH,
    top: 0,
    width: 14,
  },
  tray: {
    alignItems: 'stretch',
    bottom: 0,
    flexDirection: 'row',
    position: 'absolute',
    right: 0,
    top: 0,
    width: TRAY_WIDTH,
  },
  trayButton: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    height: '100%',
    justifyContent: 'center',
  },
  trayLabel: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  row: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    overflow: 'hidden',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 9,
  },
  iconChip: {
    alignItems: 'center',
    borderRadius: 10,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  iconEmoji: {
    fontSize: 15,
  },
  copy: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  meta: {
    fontSize: 10.5,
    lineHeight: 13,
  },
  tickHitbox: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  tickChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  pressed: {
    opacity: 0.72,
  },
});
