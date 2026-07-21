import { z } from "zod";

const getGoalsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const createGoalSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, "Goal title is required").max(120),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const deleteGoalSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({
    goalId: z.string().trim().min(1, "Goal ID is required"),
  }),
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
};
