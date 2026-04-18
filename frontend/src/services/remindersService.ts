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

export {
  createReminder,
  deleteReminder,
  getPrimaryDailyReminder,
  getReminders,
  updateReminder,
};
export type {
  CreateReminderPayload,
  Reminder,
  ReminderListResponse,
  ReminderType,
  UpdateReminderPayload,
};
