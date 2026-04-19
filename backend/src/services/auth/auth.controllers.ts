import { Request, Response } from "express";
import { apiResponse } from "../../helpers/commonHelper.helpers";
import {
  signInWithGoogle,
  invalidateRefreshToken,
  refreshAccessToken,
  resendEmailVerification,
  signInWithEmail,
  signUpWithEmail,
  verifyEmail,
} from "./auth.service";

const maskEmail = (email: string) => {
  const trimmed = email.trim().toLowerCase();
  const [localPart = "", domain = ""] = trimmed.split("@");

  if (!localPart || !domain) {
    return trimmed;
  }

  const visibleLocal =
    localPart.length <= 2
      ? `${localPart[0] || ""}*`
      : `${localPart.slice(0, 2)}***`;

  return `${visibleLocal}@${domain}`;
};

const logAuthRoute = (
  event: "request" | "success" | "error",
  route: string,
  details: Record<string, unknown>
) => {
  const logger = event === "error" ? console.error : console.info;
  logger(`[Auth][${route}] ${event}`, details);
};

const signUpWithEmailController = async (req: Request, res: Response) => {
  try {
    const { email, password, onboardingContext, onboardingCompleted } =
      req.body;
    logAuthRoute("request", "sign_up_with_email", {
      email: maskEmail(email),
    });
    const result = await signUpWithEmail({
      email,
      password,
      onboardingContext,
      onboardingCompleted,
    });

    if (!result.ok) {
      return res.status(result.status).json(
        apiResponse(false, result.message, {}, {
          error: { code: result.code },
        })
      );
    }

    logAuthRoute("success", "sign_up_with_email", {
      email: maskEmail(email),
      verificationRequired: result.challenge.verificationRequired,
      expiresInSeconds: result.challenge.expiresInSeconds,
    });

    return res
      .status(200)
      .json(apiResponse(true, "Verification code sent", result.challenge));
  } catch (error) {
    logAuthRoute("error", "sign_up_with_email", {
      error,
    });
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
    logAuthRoute("request", "resend_email_verification", {
      email: maskEmail(email),
    });
    const result = await resendEmailVerification({ email });

    if (!result.ok) {
      return res.status(result.status).json(
        apiResponse(false, result.message, {}, {
          error: { code: result.code },
        })
      );
    }

    logAuthRoute("success", "resend_email_verification", {
      email: maskEmail(email),
      verificationRequired: result.challenge.verificationRequired,
      expiresInSeconds: result.challenge.expiresInSeconds,
    });

    return res
      .status(200)
      .json(apiResponse(true, "Verification code resent", result.challenge));
  } catch (error) {
    logAuthRoute("error", "resend_email_verification", {
      error,
    });
    console.error("Error in resendEmailVerification:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

const verifyEmailController = async (req: Request, res: Response) => {
  try {
    const { email, code, onboardingCompleted } = req.body;
    const result = await verifyEmail({
      email,
      code,
      onboardingCompleted,
    });

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
    const { email, password, onboardingCompleted } = req.body;
    const result = await signInWithEmail({
      email,
      password,
      onboardingCompleted,
    });

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

const googleMobileSignInController = async (req: Request, res: Response) => {
  try {
    const { idToken, onboardingContext, onboardingCompleted } = req.body;
    const result = await signInWithGoogle({
      idToken,
      onboardingContext,
      onboardingCompleted,
    });

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
    console.error("Error in googleMobileSignIn:", error);
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
    const { googleIdToken, onboardingCompleted } = req.body;
    const result = await signInWithGoogle({
      idToken: googleIdToken,
      onboardingCompleted,
    });

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
    console.error("Error in registerFromGoogleOAuth:", error);
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
      return res.status(401).json(apiResponse(false, "Unauthorized", {}));
    }

    await invalidateRefreshToken(userId);

    return res.status(200).json(apiResponse(true, "Logout successful", {}));
  } catch (error) {
    console.error("Error in logout:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Internal Server Error", {}));
  }
};

export {
  googleMobileSignInController,
  logoutController,
  refreshController,
  resendEmailVerificationController,
  registerFromGoogleOAuthController,
  signInWithEmailController,
  signUpWithEmailController,
  verifyEmailController,
};
