import HapticPressable from '../../components/HapticPressable';
import {
  useCallback,
  useEffect,
  useMemo,
  useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Text,
} from '../../infrastructure/reactNative';
import { ArrowLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GoalRow from '../../components/GoalRow';
import GoalSheet from '../../components/GoalSheet';
import JournalLoader from '../../components/JournalLoader';
import { triggerHaptic } from '../../services/hapticsService';
import { useTheme } from '../../theme/provider';
import { useAppStore } from '../../store/appStore';
import {
  selectArchivedGoals,
  selectCompletedGoals,
  selectTodoGoals,
} from '../../store/slices/goalsSlice';
import type { GoalDraft, SavedGoal } from '../../services/goalsService';

type GoalsScreenProps = {
  onBack: () => void;
};

const SECTION_LAYOUT_ANIMATION = {
  duration: 240,
  create: {
    type: LayoutAnimation.Types.easeOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

/**
 * Manage Goals is intentionally just three lists — To do, Completed, Archived.
 * The hero card, inline create form and stats line were removed; creating a goal
 * happens from the home card, and editing happens in the shared GoalSheet.
 */
export default function GoalsScreen({ onBack }: GoalsScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const goals = useAppStore(state => state.goals);
  const isLoadingGoals = useAppStore(state => state.isLoadingGoals);
  const hasHydratedGoals = useAppStore(state => state.hasHydratedGoals);
  const goalsError = useAppStore(state => state.goalsError);
  const loadGoals = useAppStore(state => state.loadGoals);
  const updateGoalDraft = useAppStore(state => state.updateGoalDraft);
  const setGoalCompleted = useAppStore(state => state.setGoalCompleted);
  const setGoalArchived = useAppStore(state => state.setGoalArchived);
  const deleteArchivedGoal = useAppStore(state => state.deleteArchivedGoal);

  const [editingGoal, setEditingGoal] = useState<SavedGoal | null>(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Bumped on scroll so any open GoalRow action tray closes itself rather than
  // being left open behind content the user has scrolled past.
  const [rowCloseSignal, setRowCloseSignal] = useState(0);

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 20;
  const layoutMaxWidth = isWide ? 430 : 390;

  // Derived with useMemo, not inside the selector — a Zustand selector returning
  // a new array re-renders on every unrelated store change.
  const todoGoals = useMemo(() => selectTodoGoals(goals), [goals]);
  const completedGoals = useMemo(() => selectCompletedGoals(goals), [goals]);
  const archivedGoals = useMemo(() => selectArchivedGoals(goals), [goals]);
  const unavailableIcons = useMemo(
    () =>
      goals.filter(goal => goal.id !== editingGoal?.id).map(goal => goal.icon),
    [editingGoal?.id, goals],
  );

  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  useEffect(() => {
    loadGoals().catch(() => undefined);
  }, [loadGoals]);

  const animateSections = useCallback(() => {
    if (typeof jest === 'undefined') {
      LayoutAnimation.configureNext(SECTION_LAYOUT_ANIMATION);
    }
  }, []);

  const openEditSheet = (goal: SavedGoal) => {
    triggerHaptic('optionSelected').catch(() => undefined);
    setSubmitError(null);
    setEditingGoal(goal);
    setIsSheetVisible(true);
  };

  const closeSheet = () => {
    setIsSheetVisible(false);
  };

  const handleSubmit = async (draft: GoalDraft) => {
    if (!editingGoal) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const saved = await updateGoalDraft(editingGoal.id, draft);

      if (!saved) {
        setSubmitError("We couldn't save that goal. Please try again.");
        return;
      }

      animateSections();
      closeSheet();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleComplete = (goal: SavedGoal, completed: boolean) => {
    animateSections();
    return setGoalCompleted(goal.id, completed);
  };

  const handleArchive = (goal: SavedGoal) => {
    closeSheet();
    animateSections();
    setGoalArchived(goal.id, true).catch(() => undefined);
  };

  const handleUnarchive = (goal: SavedGoal) => {
    closeSheet();
    animateSections();
    setGoalArchived(goal.id, false).catch(() => undefined);
  };

  const handleDelete = async (goal: SavedGoal) => {
    if (goal.status !== 'archived') {
      return;
    }

    setIsDeleting(true);
    setSubmitError(null);

    try {
      const deleted = await deleteArchivedGoal(goal.id);

      if (!deleted) {
        setSubmitError("We couldn't delete that goal. Please try again.");
        return;
      }

      animateSections();
      closeSheet();
    } finally {
      setIsDeleting(false);
    }
  };

  /** A section header only appears when that section actually holds a goal. */
  const handleListScroll = useCallback(() => {
    setRowCloseSignal(value => value + 1);
  }, []);

  const renderSection = (label: string, sectionGoals: SavedGoal[]) => {
    if (sectionGoals.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: theme.colors.mutedForeground }]}
        >
          {label}
        </Text>
        <View style={styles.sectionList}>
          {sectionGoals.map(goal => (
            <GoalRow
              key={goal.id}
              goal={goal}
              accentIndex={goals.findIndex(item => item.id === goal.id)}
              onToggleComplete={handleToggleComplete}
              onEdit={openEditSheet}
              onArchive={item => {
                animateSections();
                setGoalArchived(item.id, true).catch(() => undefined);
              }}
              onUnarchive={item => {
                animateSections();
                setGoalArchived(item.id, false).catch(() => undefined);
              }}
              closeSignal={rowCloseSignal}
              presentation="manage"
            />
          ))}
        </View>
      </View>
    );
  };

  const hasAnyGoal = goals.length > 0;

  return (
    <SafeAreaView
      style={[styles.shell, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          style={({ pressed }) => [
            styles.headerButton,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
            pressed && styles.pressed,
          ]}
        >
          <ArrowLeft size={18} color={theme.colors.foreground} />
        </HapticPressable>
        <Text style={[styles.headerTitle, { color: theme.colors.foreground }]}>
          Goals
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: horizontalPadding, maxWidth: layoutMaxWidth },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleListScroll}
        scrollEventThrottle={16}
      >
        {isLoadingGoals && !hasHydratedGoals ? (
          <View
            style={[
              styles.statusCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <JournalLoader color={theme.colors.primary} />
            <Text
              style={[
                styles.statusText,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Loading your goals...
            </Text>
          </View>
        ) : null}

        {goalsError ? (
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading goals"
            onPress={() => loadGoals().catch(() => undefined)}
            style={({ pressed }) => [
              styles.statusCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: theme.colors.mutedForeground },
              ]}
            >
              {goalsError} Tap to retry.
            </Text>
          </HapticPressable>
        ) : null}

        {renderSection('To do', todoGoals)}
        {renderSection('Completed', completedGoals)}
        {renderSection('Archived', archivedGoals)}

        {hasHydratedGoals && !hasAnyGoal && !goalsError ? (
          <View
            style={[
              styles.statusCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={[styles.emptyTitle, { color: theme.colors.foreground }]}
            >
              Nothing saved yet
            </Text>
            <Text
              style={[
                styles.statusText,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Add a goal from your home screen to see it here.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <GoalSheet
        visible={isSheetVisible}
        mode="edit"
        goal={editingGoal}
        isSubmitting={isSubmitting}
        isDeleting={isDeleting}
        errorMessage={submitError}
        unavailableIcons={unavailableIcons}
        onSubmit={handleSubmit}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onDelete={goal => {
          handleDelete(goal).catch(() => undefined);
        }}
        onClose={closeSheet}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingTop: 10,
  },
  headerButton: {
    alignItems: 'center',
    borderRadius: 19,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  headerTitle: {
    fontSize: 16,
  },
  headerSpacer: {
    width: 38,
  },
  content: {
    alignSelf: 'center',
    gap: 22,
    paddingBottom: 48,
    paddingTop: 18,
    width: '100%',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionList: {
    gap: 10,
  },
  statusCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  statusText: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
