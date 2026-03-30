import { Router } from "express";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { getTodayMoodController, logMoodController } from "./mood.controllers";
import { getTodayMoodSchema, logMoodSchema } from "./mood.validators";

const moodRouter: Router = Router();

/**
 * @route   GET /today
 * @desc    Gets the authenticated user's mood check-in for today.
 * @access  Private (Requires JWT authentication)
 */
moodRouter.get(
  "/today",
  verifyJwtToken,
  validateRequest(getTodayMoodSchema),
  getTodayMoodController
);

/**
 * @route   POST /check_in
 * @desc    Creates today's mood check-in if it does not already exist.
 * @access  Private (Requires JWT authentication)
 */
moodRouter.post(
  "/check_in",
  verifyJwtToken,
  validateRequest(logMoodSchema),
  logMoodController
);

export default moodRouter;
