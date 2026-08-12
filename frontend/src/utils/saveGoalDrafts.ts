import { useAppStore } from '../store/appStore';
import type { GoalDraft, SavedGoal } from '../services/goalsService';

/**
 * Persists accepted AI goal suggestions through the goals store rather than the
 * raw service, so they land in `state.goals` and get their reminders scheduled
 * exactly like a goal added from the Home card. Saving straight through
 * `goalsService.createGoal` skips `applyServerGoal` + `resyncReminders`, which
 * is how AI goals ended up invisible to the rest of the app.
 *
 * Sequential on purpose: each create resyncs reminders off the current store
 * state, so overlapping writes would race.
 */
export const saveGoalDrafts = async (drafts: GoalDraft[]) => {
  const { createGoalDraft } = useAppStore.getState();
  const saved: SavedGoal[] = [];

  for (const draft of drafts) {
    const created = await createGoalDraft(draft);

    // The store action reports failure by returning null, so surface it as a
    // rejection for callers that show their own error copy.
    if (!created) {
      throw new Error('Unable to save goal');
    }

    saved.push(created);
  }

  return saved;
};
