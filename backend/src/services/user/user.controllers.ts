import { Request, Response } from "express";
import { apiResponse } from "../../helpers/commonHelper.helpers";
import { getProfile, updateProfile } from "./user.service";

const getProfileController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const profile = await getProfile(userId);

    if (!profile) {
      return res.status(404).json(apiResponse(false, "User not found", {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Profile loaded", profile));
  } catch (error) {
    console.error("Error in getProfile:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const updateProfileController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const { name, avatarColor, goals } = req.body;
    const profile = await updateProfile(userId, {
      name,
      avatarColor,
      goals,
    });

    if (!profile) {
      return res.status(404).json(apiResponse(false, "User not found", {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Profile updated", profile));
  } catch (error) {
    console.error("Error in updateProfile:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

export { getProfileController, updateProfileController };
