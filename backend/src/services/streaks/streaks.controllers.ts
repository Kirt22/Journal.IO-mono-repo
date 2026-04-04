import { Request, Response } from "express";
import { apiResponse } from "../../helpers/commonHelper.helpers";
import { getCurrentStreakSummary, getStreakHistory } from "./streaks.service";

const getCurrentStreakController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const summary = await getCurrentStreakSummary(userId);

    return res.status(200).json(apiResponse(true, "Current streak loaded", summary));
  } catch (error) {
    console.error("Error in getCurrentStreakController:", error);
    return res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const getStreakHistoryController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id?.toString();
    const days = Number(req.query.days || 30);

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const history = await getStreakHistory(userId, days);

    return res.status(200).json(apiResponse(true, "Streak history loaded", history));
  } catch (error) {
    console.error("Error in getStreakHistoryController:", error);
    return res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

export { getCurrentStreakController, getStreakHistoryController };
