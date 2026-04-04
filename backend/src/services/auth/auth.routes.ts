import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  logoutController,
  refreshController,
  resendEmailVerificationController,
  registerFromGoogleOAuthController,
  resendOtpController,
  signInWithEmailController,
  signUpWithEmailController,
  sendOtpController,
  verifyEmailController,
  verifyOtpController,
} from "./auth.controllers";
import {
  logoutSchema,
  resendEmailVerificationSchema,
  resendOtpSchema,
  refreshSchema,
  registerFromGoogleOAuthSchema,
  signInWithEmailSchema,
  signUpWithEmailSchema,
  sendOtpSchema,
  verifyEmailSchema,
  verifyOtpSchema,
} from "./auth.validators";

const authRouter: Router = Router();

authRouter.post("/send_otp", validateRequest(sendOtpSchema), sendOtpController);
authRouter.post(
  "/resend_otp",
  validateRequest(resendOtpSchema),
  resendOtpController
);
authRouter.post(
  "/sign_up_with_email",
  validateRequest(signUpWithEmailSchema),
  signUpWithEmailController
);
authRouter.post(
  "/resend_email_verification",
  validateRequest(resendEmailVerificationSchema),
  resendEmailVerificationController
);
authRouter.post(
  "/verify_email",
  validateRequest(verifyEmailSchema),
  verifyEmailController
);
authRouter.post(
  "/sign_in_with_email",
  validateRequest(signInWithEmailSchema),
  signInWithEmailController
);
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
