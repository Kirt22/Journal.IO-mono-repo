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

const authRouter: Router = Router();
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
  "/request_password_reset",
  validateRequest(requestPasswordResetSchema),
  requestPasswordResetController
);
authRouter.post(
  "/reset_password",
  validateRequest(resetPasswordSchema),
  resetPasswordController
);
authRouter.post(
  "/google/mobile",
  validateRequest(googleMobileSignInSchema),
  googleMobileSignInController
);
authRouter.post(
  "/apple/mobile",
  validateRequest(appleMobileSignInSchema),
  appleMobileSignInController
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
