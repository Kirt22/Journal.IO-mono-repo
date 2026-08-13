import { AppState, type AppStateStatus } from 'react-native';
import {
  cancelAllGoalReminders,
  syncGoalReminderNotifications,
} from '../../services/goalRemindersService';
import {
  createGoal,
  deleteGoal,
  getGoals,
  setGoalCompletion,
  setGoalStatus,
  updateGoal,
  type GoalDraft,
  type GoalUpdate,
  type SavedGoal,
} from '../../services/goalsService';
import { getLocalDateKey, isGoalDoneForPeriod } from '../../utils/goalPeriod';

/**
 * Goals live in the store rather than in each screen's local state for three
 * reasons:
 *
 *  1. `goalRemindersService` is a non-React consumer that must see exactly the
 *     list the UI sees.
 *  2. Every mutation has to resync notifications. With mutations in components,
 *     the next call site somebody adds will forget — and the bug is invisible
 *     (a notification firing days later for a goal already completed).
 *  3. GoalsHomeCard and GoalsScreen previously kept independent copies and could
 *     disagree; sharing complete/archive/edit across both would make that worse.
 */

/** How often to re-check the local date while the app is in the foreground. */
const DATE_WATCH_INTERVAL_MS = 60_000;

export type GoalsSliceState = {
  goals: SavedGoal[];
  hasHydratedGoals: boolean;
  isLoadingGoals: boolean;
  goalsError: string | null;
  /** The local date the current `isCompletedForPeriod` values were derived for. */
  goalsLocalDateKey: string;
  loadGoals: () => Promise<void>;
  createGoalDraft: (draft: GoalDraft) => Promise<SavedGoal | null>;
  updateGoalDraft: (
    goalId: string,
    update: GoalUpdate,
  ) => Promise<SavedGoal | null>;
  setGoalCompleted: (goalId: string, completed: boolean) => Promise<void>;
  setGoalArchived: (goalId: string, archived: boolean) => Promise<void>;
  deleteArchivedGoal: (goalId: string) => Promise<boolean>;
  refreshGoalsForDateChange: () => Promise<void>;
  initGoalReminderWatcher: () => () => void;
  clearGoals: () => void;
};

type GoalsState = Pick<
  GoalsSliceState,
  | 'goals'
  | 'hasHydratedGoals'
  | 'isLoadingGoals'
  | 'goalsError'
  | 'goalsLocalDateKey'
>;

type GoalsSliceSetState = (
  updater: Partial<GoalsState> | ((state: GoalsState) => Partial<GoalsState>),
) => void;

type GoalsSliceGetState = () => GoalsState;

const sortGoalsNewestFirst = (goals: SavedGoal[]): SavedGoal[] =>
  [...goals].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

/**
 * Re-derives `isCompletedForPeriod` locally for a new date key.
 *
 * The server computes it per request, but the app can sit open across midnight —
 * this keeps the rendered lists honest until the refetch lands.
 */
const rederiveForDate = (goals: SavedGoal[], todayKey: string): SavedGoal[] =>
  goals.map(goal => {
    const isCompletedForPeriod = isGoalDoneForPeriod(goal, todayKey);

    return goal.isCompletedForPeriod === isCompletedForPeriod
      ? goal
      : { ...goal, isCompletedForPeriod };
  });

export const createInitialGoalsSliceState = (): GoalsState => ({
  goals: [],
  hasHydratedGoals: false,
  isLoadingGoals: false,
  goalsError: null,
  goalsLocalDateKey: getLocalDateKey(),
});

export const createGoalsSlice = (
  set: GoalsSliceSetState,
  get: GoalsSliceGetState,
): GoalsSliceState => {
  /** Single place notifications are resynced from, so no mutation can skip it. */
  const resyncReminders = () => {
    syncGoalReminderNotifications(get().goals).catch(() => undefined);
  };

  const applyServerGoal = (goal: SavedGoal) => {
    set(state => ({
      goals: sortGoalsNewestFirst([
        goal,
        ...state.goals.filter(item => item.id !== goal.id),
      ]),
    }));
  };

  const refreshGoalsForDateChange = async () => {
    const todayKey = getLocalDateKey();

    if (todayKey === get().goalsLocalDateKey) {
      return;
    }

    // Re-derive immediately so a daily goal reappears the moment the date rolls
    // over, then reconcile with the server.
    set(state => ({
      goalsLocalDateKey: todayKey,
      goals: rederiveForDate(state.goals, todayKey),
    }));
    resyncReminders();

    try {
      const goals = await getGoals(todayKey);

      set({ goals: sortGoalsNewestFirst(goals), hasHydratedGoals: true });
      resyncReminders();
    } catch {
      // The local re-derive already holds; a refetch failure needs no banner.
    }
  };

  return {
    ...createInitialGoalsSliceState(),

    loadGoals: async () => {
      const todayKey = getLocalDateKey();

      set({ isLoadingGoals: true, goalsError: null });

      try {
        const goals = await getGoals(todayKey);

        set({
          goals: sortGoalsNewestFirst(goals),
          hasHydratedGoals: true,
          goalsLocalDateKey: todayKey,
        });
        resyncReminders();
      } catch {
        set({ goalsError: "We couldn't load your goals." });
      } finally {
        set({ isLoadingGoals: false });
      }
    },

    createGoalDraft: async draft => {
      set({ goalsError: null });

      try {
        const created = await createGoal(draft, get().goalsLocalDateKey);

        applyServerGoal(created);
        resyncReminders();

        return created;
      } catch {
        set({ goalsError: "We couldn't save that goal. Please try again." });
        return null;
      }
    },

    updateGoalDraft: async (goalId, update) => {
      set({ goalsError: null });

      try {
        const updated = await updateGoal(
          goalId,
          update,
          get().goalsLocalDateKey,
        );

        applyServerGoal(updated);
        resyncReminders();

        return updated;
      } catch {
        set({ goalsError: "We couldn't save that goal. Please try again." });
        return null;
      }
    },

    setGoalCompleted: async (goalId, completed) => {
      const previous = get().goals;
      const todayKey = get().goalsLocalDateKey;

      set({ goalsError: null });
      // Optimistic: the tick should respond immediately, not after a round trip.
      set(state => ({
        goals: state.goals.map(goal =>
          goal.id === goalId
            ? {
                ...goal,
                isCompletedForPeriod: completed,
                lastCompletedLocalDate: completed ? todayKey : null,
              }
            : goal,
        ),
      }));

      try {
        const updated = await setGoalCompletion(goalId, completed, todayKey);

        applyServerGoal(updated);
      } catch {
        set({
          goals: previous,
          goalsError: "We couldn't update that goal. Please try again.",
        });
      } finally {
        resyncReminders();
      }
    },

    setGoalArchived: async (goalId, archived) => {
      const previous = get().goals;

      set({ goalsError: null });
      set(state => ({
        goals: state.goals.map(goal =>
          goal.id === goalId
            ? { ...goal, status: archived ? 'archived' : 'active' }
            : goal,
        ),
      }));

      try {
        const updated = await setGoalStatus(
          goalId,
          archived ? 'archived' : 'active',
          get().goalsLocalDateKey,
        );

        applyServerGoal(updated);
      } catch {
        set({
          goals: previous,
          goalsError: "We couldn't update that goal. Please try again.",
        });
      } finally {
        resyncReminders();
      }
    },

    deleteArchivedGoal: async goalId => {
      set({ goalsError: null });

      try {
        await deleteGoal(goalId);
        set(state => ({
          goals: state.goals.filter(goal => goal.id !== goalId),
        }));
        resyncReminders();
        return true;
      } catch {
        set({
          goalsError: "We couldn't delete that goal. Please try again.",
        });
        return false;
      }
    },

    refreshGoalsForDateChange,

    /**
     * Watches for the local date changing.
     *
     * No midnight timer is needed to keep notifications alive — the rolling
     * horizon already covers crossing midnight while backgrounded. This exists so
     * the *rendered lists* are correct: on foreground, and on a slow tick for the
     * app-left-open-overnight case.
     *
     * Registered once at the app root, not from a screen: a screen-local listener
     * dies with the screen and this must outlive it.
     */
    initGoalReminderWatcher: () => {
      const check = () => {
        refreshGoalsForDateChange().catch(() => undefined);
      };

      const subscription = AppState.addEventListener(
        'change',
        (status: AppStateStatus) => {
          if (status === 'active') {
            check();
          }
        },
      );

      const interval = setInterval(() => {
        if (AppState.currentState === 'active') {
          check();
        }
      }, DATE_WATCH_INTERVAL_MS);

      return () => {
        subscription.remove();
        clearInterval(interval);
      };
    },

    clearGoals: () => {
      // Local notifications name goals by title — never leave them armed for a
      // signed-out account.
      cancelAllGoalReminders().catch(() => undefined);
      set(createInitialGoalsSliceState());
    },
  };
};

/** Derived lists for the three Manage Goals sections. */
export const selectTodoGoals = (goals: SavedGoal[]) =>
  goals.filter(goal => goal.status === 'active' && !goal.isCompletedForPeriod);

export const selectCompletedGoals = (goals: SavedGoal[]) =>
  goals.filter(goal => goal.status === 'active' && goal.isCompletedForPeriod);

export const selectArchivedGoals = (goals: SavedGoal[]) =>
  goals.filter(goal => goal.status === 'archived');
