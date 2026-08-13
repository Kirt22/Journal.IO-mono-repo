import { Request, Response } from "express";
import {
  apiResponse,
  API_MESSAGES,
} from "../../helpers/commonHelper.helpers";
import {
  getInsightsAiAnalysis,
  getInsightsMindMap,
  getInsightsMindMapRegionSeries,
  getInsightsOverview,
  PremiumFeatureRequiredError,
} from "./insights.service";
import {
  REFLECTION_REGION_IDS,
  type ReflectionRegionId,
} from "../../helpers/reflectionMap.helpers";
import type { InsightsMindMapRange } from "../../types/insights.types";

const parseMindMapRange = (value: unknown): InsightsMindMapRange => {
  if (value === "all_time" || value === "monthly") {
    return value;
  }
  return "latest_week";
};

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

    console.error("Error in getInsightsAiAnalysisController:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const getInsightsMindMapController = async (
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
    const range = parseMindMapRange(req.query.range);
    const mindMap = await getInsightsMindMap(userId, {
      range,
      ...(timezoneHeader ? { timeZone: timezoneHeader } : {}),
    });

    return res
      .status(200)
      .json(apiResponse(true, "Your Mind Map is ready.", mindMap));
  } catch (error) {
    if (error instanceof PremiumFeatureRequiredError) {
      return res.status(403).json(
        apiResponse(false, error.message, {}, {
          error: { code: "PREMIUM_REQUIRED" },
        })
      );
    }

    console.error("Error in getInsightsMindMapController:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const getInsightsMindMapRegionSeriesController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const regionId = req.params.regionId as ReflectionRegionId;
    if (!REFLECTION_REGION_IDS.includes(regionId)) {
      return res
        .status(400)
        .json(apiResponse(false, "Unknown reflection region.", {}));
    }

    const timezoneHeader =
      typeof req.headers["x-client-timezone"] === "string"
        ? req.headers["x-client-timezone"]
        : undefined;
    const range = parseMindMapRange(req.query.range);
    const series = await getInsightsMindMapRegionSeries(userId, {
      regionId,
      range,
      ...(timezoneHeader ? { timeZone: timezoneHeader } : {}),
    });

    return res
      .status(200)
      .json(apiResponse(true, "Region development series is ready.", series));
  } catch (error) {
    if (error instanceof PremiumFeatureRequiredError) {
      return res.status(403).json(
        apiResponse(false, error.message, {}, {
          error: { code: "PREMIUM_REQUIRED" },
        })
      );
    }

    console.error("Error in getInsightsMindMapRegionSeriesController:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export {
  getInsightsOverviewController,
  getInsightsAiAnalysisController,
  getInsightsMindMapController,
  getInsightsMindMapRegionSeriesController,
};
