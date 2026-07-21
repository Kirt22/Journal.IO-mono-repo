export type GoalRecord = {
  id: string;
  title: string;
};

export type GoalsListResponse = {
  goals: GoalRecord[];
};

export type CreateGoalInput = {
  userId: string;
  title: string;
};

export type DeleteGoalInput = {
  userId: string;
  goalId: string;
};

export type GoalSuggestion = {
  title: string;
  description: string;
};

export type GoalSuggestionsInput = {
  userId: string;
  journalId: string;
};

export type GoalSuggestionsResponse = {
  journalId: string;
  suggestions: GoalSuggestion[];
};
