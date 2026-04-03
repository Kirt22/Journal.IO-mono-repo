import { Request, Response } from "express";
import { apiResponse } from "../../helpers/commonHelper.helpers";
import { getInsightsAiAnalysis, getInsightsOverview } from "./insights.service";

const getInsightsOverviewController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const overview = await getInsightsOverview(userId);

    return res
      .status(200)
      .json(apiResponse(true, "Insights overview loaded", overview));
  } catch (error) {
    console.error("Error in getInsightsOverviewController:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const getInsightsAiAnalysisController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const analysis = await getInsightsAiAnalysis(userId);

    return res
      .status(200)
      .json(apiResponse(true, "Insights AI analysis loaded", analysis));
  } catch (error) {
    console.error("Error in getInsightsAiAnalysisController:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

export { getInsightsOverviewController, getInsightsAiAnalysisController };
