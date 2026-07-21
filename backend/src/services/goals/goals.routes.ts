import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  createGoalController,
  createGoalSuggestionsController,
  deleteGoalController,
  getGoalsController,
} from "./goals.controllers";
import {
  createGoalSchema,
  createGoalSuggestionsSchema,
  deleteGoalSchema,
  getGoalsSchema,
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
