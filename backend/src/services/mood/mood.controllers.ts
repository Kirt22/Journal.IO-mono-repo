import { Request, Response } from "express";
import {
  apiResponse,
  API_MESSAGES,
} from "../../helpers/commonHelper.helpers";
import type { IUser } from "../../schema/user.schema";
import { getTodayMoodCheckIn, logMoodCheckIn } from "./mood.service";

const getTodayMoodController = async (req: Request, res: Response) => {
  try {
    const user: IUser = req.user;
    const userId = user._id;

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const moodStatus = await getTodayMoodCheckIn(userId.toString());

    return res
      .status(200)
      .json(apiResponse(true, "Today's check-in is ready.", moodStatus));
  } catch (error) {
    console.error("Error in getTodayMoodController:", error);
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
    const moodCheckIn = await logMoodCheckIn({
      userId: userId.toString(),
      mood,
    });

    return res
      .status(200)
      .json(apiResponse(true, "Your check-in has been saved.", { moodCheckIn }));
  } catch (error) {
    console.error("Error in logMoodController:", error);
    res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export { getTodayMoodController, logMoodController };
