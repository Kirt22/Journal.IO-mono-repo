import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  createFirstReflectionSummaryController,
  createGuidedReflectionGoDeeperController,
  createGuidedReflectionGoalSuggestionsController,
  createGuidedReflectionSessionAnalysisController,
} from "./guided-reflection.controllers";
import {
  createFirstReflectionSummarySchema,
  createGuidedReflectionGoDeeperSchema,
  createGuidedReflectionGoalSuggestionsSchema,
  createGuidedReflectionSessionAnalysisSchema,
} from "./guided-reflection.validators";

const guidedReflectionRouter = Router();

guidedReflectionRouter.post(
  "/first-summary",
  verifyJwtToken,
  validateRequest(createFirstReflectionSummarySchema),
  createFirstReflectionSummaryController
);

guidedReflectionRouter.post(
  "/go-deeper",
  verifyJwtToken,
  validateRequest(createGuidedReflectionGoDeeperSchema),
  createGuidedReflectionGoDeeperController
);

guidedReflectionRouter.post(
  "/session-analysis",
  verifyJwtToken,
  validateRequest(createGuidedReflectionSessionAnalysisSchema),
  createGuidedReflectionSessionAnalysisController
);

guidedReflectionRouter.post(
  "/goal-suggestions",
  verifyJwtToken,
  validateRequest(createGuidedReflectionGoalSuggestionsSchema),
  createGuidedReflectionGoalSuggestionsController
);

export default guidedReflectionRouter;
