import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  getInsightsAiAnalysisController,
  getInsightsMindMapController,
  getInsightsMindMapRegionSeriesController,
  getInsightsOverviewController,
} from "./insights.controllers";
import {
  getInsightsAiAnalysisSchema,
  getInsightsMindMapSchema,
  getInsightsMindMapRegionSeriesSchema,
  getInsightsOverviewSchema,
} from "./insights.validators";

const insightsRouter: Router = Router();

insightsRouter.get(
  "/overview",
  verifyJwtToken,
  validateRequest(getInsightsOverviewSchema),
  getInsightsOverviewController
);

insightsRouter.get(
  "/ai-analysis",
  verifyJwtToken,
  validateRequest(getInsightsAiAnalysisSchema),
  getInsightsAiAnalysisController
);

insightsRouter.get(
  "/mind-map",
  verifyJwtToken,
  validateRequest(getInsightsMindMapSchema),
  getInsightsMindMapController
);

insightsRouter.get(
  "/mind-map/region/:regionId/series",
  verifyJwtToken,
  validateRequest(getInsightsMindMapRegionSeriesSchema),
  getInsightsMindMapRegionSeriesController
);

export default insightsRouter;
