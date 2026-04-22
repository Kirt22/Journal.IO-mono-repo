import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import {
  googleMobileSignInController,
  logoutController,
  refreshController,
  resendEmailVerificationController,
  registerFromGoogleOAuthController,
  signInWithEmailController,
  signUpWithEmailController,
  verifyEmailController,
} from "./auth.controllers";
import {
  googleMobileSignInSchema,
  logoutSchema,
  resendEmailVerificationSchema,
  refreshSchema,
  registerFromGoogleOAuthSchema,
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
  "/google/mobile",
  validateRequest(googleMobileSignInSchema),
  googleMobileSignInController
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
