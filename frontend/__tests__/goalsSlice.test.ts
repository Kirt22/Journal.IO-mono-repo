/**
 * @format
 */

jest.mock('../src/services/goalsService', () => ({
  getGoals: jest.fn(),
  createGoal: jest.fn(),
  deleteGoal: jest.fn(),
  updateGoal: jest.fn(),
  setGoalCompletion: jest.fn(),
  setGoalStatus: jest.fn(),
  getGoalSuggestions: jest.fn(),
}));

jest.mock('../src/services/goalRemindersService', () => ({
  syncGoalReminderNotifications: jest.fn(async () => undefined),
  cancelAllGoalReminders: jest.fn(async () => undefined),
}));

import {
  createGoalsSlice,
  createInitialGoalsSliceState,
  selectArchivedGoals,
  selectCompletedGoals,
  selectTodoGoals,
  type GoalsSliceState,
} from '../src/store/slices/goalsSlice';
import {
  createGoal,
  deleteGoal,
  getGoals,
  setGoalCompletion,
  setGoalStatus,
  updateGoal,
} from '../src/services/goalsService';
import { syncGoalReminderNotifications } from '../src/services/goalRemindersService';
import { getLocalDateKey } from '../src/utils/goalPeriod';
import type { SavedGoal } from '../src/services/goalsService';

const mockGetGoals = getGoals as jest.MockedFunction<typeof getGoals>;
const mockCreateGoal = createGoal as jest.MockedFunction<typeof createGoal>;
const mockDeleteGoal = deleteGoal as jest.MockedFunction<typeof deleteGoal>;
const mockUpdateGoal = updateGoal as jest.MockedFunction<typeof updateGoal>;
const mockSetGoalCompletion = setGoalCompletion as jest.MockedFunction<
  typeof setGoalCompletion
>;
const mockSetGoalStatus = setGoalStatus as jest.MockedFunction<
  typeof setGoalStatus
>;
const mockSync = syncGoalReminderNotifications as jest.MockedFunction<
  typeof syncGoalReminderNotifications
>;

const makeGoal = (
  overrides: Partial<SavedGoal> & { id: string },
): SavedGoal => ({
  title: `Goal ${overrides.id}`,
  description: null,
  icon: 'target',
  iconSource: 'fixed',
  frequency: 'daily',
  status: 'active',
  reminderEnabled: false,
  reminderTime: null,
  lastCompletedLocalDate: null,
  isCompletedForPeriod: false,
  createdAt: '2026-08-04T09:00:00.000Z',
  updatedAt: '2026-08-04T09:00:00.000Z',
  ...overrides,
});

/**
 * A minimal stand-in for Zustand's set/get so the slice can be exercised without
 * mounting the whole app store.
 */
const createHarness = () => {
  let state = createInitialGoalsSliceState() as GoalsSliceState;

  const set = (updater: unknown) => {
    const patch =
      typeof updater === 'function'
        ? (updater as (current: unknown) => object)(state)
        : updater;

    state = { ...state, ...(patch as object) } as GoalsSliceState;
  };

  const get = () => state;

  state = {
    ...state,
    ...createGoalsSlice(set as never, get as never),
  } as GoalsSliceState;

  return { get: () => state };
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('loadGoals hydrates, sorts newest first, and resyncs reminders', async () => {
  mockGetGoals.mockResolvedValue([
    makeGoal({ id: 'older', createdAt: '2026-01-01T00:00:00.000Z' }),
    makeGoal({ id: 'newer', createdAt: '2026-02-01T00:00:00.000Z' }),
  ]);

  const harness = createHarness();
  await harness.get().loadGoals();

  expect(harness.get().goals.map(goal => goal.id)).toEqual(['newer', 'older']);
  expect(harness.get().hasHydratedGoals).toBe(true);
  expect(harness.get().isLoadingGoals).toBe(false);
  expect(harness.get().goalsError).toBeNull();
  expect(mockGetGoals).toHaveBeenCalledWith(getLocalDateKey());
  expect(mockSync).toHaveBeenCalledTimes(1);
});

test('loadGoals surfaces an error without wiping what is already shown', async () => {
  mockGetGoals.mockResolvedValueOnce([makeGoal({ id: 'g1' })]);

  const harness = createHarness();
  await harness.get().loadGoals();

  mockGetGoals.mockRejectedValueOnce(new Error('offline'));
  await harness.get().loadGoals();

  expect(harness.get().goalsError).toBe("We couldn't load your goals.");
  expect(harness.get().goals).toHaveLength(1);
});

test('setGoalCompleted updates optimistically then reconciles with the server', async () => {
  mockGetGoals.mockResolvedValue([makeGoal({ id: 'g1' })]);
  const harness = createHarness();
  await harness.get().loadGoals();

  const todayKey = getLocalDateKey();
  let observedDuringRequest: SavedGoal | undefined;

  mockSetGoalCompletion.mockImplementation(async () => {
    // Captured mid-flight: the tick must already read as done.
    observedDuringRequest = harness.get().goals[0];

    return makeGoal({
      id: 'g1',
      isCompletedForPeriod: true,
      lastCompletedLocalDate: todayKey,
      updatedAt: '2026-08-05T21:00:00.000Z',
    });
  });

  await harness.get().setGoalCompleted('g1', true);

  expect(observedDuringRequest?.isCompletedForPeriod).toBe(true);
  expect(observedDuringRequest?.lastCompletedLocalDate).toBe(todayKey);
  expect(harness.get().goals[0]?.updatedAt).toBe('2026-08-05T21:00:00.000Z');
  expect(mockSetGoalCompletion).toHaveBeenCalledWith('g1', true, todayKey);
});

test('setGoalCompleted rolls back and reports when the request fails', async () => {
  mockGetGoals.mockResolvedValue([makeGoal({ id: 'g1' })]);
  const harness = createHarness();
  await harness.get().loadGoals();
  mockSync.mockClear();

  mockSetGoalCompletion.mockRejectedValue(new Error('offline'));
  await harness.get().setGoalCompleted('g1', true);

  expect(harness.get().goals[0]?.isCompletedForPeriod).toBe(false);
  expect(harness.get().goals[0]?.lastCompletedLocalDate).toBeNull();
  expect(harness.get().goalsError).toBe(
    "We couldn't update that goal. Please try again.",
  );
  // Still resynced: the rollback must leave notifications matching state.
  expect(mockSync).toHaveBeenCalledTimes(1);
});

test('every mutation resyncs reminders exactly once', async () => {
  mockGetGoals.mockResolvedValue([makeGoal({ id: 'g1' })]);
  const harness = createHarness();
  await harness.get().loadGoals();

  mockCreateGoal.mockResolvedValue(makeGoal({ id: 'g2' }));
  mockUpdateGoal.mockResolvedValue(makeGoal({ id: 'g1', title: 'Renamed' }));
  mockSetGoalCompletion.mockResolvedValue(
    makeGoal({ id: 'g1', isCompletedForPeriod: true }),
  );
  mockSetGoalStatus.mockResolvedValue(
    makeGoal({ id: 'g1', status: 'archived' }),
  );
  mockDeleteGoal.mockResolvedValue(undefined);

  const mutations: Array<() => Promise<unknown>> = [
    () => harness.get().createGoalDraft({ title: 'New goal' }),
    () => harness.get().updateGoalDraft('g1', { title: 'Renamed' }),
    () => harness.get().setGoalCompleted('g1', true),
    () => harness.get().setGoalArchived('g1', true),
    () => harness.get().deleteArchivedGoal('g1'),
  ];

  for (const mutate of mutations) {
    mockSync.mockClear();
    await mutate();
    expect(mockSync).toHaveBeenCalledTimes(1);
  }
});

test('setGoalArchived flips status optimistically and rolls back on failure', async () => {
  mockGetGoals.mockResolvedValue([makeGoal({ id: 'g1' })]);
  const harness = createHarness();
  await harness.get().loadGoals();

  mockSetGoalStatus.mockRejectedValue(new Error('offline'));
  await harness.get().setGoalArchived('g1', true);

  expect(harness.get().goals[0]?.status).toBe('active');
  expect(harness.get().goalsError).toBe(
    "We couldn't update that goal. Please try again.",
  );
});

test('deleteArchivedGoal removes the confirmed server goal and resyncs reminders', async () => {
  mockGetGoals.mockResolvedValue([makeGoal({ id: 'g1', status: 'archived' })]);
  mockDeleteGoal.mockResolvedValue(undefined);

  const harness = createHarness();
  await harness.get().loadGoals();
  mockSync.mockClear();

  const deleted = await harness.get().deleteArchivedGoal('g1');

  expect(deleted).toBe(true);
  expect(mockDeleteGoal).toHaveBeenCalledWith('g1');
  expect(harness.get().goals).toHaveLength(0);
  expect(mockSync).toHaveBeenCalledTimes(1);
});

test('deleteArchivedGoal preserves the goal and reports a failed request', async () => {
  mockGetGoals.mockResolvedValue([makeGoal({ id: 'g1', status: 'archived' })]);
  mockDeleteGoal.mockRejectedValue(new Error('offline'));

  const harness = createHarness();
  await harness.get().loadGoals();
  mockSync.mockClear();

  const deleted = await harness.get().deleteArchivedGoal('g1');

  expect(deleted).toBe(false);
  expect(harness.get().goals).toHaveLength(1);
  expect(harness.get().goalsError).toBe(
    "We couldn't delete that goal. Please try again.",
  );
  expect(mockSync).not.toHaveBeenCalled();
});

test('createGoalDraft reports failure without inventing a local goal', async () => {
  const harness = createHarness();

  mockCreateGoal.mockRejectedValue(new Error('offline'));
  const created = await harness.get().createGoalDraft({ title: 'New goal' });

  expect(created).toBeNull();
  expect(harness.get().goals).toHaveLength(0);
  expect(harness.get().goalsError).toBe(
    "We couldn't save that goal. Please try again.",
  );
});

test('the three section selectors partition the list', () => {
  const goals = [
    makeGoal({ id: 'todo' }),
    makeGoal({ id: 'done', isCompletedForPeriod: true }),
    makeGoal({ id: 'archived', status: 'archived' }),
    // Archived wins over completed: an archived goal never shows under Completed.
    makeGoal({
      id: 'archived-done',
      status: 'archived',
      isCompletedForPeriod: true,
    }),
  ];

  expect(selectTodoGoals(goals).map(goal => goal.id)).toEqual(['todo']);
  expect(selectCompletedGoals(goals).map(goal => goal.id)).toEqual(['done']);
  expect(selectArchivedGoals(goals).map(goal => goal.id)).toEqual([
    'archived',
    'archived-done',
  ]);
});
