import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  RepeatFrequency,
  TriggerType,
  type TimestampTrigger,
} from "@notifee/react-native";
import { Platform } from "react-native";
import type { Reminder } from "./remindersService";

const REMINDER_CHANNEL_ID = "journal-daily-reminders";
const PRIMARY_PREFIX = "journal-daily-reminder";
const WARNING_PREFIX = "journal-streak-warning";
const DEFAULT_REMINDER_TITLE = "Time to Journal";
const DEFAULT_REMINDER_BODY =
  "Take a moment to reflect on your day. Keep your streak going.";
const WARNING_REMINDER_TITLE = "Protect Your Streak";
const WARNING_REMINDER_BODY =
  "You are still in reach of today's streak. A short check-in is enough.";

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const isPermissionGranted = (status: AuthorizationStatus) =>
  status === AuthorizationStatus.AUTHORIZED ||
  status === AuthorizationStatus.PROVISIONAL;

const getSelectedWeekdays = (includeWeekends: boolean) =>
  includeWeekends ? [...ALL_WEEKDAYS] : [1, 2, 3, 4, 5];

const buildNotificationId = (prefix: string, weekday: number) =>
  `${prefix}-${weekday}`;

const parseTime = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);

  return {
    hour: Number.isFinite(hour) ? hour : 20,
    minute: Number.isFinite(minute) ? minute : 0,
  };
};

const getWarningTime = (time: string) => {
  const { hour, minute } = parseTime(time);
  const totalMinutes = Math.min(hour * 60 + minute + 90, 22 * 60);
  const nextHour = Math.floor(totalMinutes / 60);
  const nextMinute = totalMinutes % 60;

  return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
};

const getNextWeeklyTimestamp = (
  weekday: number,
  time: string,
  options?: { skipToday?: boolean }
) => {
  const now = new Date();
  const { hour, minute } = parseTime(time);
  const target = new Date(now);
  let daysUntilWeekday = weekday - now.getDay();

  target.setHours(hour, minute, 0, 0);

  const shouldMoveToNextWeek =
    daysUntilWeekday < 0 ||
    (daysUntilWeekday === 0 &&
      (options?.skipToday === true || target.getTime() <= now.getTime()));

  if (shouldMoveToNextWeek) {
    daysUntilWeekday += 7;
  }

  target.setDate(now.getDate() + daysUntilWeekday);
  target.setHours(hour, minute, 0, 0);

  return target.getTime();
};

const getDefaultReminderTimezone = () => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
  return timezone || "UTC";
};

const ensureReminderChannel = async () => {
  if (Platform.OS !== "android") {
    return;
  }

  await notifee.createChannel({
    id: REMINDER_CHANNEL_ID,
    name: "Daily reminders",
    importance: AndroidImportance.HIGH,
  });
};

const requestReminderPermission = async () => {
  const settings = await notifee.requestPermission();
  return isPermissionGranted(settings.authorizationStatus);
};

const getReminderPermissionGranted = async () => {
  const settings = await notifee.getNotificationSettings();
  return isPermissionGranted(settings.authorizationStatus);
};

const cancelReminderNotifications = async () => {
  const notificationIds = ALL_WEEKDAYS.flatMap(weekday => [
    buildNotificationId(PRIMARY_PREFIX, weekday),
    buildNotificationId(WARNING_PREFIX, weekday),
  ]);

  await notifee.cancelTriggerNotifications(notificationIds);
};

const scheduleWeeklyNotification = async ({
  notificationId,
  weekday,
  time,
  title,
  body,
  skipToday,
}: {
  notificationId: string;
  weekday: number;
  time: string;
  title: string;
  body: string;
  skipToday?: boolean;
}) => {
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: getNextWeeklyTimestamp(weekday, time, { skipToday }),
    repeatFrequency: RepeatFrequency.WEEKLY,
  };

  await notifee.createTriggerNotification(
    {
      id: notificationId,
      title,
      body,
      android: {
        channelId: REMINDER_CHANNEL_ID,
        pressAction: { id: "default" },
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
    trigger
  );
};

const syncReminderNotifications = async (
  reminder: Pick<
    Reminder,
    "enabled" | "time" | "includeWeekends" | "streakWarnings"
  >,
  options?: {
    currentStreak?: number;
    skipToday?: boolean;
  }
) => {
  await ensureReminderChannel();
  await cancelReminderNotifications();

  if (!reminder.enabled) {
    return;
  }

  const weekdays = getSelectedWeekdays(reminder.includeWeekends);

  for (const weekday of weekdays) {
    await scheduleWeeklyNotification({
      notificationId: buildNotificationId(PRIMARY_PREFIX, weekday),
      weekday,
      time: reminder.time,
      title: DEFAULT_REMINDER_TITLE,
      body: DEFAULT_REMINDER_BODY,
      skipToday: options?.skipToday,
    });

    if (reminder.streakWarnings && (options?.currentStreak || 0) > 0) {
      await scheduleWeeklyNotification({
        notificationId: buildNotificationId(WARNING_PREFIX, weekday),
        weekday,
        time: getWarningTime(reminder.time),
        title: WARNING_REMINDER_TITLE,
        body: WARNING_REMINDER_BODY,
        skipToday: options?.skipToday,
      });
    }
  }
};

const sendTestReminderNotification = async (time: string) => {
  await ensureReminderChannel();

  await notifee.displayNotification({
    title: DEFAULT_REMINDER_TITLE,
    body: `This is a test reminder for your ${time} journaling prompt.`,
    android: {
      channelId: REMINDER_CHANNEL_ID,
      pressAction: { id: "default" },
    },
    ios: {
      foregroundPresentationOptions: {
        badge: true,
        banner: true,
        list: true,
        sound: true,
      },
    },
  });
};

export {
  cancelReminderNotifications,
  getDefaultReminderTimezone,
  getReminderPermissionGranted,
  requestReminderPermission,
  sendTestReminderNotification,
  syncReminderNotifications,
};
