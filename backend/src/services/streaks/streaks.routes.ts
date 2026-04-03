import { Router } from "express";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import {
  getCurrentStreakController,
  getStreakHistoryController,
} from "./streaks.controllers";
import {
  getCurrentStreakSchema,
  getStreakHistorySchema,
} from "./streaks.validators";

const streaksRouter = Router();

streaksRouter.get(
  "/current",
  verifyJwtToken,
  validateRequest(getCurrentStreakSchema),
  getCurrentStreakController,
);

streaksRouter.get(
  "/history",
  verifyJwtToken,
  validateRequest(getStreakHistorySchema),
  getStreakHistoryController,
);

export default streaksRouter;
