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
  GoalNotArchivedError,
  GoalSuggestionsPremiumRequiredError,
  setGoalCompletion,
  setGoalStatus,
  updateGoal,
} from "./goals.service";

/** The client's local date, used to derive per-period completion server-side. */
const readTodayKey = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;

const getGoalsController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const goals = await getGoals({
      userId,
      today: readTodayKey(req.query.today),
    });

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
      description: req.body.description,
      icon: req.body.icon,
      iconSource: req.body.iconSource,
      frequency: req.body.frequency,
      reminderEnabled: req.body.reminderEnabled,
      reminderTime: req.body.reminderTime,
      today: readTodayKey(req.body.today),
    });

    return res.status(201).json(apiResponse(true, "Your goal has been saved.", goal));
  } catch (error) {
    console.error("Error in createGoalController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const updateGoalController = async (
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

    const goal = await updateGoal({
      userId,
      goalId,
      title: req.body.title,
      description: req.body.description,
      icon: req.body.icon,
      iconSource: req.body.iconSource,
      frequency: req.body.frequency,
      reminderEnabled: req.body.reminderEnabled,
      reminderTime: req.body.reminderTime,
      today: readTodayKey(req.body.today),
    });

    if (!goal) {
      return res.status(404).json(apiResponse(false, notFoundMessage("goal"), {}));
    }

    return res.status(200).json(apiResponse(true, "Your goal has been updated.", goal));
  } catch (error) {
    console.error("Error in updateGoalController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const setGoalCompletionController = async (
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

    const completed = req.body.completed === true;
    const goal = await setGoalCompletion({
      userId,
      goalId,
      completed,
      localDate: readTodayKey(req.body.localDate),
      today: readTodayKey(req.body.today),
    });

    if (!goal) {
      return res.status(404).json(apiResponse(false, notFoundMessage("goal"), {}));
    }

    return res
      .status(200)
      .json(
        apiResponse(
          true,
          completed ? "Nice — that's done for now." : "Your goal is back on the list.",
          goal
        )
      );
  } catch (error) {
    console.error("Error in setGoalCompletionController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const setGoalStatusController = async (
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

    const goal = await setGoalStatus({
      userId,
      goalId,
      status: req.body.status,
      today: readTodayKey(req.body.today),
    });

    if (!goal) {
      return res.status(404).json(apiResponse(false, notFoundMessage("goal"), {}));
    }

    return res.status(200).json(apiResponse(true, "Your goal has been updated.", goal));
  } catch (error) {
    console.error("Error in setGoalStatusController:", error);
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
    if (error instanceof GoalNotArchivedError) {
      return res.status(409).json(
        apiResponse(false, error.message, {}, {
          error: { code: "GOAL_NOT_ARCHIVED" },
        })
      );
    }

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

    console.error("Error in createGoalSuggestionsController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export {
  createGoalController,
  createGoalSuggestionsController,
  deleteGoalController,
  getGoalsController,
  setGoalCompletionController,
  setGoalStatusController,
  updateGoalController,
};
