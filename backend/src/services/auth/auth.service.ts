import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  IOnboardingContext,
  IUser,
  userModel,
} from "../../schema/user.schema";
import {
  isMsg91SmsConfigured,
  resendOtpSmsViaMsg91,
  sendOtpSmsViaMsg91,
  verifyOtpSmsViaMsg91,
} from "./msg91Sms.service";
import { sendEmailVerificationCode } from "./emailOtp.service";

const otpStore = new Map<
  string,
  {
    code: string;
    expiresAt: number;
    attempts: number;
  }
>();

const OTP_LENGTH = 6;
const OTP_MAX_ATTEMPTS = 5;

type SendOtpInput = {
  phoneNumber: string;
};

type VerifyOtpInput = {
  phoneNumber: string;
  otp: string;
  name?: string;
  goals?: string[];
};

type GoogleOAuthInput = {
  googleIdToken: string;
  googleUserId?: string;
  email: string;
  name: string;
  profilePic?: string;
};

type EmailOnboardingContextInput = {
  ageRange?: string;
  journalingExperience?: string;
  goals?: string[];
  supportFocus?: string[];
  reminderPreference?: string;
  aiOptIn?: boolean;
  privacyConsentAccepted?: boolean;
};

type SignUpWithEmailInput = {
  email: string;
  password: string;
  onboardingContext?: EmailOnboardingContextInput;
};

type ResendEmailVerificationInput = {
  email: string;
};

type VerifyEmailInput = {
  email: string;
  code: string;
};

type SignInWithEmailInput = {
  email: string;
  password: string;
};

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

type EmailVerificationChallenge = {
  email: string;
  verificationRequired: true;
  expiresInSeconds: number;
  verificationCode?: string;
};

const getAccessSecret = (): string => {
  return process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "";
};

const getAccessTokenExpiry = (): Exclude<
  jwt.SignOptions["expiresIn"],
  undefined
> => {
  return (process.env.JWT_ACCESS_EXPIRES_IN || "15m") as Exclude<
    jwt.SignOptions["expiresIn"],
    undefined
  >;
};

const parseDurationToMs = (value: string, fallbackMs: number): number => {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) {
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const unitMs = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * unitMs[unit as keyof typeof unitMs];
};

const getRefreshTokenExpiryMs = (): number => {
  return parseDurationToMs(
    process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    7 * 24 * 60 * 60 * 1000
  );
};

const getOtpExpiryMs = (): number => {
  return parseDurationToMs(process.env.AUTH_OTP_EXPIRES_IN || "10m", 10 * 60 * 1000);
};

const getEmailVerificationExpiryMs = (): number => {
  return parseDurationToMs(
    process.env.AUTH_EMAIL_OTP_EXPIRES_IN || "30m",
    30 * 60 * 1000
  );
};

const normalizePhoneNumber = (phoneNumber: string): string => {
  return phoneNumber.replace(/[^\d+]/g, "");
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const generateOtp = (): string => {
  const digits = Array.from({ length: OTP_LENGTH }, () =>
    crypto.randomInt(0, 10).toString()
  );
  return digits.join("");
};

const PASSWORD_KEY_LENGTH = 64;
const EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;

const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto
    .scryptSync(password, salt, PASSWORD_KEY_LENGTH)
    .toString("hex");

  return `${salt}:${derivedKey}`;
};

const verifyPasswordHash = (
  password: string,
  passwordHash: string | null | undefined
): boolean => {
  if (!passwordHash) {
    return false;
  }

  const [salt, storedKey] = passwordHash.split(":");

  if (!salt || !storedKey) {
    return false;
  }

  const derivedKey = crypto
    .scryptSync(password, salt, PASSWORD_KEY_LENGTH)
    .toString("hex");

  return crypto.timingSafeEqual(
    Buffer.from(storedKey, "hex"),
    Buffer.from(derivedKey, "hex")
  );
};

const generateRefreshToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

const hashRefreshToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const buildUserPayload = (user: IUser) => {
  return {
    userId: user._id.toString(),
    name: user.name,
    phoneNumber: user.phoneNumber || null,
    email: user.email || null,
    journalingGoals: user.journalingGoals || [],
    avatarColor: user.avatarColor || null,
    profileSetupCompleted: Boolean(user.profileSetupCompleted),
    profilePic: user.profilePic || null,
  };
};

const deriveDisplayNameFromEmail = (email: string): string => {
  const localPart = normalizeEmail(email).split("@")[0] || "Journal User";
  const cleaned = localPart.replace(/[._-]+/g, " ").trim();

  if (!cleaned) {
    return "Journal User";
  }

  return cleaned
    .split(/\s+/)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const normalizeStringList = (values?: string[]) =>
  Array.from(new Set((values || []).map(value => value.trim()).filter(Boolean)));

const normalizeOptionalString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const sanitizeOnboardingContext = (
  onboardingContext?: EmailOnboardingContextInput
): IOnboardingContext | null => {
  if (!onboardingContext) {
    return null;
  }

  return {
    ageRange: normalizeOptionalString(onboardingContext.ageRange),
    journalingExperience: normalizeOptionalString(
      onboardingContext.journalingExperience
    ),
    goals: normalizeStringList(onboardingContext.goals),
    supportFocus: normalizeStringList(onboardingContext.supportFocus),
    reminderPreference: normalizeOptionalString(
      onboardingContext.reminderPreference
    ),
    aiOptIn:
      typeof onboardingContext.aiOptIn === "boolean"
        ? onboardingContext.aiOptIn
        : null,
    privacyConsentAccepted:
      typeof onboardingContext.privacyConsentAccepted === "boolean"
        ? onboardingContext.privacyConsentAccepted
        : null,
  };
};

const buildEmailVerificationChallenge = (
  email: string,
  code: string
): EmailVerificationChallenge => {
  const challenge: EmailVerificationChallenge = {
    email,
    verificationRequired: true,
    expiresInSeconds: Math.floor(getEmailVerificationExpiryMs() / 1000),
  };

  if (process.env.NODE_ENV !== "production") {
    challenge.verificationCode = code;
  }

  return challenge;
};

const issueTokens = async (user: IUser): Promise<AuthTokens> => {
  const accessSecret = getAccessSecret();

  if (!accessSecret) {
    throw new Error("JWT access secret is not configured.");
  }

  const accessToken = jwt.sign(
    {
      sub: user._id.toString(),
      phoneNumber: user.phoneNumber || null,
      email: user.email || null,
      name: user.name,
    },
    accessSecret,
    { expiresIn: getAccessTokenExpiry() }
  );

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const refreshTokenExpiresAt = new Date(Date.now() + getRefreshTokenExpiryMs());

  await userModel.updateOne(
    { _id: user._id },
    {
      $set: {
        refreshTokenHash,
        refreshTokenExpiresAt,
        lastLoginAt: new Date(),
      },
    }
  );

  return { accessToken, refreshToken };
};

const createPhoneUser = async ({
  phoneNumber,
  name,
  goals,
}: {
  phoneNumber: string;
  name: string;
  goals?: string[];
}) => {
  try {
    return await userModel.create({
      name,
      phoneNumber,
      authProviders: ["phone"],
      journalingGoals: goals || [],
      profileSetupCompleted: false,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === 11000
    ) {
      const existingUser = await userModel.findOne({ phoneNumber });

      if (existingUser) {
        return existingUser;
      }
    }

    throw error;
  }
};

const sendOtp = async ({ phoneNumber }: SendOtpInput) => {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const code = generateOtp();
  const providerManaged = isMsg91SmsConfigured();

  otpStore.set(normalizedPhoneNumber, {
    code,
    expiresAt: Date.now() + getOtpExpiryMs(),
    attempts: 0,
  });

  try {
    if (providerManaged) {
      await sendOtpSmsViaMsg91({
        phoneNumber: normalizedPhoneNumber,
      });
    } else if (process.env.NODE_ENV === "production") {
      otpStore.delete(normalizedPhoneNumber);
      throw new Error("MSG91 SMS service is not configured.");
    } else {
      console.warn(
        `MSG91 SMS service is not configured. OTP generated locally for ${normalizedPhoneNumber}.`
      );
    }
  } catch (error) {
    otpStore.delete(normalizedPhoneNumber);
    console.error("Failed to deliver OTP SMS via MSG91:", error);
    throw error;
  }

  return {
    phoneNumber: normalizedPhoneNumber,
    expiresInSeconds: Math.floor(getOtpExpiryMs() / 1000),
    debugOtp:
      !providerManaged && process.env.NODE_ENV !== "production" ? code : undefined,
  };
};

const resendOtp = async ({ phoneNumber }: SendOtpInput) => {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const providerManaged = isMsg91SmsConfigured();

  if (providerManaged) {
    try {
      await resendOtpSmsViaMsg91({
        phoneNumber: normalizedPhoneNumber,
      });
    } catch (error) {
      console.error("Failed to resend OTP SMS via MSG91:", error);
      throw error;
    }

    return {
      phoneNumber: normalizedPhoneNumber,
      expiresInSeconds: Math.floor(getOtpExpiryMs() / 1000),
      debugOtp: undefined,
    };
  }

  return sendOtp({ phoneNumber });
};

const verifyOtp = async ({ phoneNumber, otp, name, goals }: VerifyOtpInput) => {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const otpRecord = otpStore.get(normalizedPhoneNumber);

  if (!otpRecord) {
    return {
      ok: false as const,
      code: "OTP_NOT_FOUND",
      message: "No active verification code found for this phone number.",
    };
  }

  if (Date.now() > otpRecord.expiresAt) {
    otpStore.delete(normalizedPhoneNumber);
    return {
      ok: false as const,
      code: "OTP_EXPIRED",
      message: "The verification code has expired. Please request a new one.",
    };
  }

  if (isMsg91SmsConfigured()) {
    try {
      await verifyOtpSmsViaMsg91({
        phoneNumber: normalizedPhoneNumber,
        otp,
      });
    } catch (error) {
      otpRecord.attempts += 1;

      if (otpRecord.attempts > OTP_MAX_ATTEMPTS) {
        otpStore.delete(normalizedPhoneNumber);
        return {
          ok: false as const,
          code: "OTP_LOCKED",
          message: "Too many incorrect attempts. Please request a new code.",
        };
      }

      console.error("MSG91 OTP verification failed:", error);
      return {
        ok: false as const,
        code: "OTP_INVALID",
        message: "The verification code is incorrect.",
      };
    }
  } else {
    otpRecord.attempts += 1;

    if (otpRecord.attempts > OTP_MAX_ATTEMPTS) {
      otpStore.delete(normalizedPhoneNumber);
      return {
        ok: false as const,
        code: "OTP_LOCKED",
        message: "Too many incorrect attempts. Please request a new code.",
      };
    }

    if (otpRecord.code !== otp) {
      return {
        ok: false as const,
        code: "OTP_INVALID",
        message: "The verification code is incorrect.",
      };
    }
  }

  otpStore.delete(normalizedPhoneNumber);

  let user = await userModel.findOne({ phoneNumber: normalizedPhoneNumber });
  const normalizedGoals = Array.from(
    new Set((goals || []).map(goal => goal.trim()).filter(Boolean))
  );
  const trimmedName = name?.trim();
  const isNewUser = !user;

  if (!user && !trimmedName) {
    user = await createPhoneUser({
      phoneNumber: normalizedPhoneNumber,
      name: "Journal User",
      goals: normalizedGoals,
    });
  }

  if (!user && trimmedName) {
    user = await createPhoneUser({
      phoneNumber: normalizedPhoneNumber,
      name: trimmedName,
      goals: normalizedGoals,
    });
  }

  if (!user) {
    return {
      ok: false as const,
      code: "USER_NOT_FOUND",
      message: "Unable to complete sign in for this phone number.",
    };
  }

  if (!user.authProviders.includes("phone")) {
    user.authProviders = [...user.authProviders, "phone"];
  }

  if (normalizedGoals.length > 0) {
    user.journalingGoals = normalizedGoals;
  }

  await user.save();

  const tokens = await issueTokens(user);

  return {
    ok: true as const,
    tokens,
    user: buildUserPayload(user),
    isNewUser,
  };
};

const signInWithGoogle = async (input: GoogleOAuthInput) => {
  const email = input.email.toLowerCase();

  let user =
    (input.googleUserId
      ? await userModel.findOne({ googleUserId: input.googleUserId })
      : null) || (await userModel.findOne({ email }));

  if (!user) {
    user = await userModel.create({
      name: input.name,
      email,
      googleUserId: input.googleUserId || null,
      profilePic: input.profilePic || null,
      authProviders: ["google"],
    });
  } else {
    const authProviders = user.authProviders.includes("google")
      ? user.authProviders
      : [...user.authProviders, "google"];

    user.name = user.name || input.name;
    user.email = user.email || email;
    user.googleUserId = user.googleUserId || input.googleUserId || null;
    user.profilePic = input.profilePic || user.profilePic || null;
    user.authProviders = authProviders;
    await user.save();
  }

  const tokens = await issueTokens(user);

  return {
    tokens,
    user: buildUserPayload(user),
  };
};

const signUpWithEmail = async ({
  email,
  password,
  onboardingContext,
}: SignUpWithEmailInput) => {
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = hashPassword(password);
  const emailVerificationCode = generateOtp();
  const emailVerificationExpiresAt = new Date(
    Date.now() + getEmailVerificationExpiryMs()
  );
  const normalizedOnboardingContext = sanitizeOnboardingContext(onboardingContext);
  const displayName = deriveDisplayNameFromEmail(normalizedEmail);
  const onboardingGoals = normalizedOnboardingContext?.goals || [];

  let user = await userModel.findOne({ email: normalizedEmail });

  if (user?.emailVerified) {
    return {
      ok: false as const,
      status: 409 as const,
      code: "EMAIL_ALREADY_REGISTERED",
      message: "An account with this email already exists. Please sign in.",
    };
  }

  if (!user) {
    user = await userModel.create({
      name: displayName,
      email: normalizedEmail,
      passwordHash,
      emailVerified: false,
      emailVerificationCode,
      emailVerificationExpiresAt,
      emailVerificationAttempts: 0,
      authProviders: ["email"],
      journalingGoals: onboardingGoals,
      onboardingContext: normalizedOnboardingContext,
      profileSetupCompleted: false,
    });
  } else {
    user.name = user.name || displayName;
    user.passwordHash = passwordHash;
    user.emailVerificationCode = emailVerificationCode;
    user.emailVerificationExpiresAt = emailVerificationExpiresAt;
    user.emailVerificationAttempts = 0;
    user.onboardingContext = normalizedOnboardingContext;
    user.journalingGoals = onboardingGoals;
    if (!user.authProviders.includes("email")) {
      user.authProviders = [...user.authProviders, "email"];
    }
    await user.save();
  }

  await sendEmailVerificationCode({
    email: normalizedEmail,
    code: emailVerificationCode,
  });

  return {
    ok: true as const,
    challenge: buildEmailVerificationChallenge(
      normalizedEmail,
      emailVerificationCode
    ),
  };
};

const resendEmailVerification = async ({
  email,
}: ResendEmailVerificationInput) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await userModel.findOne({ email: normalizedEmail });

  if (!user || !user.passwordHash) {
    return {
      ok: false as const,
      status: 404 as const,
      code: "PENDING_ACCOUNT_NOT_FOUND",
      message: "No pending account found for this email.",
    };
  }

  if (user.emailVerified) {
    return {
      ok: false as const,
      status: 409 as const,
      code: "EMAIL_ALREADY_VERIFIED",
      message: "This email is already verified. Please sign in.",
    };
  }

  const emailVerificationCode = generateOtp();

  user.emailVerificationCode = emailVerificationCode;
  user.emailVerificationExpiresAt = new Date(
    Date.now() + getEmailVerificationExpiryMs()
  );
  user.emailVerificationAttempts = 0;
  await user.save();

  await sendEmailVerificationCode({
    email: normalizedEmail,
    code: emailVerificationCode,
  });

  return {
    ok: true as const,
    challenge: buildEmailVerificationChallenge(
      normalizedEmail,
      emailVerificationCode
    ),
  };
};

const verifyEmail = async ({ email, code }: VerifyEmailInput) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await userModel.findOne({ email: normalizedEmail });

  if (!user || !user.passwordHash) {
    return {
      ok: false as const,
      status: 404 as const,
      code: "PENDING_ACCOUNT_NOT_FOUND",
      message: "No pending account found for this email.",
    };
  }

  if (user.emailVerified) {
    return {
      ok: false as const,
      status: 409 as const,
      code: "EMAIL_ALREADY_VERIFIED",
      message: "This email is already verified. Please sign in.",
    };
  }

  if (!user.emailVerificationCode || !user.emailVerificationExpiresAt) {
    return {
      ok: false as const,
      status: 400 as const,
      code: "EMAIL_OTP_NOT_FOUND",
      message: "No active verification code found for this email.",
    };
  }

  if (Date.now() > user.emailVerificationExpiresAt.getTime()) {
    user.emailVerificationCode = null;
    user.emailVerificationExpiresAt = null;
    user.emailVerificationAttempts = 0;
    await user.save();

    return {
      ok: false as const,
      status: 400 as const,
      code: "EMAIL_OTP_EXPIRED",
      message: "The verification code has expired. Please request a new one.",
    };
  }

  if (user.emailVerificationCode !== code) {
    user.emailVerificationAttempts += 1;

    if (user.emailVerificationAttempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
      user.emailVerificationCode = null;
      user.emailVerificationExpiresAt = null;
      user.emailVerificationAttempts = 0;
      await user.save();

      return {
        ok: false as const,
        status: 400 as const,
        code: "EMAIL_OTP_LOCKED",
        message: "Too many incorrect attempts. Please request a new code.",
      };
    }

    await user.save();

    return {
      ok: false as const,
      status: 400 as const,
      code: "EMAIL_OTP_INVALID",
      message: "The verification code is incorrect.",
    };
  }

  user.emailVerified = true;
  user.emailVerificationCode = null;
  user.emailVerificationExpiresAt = null;
  user.emailVerificationAttempts = 0;
  if (!user.authProviders.includes("email")) {
    user.authProviders = [...user.authProviders, "email"];
  }
  if (!user.name?.trim()) {
    user.name = deriveDisplayNameFromEmail(normalizedEmail);
  }
  if (!user.journalingGoals.length && user.onboardingContext?.goals?.length) {
    user.journalingGoals = normalizeStringList(user.onboardingContext.goals);
  }
  await user.save();

  const tokens = await issueTokens(user);

  return {
    ok: true as const,
    tokens,
    user: buildUserPayload(user),
    isNewUser: true,
  };
};

const signInWithEmail = async ({
  email,
  password,
}: SignInWithEmailInput) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await userModel.findOne({ email: normalizedEmail });

  if (!user || !user.passwordHash || !verifyPasswordHash(password, user.passwordHash)) {
    return {
      ok: false as const,
      status: 401 as const,
      code: "INVALID_CREDENTIALS",
      message: "Incorrect email or password.",
    };
  }

  if (!user.emailVerified) {
    return {
      ok: false as const,
      status: 403 as const,
      code: "EMAIL_NOT_VERIFIED",
      message: "Please verify your email before signing in.",
    };
  }

  if (!user.authProviders.includes("email")) {
    user.authProviders = [...user.authProviders, "email"];
    await user.save();
  }

  const tokens = await issueTokens(user);

  return {
    ok: true as const,
    tokens,
    user: buildUserPayload(user),
  };
};

const refreshAccessToken = async (
  refreshToken: string
): Promise<{ accessToken: string } | null> => {
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const user = await userModel.findOne({
    refreshTokenHash,
    refreshTokenExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    return null;
  }

  const accessSecret = getAccessSecret();
  if (!accessSecret) {
    throw new Error("JWT access secret is not configured.");
  }

  const accessToken = jwt.sign(
    {
      sub: user._id.toString(),
      phoneNumber: user.phoneNumber || null,
      email: user.email || null,
      name: user.name,
    },
    accessSecret,
    { expiresIn: getAccessTokenExpiry() }
  );

  return { accessToken };
};

const invalidateRefreshToken = async (userId: string): Promise<void> => {
  await userModel.updateOne(
    { _id: userId },
    {
      $set: {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    }
  );
};

export {
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
};
