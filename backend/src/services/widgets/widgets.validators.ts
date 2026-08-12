import { z } from "zod";
import { moodValueSchema } from "../mood/mood.validators";

const installationIdSchema = z.string().trim().min(8).max(128);

const widgetSessionBodySchema = z
  .object({
    platform: z.literal("ios"),
    installationId: installationIdSchema,
  })
  .strict();

const widgetSessionSchema = z.object({
  body: widgetSessionBodySchema,
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const widgetMoodCheckInSchema = z.object({
  body: z
    .object({
      mood: moodValueSchema,
    })
    .strict(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
  headers: z
    .object({
      "x-client-timezone": z.string().trim().min(1).max(128).optional(),
    })
    .passthrough()
    .optional(),
});

export { widgetMoodCheckInSchema, widgetSessionSchema };
