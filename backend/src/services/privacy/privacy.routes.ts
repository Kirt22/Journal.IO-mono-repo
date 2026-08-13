import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  deletePrivacyAccountController,
  exportPrivacyDataController,
} from "./privacy.controllers";
import {
  deletePrivacyAccountSchema,
  exportPrivacyDataSchema,
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

export default privacyRouter;
