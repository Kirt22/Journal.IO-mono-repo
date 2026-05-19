import { request } from "../utils/apiClient";

type ReminderType = "daily_journal";

type Reminder = {
  reminderId: string;
  type: ReminderType;
  enabled: boolean;
  time: string;
  timezone: string;
  skipIfCompletedToday: boolean;
  includeWeekends: boolean;
  streakWarnings: boolean;
  createdAt: string;
  updatedAt: string;
};

type ReminderListResponse = {
  reminders: Reminder[];
};

type CreateReminderPayload = {
  type?: ReminderType;
  enabled: boolean;
  time: string;
  timezone: string;
  skipIfCompletedToday?: boolean;
  includeWeekends?: boolean;
  streakWarnings?: boolean;
};

type UpdateReminderPayload = Partial<CreateReminderPayload>;

type DeleteReminderResponse = {
  reminderId: string;
};

const ONBOARDING_REMINDER_TIMES: Record<string, string> = {
  morning: "08:00",
  afternoon: "14:00",
  evening: "20:00",
};

const normalizeReminderPreference = (preference?: string | null) =>
  preference?.trim().toLowerCase() || "";

const getReminders = async () => {
  const response = await request<ReminderListResponse>("/reminders", {
    method: "GET",
  });

  return response.data.reminders;
};

const createReminder = async (payload: CreateReminderPayload) => {
  const response = await request<Reminder>("/reminders", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
};

const updateReminder = async (
  reminderId: string,
  payload: UpdateReminderPayload
) => {
  const response = await request<Reminder>(`/reminders/${encodeURIComponent(reminderId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return response.data;
};

const deleteReminder = async (reminderId: string) => {
  const response = await request<DeleteReminderResponse>(
    `/reminders/${encodeURIComponent(reminderId)}`,
    {
      method: "DELETE",
    }
  );

  return response.data;
};

const getPrimaryDailyReminder = async () => {
  const reminders = await getReminders();
  return reminders.find(reminder => reminder.type === "daily_journal") ?? null;
};

const syncOnboardingReminderRecordPreference = async (
  preference: string | null | undefined,
  options: {
    enabled: boolean;
    timezone: string;
  }
) => {
  const normalizedPreference = normalizeReminderPreference(preference);
  const existingReminder = await getPrimaryDailyReminder();

  if (!normalizedPreference || normalizedPreference === "none") {
    if (!existingReminder) {
      return null;
    }

    return updateReminder(existingReminder.reminderId, {
      enabled: false,
      timezone: options.timezone,
    });
  }

  const time = ONBOARDING_REMINDER_TIMES[normalizedPreference];

  if (!time) {
    return existingReminder;
  }

  const payload = {
    enabled: options.enabled,
    time,
    timezone: options.timezone,
    skipIfCompletedToday: true,
    includeWeekends: true,
    streakWarnings: true,
  };

  if (existingReminder) {
    return updateReminder(existingReminder.reminderId, payload);
  }

  return createReminder({
    type: "daily_journal",
    ...payload,
  });
};

export {
  createReminder,
  deleteReminder,
  getPrimaryDailyReminder,
  getReminders,
  syncOnboardingReminderRecordPreference,
  updateReminder,
};
export type {
  CreateReminderPayload,
  Reminder,
  ReminderListResponse,
  ReminderType,
  UpdateReminderPayload,
};
