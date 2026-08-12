import { Request, Response } from "express";
import {
  apiResponse,
  API_MESSAGES,
} from "../../helpers/commonHelper.helpers";
import type { IUser } from "../../schema/user.schema";
import {
  getMoodHistory,
  getTodayMoodCheckIn,
  logMoodCheckIn,
} from "./mood.service";

const getTodayMoodController = async (req: Request, res: Response) => {
  try {
    const user: IUser = req.user;
    const userId = user._id;

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const timeZoneHeader =
      typeof req.headers["x-client-timezone"] === "string"
        ? req.headers["x-client-timezone"]
        : undefined;
    const moodStatus = await getTodayMoodCheckIn(
      userId.toString(),
      timeZoneHeader ? { timeZone: timeZoneHeader } : undefined
    );

    return res
      .status(200)
      .json(apiResponse(true, "Today's check-in is ready.", moodStatus));
  } catch (error) {
    console.error("Error in getTodayMoodController:", error);
    res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const getMoodHistoryController = async (req: Request, res: Response) => {
  try {
    const user: IUser = req.user;
    const userId = user._id;

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const timeZoneHeader =
      typeof req.headers["x-client-timezone"] === "string"
        ? req.headers["x-client-timezone"]
        : undefined;
    const daysQuery = req.query.days;
    const days =
      typeof daysQuery === "string" && daysQuery.trim()
        ? Number(daysQuery)
        : undefined;

    const history = await getMoodHistory(userId.toString(), {
      ...(timeZoneHeader ? { timeZone: timeZoneHeader } : {}),
      ...(days ? { days } : {}),
    });

    return res
      .status(200)
      .json(apiResponse(true, "Your mood history is ready.", history));
  } catch (error) {
    console.error("Error in getMoodHistoryController:", error);
    res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const logMoodController = async (req: Request, res: Response) => {
  try {
    const user: IUser = req.user;
    const userId = user._id;

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const { mood } = req.body;
    const timeZoneHeader =
      typeof req.headers["x-client-timezone"] === "string"
        ? req.headers["x-client-timezone"]
        : undefined;
    const moodCheckIn = await logMoodCheckIn({
      userId: userId.toString(),
      mood,
      ...(timeZoneHeader ? { timeZone: timeZoneHeader } : {}),
    });

    return res
      .status(200)
      .json(apiResponse(true, "Your check-in has been saved.", { moodCheckIn }));
  } catch (error) {
    console.error("Error in logMoodController:", error);
    res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export { getMoodHistoryController, getTodayMoodController, logMoodController };
