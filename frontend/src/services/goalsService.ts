import { request } from '../utils/apiClient';

export type SavedGoal = {
  id: string;
  title: string;
};

export type GoalSuggestion = {
  title: string;
  description: string;
};

const getGoals = async () => {
  const response = await request<{ goals: SavedGoal[] }>('/goals', {
    method: 'GET',
  });

  return response.data.goals || [];
};

const createGoal = async (title: string) => {
  const response = await request<SavedGoal>('/goals', {
    method: 'POST',
    body: JSON.stringify({ title: title.trim() }),
  });

  return response.data;
};

const deleteGoal = async (goalId: string) => {
  await request<{}>(`/goals/${encodeURIComponent(goalId)}`, {
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

export { createGoal, deleteGoal, getGoals, getGoalSuggestions };
