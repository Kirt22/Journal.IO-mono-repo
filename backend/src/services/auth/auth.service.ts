import crypto from "crypto";
import jwt from "jsonwebtoken";
import { IUser, userModel } from "../../schema/user.schema";

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
};

type GoogleOAuthInput = {
  googleIdToken: string;
  googleUserId?: string;
  email: string;
  name: string;
  profilePic?: string;
};

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
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

const normalizePhoneNumber = (phoneNumber: string): string => {
  return phoneNumber.replace(/[^\d+]/g, "");
};

const generateOtp = (): string => {
  const digits = Array.from({ length: OTP_LENGTH }, () =>
    crypto.randomInt(0, 10).toString()
  );
  return digits.join("");
};

const generateRefreshToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

const hashRefreshToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const buildUserPayload = (user: IUser) => {
  return {
    userId: user._id,
    name: user.name,
    phoneNumber: user.phoneNumber || null,
    email: user.email || null,
    profilePic: user.profilePic || null,
  };
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
}: {
  phoneNumber: string;
  name: string;
}) => {
  try {
    return await userModel.create({
      name,
      phoneNumber,
      authProviders: ["phone"],
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

  otpStore.set(normalizedPhoneNumber, {
    code,
    expiresAt: Date.now() + getOtpExpiryMs(),
    attempts: 0,
  });

  console.log(`OTP generated for ${normalizedPhoneNumber}: ${code}`);

  return {
    phoneNumber: normalizedPhoneNumber,
    expiresInSeconds: Math.floor(getOtpExpiryMs() / 1000),
    debugOtp: process.env.NODE_ENV === "production" ? undefined : code,
  };
};

const verifyOtp = async ({ phoneNumber, otp, name }: VerifyOtpInput) => {
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

  otpStore.delete(normalizedPhoneNumber);

  let user = await userModel.findOne({ phoneNumber: normalizedPhoneNumber });

  if (!user && !name) {
    return {
      ok: false as const,
      code: "NAME_REQUIRED",
      message: "A name is required to create a new account.",
    };
  }

  if (!user && name) {
    user = await createPhoneUser({
      phoneNumber: normalizedPhoneNumber,
      name,
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
    await user.save();
  }

  const tokens = await issueTokens(user);

  return {
    ok: true as const,
    tokens,
    user: buildUserPayload(user),
    isNewUser: Boolean(name && !user.lastLoginAt),
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
  sendOtp,
  signInWithGoogle,
  verifyOtp,
};
