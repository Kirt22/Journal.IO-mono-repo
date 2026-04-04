import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  deletePrivacyAccountController,
  exportPrivacyDataController,
  updatePrivacyAiOptOutController,
} from "./privacy.controllers";
import {
  deletePrivacyAccountSchema,
  exportPrivacyDataSchema,
  updateAiOptOutSchema,
} from "./privacy.validators";

const privacyRouter: Router = Router();

privacyRouter.post(
  "/export",
  verifyJwtToken,
  validateRequest(exportPrivacyDataSchema),
  exportPrivacyDataController
);

privacyRouter.post(
  "/delete-request",
  verifyJwtToken,
  validateRequest(deletePrivacyAccountSchema),
  deletePrivacyAccountController
);

privacyRouter.patch(
  "/ai-opt-out",
  verifyJwtToken,
  validateRequest(updateAiOptOutSchema),
  updatePrivacyAiOptOutController
);

export default privacyRouter;
