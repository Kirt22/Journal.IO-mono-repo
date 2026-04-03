import { z } from "zod";

const getInsightsOverviewSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const getInsightsAiAnalysisSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export { getInsightsOverviewSchema, getInsightsAiAnalysisSchema };
