import { z } from "zod";

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const reminderTypeSchema = z.enum(["daily_journal"]);

const createReminderSchema = z.object({
  body: z.object({
    type: reminderTypeSchema.optional(),
    enabled: z.boolean(),
    time: z.string().regex(TIME_REGEX, "Time must use HH:MM format"),
    timezone: z.string().min(1).max(128),
    skipIfCompletedToday: z.boolean().optional(),
    includeWeekends: z.boolean().optional(),
    streakWarnings: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const getRemindersSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updateReminderSchema = z.object({
  body: z
    .object({
      type: reminderTypeSchema.optional(),
      enabled: z.boolean().optional(),
      time: z.string().regex(TIME_REGEX, "Time must use HH:MM format").optional(),
      timezone: z.string().min(1).max(128).optional(),
      skipIfCompletedToday: z.boolean().optional(),
      includeWeekends: z.boolean().optional(),
      streakWarnings: z.boolean().optional(),
    })
    .refine(value => Object.keys(value).length > 0, {
      message: "At least one reminder field is required",
    }),
  query: z.object({}).optional(),
  params: z.object({
    reminderId: z.string().min(1),
  }),
});

const deleteReminderSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({
    reminderId: z.string().min(1),
  }),
});

export {
  createReminderSchema,
  deleteReminderSchema,
  getRemindersSchema,
  updateReminderSchema,
};
