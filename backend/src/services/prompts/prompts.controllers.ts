import { Request, Response } from "express";
import { apiResponse } from "../../helpers/commonHelper.helpers";
import { getWritingPromptsForUser } from "./prompts.service";

const getWritingPromptsController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    const prompts = await getWritingPromptsForUser(userId);

    return res
      .status(200)
      .json(apiResponse(true, "Writing prompts loaded", prompts));
  } catch (error) {
    console.error("Error in getWritingPromptsController:", error);
    return res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

export { getWritingPromptsController };
