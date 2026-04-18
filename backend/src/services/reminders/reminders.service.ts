import { reminderModel, type IReminder } from "../../schema/reminder.schema";
import type {
  ReminderDeleteResponse,
  ReminderListResponse,
  ReminderResponse,
  ReminderType,
} from "../../types/reminders.types";

type CreateReminderInput = {
  type?: ReminderType;
  enabled: boolean;
  time: string;
  timezone: string;
  skipIfCompletedToday?: boolean;
  includeWeekends?: boolean;
  streakWarnings?: boolean;
};

type UpdateReminderInput = Partial<CreateReminderInput>;

class ReminderConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReminderConflictError";
  }
}

class ReminderNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReminderNotFoundError";
  }
}

const toReminderResponse = (reminder: IReminder): ReminderResponse => {
  const reminderObject = reminder.toObject() as Record<string, any>;

  return {
    reminderId: reminderObject._id.toString(),
    type: reminderObject.type,
    enabled: Boolean(reminderObject.enabled),
    time: reminderObject.time,
    timezone: reminderObject.timezone,
    skipIfCompletedToday: Boolean(reminderObject.skipIfCompletedToday),
    includeWeekends: Boolean(reminderObject.includeWeekends),
    streakWarnings: Boolean(reminderObject.streakWarnings),
    createdAt: new Date(reminderObject.createdAt).toISOString(),
    updatedAt: new Date(reminderObject.updatedAt).toISOString(),
  };
};

const getRemindersForUser = async (userId: string): Promise<ReminderListResponse> => {
  const reminders = await reminderModel.find({ userId }).sort({ createdAt: -1 }).exec();

  return {
    reminders: reminders.map(toReminderResponse),
  };
};

const createReminderForUser = async (
  userId: string,
  input: CreateReminderInput
): Promise<ReminderResponse> => {
  const type = input.type || "daily_journal";
  const existingReminder = await reminderModel.findOne({ userId, type }).exec();

  if (existingReminder) {
    throw new ReminderConflictError("A reminder of this type already exists");
  }

  const reminder = await reminderModel.create({
    userId,
    type,
    enabled: input.enabled,
    time: input.time,
    timezone: input.timezone,
    skipIfCompletedToday: input.skipIfCompletedToday ?? true,
    includeWeekends: input.includeWeekends ?? true,
    streakWarnings: input.streakWarnings ?? true,
  });

  return toReminderResponse(reminder);
};

const updateReminderForUser = async (
  userId: string,
  reminderId: string,
  input: UpdateReminderInput
): Promise<ReminderResponse> => {
  const reminder = await reminderModel
    .findOneAndUpdate(
      { _id: reminderId, userId },
      {
        $set: input,
      },
      {
        new: true,
        runValidators: true,
      }
    )
    .exec();

  if (!reminder) {
    throw new ReminderNotFoundError("Reminder not found");
  }

  return toReminderResponse(reminder);
};

const deleteReminderForUser = async (
  userId: string,
  reminderId: string
): Promise<ReminderDeleteResponse> => {
  const reminder = await reminderModel.findOneAndDelete({
    _id: reminderId,
    userId,
  }).exec();

  if (!reminder) {
    throw new ReminderNotFoundError("Reminder not found");
  }

  return {
    reminderId,
  };
};

export {
  ReminderConflictError,
  ReminderNotFoundError,
  createReminderForUser,
  deleteReminderForUser,
  getRemindersForUser,
  updateReminderForUser,
};
