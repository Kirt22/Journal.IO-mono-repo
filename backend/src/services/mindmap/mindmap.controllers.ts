import { Request, Response } from "express";
import {
  apiResponse,
  API_MESSAGES,
  notFoundMessage,
} from "../../helpers/commonHelper.helpers";
import {
  PremiumFeatureRequiredError,
} from "../../helpers/aiAccess.helpers";
import { getEntryMindMap } from "./mindmap.service";

const getEntryMindMapController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const journalId = req.params.journalId;

    if (!journalId) {
      return res
        .status(404)
        .json(apiResponse(false, notFoundMessage("Journal entry"), {}));
    }

    const mindMap = await getEntryMindMap(userId, journalId);

    if (!mindMap) {
      return res
        .status(404)
        .json(apiResponse(false, notFoundMessage("Journal entry"), {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Your entry Mind Map is ready.", mindMap));
  } catch (error) {
    if (error instanceof PremiumFeatureRequiredError) {
      return res.status(403).json(
        apiResponse(false, error.message, {}, {
          error: { code: "PREMIUM_REQUIRED" },
        })
      );
    }

    console.error("Error in getEntryMindMapController:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export { getEntryMindMapController };
