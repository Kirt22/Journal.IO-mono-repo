import { z } from "zod";

/**
 * validateRequest parses { body, query, params, headers } as one object, so
 * every schema is shaped with those top-level keys.
 */

const sessionIdParam = z.object({
  sessionId: z.string().trim().min(1, "Session ID is required"),
});

const cursor = z.string().trim().min(1).max(512);

const listJadeSessionsSchema = z.object({
  body: z.object({}).optional(),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(30).optional(),
      cursor: cursor.optional(),
    })
    .optional(),
  params: z.object({}).optional(),
});

const getJadeSessionSchema = z.object({
  body: z.object({}).optional(),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(50).optional(),
      cursor: cursor.optional(),
    })
    .optional(),
  params: sessionIdParam,
});

const sendJadeMessageSchema = z.object({
  // sessionId is optional: omitting it starts a new conversation, so an
  // abandoned "New chat" tap never leaves an empty session behind.
  body: z.object({
    sessionId: z.string().trim().min(1).max(64).optional(),
    text: z.string().trim().min(1, "Write something first.").max(2000),
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

const deleteJadeSessionSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: sessionIdParam,
});

export {
  deleteJadeSessionSchema,
  getJadeSessionSchema,
  listJadeSessionsSchema,
  sendJadeMessageSchema,
};
