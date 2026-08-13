import { z } from "zod";

const getEntryMindMapSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({
    journalId: z.string().min(1, "Journal ID is required"),
  }),
});

export { getEntryMindMapSchema };
