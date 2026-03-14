import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  logoutController,
  refreshController,
  registerFromGoogleOAuthController,
  sendOtpController,
  verifyOtpController,
} from "./auth.controllers";
import {
  logoutSchema,
  refreshSchema,
  registerFromGoogleOAuthSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from "./auth.validators";

const authRouter: Router = Router();

authRouter.post("/send_otp", validateRequest(sendOtpSchema), sendOtpController);
authRouter.post(
  "/verify_otp",
  validateRequest(verifyOtpSchema),
  verifyOtpController
);
authRouter.post(
  "/register_from_googleOAuth",
  validateRequest(registerFromGoogleOAuthSchema),
  registerFromGoogleOAuthController
);
authRouter.post("/refresh", validateRequest(refreshSchema), refreshController);
authRouter.post(
  "/logout",
  verifyJwtToken,
  validateRequest(logoutSchema),
  logoutController
);

export default authRouter;
