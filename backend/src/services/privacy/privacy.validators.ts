import { z } from "zod";

const exportPrivacyDataSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const deletePrivacyAccountSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updateAiOptOutSchema = z.object({
  body: z.object({
    aiOptOut: z.boolean(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export {
  deletePrivacyAccountSchema,
  exportPrivacyDataSchema,
  updateAiOptOutSchema,
};
