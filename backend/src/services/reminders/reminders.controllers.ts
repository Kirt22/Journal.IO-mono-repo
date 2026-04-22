import type { Request, Response } from "express";
import {
  apiResponse,
  API_MESSAGES,
  notFoundMessage,
} from "../../helpers/commonHelper.helpers";
import {
  ReminderConflictError,
  ReminderNotFoundError,
  createReminderForUser,
  deleteReminderForUser,
  getRemindersForUser,
  updateReminderForUser,
} from "./reminders.service";

type AuthenticatedRequest = Request & {
  user?: {
    _id?: {
      toString(): string;
    };
  };
};

const getRemindersController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const reminders = await getRemindersForUser(userId);
    return res.status(200).json(apiResponse(true, "Your reminders are ready.", reminders));
  } catch (error) {
    console.error("Error in getRemindersController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const createReminderController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const reminder = await createReminderForUser(userId, req.body);
    return res.status(201).json(apiResponse(true, "Your reminder has been created.", reminder));
  } catch (error) {
    if (error instanceof ReminderConflictError) {
      return res.status(409).json(apiResponse(false, error.message, {}));
    }

    console.error("Error in createReminderController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const updateReminderController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?._id?.toString();
    const reminderId = req.params.reminderId;

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    if (!reminderId) {
      return res.status(400).json(apiResponse(false, "Please choose a reminder and try again.", {}));
    }

    const reminder = await updateReminderForUser(userId, reminderId, req.body);
    return res.status(200).json(apiResponse(true, "Your reminder has been updated.", reminder));
  } catch (error) {
    if (error instanceof ReminderNotFoundError) {
      return res.status(404).json(apiResponse(false, notFoundMessage("reminder"), {}));
    }

    console.error("Error in updateReminderController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const deleteReminderController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?._id?.toString();
    const reminderId = req.params.reminderId;

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    if (!reminderId) {
      return res.status(400).json(apiResponse(false, "Please choose a reminder and try again.", {}));
    }

    const result = await deleteReminderForUser(userId, reminderId);
    return res.status(200).json(apiResponse(true, "Your reminder has been deleted.", result));
  } catch (error) {
    if (error instanceof ReminderNotFoundError) {
      return res.status(404).json(apiResponse(false, notFoundMessage("reminder"), {}));
    }

    console.error("Error in deleteReminderController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export {
  createReminderController,
  deleteReminderController,
  getRemindersController,
  updateReminderController,
};
