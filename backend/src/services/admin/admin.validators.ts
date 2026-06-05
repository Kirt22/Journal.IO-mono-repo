import { z } from "zod";

const getHomeOfferConfigSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export { getHomeOfferConfigSchema };
