import { Request, Response } from "express";
import { apiResponse, API_MESSAGES } from "../../helpers/commonHelper.helpers";
import {
  isRevenueCatServiceError,
  processRevenueCatWebhook,
} from "./revenuecat.service";

const processRevenueCatWebhookController = async (
  req: Request,
  res: Response
) => {
  try {
    const result = await processRevenueCatWebhook(
      req.body,
      req.headers.authorization
    );

    return res.status(200).json(
      apiResponse(true, "RevenueCat webhook processed.", {
        eventKey: result.eventKey,
        duplicate: result.kind === "duplicate",
        userIds: result.userIds,
      })
    );
  } catch (error) {
    if (isRevenueCatServiceError(error)) {
      return res
        .status(error.statusCode)
        .json(apiResponse(false, error.message, {}, { error: { code: error.safeErrorCode } }));
    }

    console.error("Error in processRevenueCatWebhookController:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export { processRevenueCatWebhookController };
