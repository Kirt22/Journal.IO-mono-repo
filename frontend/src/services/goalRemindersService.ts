import notifee, {
  AndroidImportance,
  TriggerType,
  type TimestampTrigger,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { getGoalIconEmoji } from '../constants/goalIcons';
import { getLocalDateKey, isGoalDoneForPeriod } from '../utils/goalPeriod';
import {
  getReminderPermissionGranted,
  parseTime,
} from './reminderNotificationsService';
import type { SavedGoal } from './goalsService';

/**
 * Per-goal local reminders.
 *
 * WHY DISCRETE TRIGGERS, NOT REPEATING ONES
 * A repeating trigger cannot be conditional. On iOS notifee maps
 * `TimestampTrigger + repeatFrequency` onto a `UNCalendarNotificationTrigger`
 * built from only the matching calendar components, so the date part of the
 * timestamp is thrown away — there is no way to express "every day at 21:00
 * EXCEPT today, because it's already done". So each occurrence is scheduled as
 * its own one-shot trigger over a short rolling horizon, and the whole set is
 * recomputed after every mutation.
 *
 * The tradeoff, stated plainly: if the user does not open the app for longer
 * than the horizon, goal reminders stop until they next open it. That is
 * unavoidable for conditional local scheduling — the server cannot evaluate
 * "done today" without timezone data it does not have.
 */

const GOAL_REMINDER_CHANNEL_ID = 'journal-goal-reminders';
const GOAL_REMINDER_PREFIX = 'journal-goal-reminder';

/**
 * iOS caps *pending* notification requests at 64 app-wide. Existing usage is 11
 * (7 daily-journal weeklies + up to 3 weekly AI nudges + 1 trial-ending), so 24
 * keeps ~29 requests of headroom for future features.
 */
const GOAL_REMINDER_BUDGET = 24;
const MAX_OCCURRENCES_PER_GOAL = 4;

const DEFAULT_REMINDER_BODY = 'A small step you chose. No pressure.';

type GoalReminderCandidate = Pick<
  SavedGoal,
  | 'id'
  | 'title'
  | 'description'
  | 'icon'
  | 'frequency'
  | 'status'
  | 'reminderEnabled'
  | 'reminderTime'
  | 'lastCompletedLocalDate'
  | 'createdAt'
>;

/**
 * A fixed, enumerable id space. Indexing by occurrence (not by date) means
 * `cancelGoalReminders` can clear a goal without first discovering what is
 * pending — a date suffix would orphan ids on every time change.
 */
const buildGoalNotificationId = (goalId: string, occurrenceIndex: number) =>
  `${GOAL_REMINDER_PREFIX}-${goalId}-${occurrenceIndex}`;

const isGoalReminderId = (id: string) => id.startsWith(`${GOAL_REMINDER_PREFIX}-`);

const ensureGoalReminderChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }

  // Its own channel so a user can mute goal nudges without losing the daily
  // journal reminder.
  await notifee.createChannel({
    id: GOAL_REMINDER_CHANNEL_ID,
    name: 'Goal reminders',
    importance: AndroidImportance.DEFAULT,
  });
};

const listAllGoalReminderIds = (goalId: string) =>
  Array.from({ length: MAX_OCCURRENCES_PER_GOAL }, (_, index) =>
    buildGoalNotificationId(goalId, index),
  );

const cancelGoalReminders = async (goalId: string) => {
  await notifee.cancelTriggerNotifications(listAllGoalReminderIds(goalId));
};

/** Clears every goal reminder. Called on sign-out — these name goals by title. */
const cancelAllGoalReminders = async () => {
  try {
    const pending = await notifee.getTriggerNotificationIds();
    const goalIds = (pending || []).filter(isGoalReminderId);

    if (goalIds.length > 0) {
      await notifee.cancelTriggerNotifications(goalIds);
    }
  } catch {
    // Nothing actionable — a stale local notification is not worth surfacing.
  }
};

const isReminderCandidate = (goal: GoalReminderCandidate) =>
  goal.status === 'active' &&
  goal.reminderEnabled === true &&
  Boolean(goal.reminderTime) &&
  // `as_needed` has no cadence to generate occurrences from, and it completes
  // permanently — a reminder for it is incoherent, so the sheet hides the
  // controls and the scheduler skips it.
  goal.frequency !== 'as_needed';

const atTimeOnDay = (day: Date, time: string) => {
  const { hour, minute } = parseTime(time);
  const target = new Date(day);

  target.setHours(hour, minute, 0, 0);

  return target;
};

/**
 * The next `MAX_OCCURRENCES_PER_GOAL` times this goal should fire, skipping any
 * period it is already done for.
 *
 * Future completion is unknowable, so in practice this means "skip today if it
 * is already done today" — which is exactly the requirement.
 */
const buildOccurrences = (
  goal: GoalReminderCandidate,
  nowMs: number,
): number[] => {
  const reminderTime = goal.reminderTime;

  if (!reminderTime) {
    return [];
  }

  const occurrences: number[] = [];
  const cursor = new Date(nowMs);

  cursor.setHours(0, 0, 0, 0);

  if (goal.frequency === 'weekly') {
    // Anchor to the weekday the goal was created on: no extra schema field, and
    // it reads naturally ("you set this on a Tuesday, you get nudged Tuesdays").
    const anchorWeekday = new Date(goal.createdAt).getDay();
    const daysUntilAnchor = (anchorWeekday - cursor.getDay() + 7) % 7;

    cursor.setDate(cursor.getDate() + daysUntilAnchor);

    for (
      let index = 0;
      index < MAX_OCCURRENCES_PER_GOAL * 2 &&
      occurrences.length < MAX_OCCURRENCES_PER_GOAL;
      index += 1
    ) {
      const candidate = atTimeOnDay(cursor, reminderTime);

      if (
        candidate.getTime() > nowMs &&
        !isGoalDoneForPeriod(goal, getLocalDateKey(candidate))
      ) {
        occurrences.push(candidate.getTime());
      }

      cursor.setDate(cursor.getDate() + 7);
    }

    return occurrences;
  }

  for (
    let index = 0;
    index < MAX_OCCURRENCES_PER_GOAL * 2 &&
    occurrences.length < MAX_OCCURRENCES_PER_GOAL;
    index += 1
  ) {
    const candidate = atTimeOnDay(cursor, reminderTime);

    if (
      candidate.getTime() > nowMs &&
      !isGoalDoneForPeriod(goal, getLocalDateKey(candidate))
    ) {
      occurrences.push(candidate.getTime());
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences;
};

const scheduleGoalOccurrence = async ({
  notificationId,
  timestamp,
  goal,
}: {
  notificationId: string;
  timestamp: number;
  goal: GoalReminderCandidate;
}) => {
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp,
  };

  await notifee.createTriggerNotification(
    {
      id: notificationId,
      title: `${getGoalIconEmoji(goal.icon)} ${goal.title}`,
      body: goal.description || DEFAULT_REMINDER_BODY,
      data: { kind: 'goal-reminder', goalId: goal.id },
      android: {
        channelId: GOAL_REMINDER_CHANNEL_ID,
        pressAction: { id: 'default' },
      },
      ios: {
        foregroundPresentationOptions: {
          badge: true,
          banner: true,
          list: true,
          sound: true,
        },
      },
    },
    trigger,
  );
};

/**
 * Recomputes every pending goal reminder from the current goal list.
 *
 * Never requests permission — that only happens on explicit user intent, when
 * the sheet's reminder toggle is switched on.
 */
const syncGoalReminderNotifications = async (
  goals: GoalReminderCandidate[],
  options?: { nowMs?: number },
) => {
  const nowMs = options?.nowMs ?? Date.now();

  try {
    await ensureGoalReminderChannel();

    if (!(await getReminderPermissionGranted())) {
      await cancelAllGoalReminders();
      return;
    }

    const candidates = (goals || [])
      .filter(isReminderCandidate)
      // Stable ordering so the same input always produces the same schedule.
      .sort(
        (a, b) =>
          (a.reminderTime || '').localeCompare(b.reminderTime || '') ||
          a.createdAt.localeCompare(b.createdAt),
      )
      .slice(0, GOAL_REMINDER_BUDGET);

    const plans = candidates.map(goal => ({
      goal,
      occurrences: buildOccurrences(goal, nowMs),
    }));

    // Round-robin BY OCCURRENCE INDEX, not by goal: pass 0 gives every goal its
    // next occurrence, pass 1 gives every goal its second, and so on. Sorting
    // all occurrences by timestamp and truncating would instead starve a 21:00
    // goal behind an 08:00 goal's *second* occurrence.
    const scheduled: Array<{
      notificationId: string;
      timestamp: number;
      goal: GoalReminderCandidate;
    }> = [];

    for (
      let occurrenceIndex = 0;
      occurrenceIndex < MAX_OCCURRENCES_PER_GOAL &&
      scheduled.length < GOAL_REMINDER_BUDGET;
      occurrenceIndex += 1
    ) {
      for (const plan of plans) {
        if (scheduled.length >= GOAL_REMINDER_BUDGET) {
          break;
        }

        const timestamp = plan.occurrences[occurrenceIndex];

        if (timestamp === undefined) {
          continue;
        }

        scheduled.push({
          notificationId: buildGoalNotificationId(plan.goal.id, occurrenceIndex),
          timestamp,
          goal: plan.goal,
        });
      }
    }

    // Sweep anything previously scheduled that is not in the new set. Clears
    // orphans from deleted goals, changed times and older app versions.
    const keepIds = new Set(scheduled.map(item => item.notificationId));
    const pending = await notifee.getTriggerNotificationIds();
    const staleIds = (pending || []).filter(
      id => isGoalReminderId(id) && !keepIds.has(id),
    );

    if (staleIds.length > 0) {
      await notifee.cancelTriggerNotifications(staleIds);
    }

    for (const item of scheduled) {
      await scheduleGoalOccurrence(item);
    }
  } catch {
    // A failed reminder sync must never break the goal mutation that triggered it.
  }
};

export {
  GOAL_REMINDER_BUDGET,
  MAX_OCCURRENCES_PER_GOAL,
  buildGoalNotificationId,
  cancelAllGoalReminders,
  cancelGoalReminders,
  syncGoalReminderNotifications,
};
