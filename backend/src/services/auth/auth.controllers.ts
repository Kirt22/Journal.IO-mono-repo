import { Request, Response } from "express";
import { apiResponse } from "../../helpers/commonHelper.helpers";
import {
  invalidateRefreshToken,
  refreshAccessToken,
  resendEmailVerification,
  resendOtp,
  sendOtp,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  verifyEmail,
  verifyOtp,
} from "./auth.service";

const sendOtpController = async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;
    const result = await sendOtp({ phoneNumber });

    return res
      .status(200)
      .json(apiResponse(true, "Verification code sent", result));
  } catch (error) {
    console.error("Error in sendOtp:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const resendOtpController = async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;
    const result = await resendOtp({ phoneNumber });

    return res
      .status(200)
      .json(apiResponse(true, "Verification code resent", result));
  } catch (error) {
    console.error("Error in resendOtp:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const verifyOtpController = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, otp, name, goals } = req.body;
    const result = await verifyOtp({ phoneNumber, otp, name, goals });

    if (!result.ok) {
      return res.status(400).json(
        apiResponse(false, result.message, {}, {
          error: { code: result.code },
        })
      );
    }

    return res.status(200).json(
      apiResponse(true, "Login successful", {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        user: result.user,
        isNewUser: result.isNewUser,
      })
    );
  } catch (error) {
    console.error("Error in verifyOtp:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const registerFromGoogleOAuthController = async (
  req: Request,
  res: Response
) => {
  try {
    const { googleIdToken, googleUserId, email, name, profilePic } = req.body;
    const result = await signInWithGoogle({
      googleIdToken,
      googleUserId,
      email,
      name,
      profilePic,
    });

    return res.status(200).json(
      apiResponse(true, "Login successful", {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        user: result.user,
      })
    );
  } catch (error) {
    console.error("Error in registerFromGoogleOAuth:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const signUpWithEmailController = async (req: Request, res: Response) => {
  try {
    const { email, password, onboardingContext } = req.body;
    const result = await signUpWithEmail({
      email,
      password,
      onboardingContext,
    });

    if (!result.ok) {
      return res.status(result.status).json(
        apiResponse(false, result.message, {}, {
          error: { code: result.code },
        })
      );
    }

    return res
      .status(200)
      .json(apiResponse(true, "Verification code sent", result.challenge));
  } catch (error) {
    console.error("Error in signUpWithEmail:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const resendEmailVerificationController = async (
  req: Request,
  res: Response
) => {
  try {
    const { email } = req.body;
    const result = await resendEmailVerification({ email });

    if (!result.ok) {
      return res.status(result.status).json(
        apiResponse(false, result.message, {}, {
          error: { code: result.code },
        })
      );
    }

    return res
      .status(200)
      .json(apiResponse(true, "Verification code resent", result.challenge));
  } catch (error) {
    console.error("Error in resendEmailVerification:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const verifyEmailController = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    const result = await verifyEmail({ email, code });

    if (!result.ok) {
      return res.status(result.status).json(
        apiResponse(false, result.message, {}, {
          error: { code: result.code },
        })
      );
    }

    return res.status(200).json(
      apiResponse(true, "Email verified successfully", {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        user: result.user,
        isNewUser: result.isNewUser,
      })
    );
  } catch (error) {
    console.error("Error in verifyEmail:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const signInWithEmailController = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await signInWithEmail({ email, password });

    if (!result.ok) {
      return res.status(result.status).json(
        apiResponse(false, result.message, {}, {
          error: { code: result.code },
        })
      );
    }

    return res.status(200).json(
      apiResponse(true, "Login successful", {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        user: result.user,
      })
    );
  } catch (error) {
    console.error("Error in signInWithEmail:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const refreshController = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const result = await refreshAccessToken(refreshToken);

    if (!result) {
      return res
        .status(401)
        .json(apiResponse(false, "Invalid refresh token", {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Token refreshed", result));
  } catch (error) {
    console.error("Error in refresh:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const logoutController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res
        .status(401)
        .json(apiResponse(false, "Unauthorized", {}));
    }

    await invalidateRefreshToken(userId);

    return res
      .status(200)
      .json(apiResponse(true, "Logout successful", {}));
  } catch (error) {
    console.error("Error in logout:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

export {
  logoutController,
  refreshController,
  registerFromGoogleOAuthController,
  resendEmailVerificationController,
  resendOtpController,
  sendOtpController,
  signInWithEmailController,
  signUpWithEmailController,
  verifyEmailController,
  verifyOtpController,
};
