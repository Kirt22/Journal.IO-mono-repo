import { z } from "zod";

const moodValueSchema = z.enum(["amazing", "good", "okay", "bad", "terrible"]);

const getTodayMoodSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const logMoodSchema = z.object({
  body: z.object({
    mood: moodValueSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export { getTodayMoodSchema, logMoodSchema, moodValueSchema };
