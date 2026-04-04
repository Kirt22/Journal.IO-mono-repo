import { z } from "zod";

const getCurrentStreakSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const getStreakHistorySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).optional(),
  }),
  params: z.object({}).optional(),
});

export { getCurrentStreakSchema, getStreakHistorySchema };
