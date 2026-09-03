import HapticPressable from './HapticPressable';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  LayoutAnimation,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import { useFocusEffect } from '@react-navigation/native';
import { Plus } from 'lucide-react-native';
import { triggerHaptic } from '../services/hapticsService';
import { useTheme } from '../theme/provider';
import { useAppStore } from '../store/appStore';
import { selectTodoGoals } from '../store/slices/goalsSlice';
import type { GoalDraft, SavedGoal } from '../services/goalsService';
import GoalSheet from './GoalSheet';
import GoalRow from './GoalRow';

const PREVIEW_LIMIT = 3;
const GOALS_ICON = require('../assets/png/goals/goals-focus.png');

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

type SheetState = {
  visible: boolean;
  mode: 'add' | 'edit';
  editing: SavedGoal | null;
};

const CLOSED_SHEET: SheetState = {
  visible: false,
  mode: 'add',
  editing: null,
};

type GoalsHomeCardProps = {
  onOpenGoals: () => void;
  /**
   * Bumped by HomeScreen whenever the page scrolls, so an open GoalRow action
   * tray closes instead of being left open behind content scrolled past.
   */
  rowCloseSignal?: number;
};

export default function GoalsHomeCard({
  onOpenGoals,
  rowCloseSignal,
}: GoalsHomeCardProps) {
  const theme = useTheme();
  const goals = useAppStore(state => state.goals);
  const isLoadingGoals = useAppStore(state => state.isLoadingGoals);
  const hasHydratedGoals = useAppStore(state => state.hasHydratedGoals);
  const goalsError = useAppStore(state => state.goalsError);
  const loadGoals = useAppStore(state => state.loadGoals);
  const createGoalDraft = useAppStore(state => state.createGoalDraft);
  const updateGoalDraft = useAppStore(state => state.updateGoalDraft);
  const setGoalCompleted = useAppStore(state => state.setGoalCompleted);
  const setGoalArchived = useAppStore(state => state.setGoalArchived);

  const [sheet, setSheet] = useState<SheetState>(CLOSED_SHEET);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);

  // Derive with useMemo, never inside the Zustand selector — returning a new
  // array from a selector re-renders on every unrelated store change.
  const todoGoals = useMemo(() => selectTodoGoals(goals), [goals]);
  const previewGoals = todoGoals.slice(0, PREVIEW_LIMIT);
  const hasGoals = goals.length > 0;
  const isAllDone = hasGoals && todoGoals.length === 0;
  const unavailableIcons = useMemo(
    () =>
      goals
        .filter(goal => goal.id !== sheet.editing?.id)
        .map(goal => goal.icon),
    [goals, sheet.editing?.id],
  );

  const emptyReveal = useRef(new Animated.Value(isAllDone ? 1 : 0)).current;

  useFocusEffect(
    useCallback(() => {
      loadGoals().catch(() => undefined);
    }, [loadGoals]),
  );

  useEffect(() => {
    let isActive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (isActive) {
          setIsReduceMotionEnabled(enabled);
        }
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, []);

  /**
   * When the last goal is ticked off, the header icon travels to the centre of
   * the card and the title drops beneath it, reading "No goals left for today".
   *
   * The row -> column move is a layout change, so LayoutAnimation drives the
   * travel (and pulls the buttons below up with it), while the spring below only
   * handles the copy swapping in. One spring, no looping.
   */
  useEffect(() => {
    const target = isAllDone ? 1 : 0;
    const shouldAnimate = !isReduceMotionEnabled && typeof jest === 'undefined';

    if (!shouldAnimate) {
      emptyReveal.setValue(target);
      return;
    }

    LayoutAnimation.configureNext({
      duration: 280,
      create: {
        type: LayoutAnimation.Types.easeOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: { type: LayoutAnimation.Types.spring, springDamping: 0.8 },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });

    emptyReveal.setValue(0);
    Animated.spring(emptyReveal, {
      toValue: 1,
      damping: 18,
      stiffness: 190,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [emptyReveal, isAllDone, isReduceMotionEnabled]);

  const openAddSheet = () => {
    triggerHaptic('optionSelected').catch(() => undefined);
    setSubmitError(null);
    setSheet({ visible: true, mode: 'add', editing: null });
  };

  const openEditSheet = (goal: SavedGoal) => {
    setSubmitError(null);
    setSheet({ visible: true, mode: 'edit', editing: goal });
  };

  const closeSheet = () => {
    setSheet(current => ({ ...current, visible: false }));
  };

  const handleSubmit = async (draft: GoalDraft) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const saved =
        sheet.mode === 'edit' && sheet.editing
          ? await updateGoalDraft(sheet.editing.id, draft)
          : await createGoalDraft(draft);

      if (!saved) {
        setSubmitError("We couldn't save that goal. Please try again.");
        return;
      }

      closeSheet();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenGoals = () => {
    triggerHaptic('secondaryAction').catch(() => undefined);
    onOpenGoals();
  };

  const renderBody = () => {
    if (isLoadingGoals && !hasHydratedGoals) {
      return (
        <View style={styles.loadingGroup}>
          {[0, 1].map(key => (
            <View
              key={key}
              style={[
                styles.loadingRow,
                {
                  backgroundColor: theme.colors.secondary,
                  borderColor: theme.colors.border,
                },
              ]}
            />
          ))}
        </View>
      );
    }

    if (goalsError && !hasHydratedGoals) {
      return (
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading goals"
          onPress={() => loadGoals().catch(() => undefined)}
          style={({ pressed }) => [
            styles.stateRow,
            {
              backgroundColor: theme.colors.secondary,
              borderColor: theme.colors.border,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[styles.stateText, { color: theme.colors.mutedForeground }]}
          >
            {goalsError} Tap to retry.
          </Text>
        </HapticPressable>
      );
    }

    if (!hasGoals) {
      return (
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel="Set your first goal"
          onPress={openAddSheet}
          style={({ pressed }) => [
            styles.emptyRow,
            {
              backgroundColor: theme.colors.secondary,
              borderColor: hexToRgba(theme.colors.primary, 0.22),
            },
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: hexToRgba(theme.colors.primary, 0.14) },
            ]}
          >
            <Plus size={16} color={theme.colors.primary} />
          </View>
          <View style={styles.emptyCopy}>
            <Text
              style={[styles.emptyTitle, { color: theme.colors.foreground }]}
            >
              Set your first goal
            </Text>
            <Text
              style={[
                styles.emptyBody,
                { color: theme.colors.mutedForeground },
              ]}
            >
              A small next step you want to keep in view.
            </Text>
          </View>
        </HapticPressable>
      );
    }

    if (isAllDone) {
      return null;
    }

    return (
      <View style={styles.goalList}>
        {previewGoals.map(goal => (
          <GoalRow
            key={goal.id}
            closeSignal={rowCloseSignal}
            goal={goal}
            accentIndex={goals.findIndex(item => item.id === goal.id)}
            onToggleComplete={(item, completed) => {
              if (!isReduceMotionEnabled && typeof jest === 'undefined') {
                LayoutAnimation.configureNext({
                  duration: 220,
                  update: { type: LayoutAnimation.Types.easeInEaseOut },
                  delete: {
                    type: LayoutAnimation.Types.easeInEaseOut,
                    property: LayoutAnimation.Properties.opacity,
                  },
                });
              }

              return setGoalCompleted(item.id, completed);
            }}
            onEdit={openEditSheet}
            onArchive={item => {
              setGoalArchived(item.id, true).catch(() => undefined);
            }}
          />
        ))}
      </View>
    );
  };

  const headerCopyStyle = {
    opacity: emptyReveal,
    transform: [
      {
        translateY: emptyReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [6, 0],
        }),
      },
    ],
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={[styles.header, isAllDone && styles.headerCentered]}>
        <View
          style={[
            styles.headerIcon,
            { backgroundColor: hexToRgba(theme.colors.primary, 0.12) },
          ]}
        >
          <Image source={GOALS_ICON} style={styles.headerIconImage} />
        </View>
        <Animated.View
          style={[
            isAllDone ? styles.headerCopyCentered : styles.headerCopy,
            headerCopyStyle,
          ]}
        >
          <Text
            style={[
              styles.headerTitle,
              isAllDone && styles.headerTitleCentered,
              { color: theme.colors.foreground },
            ]}
          >
            {isAllDone ? 'No goals left for today' : 'Goals'}
          </Text>
        </Animated.View>
      </View>

      {renderBody()}

      {goalsError && hasHydratedGoals ? (
        <Text style={[styles.actionError, { color: theme.colors.destructive }]}>
          {goalsError}
        </Text>
      ) : null}

      <View style={styles.buttonRow}>
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel="Add a goal"
          onPress={openAddSheet}
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.primary,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.actionText,
              { color: theme.colors.primaryForeground },
            ]}
          >
            Add goal
          </Text>
        </HapticPressable>
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel="Manage goals"
          onPress={handleOpenGoals}
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: theme.colors.secondary,
              borderColor: theme.colors.border,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.actionText, { color: theme.colors.foreground }]}>
            Manage
          </Text>
        </HapticPressable>
      </View>

      <GoalSheet
        visible={sheet.visible}
        mode={sheet.mode}
        goal={sheet.editing}
        isSubmitting={isSubmitting}
        errorMessage={submitError}
        unavailableIcons={unavailableIcons}
        onSubmit={handleSubmit}
        onArchive={goal => {
          closeSheet();
          setGoalArchived(goal.id, true).catch(() => undefined);
        }}
        onClose={closeSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },
  headerCentered: {
    flexDirection: 'column',
    gap: 10,
    paddingVertical: 8,
  },
  headerIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerIconImage: {
    height: 20,
    width: 20,
  },
  headerCopy: {
    flex: 1,
  },
  headerCopyCentered: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerTitleCentered: {
    fontSize: 15,
    textAlign: 'center',
  },
  goalList: {
    gap: 8,
  },
  loadingGroup: {
    gap: 10,
  },
  loadingRow: {
    borderRadius: 16,
    borderWidth: 1,
    height: 58,
  },
  stateRow: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  stateText: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  emptyRow: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  emptyIcon: {
    alignItems: 'center',
    borderRadius: 12,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  emptyCopy: {
    flex: 1,
    gap: 2,
  },
  emptyTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  emptyBody: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  actionError: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 48,
  },
  actionText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
