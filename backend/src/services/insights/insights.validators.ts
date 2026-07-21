import { z } from "zod";

const getInsightsOverviewSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
  headers: z.object({}).passthrough().optional(),
});

const getInsightsAiAnalysisSchema = z.object({
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

const getInsightsMindMapSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    range: z.enum(["latest_week", "all_time"]),
  }),
  params: z.object({}).optional(),
  headers: z
    .object({
      "x-client-timezone": z.string().trim().min(1).max(128).optional(),
    })
    .passthrough()
    .optional(),
});

export {
  getInsightsOverviewSchema,
  getInsightsAiAnalysisSchema,
  getInsightsMindMapSchema,
};
