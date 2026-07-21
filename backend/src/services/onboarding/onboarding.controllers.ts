import { Request, Response } from "express";
import {
  apiResponse,
  API_MESSAGES,
} from "../../helpers/commonHelper.helpers";
import {
  buildOnboardingDemoAnalysis,
  completeOnboardingForUser,
} from "./onboarding.service";
import type {
  CompleteOnboardingInput,
  OnboardingDemoAnalysisInput,
} from "./onboarding.service";

const createOnboardingDemoAnalysisController = async (
  req: Request,
  res: Response
) => {
  try {
    const analysis = buildOnboardingDemoAnalysis(
      req.body as OnboardingDemoAnalysisInput
    );

    return res
      .status(200)
      .json(apiResponse(true, "Your demo reflection is ready.", analysis));
  } catch (error) {
    console.error("Error in createOnboardingDemoAnalysisController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const completeOnboardingController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    const profile = await completeOnboardingForUser(
      userId,
      req.body as CompleteOnboardingInput
    );

    if (!profile) {
      return res.status(404).json(apiResponse(false, API_MESSAGES.userNotFound, {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Onboarding is complete.", profile));
  } catch (error) {
    console.error("Error in completeOnboardingController:", error);
    return res.status(500).json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export {
  completeOnboardingController,
  createOnboardingDemoAnalysisController,
};
