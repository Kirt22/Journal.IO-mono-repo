import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  createGoalController,
  createGoalSuggestionsController,
  deleteGoalController,
  getGoalsController,
  setGoalCompletionController,
  setGoalStatusController,
  updateGoalController,
} from "./goals.controllers";
import {
  createGoalSchema,
  createGoalSuggestionsSchema,
  deleteGoalSchema,
  getGoalsSchema,
  setGoalCompletionSchema,
  setGoalStatusSchema,
  updateGoalSchema,
} from "./goals.validators";

const goalsRouter = Router();

goalsRouter.get(
  "/",
  verifyJwtToken,
  validateRequest(getGoalsSchema),
  getGoalsController
);

goalsRouter.post(
  "/",
  verifyJwtToken,
  validateRequest(createGoalSchema),
  createGoalController
);

// Sub-paths MUST stay registered before the bare "/:goalId" patch route, or
// Express matches "completion"/"status" as a goalId.
goalsRouter.patch(
  "/:goalId/completion",
  verifyJwtToken,
  validateRequest(setGoalCompletionSchema),
  setGoalCompletionController
);

goalsRouter.patch(
  "/:goalId/status",
  verifyJwtToken,
  validateRequest(setGoalStatusSchema),
  setGoalStatusController
);

goalsRouter.patch(
  "/:goalId",
  verifyJwtToken,
  validateRequest(updateGoalSchema),
  updateGoalController
);

goalsRouter.delete(
  "/:goalId",
  verifyJwtToken,
  validateRequest(deleteGoalSchema),
  deleteGoalController
);

goalsRouter.post(
  "/suggestions",
  verifyJwtToken,
  validateRequest(createGoalSuggestionsSchema),
  createGoalSuggestionsController
);

export default goalsRouter;
