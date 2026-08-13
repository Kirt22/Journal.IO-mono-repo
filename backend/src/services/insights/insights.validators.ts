import { z } from "zod";
import { REFLECTION_REGION_IDS } from "../../helpers/reflectionMap.helpers";

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
    range: z.enum(["latest_week", "monthly", "all_time"]),
  }),
  params: z.object({}).optional(),
  headers: z
    .object({
      "x-client-timezone": z.string().trim().min(1).max(128).optional(),
    })
    .passthrough()
    .optional(),
});

const getInsightsMindMapRegionSeriesSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    range: z.enum(["latest_week", "monthly", "all_time"]),
  }),
  params: z.object({
    regionId: z.enum(
      REFLECTION_REGION_IDS as [string, ...string[]]
    ),
  }),
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
  getInsightsMindMapRegionSeriesSchema,
};
