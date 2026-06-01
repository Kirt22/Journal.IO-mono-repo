import { Request, Response } from "express";
import {
  apiResponse,
  API_MESSAGES,
} from "../../helpers/commonHelper.helpers";
import { buildOnboardingDemoAnalysis } from "./onboarding.service";
import type { OnboardingDemoAnalysisInput } from "./onboarding.service";

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

export { createOnboardingDemoAnalysisController };
