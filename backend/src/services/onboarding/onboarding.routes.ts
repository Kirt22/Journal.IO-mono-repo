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
import { publicDemoRateLimit } from "../../middleware/security.middleware";

const onboardingRouter = Router();

onboardingRouter.post(
  "/demo-analysis",
  publicDemoRateLimit,
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
