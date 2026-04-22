import { ApiError, request } from "../utils/apiClient";

type AuthUser = {
  userId: string;
  name: string;
  phoneNumber: string | null;
  email: string | null;
  isPremium?: boolean;
  premiumPlanKey?: "weekly" | "monthly" | "yearly" | "lifetime" | null;
  premiumActivatedAt?: string | null;
  journalingGoals: string[];
  avatarColor: string | null;
  profileSetupCompleted: boolean;
  onboardingCompleted: boolean;
  profilePic: string | null;
  aiOptIn: boolean | null;
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
  onboardingAiOptIn?: boolean;
  onboardingCompleted?: boolean;
};

type SignInWithEmailPayload = {
  email: string;
  password: string;
  onboardingCompleted?: boolean;
};

type GoogleSignInPayload = {
  idToken: string;
  onboardingContext?: AuthOnboardingContext;
  onboardingCompleted?: boolean;
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

const applyDevPremiumDefault = <T extends AuthUser | AuthSession>(value: T): T => {
  if (!__DEV__) {
    return value;
  }

  if ("user" in value) {
    return {
      ...value,
      user: {
        ...value.user,
        isPremium: value.user.isPremium ?? false,
      },
    };
  }

  return {
    ...value,
    isPremium: value.isPremium ?? false,
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
  aiOptIn?: boolean | null;
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
      isPremium: false,
      premiumPlanKey: null,
      premiumActivatedAt: null,
      journalingGoals: payload.goals || [],
      avatarColor:
        payload.avatarColor === undefined ? null : payload.avatarColor,
      profileSetupCompleted: payload.profileSetupCompleted ?? false,
      onboardingCompleted: payload.onboardingCompleted ?? false,
      profilePic: payload.profilePic ?? null,
      aiOptIn: payload.aiOptIn ?? true,
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

    return applyDevPremiumDefault(response.data);
  } catch (error) {
    if (!shouldUseDevNetworkFallback(error)) {
      throw error;
    }

    return createMockSession({
      email: payload.email,
      name: deriveDisplayNameFromEmail(payload.email),
      goals: options.onboardingGoals || [],
      aiOptIn:
        typeof options.onboardingAiOptIn === "boolean"
          ? options.onboardingAiOptIn
          : true,
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

    return applyDevPremiumDefault(response.data);
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
  const response = await request<AuthSession>("/auth/google/mobile", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return applyDevPremiumDefault(response.data);
};

const logout = async () => {
  await request<{}>("/auth/logout", {
    method: "POST",
  });
};

export {
  applyDevPremiumDefault,
  resendEmailVerification,
  logout,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  verifyEmail,
};
export type {
  AuthOnboardingContext,
  AuthSession,
  AuthUser,
  EmailVerificationChallenge,
  GoogleSignInPayload,
  ResendEmailVerificationPayload,
  SignInWithEmailPayload,
  SignUpWithEmailPayload,
  VerifyEmailOptions,
  VerifyEmailPayload,
};
