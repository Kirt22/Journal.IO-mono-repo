import { z } from "zod";
import { GOAL_ICON_KEYS } from "../../helpers/goalIcons.helpers";
import { GOAL_FREQUENCIES } from "../../helpers/goalPeriod.helpers";

/** The client's local date, "YYYY-MM-DD". */
const localDateKey = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

/** 24-hour "HH:mm". */
const reminderTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected a HH:mm time");

const goalId = z.object({
  goalId: z.string().trim().min(1, "Goal ID is required"),
});

const goalTitle = z.string().trim().min(1, "Goal title is required").max(120);
const goalDescription = z.string().trim().max(200).nullable();

const goalDraftFields = {
  description: goalDescription.optional(),
  icon: z.enum(GOAL_ICON_KEYS).optional(),
  iconSource: z.enum(["automatic", "fixed"]).optional(),
  frequency: z.enum(GOAL_FREQUENCIES).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderTime: reminderTime.nullable().optional(),
};

const getGoalsSchema = z.object({
  body: z.object({}).optional(),
  // The client sends its local date so the server never has to guess a timezone.
  query: z.object({ today: localDateKey.optional() }).optional(),
  params: z.object({}).optional(),
});

const createGoalSchema = z.object({
  body: z
    .object({
      title: goalTitle,
      ...goalDraftFields,
      today: localDateKey.optional(),
    })
    .refine((body) => body.iconSource !== "fixed" || Boolean(body.icon), {
      message: "icon is required when iconSource is fixed",
      path: ["icon"],
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updateGoalSchema = z.object({
  body: z
    .object({
      title: goalTitle.optional(),
      ...goalDraftFields,
      today: localDateKey.optional(),
    })
    .refine(
      (body) =>
        Object.keys(body).some(
          (key) => key !== "today" && body[key as keyof typeof body] !== undefined
        ),
      { message: "Provide at least one field to update" }
    )
    .refine(
      (body) => body.iconSource !== "fixed" || Boolean(body.icon),
      {
        message: "icon is required when iconSource is fixed",
        path: ["icon"],
      }
    ),
  query: z.object({}).optional(),
  params: goalId,
});

const setGoalCompletionSchema = z.object({
  body: z
    .object({
      completed: z.boolean(),
      localDate: localDateKey.optional(),
      today: localDateKey.optional(),
    })
    // Marking done requires knowing *which* local day it was done on; clearing
    // does not, because it just nulls the field.
    .refine((body) => !body.completed || Boolean(body.localDate), {
      message: "localDate is required when marking a goal complete",
      path: ["localDate"],
    }),
  query: z.object({}).optional(),
  params: goalId,
});

const setGoalStatusSchema = z.object({
  // Narrowed to the archive lifecycle: "completed" is no longer a status, it is
  // derived per period from the goal's frequency and last completion.
  body: z.object({
    status: z.enum(["active", "archived"]),
    today: localDateKey.optional(),
  }),
  query: z.object({}).optional(),
  params: goalId,
});

const deleteGoalSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: goalId,
});

const createGoalSuggestionsSchema = z.object({
  body: z.object({
    journalId: z.string().trim().min(1, "Journal ID is required"),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export {
  createGoalSchema,
  createGoalSuggestionsSchema,
  deleteGoalSchema,
  getGoalsSchema,
  setGoalCompletionSchema,
  setGoalStatusSchema,
  updateGoalSchema,
};
