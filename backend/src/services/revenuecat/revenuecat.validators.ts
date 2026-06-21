import { z } from "zod";

const revenueCatWebhookHeadersSchema = z.object({
  authorization: z.string().min(1, "Authorization header is required"),
});

const revenueCatWebhookEventSchema = z
  .object({
    id: z.string().trim().min(1).optional().nullable(),
    type: z.string().trim().min(1, "event.type is required"),
    app_id: z.string().trim().min(1).optional().nullable(),
    app_user_id: z.string().trim().min(1).optional().nullable(),
    original_app_user_id: z.string().trim().min(1).optional().nullable(),
    aliases: z.array(z.string().trim().min(1)).optional().default([]),
    transferred_from: z.array(z.string().trim().min(1)).optional().default([]),
    transferred_to: z.array(z.string().trim().min(1)).optional().default([]),
    environment: z.string().trim().min(1).optional().nullable(),
    product_id: z.string().trim().min(1).optional().nullable(),
    entitlement_ids: z.array(z.string().trim().min(1)).optional().nullable(),
    purchased_at_ms: z.number().int().optional().nullable(),
    event_timestamp_ms: z.number().int().optional().nullable(),
    transaction_id: z.union([z.string(), z.number()]).optional().nullable(),
    original_transaction_id: z
      .union([z.string(), z.number()])
      .optional()
      .nullable(),
  })
  .passthrough();

const revenueCatWebhookSchema = z.object({
  headers: revenueCatWebhookHeadersSchema,
  body: z.object({
    api_version: z.string().trim().min(1).optional(),
    event: revenueCatWebhookEventSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export { revenueCatWebhookSchema };
