import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  completeOnboardingController,
  createOnboardingDemoAnalysisController,
} from "./onboarding.controllers";
import {
  completeOnboardingSchema,
  createOnboardingDemoAnalysisSchema,
} from "./onboarding.validators";

const onboardingRouter = Router();

onboardingRouter.post(
  "/demo-analysis",
  validateRequest(createOnboardingDemoAnalysisSchema),
  createOnboardingDemoAnalysisController
);

onboardingRouter.post(
  "/complete",
  verifyJwtToken,
  validateRequest(completeOnboardingSchema),
  completeOnboardingController
);

export default onboardingRouter;
