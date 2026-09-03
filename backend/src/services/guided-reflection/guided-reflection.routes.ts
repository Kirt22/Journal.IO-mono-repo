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
import { authenticatedAiRateLimit } from "../../middleware/security.middleware";

const guidedReflectionRouter = Router();

guidedReflectionRouter.post(
  "/first-summary",
  verifyJwtToken,
  authenticatedAiRateLimit,
  validateRequest(createFirstReflectionSummarySchema),
  createFirstReflectionSummaryController
);

guidedReflectionRouter.post(
  "/go-deeper",
  verifyJwtToken,
  authenticatedAiRateLimit,
  validateRequest(createGuidedReflectionGoDeeperSchema),
  createGuidedReflectionGoDeeperController
);

guidedReflectionRouter.post(
  "/session-analysis",
  verifyJwtToken,
  authenticatedAiRateLimit,
  validateRequest(createGuidedReflectionSessionAnalysisSchema),
  createGuidedReflectionSessionAnalysisController
);

guidedReflectionRouter.post(
  "/goal-suggestions",
  verifyJwtToken,
  authenticatedAiRateLimit,
  validateRequest(createGuidedReflectionGoalSuggestionsSchema),
  createGuidedReflectionGoalSuggestionsController
);

export default guidedReflectionRouter;
