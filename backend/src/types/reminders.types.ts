export type ReminderType = "daily_journal";

export type ReminderResponse = {
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

export type ReminderListResponse = {
  reminders: ReminderResponse[];
};

export type ReminderDeleteResponse = {
  reminderId: string;
};
