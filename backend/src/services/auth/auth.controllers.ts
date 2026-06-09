import { Request, Response } from "express";
import {
  apiResponse,
  API_MESSAGES,
} from "../../helpers/commonHelper.helpers";
import {
  signInWithApple,
  signInWithGoogle,
  invalidateRefreshToken,
  refreshAccessToken,
  requestPasswordReset,
  resendEmailVerification,
  resetPassword,
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

const passwordResetPageController = (req: Request, res: Response) => {
  const token =
    typeof req.query.token === "string" ? req.query.token.trim() : "";

  res.status(200).type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Journal.IO Password Reset</title>
    <style>
      :root {
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(180deg, #f6efe7 0%, #fffaf5 100%);
        color: #201714;
        padding: 24px;
      }
      .card {
        width: 100%;
        max-width: 420px;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid #eadfd3;
        border-radius: 24px;
        padding: 24px;
        box-shadow: 0 20px 50px rgba(92, 57, 31, 0.08);
      }
      h1 {
        font-size: 28px;
        line-height: 1.15;
        margin: 0 0 10px;
      }
      p {
        margin: 0 0 16px;
        line-height: 1.5;
        color: #5d4a3c;
      }
      label {
        display: block;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      input {
        width: 100%;
        box-sizing: border-box;
        min-height: 48px;
        border-radius: 14px;
        border: 1px solid #d9c8b8;
        padding: 12px 14px;
        font-size: 15px;
        margin-bottom: 14px;
      }
      button {
        width: 100%;
        min-height: 48px;
        border: 0;
        border-radius: 999px;
        background: #c46d3d;
        color: white;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      button[disabled] {
        opacity: 0.7;
        cursor: wait;
      }
      .message {
        border-radius: 14px;
        padding: 12px 14px;
        margin-bottom: 16px;
        font-size: 14px;
        line-height: 1.45;
        display: none;
      }
      .message.visible {
        display: block;
      }
      .message.error {
        background: #fff0ef;
        color: #a0382e;
        border: 1px solid #efc7c3;
      }
      .message.success {
        background: #f0fbf5;
        color: #256447;
        border: 1px solid #c8e7d4;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Choose a new password</h1>
      <p>Set a new password for your Journal.IO account, then return to the app and sign in.</p>
      <div id="message" class="message" role="alert"></div>
      <form id="reset-form">
        <label for="password">New password</label>
        <input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required />
        <label for="confirmPassword">Confirm password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required />
        <button id="submit" type="submit">Reset password</button>
      </form>
    </main>
    <script>
      const token = ${JSON.stringify(token)};
      const form = document.getElementById("reset-form");
      const submitButton = document.getElementById("submit");
      const message = document.getElementById("message");

      const showMessage = (text, tone) => {
        message.textContent = text;
        message.className = "message visible " + tone;
      };

      form.addEventListener("submit", async event => {
        event.preventDefault();

        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (!token) {
          showMessage("This reset link is missing a token. Request a new one.", "error");
          return;
        }

        if (password.length < 8) {
          showMessage("Password must be at least 8 characters.", "error");
          return;
        }

        if (password !== confirmPassword) {
          showMessage("Passwords must match.", "error");
          return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Resetting...";
        showMessage("", "success");
        message.className = "message";

        try {
          const response = await fetch("/api/v1/auth/reset_password", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ token, password })
          });
          const payload = await response.json();

          if (!response.ok || !payload.success) {
            showMessage(payload.message || "Unable to reset your password right now.", "error");
            return;
          }

          showMessage("Your password is updated. You can return to the app sign-in screen now.", "success");
          form.reset();
        } catch (error) {
          showMessage("Unable to reach the server right now.", "error");
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = "Reset password";
        }
      });
    </script>
  </body>
</html>`);
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
      .json(apiResponse(true, "Your verification code is on the way.", result.challenge));
  } catch (error) {
    logAuthRoute("error", "sign_up_with_email", {
      error,
    });
    console.error("Error in signUpWithEmail:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
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
      .json(apiResponse(true, "A new verification code is on the way.", result.challenge));
  } catch (error) {
    logAuthRoute("error", "resend_email_verification", {
      error,
    });
    console.error("Error in resendEmailVerification:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
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
      apiResponse(true, "You're signed in.", {
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
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const signInWithEmailController = async (req: Request, res: Response) => {
  try {
    const { email, password, onboardingContext, onboardingCompleted } = req.body;
    const result = await signInWithEmail({
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

    return res.status(200).json(
      apiResponse(true, "You're signed in.", {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        user: result.user,
      })
    );
  } catch (error) {
    console.error("Error in signInWithEmail:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const requestPasswordResetController = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    logAuthRoute("request", "request_password_reset", {
      email: maskEmail(email),
    });

    const result = await requestPasswordReset({ email });

    logAuthRoute("success", "request_password_reset", {
      email: maskEmail(email),
      expiresInSeconds: result.challenge.expiresInSeconds,
    });

    return res.status(200).json(
      apiResponse(
        true,
        "If that email is registered, a reset link is on the way.",
        result.challenge
      )
    );
  } catch (error) {
    logAuthRoute("error", "request_password_reset", {
      error,
    });
    console.error("Error in requestPasswordReset:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const resetPasswordController = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    const result = await resetPassword({ token, password });

    if (!result.ok) {
      return res.status(result.status).json(
        apiResponse(false, result.message, {}, {
          error: { code: result.code },
        })
      );
    }

    return res
      .status(200)
      .json(apiResponse(true, "Your password has been reset.", {}));
  } catch (error) {
    console.error("Error in resetPassword:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
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
      apiResponse(true, "You're signed in.", {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        user: result.user,
      })
    );
  } catch (error) {
    console.error("Error in googleMobileSignIn:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const appleMobileSignInController = async (req: Request, res: Response) => {
  try {
    const {
      identityToken,
      nonce,
      email,
      fullName,
      onboardingContext,
      onboardingCompleted,
    } = req.body;
    const result = await signInWithApple({
      identityToken,
      nonce,
      email,
      fullName,
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
      apiResponse(true, "You're signed in.", {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        user: result.user,
      })
    );
  } catch (error) {
    console.error("Error in appleMobileSignIn:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
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
      apiResponse(true, "You're signed in.", {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        user: result.user,
      })
    );
  } catch (error) {
    console.error("Error in registerFromGoogleOAuth:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const refreshController = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const result = await refreshAccessToken(refreshToken);

    if (!result) {
      return res
        .status(401)
        .json(apiResponse(false, API_MESSAGES.sessionExpired, {}));
    }

    return res
      .status(200)
      .json(apiResponse(true, "Your session has been refreshed.", result));
  } catch (error) {
    console.error("Error in refresh:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

const logoutController = async (
  req: Request & { user?: { _id?: string } },
  res: Response
) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json(apiResponse(false, API_MESSAGES.unauthorized, {}));
    }

    await invalidateRefreshToken(userId);

    return res.status(200).json(apiResponse(true, "You're signed out.", {}));
  } catch (error) {
    console.error("Error in logout:", error);
    return res
      .status(500)
      .json(apiResponse(false, API_MESSAGES.internalError, {}));
  }
};

export {
  appleMobileSignInController,
  googleMobileSignInController,
  logoutController,
  passwordResetPageController,
  refreshController,
  requestPasswordResetController,
  resendEmailVerificationController,
  resetPasswordController,
  registerFromGoogleOAuthController,
  signInWithEmailController,
  signUpWithEmailController,
  verifyEmailController,
};
