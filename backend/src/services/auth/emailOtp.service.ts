type SendEmailVerificationInput = {
  email: string;
  code: string;
};

const shouldUseConsoleDelivery = () =>
  process.env.NODE_ENV !== "production" ||
  process.env.AUTH_EMAIL_DELIVERY_MODE === "console";

const sendEmailVerificationCode = async ({
  email,
  code,
}: SendEmailVerificationInput) => {
  if (shouldUseConsoleDelivery()) {
    console.info(`[Auth] Email verification code for ${email}: ${code}`);
    return;
  }

  throw new Error("Email verification delivery is not configured.");
};

export { sendEmailVerificationCode };
