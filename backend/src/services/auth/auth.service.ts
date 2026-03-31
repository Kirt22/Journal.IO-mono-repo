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
const EMAIL_VERIFICATION_LENGTH = 6;
const EMAIL_VERIFICATION_EXPIRY_MS = parseDurationToMs(
  process.env.EMAIL_VERIFICATION_EXPIRES_IN || "30m",
  30 * 60 * 1000
);
const PASSWORD_HASH_ITERATIONS = 120000;
const PASSWORD_HASH_KEY_LENGTH = 64;
const PASSWORD_HASH_DIGEST = "sha512";

type SendOtpInput = {
  phoneNumber: string;
};

type VerifyOtpInput = {
  phoneNumber: string;
  otp: string;
  name?: string;
  goals?: string[];
  onboardingCompleted?: boolean;
};

type GoogleOAuthInput = {
  googleIdToken: string;
  googleUserId?: string;
  email: string;
  name: string;
  profilePic?: string;
  onboardingCompleted?: boolean;
};

type SignUpWithEmailInput = {
  email: string;
  password: string;
  onboardingContext?: {
    goals?: string[];
  };
  onboardingCompleted?: boolean;
};

type ResendEmailVerificationInput = {
  email: string;
};

type VerifyEmailInput = {
  email: string;
  code: string;
  onboardingCompleted?: boolean;
};

type SignInWithEmailInput = {
  email: string;
  password: string;
  onboardingCompleted?: boolean;
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

function parseDurationToMs(value: string, fallbackMs: number): number {
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
}

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

const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

const normalizeSelections = (values?: string[]) =>
  Array.from(new Set((values || []).map(value => value.trim()).filter(Boolean)));

const generateEmailVerificationCode = (): string => {
  const digits = Array.from({ length: EMAIL_VERIFICATION_LENGTH }, () =>
    crypto.randomInt(0, 10).toString()
  );
  return digits.join("");
};

const hashEmailVerificationCode = (
  email: string,
  code: string
): string => {
  return crypto
    .createHash("sha256")
    .update(`${normalizeEmail(email)}:${code}`)
    .digest("hex");
};

const generatePasswordHash = (password: string): string => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto
    .pbkdf2Sync(
      password,
      salt,
      PASSWORD_HASH_ITERATIONS,
      PASSWORD_HASH_KEY_LENGTH,
      PASSWORD_HASH_DIGEST
    )
    .toString("hex");

  return [
    "pbkdf2",
    PASSWORD_HASH_DIGEST,
    PASSWORD_HASH_ITERATIONS.toString(),
    salt,
    derivedKey,
  ].join("$");
};

const verifyPasswordHash = (password: string, storedHash?: string | null) => {
  if (!storedHash) {
    return false;
  }

  const [algorithm, digest, iterationsRaw, salt, derivedKey] =
    storedHash.split("$");

  if (
    algorithm !== "pbkdf2" ||
    digest !== PASSWORD_HASH_DIGEST ||
    !iterationsRaw ||
    !salt ||
    !derivedKey
  ) {
    return false;
  }

  const iterations = Number(iterationsRaw);

  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const recalculated = crypto
    .pbkdf2Sync(password, salt, iterations, derivedKey.length / 2, digest)
    .toString("hex");

  const recalculatedBuffer = Buffer.from(recalculated, "hex");
  const storedBuffer = Buffer.from(derivedKey, "hex");

  if (recalculatedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(recalculatedBuffer, storedBuffer);
};

const buildEmailVerificationChallenge = async (
  user: IUser,
  email: string
) => {
  const verificationCode = generateEmailVerificationCode();
  user.emailVerificationCodeHash = hashEmailVerificationCode(
    email,
    verificationCode
  );
  user.emailVerificationExpiresAt = new Date(
    Date.now() + EMAIL_VERIFICATION_EXPIRY_MS
  );

  await user.save();

  return {
    email,
    verificationRequired: true,
    expiresInSeconds: Math.floor(EMAIL_VERIFICATION_EXPIRY_MS / 1000),
    verificationCode:
      process.env.NODE_ENV !== "production" ? verificationCode : undefined,
  };
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
    onboardingCompleted: Boolean(user.onboardingCompleted),
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
  onboardingCompleted,
}: {
  phoneNumber: string;
  name: string;
  goals?: string[];
  onboardingCompleted?: boolean;
}) => {
  try {
    return await userModel.create({
      name,
      phoneNumber,
      authProviders: ["phone"],
      journalingGoals: goals || [],
      profileSetupCompleted: false,
      onboardingCompleted: Boolean(onboardingCompleted),
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

const signUpWithEmail = async ({
  email,
  password,
  onboardingContext,
  onboardingCompleted,
}: SignUpWithEmailInput) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedGoals = normalizeSelections(onboardingContext?.goals);
  const passwordHash = generatePasswordHash(password);

  let user = await userModel.findOne({ email: normalizedEmail });

  if (user?.emailVerifiedAt) {
    return {
      ok: false as const,
      code: "EMAIL_EXISTS",
      message: "An account with this email already exists. Please sign in.",
    };
  }

  if (!user) {
    user = await userModel.create({
      name: "Journal User",
      email: normalizedEmail,
      authProviders: ["email"],
      journalingGoals: normalizedGoals,
      profileSetupCompleted: false,
      onboardingCompleted: Boolean(onboardingCompleted),
      emailPasswordHash: passwordHash,
      emailVerifiedAt: null,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
    });
  } else {
    if (!user.authProviders.includes("email")) {
      user.authProviders = [...user.authProviders, "email"];
    }

    user.emailPasswordHash = passwordHash;
    user.emailVerifiedAt = null;
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpiresAt = null;
    if (normalizedGoals.length > 0) {
      user.journalingGoals = normalizedGoals;
    }

    if (onboardingCompleted !== undefined) {
      user.onboardingCompleted = onboardingCompleted;
    }

    await user.save();
  }

  const challenge = await buildEmailVerificationChallenge(user, normalizedEmail);

  return {
    ok: true as const,
    challenge,
  };
};

const resendEmailVerification = async ({
  email,
}: ResendEmailVerificationInput) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await userModel.findOne({ email: normalizedEmail });

  if (!user) {
    return {
      ok: false as const,
      code: "USER_NOT_FOUND",
      message: "No account found for this email address.",
    };
  }

  if (user.emailVerifiedAt) {
    return {
      ok: false as const,
      code: "EMAIL_ALREADY_VERIFIED",
      message: "This email is already verified.",
    };
  }

  const challenge = await buildEmailVerificationChallenge(user, normalizedEmail);

  return {
    ok: true as const,
    challenge,
  };
};

const verifyEmail = async ({
  email,
  code,
  onboardingCompleted,
}: VerifyEmailInput) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await userModel.findOne({ email: normalizedEmail });

  if (!user) {
    return {
      ok: false as const,
      code: "USER_NOT_FOUND",
      message: "No pending account found for this email address.",
    };
  }

  if (!user.emailVerificationCodeHash || !user.emailVerificationExpiresAt) {
    return {
      ok: false as const,
      code: "VERIFICATION_NOT_FOUND",
      message: "No active verification code found for this email address.",
    };
  }

  if (Date.now() > user.emailVerificationExpiresAt.getTime()) {
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpiresAt = null;
    await user.save();

    return {
      ok: false as const,
      code: "VERIFICATION_EXPIRED",
      message: "The verification code has expired. Please request a new one.",
    };
  }

  const expectedCodeHash = hashEmailVerificationCode(normalizedEmail, code);

  if (expectedCodeHash !== user.emailVerificationCodeHash) {
    return {
      ok: false as const,
      code: "VERIFICATION_INVALID",
      message: "The verification code is incorrect.",
    };
  }

  const isNewUser = !Boolean(user.emailVerifiedAt);

  user.emailVerifiedAt = new Date();
  user.emailVerificationCodeHash = null;
  user.emailVerificationExpiresAt = null;

  if (!user.authProviders.includes("email")) {
    user.authProviders = [...user.authProviders, "email"];
  }

  if (onboardingCompleted !== undefined) {
    user.onboardingCompleted = onboardingCompleted;
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

const signInWithEmail = async ({
  email,
  password,
  onboardingCompleted,
}: SignInWithEmailInput) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await userModel.findOne({ email: normalizedEmail });

  if (!user) {
    return {
      ok: false as const,
      code: "USER_NOT_FOUND",
      message: "No account found for this email address.",
    };
  }

  if (!user.emailVerifiedAt) {
    return {
      ok: false as const,
      code: "EMAIL_NOT_VERIFIED",
      message: "Please verify your email before signing in.",
    };
  }

  if (!verifyPasswordHash(password, user.emailPasswordHash)) {
    return {
      ok: false as const,
      code: "INVALID_CREDENTIALS",
      message: "The email or password is incorrect.",
    };
  }

  if (!user.authProviders.includes("email")) {
    user.authProviders = [...user.authProviders, "email"];
    await user.save();
  }

  if (onboardingCompleted) {
    user.onboardingCompleted = true;
    await user.save();
  }

  const tokens = await issueTokens(user);

  return {
    ok: true as const,
    tokens,
    user: buildUserPayload(user),
  };
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

const verifyOtp = async ({
  phoneNumber,
  otp,
  name,
  goals,
  onboardingCompleted,
}: VerifyOtpInput) => {
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
      ...(onboardingCompleted !== undefined
        ? { onboardingCompleted }
        : {}),
    });
  }

  if (!user && trimmedName) {
    user = await createPhoneUser({
      phoneNumber: normalizedPhoneNumber,
      name: trimmedName,
      goals: normalizedGoals,
      ...(onboardingCompleted !== undefined
        ? { onboardingCompleted }
        : {}),
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

  if (onboardingCompleted) {
    user.onboardingCompleted = true;
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
      onboardingCompleted: Boolean(input.onboardingCompleted),
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
    if (input.onboardingCompleted) {
      user.onboardingCompleted = true;
    }
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
  signInWithEmail,
  signUpWithEmail,
  sendOtp,
  signInWithGoogle,
  verifyEmail,
  verifyOtp,
};
