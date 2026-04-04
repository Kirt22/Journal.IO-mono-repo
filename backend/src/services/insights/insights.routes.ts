import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  getInsightsAiAnalysisController,
  getInsightsOverviewController,
} from "./insights.controllers";
import {
  getInsightsAiAnalysisSchema,
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

export default insightsRouter;
