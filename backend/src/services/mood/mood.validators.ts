import { z } from "zod";

const moodValueSchema = z.enum(["amazing", "good", "okay", "bad", "terrible"]);

const getTodayMoodSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
  headers: z
    .object({
      "x-client-timezone": z.string().trim().min(1).max(128).optional(),
    })
    .passthrough()
    .optional(),
});

const getMoodHistorySchema = z.object({
  body: z.object({}).optional(),
  query: z
    .object({
      days: z.coerce.number().int().min(1).max(31).optional(),
    })
    .optional(),
  params: z.object({}).optional(),
  headers: z
    .object({
      "x-client-timezone": z.string().trim().min(1).max(128).optional(),
    })
    .passthrough()
    .optional(),
});

const logMoodSchema = z.object({
  body: z.object({
    mood: moodValueSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
  headers: z
    .object({
      "x-client-timezone": z.string().trim().min(1).max(128).optional(),
    })
    .passthrough()
    .optional(),
});

export {
  getMoodHistorySchema,
  getTodayMoodSchema,
  logMoodSchema,
  moodValueSchema,
};
