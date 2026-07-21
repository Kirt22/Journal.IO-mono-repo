import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  getInsightsAiAnalysisController,
  getInsightsMindMapController,
  getInsightsOverviewController,
} from "./insights.controllers";
import {
  getInsightsAiAnalysisSchema,
  getInsightsMindMapSchema,
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

export default insightsRouter;
