import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  RepeatFrequency,
  TriggerType,
  type TimestampTrigger,
} from "@notifee/react-native";
import { Platform } from "react-native";
import type { Reminder } from "./remindersService";
import type { InsightsAiAnalysisCollecting } from "./insightsService";

const REMINDER_CHANNEL_ID = "journal-daily-reminders";
const PRIMARY_PREFIX = "journal-daily-reminder";
const WEEKLY_AI_PREFIX = "journal-weekly-ai-nudge";
const DEFAULT_REMINDER_BODY =
  "Take a moment to reflect on your day. Keep your streak going.";
const ONBOARDING_REMINDER_TIMES: Record<string, string> = {
  morning: "08:00",
  afternoon: "14:00",
  evening: "20:00",
};

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

const formatReminderTitle = (time: string) => {
  const { hour, minute } = parseTime(time);
  const period = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 || 12;

  return `${normalizedHour}:${String(minute).padStart(2, "0")} ${period} reminder`;
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
  const notificationIds = ALL_WEEKDAYS.map(weekday =>
    buildNotificationId(PRIMARY_PREFIX, weekday)
  );

  await notifee.cancelTriggerNotifications(notificationIds);
};

const WEEKLY_AI_NUDGE_IDS = ["early", "mid", "last"].map(label =>
  buildNotificationId(WEEKLY_AI_PREFIX, label === "early" ? 1 : label === "mid" ? 3 : 5)
);

const cancelWeeklyInsightNotifications = async () => {
  await notifee.cancelTriggerNotifications(WEEKLY_AI_NUDGE_IDS);
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

const scheduleOneOffNotification = async ({
  notificationId,
  timestamp,
  title,
  body,
}: {
  notificationId: string;
  timestamp: number;
  title: string;
  body: string;
}) => {
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp,
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
  reminder: Pick<Reminder, "enabled" | "time" | "includeWeekends">,
  options?: {
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
      title: formatReminderTitle(reminder.time),
      body: DEFAULT_REMINDER_BODY,
      skipToday: options?.skipToday,
    });
  }
};

const getTimestampForDateKey = (dateKey: string, hour: number, minute = 0) => {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Date(year || 1970, (month || 1) - 1, day || 1, hour, minute, 0, 0).getTime();
};

const syncWeeklyInsightNotifications = async (
  collecting: InsightsAiAnalysisCollecting | null
) => {
  await ensureReminderChannel();
  await cancelWeeklyInsightNotifications();

  if (!collecting || collecting.progress.activeDays > 0) {
    return;
  }

  const permissionGranted = await getReminderPermissionGranted();

  if (!permissionGranted) {
    return;
  }

  const now = Date.now();
  const nudgeSchedule = [
    {
      id: WEEKLY_AI_NUDGE_IDS[0],
      dateKey: collecting.window.startDate,
      hour: 19,
      title: "Start this week's AI read",
      body: "A short entry today is enough to start building your first weekly analysis.",
    },
    {
      id: WEEKLY_AI_NUDGE_IDS[1],
      dateKey: collecting.window.startDate,
      hour: 19,
      title: "Still time to give this week some shape",
      body: "Two or three honest minutes can start turning this week into a real pattern read.",
    },
    {
      id: WEEKLY_AI_NUDGE_IDS[2],
      dateKey: collecting.window.endDate,
      hour: 19,
      title: "Last call for this week's insight",
      body: "Drop one entry before the week closes so Journal.IO has something real to work with.",
    },
  ].map((item, index) => ({
    ...item,
    timestamp:
      index === 0
        ? getTimestampForDateKey(collecting.window.startDate, item.hour, 30)
        : index === 1
          ? getTimestampForDateKey(
              collecting.window.startDate,
              item.hour,
              30
            ) +
            2 * 86400000
          : getTimestampForDateKey(collecting.window.endDate, item.hour, 30),
  }));

  for (const nudge of nudgeSchedule) {
    if (nudge.timestamp <= now) {
      continue;
    }

    await scheduleOneOffNotification({
      notificationId: nudge.id,
      timestamp: nudge.timestamp,
      title: nudge.title,
      body: nudge.body,
    });
  }
};

const syncOnboardingReminderPreference = async (preference?: string | null) => {
  const normalizedPreference = preference?.trim().toLowerCase() || "";

  if (!normalizedPreference || normalizedPreference === "none") {
    await cancelReminderNotifications();
    return;
  }

  const time = ONBOARDING_REMINDER_TIMES[normalizedPreference];

  if (!time) {
    return;
  }

  const permissionGranted = await getReminderPermissionGranted();

  if (!permissionGranted) {
    await cancelReminderNotifications();
    return;
  }

  await syncReminderNotifications({
    enabled: true,
    time,
    includeWeekends: true,
  });
};

const requestAndSyncOnboardingReminderPreference = async (
  preference?: string | null
) => {
  const normalizedPreference = preference?.trim().toLowerCase() || "";

  if (!normalizedPreference || normalizedPreference === "none") {
    await cancelReminderNotifications();
    return;
  }

  const permissionGranted = await requestReminderPermission();

  if (!permissionGranted) {
    await cancelReminderNotifications();
    return;
  }

  await syncOnboardingReminderPreference(normalizedPreference);
};

export {
  cancelReminderNotifications,
  cancelWeeklyInsightNotifications,
  getDefaultReminderTimezone,
  getReminderPermissionGranted,
  requestReminderPermission,
  requestAndSyncOnboardingReminderPreference,
  syncOnboardingReminderPreference,
  syncReminderNotifications,
  syncWeeklyInsightNotifications,
};
