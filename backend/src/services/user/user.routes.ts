import { Router } from "express";
// import { verifyJwtToken } from "../../middleware/authjwt";
import * as userController from "./user.controllers";
import * as userValidators from "./user.validators";
import { verifyJwtToken } from "../../middleware/verifyJwtToken.middleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";

const userRouter: Router = Router();

/**
 * @route   POST /send_otp
 * @desc    Generates and sends an OTP to the user's phone number.
 * @access  Public
 */
userRouter.post(
  "/send_otp",
  validateRequest(userValidators.sendOtpSchema),
  userController.sendOtp
);

/**
 * @route   POST /verify_otp
 * @desc    Verifies the OTP provided by the user and updates user details if valid.
 * @access  Public
 */
userRouter.post(
  "/verify_otp",
  validateRequest(userValidators.verifyOtpSchema),
  userController.verifyOtp
);

/**
 * @route   POST /register
 * @desc    Registers a new user after OTP verification.
 * @access  Public
 */
userRouter.post(
  "/register",
  verifyJwtToken,
  validateRequest(userValidators.registerSchema),
  userController.register
);

/**
 * @route   POST /register_from_googleOAuth
 * @desc    Verifies the OTP provided by the user and updates user details if valid.
 * @access  Public
 */
userRouter.post(
  "/register_from_googleOAuth",
  validateRequest(userValidators.registerFromGoogleOAuthSchema),
  userController.getUserDetailsFromGoogleOAuth
);

/**
 * @route   POST /get_user_profile
 * @desc    Retrieves the user profile details.
 * @access  Private (Requires JWT authentication)
 */
userRouter.get(
  "/get_user_profile",
  verifyJwtToken,
  validateRequest(userValidators.getUserProfileSchema),
  userController.getUserProfile
);

/**
 * @route   POST /edit_user_profile
 * @desc    Updates the user profile details.
 * @access  Private (Requires JWT authentication)
 */
userRouter.post(
  "/edit_user_profile",
  verifyJwtToken,
  validateRequest(userValidators.editUserProfileSchema),
  userController.editUserProfile
);

/**
 * @route   POST /logout
 * @desc    Logs out the user and invalidates the JWT token.
 * @access  Private (Requires JWT authentication)
 */
userRouter.post(
  "/logout",
  verifyJwtToken,
  validateRequest(userValidators.logoutSchema),
  userController.logout
);

export default userRouter;
