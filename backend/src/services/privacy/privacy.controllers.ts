import type { Request, Response } from "express";
import {
  apiResponse,
  API_MESSAGES,
} from "../../helpers/commonHelper.helpers";
import {
  deletePrivacyAccount,
  exportPrivacyData,
} from "./privacy.service";

type AuthenticatedRequest = Request & {
  user?: {
    _id?: {
      toString(): string;
    };
  };
};

const exportPrivacyDataController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const result = await exportPrivacyData(userId);

    if (!result) {
      return res.status(404).json(apiResponse(false, API_MESSAGES.userNotFound, {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Your data export is ready.", result));
  } catch (error) {
    console.error("Error in exportPrivacyData:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const deletePrivacyAccountController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const result = await deletePrivacyAccount(userId);

    if (!result.deletedAccount) {
      return res.status(404).json(apiResponse(false, API_MESSAGES.userNotFound, {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Your account has been deleted.", result));
  } catch (error) {
    console.error("Error in deletePrivacyAccount:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export {
  deletePrivacyAccountController,
  exportPrivacyDataController,
};
