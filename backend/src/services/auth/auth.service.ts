import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import {
  type IOnboardingContext,
  type IUser,
  userModel,
} from "../../schema/user.schema";
import { sendEmailVerificationCode } from "./emailOtp.service";
import {
  isMsg91SmsConfigured,
  resendOtpSmsViaMsg91,
  sendOtpSmsViaMsg91,
  verifyOtpSmsViaMsg91,
} from "./msg91Sms.service";

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
const EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;
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
  idToken: string;
  onboardingContext?: EmailOnboardingContextInput;
  onboardingCompleted?: boolean;
};

type VerifiedGoogleProfile = {
  googleSub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
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

type AuthFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

type AuthSuccess<T> = T & {
  ok: true;
};

const getAccessSecret = (): string => {
  return process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "";
};

const getAccessTokenExpiry = (): Exclude<
  jwt.SignOptions["expiresIn"],
  undefined
> => {
  return (process.env.JWT_ACCESS_EXPIRES_IN || "14d") as Exclude<
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

const getRefreshTokenExpiryMs = () => {
  return parseDurationToMs(
    process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    7 * 24 * 60 * 60 * 1000
  );
};

const getOtpExpiryMs = () => {
  return parseDurationToMs(
    process.env.AUTH_OTP_EXPIRES_IN || "10m",
    10 * 60 * 1000
  );
};

const normalizeEnvClientId = (value?: string | null) => {
  const trimmed = value?.trim() || "";
  return trimmed.replace(/^["']|["']$/g, "").trim();
};

const getGoogleClientAudiences = () => {
  return Array.from(
    new Set(
      [
        normalizeEnvClientId(process.env.GOOGLE_WEB_CLIENT_ID),
        normalizeEnvClientId(process.env.GOOGLE_IOS_CLIENT_ID),
        normalizeEnvClientId(process.env.GOOGLE_ANDROID_CLIENT_ID),
      ].filter(Boolean)
    )
  );
};

const getEmailVerificationExpiryMs = () => {
  return parseDurationToMs(
    process.env.AUTH_EMAIL_OTP_EXPIRES_IN || "30m",
    30 * 60 * 1000
  );
};

const normalizePhoneNumber = (phoneNumber: string) => {
  return phoneNumber.replace(/[^\d+]/g, "");
};

const normalizeEmail = (email: string) => {
  return email.trim().toLowerCase();
};

const normalizeOptionalString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeSelections = (values?: string[]) =>
  Array.from(new Set((values || []).map(value => value.trim()).filter(Boolean)));

const deriveDisplayNameFromEmail = (email: string) => {
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

const createDefaultGoogleIdTokenVerifier = () => {
  return async (idToken: string): Promise<VerifiedGoogleProfile | null> => {
    const audiences = getGoogleClientAudiences();

    if (audiences.length === 0) {
      throw new Error(
        "At least one Google client ID must be configured for token verification."
      );
    }

    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: audiences,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub) {
      return null;
    }

    return {
      googleSub: payload.sub,
      email: normalizeOptionalString(payload.email) || null,
      emailVerified: Boolean(payload.email_verified),
      name: normalizeOptionalString(payload.name) || null,
      picture: normalizeOptionalString(payload.picture) || null,
    };
  };
};

let verifyGoogleIdTokenImpl = createDefaultGoogleIdTokenVerifier();

const setGoogleIdTokenVerifierForTests = (
  verifier: typeof verifyGoogleIdTokenImpl
) => {
  verifyGoogleIdTokenImpl = verifier;
};

const resetGoogleIdTokenVerifierForTests = () => {
  verifyGoogleIdTokenImpl = createDefaultGoogleIdTokenVerifier();
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
    goals: normalizeSelections(onboardingContext.goals),
    supportFocus: normalizeSelections(onboardingContext.supportFocus),
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

const generateOtp = () => {
  return Array.from({ length: OTP_LENGTH }, () =>
    crypto.randomInt(0, 10).toString()
  ).join("");
};

const generatePasswordHash = (password: string) => {
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

  if (storedHash.includes("$")) {
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
  }

  const [salt, derivedKey] = storedHash.split(":");

  if (!salt || !derivedKey) {
    return false;
  }

  const storedBuffer = Buffer.from(derivedKey, "hex");
  const recalculatedBuffer = crypto.scryptSync(
    password,
    salt,
    storedBuffer.length
  );

  if (recalculatedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(recalculatedBuffer, storedBuffer);
};

const hashRefreshToken = (token: string) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const generateRefreshToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

const hashEmailVerificationCode = (email: string, code: string) => {
  return crypto
    .createHash("sha256")
    .update(`${normalizeEmail(email)}:${code}`)
    .digest("hex");
};

const isDuplicateKeyError = (error: unknown): error is { code: number } => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "number"
  );
};

const isEmailVerified = (user: IUser) => {
  return Boolean(user.emailVerified || user.emailVerifiedAt);
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
    aiOptIn:
      typeof user.onboardingContext?.aiOptIn === "boolean"
        ? user.onboardingContext.aiOptIn
        : null,
  };
};

const buildEmailVerificationChallenge = (
  email: string,
  verificationCode: string
): EmailVerificationChallenge => {
  const challenge: EmailVerificationChallenge = {
    email,
    verificationRequired: true,
    expiresInSeconds: Math.floor(getEmailVerificationExpiryMs() / 1000),
  };

  if (process.env.NODE_ENV !== "production") {
    challenge.verificationCode = verificationCode;
  }

  return challenge;
};

const getStoredPasswordHash = (user: IUser) => {
  return user.passwordHash || user.emailPasswordHash || null;
};

const setPendingEmailVerification = (
  user: IUser,
  email: string,
  verificationCode: string
) => {
  user.emailVerified = false;
  user.emailVerifiedAt = null;
  user.emailVerificationCode = verificationCode;
  user.emailVerificationCodeHash = hashEmailVerificationCode(
    email,
    verificationCode
  );
  user.emailVerificationExpiresAt = new Date(
    Date.now() + getEmailVerificationExpiryMs()
  );
  user.emailVerificationAttempts = 0;
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
    if (isDuplicateKeyError(error) && error.code === 11000) {
      const existingUser = await userModel.findOne({ phoneNumber });

      if (existingUser) {
        return existingUser;
      }
    }

    throw error;
  }
};

const createGoogleUser = async ({
  googleProfile,
  onboardingContext,
  onboardingCompleted,
}: {
  googleProfile: VerifiedGoogleProfile;
  onboardingContext?: EmailOnboardingContextInput;
  onboardingCompleted?: boolean | undefined;
}) => {
  const fallbackName = googleProfile.email
    ? deriveDisplayNameFromEmail(googleProfile.email)
    : "Journal User";
  const normalizedOnboardingContext = sanitizeOnboardingContext(onboardingContext);

  return userModel.create({
    name: googleProfile.name || fallbackName,
    email: googleProfile.email,
    googleUserId: googleProfile.googleSub,
    profilePic: googleProfile.picture,
    authProviders: ["google"],
    profileSetupCompleted: false,
    onboardingCompleted: Boolean(onboardingCompleted),
    emailVerified: googleProfile.emailVerified,
    emailVerifiedAt: googleProfile.emailVerified ? new Date() : null,
    journalingGoals: normalizedOnboardingContext?.goals || [],
    onboardingContext: normalizedOnboardingContext,
  });
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
      !providerManaged && process.env.NODE_ENV !== "production"
        ? code
        : undefined,
  };
};

const resendOtp = async ({ phoneNumber }: SendOtpInput) => {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

  if (isMsg91SmsConfigured()) {
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
}: VerifyOtpInput): Promise<
  | AuthSuccess<{
      tokens: AuthTokens;
      user: ReturnType<typeof buildUserPayload>;
      isNewUser: boolean;
    }>
  | AuthFailure
> => {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const otpRecord = otpStore.get(normalizedPhoneNumber);

  if (!otpRecord) {
    return {
      ok: false,
      status: 404,
      code: "OTP_NOT_FOUND",
      message: "No active verification code found for this phone number.",
    };
  }

  if (Date.now() > otpRecord.expiresAt) {
    otpStore.delete(normalizedPhoneNumber);
    return {
      ok: false,
      status: 400,
      code: "OTP_EXPIRED",
      message: "The verification code has expired. Please request a new code.",
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
          ok: false,
          status: 400,
          code: "OTP_LOCKED",
          message: "Too many incorrect attempts. Please request a new code.",
        };
      }

      console.error("MSG91 OTP verification failed:", error);
      return {
        ok: false,
        status: 400,
        code: "OTP_INVALID",
        message: "The verification code is incorrect.",
      };
    }
  } else {
    otpRecord.attempts += 1;

    if (otpRecord.attempts > OTP_MAX_ATTEMPTS) {
      otpStore.delete(normalizedPhoneNumber);
      return {
        ok: false,
        status: 400,
        code: "OTP_LOCKED",
        message: "Too many incorrect attempts. Please request a new code.",
      };
    }

    if (otpRecord.code !== otp) {
      return {
        ok: false,
        status: 400,
        code: "OTP_INVALID",
        message: "The verification code is incorrect.",
      };
    }
  }

  otpStore.delete(normalizedPhoneNumber);

  let user = await userModel.findOne({ phoneNumber: normalizedPhoneNumber });
  const normalizedGoals = normalizeSelections(goals);
  const trimmedName = name?.trim();
  const isNewUser = !user;

  if (!user) {
    user = await createPhoneUser({
      phoneNumber: normalizedPhoneNumber,
      name: trimmedName || "Journal User",
      goals: normalizedGoals,
      ...(onboardingCompleted !== undefined ? { onboardingCompleted } : {}),
    });
  }

  if (!user.authProviders.includes("phone")) {
    user.authProviders = [...user.authProviders, "phone"];
  }

  if (trimmedName) {
    user.name = trimmedName;
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
    ok: true,
    tokens,
    user: buildUserPayload(user),
    isNewUser,
  };
};

const signUpWithEmail = async ({
  email,
  password,
  onboardingContext,
  onboardingCompleted,
}: SignUpWithEmailInput): Promise<
  | AuthSuccess<{ challenge: EmailVerificationChallenge }>
  | AuthFailure
> => {
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = generatePasswordHash(password);
  const verificationCode = generateOtp();
  const normalizedOnboardingContext = sanitizeOnboardingContext(onboardingContext);
  const onboardingGoals = normalizedOnboardingContext?.goals || [];
  const displayName = deriveDisplayNameFromEmail(normalizedEmail);

  let user = await userModel.findOne({ email: normalizedEmail });

  if (user && isEmailVerified(user)) {
    return {
      ok: false,
      status: 409,
      code: "EMAIL_ALREADY_REGISTERED",
      message: "An account with this email already exists. Please sign in.",
    };
  }

  if (!user) {
    user = await userModel.create({
      name: displayName,
      email: normalizedEmail,
      passwordHash,
      emailPasswordHash: passwordHash,
      authProviders: ["email"],
      journalingGoals: onboardingGoals,
      onboardingContext: normalizedOnboardingContext,
      profileSetupCompleted: false,
      onboardingCompleted: Boolean(onboardingCompleted),
      emailVerified: false,
      emailVerifiedAt: null,
      emailVerificationCode: null,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationAttempts: 0,
    });
  } else {
    user.name = user.name || displayName;
    user.passwordHash = passwordHash;
    user.emailPasswordHash = passwordHash;
    user.onboardingContext = normalizedOnboardingContext;
    user.journalingGoals = onboardingGoals;

    if (!user.authProviders.includes("email")) {
      user.authProviders = [...user.authProviders, "email"];
    }

    if (onboardingCompleted !== undefined) {
      user.onboardingCompleted = onboardingCompleted;
    }
  }

  setPendingEmailVerification(user, normalizedEmail, verificationCode);
  await user.save();

  await sendEmailVerificationCode({
    email: normalizedEmail,
    code: verificationCode,
  });

  return {
    ok: true,
    challenge: buildEmailVerificationChallenge(normalizedEmail, verificationCode),
  };
};

const resendEmailVerification = async ({
  email,
}: ResendEmailVerificationInput): Promise<
  | AuthSuccess<{ challenge: EmailVerificationChallenge }>
  | AuthFailure
> => {
  const normalizedEmail = normalizeEmail(email);
  const user = await userModel.findOne({ email: normalizedEmail });

  if (!user || !getStoredPasswordHash(user)) {
    return {
      ok: false,
      status: 404,
      code: "PENDING_ACCOUNT_NOT_FOUND",
      message: "No pending account found for this email.",
    };
  }

  if (isEmailVerified(user)) {
    return {
      ok: false,
      status: 409,
      code: "EMAIL_ALREADY_VERIFIED",
      message: "This email is already verified. Please sign in.",
    };
  }

  const verificationCode = generateOtp();

  setPendingEmailVerification(user, normalizedEmail, verificationCode);
  await user.save();

  await sendEmailVerificationCode({
    email: normalizedEmail,
    code: verificationCode,
  });

  return {
    ok: true,
    challenge: buildEmailVerificationChallenge(normalizedEmail, verificationCode),
  };
};

const verifyEmail = async ({
  email,
  code,
  onboardingCompleted,
}: VerifyEmailInput): Promise<
  | AuthSuccess<{
      tokens: AuthTokens;
      user: ReturnType<typeof buildUserPayload>;
      isNewUser: boolean;
    }>
  | AuthFailure
> => {
  const normalizedEmail = normalizeEmail(email);
  const user = await userModel.findOne({ email: normalizedEmail });

  if (!user || !getStoredPasswordHash(user)) {
    return {
      ok: false,
      status: 404,
      code: "PENDING_ACCOUNT_NOT_FOUND",
      message: "No pending account found for this email.",
    };
  }

  if (isEmailVerified(user)) {
    return {
      ok: false,
      status: 409,
      code: "EMAIL_ALREADY_VERIFIED",
      message: "This email is already verified. Please sign in.",
    };
  }

  if (!user.emailVerificationExpiresAt) {
    return {
      ok: false,
      status: 400,
      code: "EMAIL_OTP_NOT_FOUND",
      message: "No active verification code found for this email.",
    };
  }

  if (Date.now() > user.emailVerificationExpiresAt.getTime()) {
    user.emailVerificationCode = null;
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpiresAt = null;
    user.emailVerificationAttempts = 0;
    await user.save();

    return {
      ok: false,
      status: 400,
      code: "EMAIL_OTP_EXPIRED",
      message: "The verification code has expired. Please request a new one.",
    };
  }

  const codeMatchesPlaintext =
    typeof user.emailVerificationCode === "string" &&
    user.emailVerificationCode === code;
  const codeMatchesHash =
    typeof user.emailVerificationCodeHash === "string" &&
    user.emailVerificationCodeHash ===
      hashEmailVerificationCode(normalizedEmail, code);

  if (!codeMatchesPlaintext && !codeMatchesHash) {
    user.emailVerificationAttempts += 1;

    if (user.emailVerificationAttempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
      user.emailVerificationCode = null;
      user.emailVerificationCodeHash = null;
      user.emailVerificationExpiresAt = null;
      user.emailVerificationAttempts = 0;
      await user.save();

      return {
        ok: false,
        status: 400,
        code: "EMAIL_OTP_LOCKED",
        message: "Too many incorrect attempts. Please request a new code.",
      };
    }

    await user.save();

    return {
      ok: false,
      status: 400,
      code: "EMAIL_OTP_INVALID",
      message: "The verification code is incorrect.",
    };
  }

  const isNewUser = !isEmailVerified(user);

  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerificationCode = null;
  user.emailVerificationCodeHash = null;
  user.emailVerificationExpiresAt = null;
  user.emailVerificationAttempts = 0;

  if (!user.authProviders.includes("email")) {
    user.authProviders = [...user.authProviders, "email"];
  }

  if (onboardingCompleted !== undefined) {
    user.onboardingCompleted = onboardingCompleted;
  }

  await user.save();

  const tokens = await issueTokens(user);

  return {
    ok: true,
    tokens,
    user: buildUserPayload(user),
    isNewUser,
  };
};

const signInWithEmail = async ({
  email,
  password,
  onboardingCompleted,
}: SignInWithEmailInput): Promise<
  | AuthSuccess<{
      tokens: AuthTokens;
      user: ReturnType<typeof buildUserPayload>;
    }>
  | AuthFailure
> => {
  const normalizedEmail = normalizeEmail(email);
  const user = await userModel.findOne({ email: normalizedEmail });
  const storedPasswordHash = user ? getStoredPasswordHash(user) : null;

  if (!user || !storedPasswordHash || !verifyPasswordHash(password, storedPasswordHash)) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "The email or password is incorrect.",
    };
  }

  if (!isEmailVerified(user)) {
    return {
      ok: false,
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
      message: "Please verify your email before signing in.",
    };
  }

  if (!user.authProviders.includes("email")) {
    user.authProviders = [...user.authProviders, "email"];
  }

  if (onboardingCompleted) {
    user.onboardingCompleted = true;
  }

  await user.save();

  const tokens = await issueTokens(user);

  return {
    ok: true,
    tokens,
    user: buildUserPayload(user),
  };
};

const signInWithGoogle = async (
  input: GoogleOAuthInput
): Promise<
  | AuthSuccess<{
      tokens: AuthTokens;
      user: ReturnType<typeof buildUserPayload>;
    }>
  | AuthFailure
> => {
  let googleProfile: VerifiedGoogleProfile | null = null;

  try {
    googleProfile = await verifyGoogleIdTokenImpl(input.idToken);
  } catch (error) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_GOOGLE_ID_TOKEN",
      message: "Unable to verify the Google sign-in token.",
    };
  }

  if (!googleProfile?.googleSub) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_GOOGLE_ID_TOKEN",
      message: "Unable to verify the Google sign-in token.",
    };
  }

  const normalizedEmail = googleProfile.email
    ? normalizeEmail(googleProfile.email)
    : null;
  const normalizedOnboardingContext = sanitizeOnboardingContext(
    input.onboardingContext
  );
  const onboardingGoals = normalizedOnboardingContext?.goals || [];
  googleProfile = {
    ...googleProfile,
    email: normalizedEmail,
  };

  let user = await userModel.findOne({ googleUserId: googleProfile.googleSub });

  if (!user && normalizedEmail) {
    user = await userModel.findOne({ email: normalizedEmail });

    if (
      user &&
      user.googleUserId &&
      user.googleUserId !== googleProfile.googleSub
    ) {
      return {
        ok: false,
        status: 409,
        code: "GOOGLE_ACCOUNT_ALREADY_LINKED",
        message: "This email is already linked to another Google account.",
      };
    }
  }

  if (!user) {
    user = await createGoogleUser({
      googleProfile,
      ...(input.onboardingContext
        ? { onboardingContext: input.onboardingContext }
        : {}),
      onboardingCompleted: input.onboardingCompleted,
    });
  } else {
    if (!user.authProviders.includes("google")) {
      user.authProviders = [...user.authProviders, "google"];
    }

    if (!user.name && googleProfile.name) {
      user.name = googleProfile.name;
    }

    if (!user.name && normalizedEmail) {
      user.name = deriveDisplayNameFromEmail(normalizedEmail);
    }

    if (!user.email && normalizedEmail) {
      user.email = normalizedEmail;
    }

    user.googleUserId = googleProfile.googleSub;
    user.profilePic = googleProfile.picture || user.profilePic || null;

    if (normalizedOnboardingContext) {
      user.onboardingContext = normalizedOnboardingContext;
    }

    if (onboardingGoals.length > 0) {
      user.journalingGoals = onboardingGoals;
    }

    if (googleProfile.emailVerified) {
      user.emailVerified = true;
      user.emailVerifiedAt = user.emailVerifiedAt || new Date();
    }

    if (input.onboardingCompleted) {
      user.onboardingCompleted = true;
    }

    await user.save();
  }

  const tokens = await issueTokens(user);

  return {
    ok: true,
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

const invalidateRefreshToken = async (userId: string) => {
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
  resetGoogleIdTokenVerifierForTests,
  resendEmailVerification,
  resendOtp,
  sendOtp,
  setGoogleIdTokenVerifierForTests,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  verifyEmail,
  verifyOtp,
};
