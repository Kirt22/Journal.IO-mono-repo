import { ApiError, request } from "../utils/apiClient";

type AuthUser = {
  userId: string;
  name: string;
  phoneNumber: string | null;
  email: string | null;
  journalingGoals: string[];
  avatarColor: string | null;
  profileSetupCompleted: boolean;
  onboardingCompleted: boolean;
  profilePic: string | null;
};

type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type AuthOnboardingContext = {
  ageRange?: string;
  journalingExperience?: string;
  goals?: string[];
  supportFocus?: string[];
  reminderPreference?: string;
  aiOptIn?: boolean;
  privacyConsentAccepted?: boolean;
};

type EmailVerificationChallenge = {
  email: string;
  verificationRequired: boolean;
  expiresInSeconds: number;
  verificationCode?: string;
};

type SignUpWithEmailPayload = {
  email: string;
  password: string;
  onboardingContext?: AuthOnboardingContext;
  onboardingCompleted?: boolean;
};

type ResendEmailVerificationPayload = {
  email: string;
};

type VerifyEmailPayload = {
  email: string;
  code: string;
};

type VerifyEmailOptions = {
  onboardingGoals?: string[];
  onboardingCompleted?: boolean;
};

type SignInWithEmailPayload = {
  email: string;
  password: string;
  onboardingCompleted?: boolean;
};

type GoogleSignInPayload = {
  googleIdToken: string;
  googleUserId?: string;
  email: string;
  name: string;
  profilePic?: string;
  onboardingCompleted?: boolean;
};

type SendOtpResponse = {
  phoneNumber: string;
  expiresInSeconds: number;
  debugOtp?: string;
};

type VerifyOtpResponse = AuthSession & {
  isNewUser: boolean;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

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

const buildUserId = (email: string) => {
  const slug = normalizeEmail(email)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug ? `user-${slug}` : "user-journal";
};

const buildMockTokens = (email: string) => {
  const tokenSeed = normalizeEmail(email).replace(/[^a-z0-9]/g, "");

  return {
    accessToken: `mock-access-${tokenSeed || "journal"}`,
    refreshToken: `mock-refresh-${tokenSeed || "journal"}`,
  };
};

const createMockSession = (payload: {
  email: string;
  name?: string;
  goals?: string[];
  avatarColor?: string | null;
  profileSetupCompleted?: boolean;
  onboardingCompleted?: boolean;
  profilePic?: string | null;
}): AuthSession => {
  const email = normalizeEmail(payload.email);
  const tokens = buildMockTokens(email);

  return {
    ...tokens,
    user: {
      userId: buildUserId(email),
      name: payload.name?.trim() || deriveDisplayNameFromEmail(email),
      phoneNumber: null,
      email,
      journalingGoals: payload.goals || [],
      avatarColor:
        payload.avatarColor === undefined ? null : payload.avatarColor,
      profileSetupCompleted: payload.profileSetupCompleted ?? false,
      onboardingCompleted: payload.onboardingCompleted ?? false,
      profilePic: payload.profilePic ?? null,
    },
  };
};

const shouldUseDevNetworkFallback = (error: unknown) =>
  __DEV__ && error instanceof ApiError && error.isNetworkError;

const signUpWithEmail = async (payload: SignUpWithEmailPayload) => {
  const response = await request<EmailVerificationChallenge>(
    "/auth/sign_up_with_email",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  return response.data;
};

const resendEmailVerification = async (
  payload: ResendEmailVerificationPayload
) => {
  const response = await request<EmailVerificationChallenge>(
    "/auth/resend_email_verification",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  return response.data;
};

const verifyEmail = async (
  payload: VerifyEmailPayload,
  options: VerifyEmailOptions = {}
) => {
  try {
    const response = await request<AuthSession>("/auth/verify_email", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        onboardingCompleted: options.onboardingCompleted ?? false,
      }),
    });

    return response.data;
  } catch (error) {
    if (!shouldUseDevNetworkFallback(error)) {
      throw error;
    }

    return createMockSession({
      email: payload.email,
      name: deriveDisplayNameFromEmail(payload.email),
      goals: options.onboardingGoals || [],
      profileSetupCompleted: false,
      onboardingCompleted: options.onboardingCompleted ?? true,
    });
  }
};

const signInWithEmail = async (payload: SignInWithEmailPayload) => {
  try {
    const response = await request<AuthSession>("/auth/sign_in_with_email", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return response.data;
  } catch (error) {
    if (!shouldUseDevNetworkFallback(error)) {
      throw error;
    }

    return createMockSession({
      email: payload.email,
      name: deriveDisplayNameFromEmail(payload.email),
      goals: [],
      avatarColor: "#8E4636",
      profileSetupCompleted: true,
      onboardingCompleted: true,
    });
  }
};

const signInWithGoogle = async (payload: GoogleSignInPayload) => {
  try {
    const response = await request<AuthSession>("/auth/register_from_googleOAuth", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return response.data;
  } catch (error) {
    if (!shouldUseDevNetworkFallback(error)) {
      throw error;
    }

    return createMockSession({
      email: payload.email,
      name: payload.name,
      goals: [],
      avatarColor: null,
      profilePic: payload.profilePic || null,
      profileSetupCompleted: false,
      onboardingCompleted: true,
    });
  }
};

const sendOtp = async (payload: { phoneNumber: string }) => {
  const response = await request<SendOtpResponse>("/auth/send_otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
};

const resendOtp = async (payload: { phoneNumber: string }) => {
  try {
    const response = await request<SendOtpResponse>("/auth/resend_otp", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return response.data;
  } catch {
    return sendOtp(payload);
  }
};

const verifyOtp = async (payload: {
  phoneNumber: string;
  otp: string;
  name?: string;
  goals?: string[];
  onboardingCompleted?: boolean;
}) => {
  const response = await request<VerifyOtpResponse>("/auth/verify_otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
};

export {
  resendEmailVerification,
  resendOtp,
  sendOtp,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  verifyEmail,
  verifyOtp,
};
export type {
  AuthOnboardingContext,
  AuthSession,
  AuthUser,
  EmailVerificationChallenge,
  GoogleSignInPayload,
  ResendEmailVerificationPayload,
  SendOtpResponse,
  SignInWithEmailPayload,
  SignUpWithEmailPayload,
  VerifyEmailOptions,
  VerifyEmailPayload,
  VerifyOtpResponse,
};
