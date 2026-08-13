import { request } from '../utils/apiClient';
import type { GoalIconKey } from '../constants/goalIcons';
import { getLocalDateKey, type GoalFrequency } from '../utils/goalPeriod';

/** Completion is derived per period, so it is not a status. */
export type GoalStatus = 'active' | 'archived';
export type GoalIconSource = 'automatic' | 'fixed';

export type SavedGoal = {
  id: string;
  title: string;
  description: string | null;
  icon: GoalIconKey;
  iconSource: GoalIconSource;
  frequency: GoalFrequency;
  status: GoalStatus;
  reminderEnabled: boolean;
  reminderTime: string | null;
  /**
   * Raw completion date, needed by the reminder scheduler to evaluate future
   * occurrences — `isCompletedForPeriod` only answers "right now".
   */
  lastCompletedLocalDate: string | null;
  isCompletedForPeriod: boolean;
  createdAt: string;
  updatedAt: string;
};

/** The editable shape of a goal, shared by the add and edit sheet. */
export type GoalDraft = {
  title: string;
  description?: string | null;
  icon?: GoalIconKey;
  iconSource?: GoalIconSource;
  frequency?: GoalFrequency;
  reminderEnabled?: boolean;
  reminderTime?: string | null;
};

export type GoalUpdate = Partial<GoalDraft>;

export type GoalSuggestion = {
  title: string;
  description: string;
  icon: GoalIconKey;
  iconSource: 'automatic';
  frequency: GoalFrequency;
};

const getGoals = async (todayKey: string = getLocalDateKey()) => {
  const response = await request<{ goals: SavedGoal[] }>(
    `/goals?today=${encodeURIComponent(todayKey)}`,
    { method: 'GET' },
  );

  return response.data.goals || [];
};

const createGoal = async (
  draft: GoalDraft,
  todayKey: string = getLocalDateKey(),
) => {
  const response = await request<SavedGoal>('/goals', {
    method: 'POST',
    body: JSON.stringify({
      ...draft,
      title: draft.title.trim(),
      today: todayKey,
    }),
  });

  return response.data;
};

const updateGoal = async (
  goalId: string,
  update: GoalUpdate,
  todayKey: string = getLocalDateKey(),
) => {
  const response = await request<SavedGoal>(
    `/goals/${encodeURIComponent(goalId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        ...update,
        ...(update.title === undefined ? {} : { title: update.title.trim() }),
        today: todayKey,
      }),
    },
  );

  return response.data;
};

/**
 * Marks a goal done (or undone) for the current period.
 *
 * One endpoint both ways: both directions write the same single field, and the
 * client's cancel/re-arm path for notifications is identical either way.
 */
const setGoalCompletion = async (
  goalId: string,
  completed: boolean,
  todayKey: string = getLocalDateKey(),
) => {
  const response = await request<SavedGoal>(
    `/goals/${encodeURIComponent(goalId)}/completion`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        completed,
        // The server never guesses a timezone; the device tells it which day.
        ...(completed ? { localDate: todayKey } : {}),
        today: todayKey,
      }),
    },
  );

  return response.data;
};

/** Archive / unarchive. Reminders are preserved so unarchiving restores them. */
const setGoalStatus = async (
  goalId: string,
  status: GoalStatus,
  todayKey: string = getLocalDateKey(),
) => {
  const response = await request<SavedGoal>(
    `/goals/${encodeURIComponent(goalId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, today: todayKey }),
    },
  );

  return response.data;
};

/** Permanent removal is intentionally limited to archived goals by the server. */
const deleteGoal = async (goalId: string) => {
  await request<Record<string, never>>(`/goals/${encodeURIComponent(goalId)}`, {
    method: 'DELETE',
  });
};

const getGoalSuggestions = async (journalId: string) => {
  const response = await request<{
    journalId: string;
    suggestions: GoalSuggestion[];
  }>('/goals/suggestions', {
    method: 'POST',
    body: JSON.stringify({ journalId }),
  });

  return response.data;
};

export {
  createGoal,
  deleteGoal,
  getGoals,
  getGoalSuggestions,
  setGoalCompletion,
  setGoalStatus,
  updateGoal,
};
