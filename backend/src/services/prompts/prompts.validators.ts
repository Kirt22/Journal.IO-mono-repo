import { z } from "zod";

const getWritingPromptsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export { getWritingPromptsSchema };
