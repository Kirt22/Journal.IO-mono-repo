import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  appleMobileSignInController,
  googleMobileSignInController,
  logoutController,
  refreshController,
  requestPasswordResetController,
  resendEmailVerificationController,
  resetPasswordController,
  registerFromGoogleOAuthController,
  signInWithEmailController,
  signUpWithEmailController,
  verifyEmailController,
} from "./auth.controllers";
import {
  appleMobileSignInSchema,
  googleMobileSignInSchema,
  logoutSchema,
  resendEmailVerificationSchema,
  refreshSchema,
  registerFromGoogleOAuthSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  signInWithEmailSchema,
  signUpWithEmailSchema,
  verifyEmailSchema,
} from "./auth.validators";
import {
  authInitiationRateLimit,
  otpVerificationRateLimit,
} from "../../middleware/security.middleware";

const authRouter: Router = Router();
authRouter.post(
  "/sign_up_with_email",
  authInitiationRateLimit,
  validateRequest(signUpWithEmailSchema),
  signUpWithEmailController
);
authRouter.post(
  "/resend_email_verification",
  authInitiationRateLimit,
  validateRequest(resendEmailVerificationSchema),
  resendEmailVerificationController
);
authRouter.post(
  "/verify_email",
  otpVerificationRateLimit,
  validateRequest(verifyEmailSchema),
  verifyEmailController
);
authRouter.post(
  "/sign_in_with_email",
  authInitiationRateLimit,
  validateRequest(signInWithEmailSchema),
  signInWithEmailController
);
authRouter.post(
  "/request_password_reset",
  authInitiationRateLimit,
  validateRequest(requestPasswordResetSchema),
  requestPasswordResetController
);
authRouter.post(
  "/reset_password",
  otpVerificationRateLimit,
  validateRequest(resetPasswordSchema),
  resetPasswordController
);
authRouter.post(
  "/google/mobile",
  authInitiationRateLimit,
  validateRequest(googleMobileSignInSchema),
  googleMobileSignInController
);
authRouter.post(
  "/apple/mobile",
  authInitiationRateLimit,
  validateRequest(appleMobileSignInSchema),
  appleMobileSignInController
);
authRouter.post(
  "/register_from_googleOAuth",
  authInitiationRateLimit,
  validateRequest(registerFromGoogleOAuthSchema),
  registerFromGoogleOAuthController
);
authRouter.post(
  "/refresh",
  authInitiationRateLimit,
  validateRequest(refreshSchema),
  refreshController
);
authRouter.post(
  "/logout",
  verifyJwtToken,
  validateRequest(logoutSchema),
  logoutController
);

export default authRouter;
