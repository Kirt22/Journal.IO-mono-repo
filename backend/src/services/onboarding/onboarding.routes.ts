import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { createOnboardingDemoAnalysisController } from "./onboarding.controllers";
import { createOnboardingDemoAnalysisSchema } from "./onboarding.validators";

const onboardingRouter = Router();

onboardingRouter.post(
  "/demo-analysis",
  validateRequest(createOnboardingDemoAnalysisSchema),
  createOnboardingDemoAnalysisController
);

export default onboardingRouter;
