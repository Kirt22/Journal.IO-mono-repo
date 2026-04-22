import { Request, Response } from "express";
import {
  apiResponse,
  API_MESSAGES,
} from "../../helpers/commonHelper.helpers";
import {
  AiAnalysisDisabledError,
  getInsightsAiAnalysis,
  getInsightsOverview,
  PremiumFeatureRequiredError,
} from "./insights.service";

const getInsightsOverviewController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const overview = await getInsightsOverview(userId);

    return res
      .status(200)
      .json(apiResponse(true, "Your insights overview is ready.", overview));
  } catch (error) {
    console.error("Error in getInsightsOverviewController:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const getInsightsAiAnalysisController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const timezoneHeader =
      typeof req.headers["x-client-timezone"] === "string"
        ? req.headers["x-client-timezone"]
        : undefined;
    const analysis = await getInsightsAiAnalysis(
      userId,
      timezoneHeader ? { timeZone: timezoneHeader } : undefined
    );

    return res
      .status(200)
      .json(apiResponse(true, "Your AI analysis is ready.", analysis));
  } catch (error) {
    if (error instanceof PremiumFeatureRequiredError) {
      return res.status(403).json(
        apiResponse(false, error.message, {}, {
          error: { code: "PREMIUM_REQUIRED" },
        })
      );
    }

    if (error instanceof AiAnalysisDisabledError) {
      return res.status(403).json(
        apiResponse(false, error.message, {}, {
          error: { code: "AI_ANALYSIS_DISABLED" },
        })
      );
    }

    console.error("Error in getInsightsAiAnalysisController:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export { getInsightsOverviewController, getInsightsAiAnalysisController };
