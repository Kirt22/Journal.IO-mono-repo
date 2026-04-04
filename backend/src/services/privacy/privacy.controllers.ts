import type { Request, Response } from "express";
import { apiResponse } from "../../helpers/commonHelper.helpers";
import {
  deletePrivacyAccount,
  exportPrivacyData,
  updatePrivacyAiOptOut,
} from "./privacy.service";

type AuthenticatedRequest = Request & {
  user?: {
    _id?: {
      toString(): string;
    };
  };
};

type AiOptOutRequest = AuthenticatedRequest & {
  body: {
    aiOptOut?: boolean;
  };
};

const exportPrivacyDataController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const result = await exportPrivacyData(userId);

    if (!result) {
      return res.status(404).json(apiResponse(false, "User not found", {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Data export generated", result));
  } catch (error) {
    console.error("Error in exportPrivacyData:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const deletePrivacyAccountController = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const result = await deletePrivacyAccount(userId);

    if (!result.deletedAccount) {
      return res.status(404).json(apiResponse(false, "User not found", {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Account deleted successfully", result));
  } catch (error) {
    console.error("Error in deletePrivacyAccount:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const updatePrivacyAiOptOutController = async (
  req: AiOptOutRequest,
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();
    const aiOptOut = req.body?.aiOptOut;

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    if (typeof aiOptOut !== "boolean") {
      return res
        .status(400)
        .json(apiResponse(false, "Invalid opt-out preference", {}));
    }

    const result = await updatePrivacyAiOptOut(userId, aiOptOut);

    if (!result) {
      return res.status(404).json(apiResponse(false, "User not found", {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "AI preference updated", result));
  } catch (error) {
    console.error("Error in updatePrivacyAiOptOut:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

export {
  deletePrivacyAccountController,
  exportPrivacyDataController,
  updatePrivacyAiOptOutController,
};
