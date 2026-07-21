import { Request, Response } from "express";
import {
  API_MESSAGES,
  apiResponse,
  notFoundMessage,
} from "../../helpers/commonHelper.helpers";
import {
  createGoal,
  createGoalSuggestions,
  deleteGoal,
  getGoals,
  GoalSuggestionsDisabledError,
  GoalSuggestionsPremiumRequiredError,
} from "./goals.service";

const getGoalsController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const goals = await getGoals(userId);

    return res.status(200).json(apiResponse(true, "Your goals are ready.", goals));
  } catch (error) {
    console.error("Error in getGoalsController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const createGoalController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const goal = await createGoal({
      userId,
      title: req.body.title,
    });

    return res.status(201).json(apiResponse(true, "Your goal has been saved.", goal));
  } catch (error) {
    console.error("Error in createGoalController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const deleteGoalController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const goalId = req.params.goalId;

    if (!goalId) {
      return res.status(400).json(apiResponse(false, "Goal ID is required.", {}));
    }

    const deleted = await deleteGoal({
      userId,
      goalId,
    });

    if (!deleted) {
      return res.status(404).json(apiResponse(false, notFoundMessage("goal"), {}));
    }

    return res.status(200).json(apiResponse(true, "Your goal has been removed.", {}));
  } catch (error) {
    console.error("Error in deleteGoalController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const createGoalSuggestionsController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const suggestions = await createGoalSuggestions({
      userId,
      journalId: req.body.journalId,
    });

    return res
      .status(200)
      .json(apiResponse(true, "Your goal suggestions are ready.", suggestions));
  } catch (error) {
    if (error instanceof GoalSuggestionsPremiumRequiredError) {
      return res.status(403).json(
        apiResponse(false, error.message, {}, {
          error: { code: "PREMIUM_REQUIRED" },
        })
      );
    }

    if (error instanceof GoalSuggestionsDisabledError) {
      return res.status(403).json(
        apiResponse(false, error.message, {}, {
          error: { code: "AI_DISABLED" },
        })
      );
    }

    console.error("Error in createGoalSuggestionsController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export {
  createGoalController,
  createGoalSuggestionsController,
  deleteGoalController,
  getGoalsController,
};
