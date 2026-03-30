import { Request, Response } from "express";
import { apiResponse } from "../../helpers/commonHelper.helpers";
import type { IUser } from "../../schema/user.schema";
import { getTodayMoodCheckIn, logMoodCheckIn } from "./mood.service";

const getTodayMoodController = async (req: Request, res: Response) => {
  try {
    const user: IUser = req.user;
    const userId = user._id;

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const moodStatus = await getTodayMoodCheckIn(userId.toString());

    return res
      .status(200)
      .json(apiResponse(true, "Today's mood loaded", moodStatus));
  } catch (error) {
    console.error("Error in getTodayMoodController:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const logMoodController = async (req: Request, res: Response) => {
  try {
    const user: IUser = req.user;
    const userId = user._id;

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const { mood } = req.body;
    const moodCheckIn = await logMoodCheckIn({
      userId: userId.toString(),
      mood,
    });

    return res
      .status(200)
      .json(apiResponse(true, "Mood check-in saved", { moodCheckIn }));
  } catch (error) {
    console.error("Error in logMoodController:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

export { getTodayMoodController, logMoodController };
