import { Request, Response } from "express";
import {
  apiResponse,
  API_MESSAGES,
} from "../../helpers/commonHelper.helpers";
import { getProfile, updatePremiumStatus, updateProfile } from "./user.service";

const getProfileController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const profile = await getProfile(userId);

    if (!profile) {
      return res.status(404).json(apiResponse(false, API_MESSAGES.userNotFound, {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Your profile is ready.", profile));
  } catch (error) {
    console.error("Error in getProfile:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const updateProfileController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const { name, avatarColor, goals } = req.body;
    const profile = await updateProfile(userId, {
      name,
      avatarColor,
      goals,
    });

    if (!profile) {
      return res.status(404).json(apiResponse(false, API_MESSAGES.userNotFound, {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Your profile has been updated.", profile));
  } catch (error) {
    console.error("Error in updateProfile:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const updatePremiumStatusController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const { isPremium } = req.body;
    const profile = await updatePremiumStatus(userId, { isPremium });

    if (!profile) {
      return res.status(404).json(apiResponse(false, API_MESSAGES.userNotFound, {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Your membership has been updated.", profile));
  } catch (error) {
    console.error("Error in updatePremiumStatus:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export { getProfileController, updatePremiumStatusController, updateProfileController };
